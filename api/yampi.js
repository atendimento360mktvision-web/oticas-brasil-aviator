// Webhook da Yampi: conta os pares do lançamento a cada pedido pago.
// Só conta pedidos assinados com YAMPI_WEBHOOK_SECRET (HMAC SHA256 em base64, header X-Yampi-Hmac-SHA256).
const crypto = require('crypto');
const { ipKey, readLimited, limited, deny } = require('./_lib/guard');
const { addOrder, removeOrder, logHook } = require('./_lib/sales');

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
  const raw = await readLimited(req, 512 * 1024);
  if (raw === null) return deny(res, 413);
  const ip = ipKey(req);
  // Quem manda muitas chamadas com assinatura errada fica bloqueado por 15 min
  try { if (await limited('hookfail', ip, 20, 900, true)) return deny(res, 429); } catch (e) {}
  let body = null;
  try { body = JSON.parse(raw); } catch (e) {}
  const ev = String((body && body.event) || '').slice(0, 40);
  const o = (body && body.resource) || {};
  const id = String(o.id || o.number || '');
  const num = String(o.number || id).slice(0, 30);
  const reply = async (code, obj) => { await logHook({ ev, n: num, r: obj.reason || obj.ignored || (obj.added ? 'contou ' + obj.added : obj.removed ? 'descontou ' + obj.removed : (obj.ok ? 'ok' : 'erro')) }); return send(res, code, obj); };

  const secret = process.env.YAMPI_WEBHOOK_SECRET;
  // Antes de a chave estar configurada, responde 200 para a Yampi conseguir salvar o webhook, mas não conta nada
  if (!secret) return reply(200, { ok: false, reason: 'sem-chave' });
  if (!validSig(raw, req.headers['x-yampi-hmac-sha256'], secret)) {
    try { await limited('hookfail', ip, 20, 900); } catch (e) {}
    return reply(401, { ok: false, reason: 'assinatura-invalida' });
  }
  if (!body) return reply(200, { ok: true, ignored: 'json' });
  if (!id) return reply(200, { ok: true, ignored: 'sem-pedido' });

  try {
    const status = String((o.status && o.status.data && o.status.data.alias) || '');
    if (CANCEL.test(ev) || CANCEL.test(status)) return reply(200, await removeOrder(id, num));

    const paid = ev === 'order.paid' || /paid|aprov|pago|invoiced|faturad|shipped|enviad|deliver|entreg/i.test(status);
    if (!paid) return reply(200, { ok: true, ignored: 'nao-pago' });

    const items = (o.items && o.items.data) || o.items || [];
    const c = {};
    (Array.isArray(items) ? items : []).forEach(it => {
      const k = colorOf(it); if (!k) return;
      c[k] = (c[k] || 0) + Math.max(1, parseInt(it.quantity, 10) || 1);
    });
    return reply(200, await addOrder(id, num, c));
  } catch (e) {
    return reply(500, { ok: false, reason: 'erro-interno' });
  }
};
