// Webhook da Yampi: conta os pares do lançamento a cada pedido pago.
// Só conta pedidos assinados com YAMPI_WEBHOOK_SECRET (HMAC SHA256 em base64, header X-Yampi-Hmac-SHA256).
const crypto = require('crypto');
const { cmd, pipe, readRaw } = require('./_lib/kv');

// Código do link de compra (token do SKU na Yampi) e sufixo do código Ray-Ban de cada cor
const TOKENS = { P383GE83XH: 'mg', PC3CFCG8KG: 'm1', NVPX5ZAC4J: 'mh' };
const NAMES = { mg: 'Âmbar', m1: 'Esmeralda', mh: 'Ametista' };
const CANCEL = /cancel|refund|estorn|devol|refus|recus|chargeback/i;

function phpJson(o) {
  return JSON.stringify(o).replace(/\//g, '\\/').replace(/[\u0080-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function validSig(raw, sig, secret) {
  if (!sig) return false;
  const given = Buffer.from(String(sig).trim());
  const bodies = [raw];
  try { const o = JSON.parse(raw); bodies.push(JSON.stringify(o), phpJson(o)); } catch (e) {}
  return bodies.some(b => {
    const h = Buffer.from(crypto.createHmac('sha256', secret).update(b, 'utf8').digest('base64'));
    return h.length === given.length && crypto.timingSafeEqual(h, given);
  });
}

function colorOf(item) {
  const sku = (item.sku && item.sku.data) || {};
  const tok = String(sku.token || item.sku_token || '').toUpperCase();
  if (TOKENS[tok]) return TOKENS[tok];
  const txt = [item.item_sku, sku.sku, sku.title, item.name, item.product_name, sku.title_full].filter(Boolean).join(' ');
  if (!/3791/.test(txt)) return null;
  const u = txt.toUpperCase();
  if (/001\/?MG|\bMG\b|ÂMBAR|AMBAR|AREIA/.test(u)) return 'mg';
  if (/003\/?M1|\bM1\b|ESMERALDA|NÉVOA|NEVOA/.test(u)) return 'm1';
  if (/001\/?MH|\bMH\b|AMETISTA|LILÁS|LILAS/.test(u)) return 'mh';
  return 'outro';
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 200, { ok: true });
  const raw = await readRaw(req);
  const secret = process.env.YAMPI_WEBHOOK_SECRET;
  // Antes de a chave estar configurada, responde 200 para a Yampi conseguir salvar o webhook, mas não conta nada
  if (!secret) return send(res, 200, { ok: false, reason: 'secret-not-set' });
  if (!validSig(raw, req.headers['x-yampi-hmac-sha256'], secret)) return send(res, 401, { ok: false });

  let body;
  try { body = JSON.parse(raw); } catch (e) { return send(res, 200, { ok: true, ignored: 'json' }); }
  const ev = String(body.event || '');
  const o = body.resource || {};
  const id = String(o.id || o.number || '');
  if (!id) return send(res, 200, { ok: true, ignored: 'no-order' });

  try {
    const status = String((o.status && o.status.data && o.status.data.alias) || '');
    const prev = await cmd(['HGET', 'orders', id]);

    if (CANCEL.test(ev) || CANCEL.test(status)) {
      if (!prev) return send(res, 200, { ok: true, ignored: 'not-counted' });
      const p = JSON.parse(prev);
      const list = [['HDEL', 'orders', id], ['DECRBY', 'sold', p.q]];
      Object.keys(p.c).forEach(k => list.push(['HINCRBY', 'soldc', k, -p.c[k]]));
      list.push(['LPUSH', 'sales', JSON.stringify({ id: o.number || id, q: -p.q, c: p.c, at: Date.now(), x: 'cancelado' })], ['LTRIM', 'sales', 0, 99]);
      await pipe(list);
      return send(res, 200, { ok: true, removed: p.q });
    }

    const paid = ev === 'order.paid' || /paid|aprov|pago|invoiced|faturad|shipped|enviad|deliver|entreg/i.test(status);
    if (!paid || prev) return send(res, 200, { ok: true, ignored: prev ? 'dup' : 'not-paid' });

    const items = (o.items && o.items.data) || o.items || [];
    const c = {}; let q = 0;
    (Array.isArray(items) ? items : []).forEach(it => {
      const k = colorOf(it); if (!k) return;
      const n = Math.max(1, parseInt(it.quantity, 10) || 1);
      c[k] = (c[k] || 0) + n; q += n;
    });
    if (!q) return send(res, 200, { ok: true, ignored: 'no-launch-items' });

    const set = await cmd(['HSETNX', 'orders', id, JSON.stringify({ q, c })]);
    if (!set) return send(res, 200, { ok: true, ignored: 'dup' });
    const list = [['INCRBY', 'sold', q]];
    Object.keys(c).forEach(k => list.push(['HINCRBY', 'soldc', k, c[k]]));
    list.push(['LPUSH', 'sales', JSON.stringify({ id: o.number || id, q, c, at: Date.now() })], ['LTRIM', 'sales', 0, 99]);
    await pipe(list);
    return send(res, 200, { ok: true, added: q, colors: Object.keys(c).map(k => NAMES[k] || k) });
  } catch (e) {
    return send(res, 500, { ok: false });
  }
};
