// Dados do painel. Protegido pela chave PAINEL_TOKEN (header x-k).
const crypto = require('crypto');
const { cmd, pipe, brt, readRaw } = require('./_lib/kv');
const { addOrder } = require('./_lib/sales');

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function hgetall(arr) {
  const o = {};
  for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = Number(arr[i + 1]) || 0;
  return o;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const key = process.env.PAINEL_TOKEN;
  if (!key || !same(req.headers['x-k'] || '', key)) { res.statusCode = 401; return res.end('{}'); }
  // Registro manual de um pedido pago (para pedidos que chegaram antes do webhook funcionar)
  if (req.method === 'POST') {
    try {
      const b = JSON.parse(await readRaw(req) || '{}');
      const c = {};
      ['mg', 'm1', 'mh'].forEach(k => { const n = parseInt(b.c && b.c[k], 10); if (n > 0 && n < 50) c[k] = n; });
      if (!b.id || !Object.keys(c).length) { res.statusCode = 400; return res.end('{}'); }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(await addOrder(String(b.id).slice(0, 30), String(b.number || b.id).slice(0, 30), c)));
    } catch (e) { res.statusCode = 500; return res.end('{}'); }
  }
  try {
    const now = Date.now();
    const days = [];
    for (let i = 0; i < 7; i++) days.push(brt(now - i * 86400000).day);
    const today = days[0];
    const list = [
      ['ZCOUNT', 'live', now - 70000, '+inf'],
      ['GET', 'sold'],
      ['HGETALL', 'soldc'],
      ['LRANGE', 'sales', 0, 19],
      ['HGETALL', 'h:' + today],
      ['ZRANGEBYSCORE', 'live', now - 70000, '+inf', 'LIMIT', 0, 1000],
      ['HGETALL', 'c:' + today],
      ['LRANGE', 'whlog', 0, 9]
    ];
    const B = list.length;
    days.forEach(d => { list.push(['HGETALL', 'd:' + d]); list.push(['PFCOUNT', 'uv:' + d]); });
    const r = await pipe(list);
    const members = r[5] || [];
    const geos = members.length ? (await cmd(['HMGET', 'lg', ...members])) : [];
    const online = {};
    geos.forEach(g => { const k = g || 'Desconhecida||||'; online[k] = (online[k] || 0) + 1; });
    const toCity = (k, n) => { const p = k.split('|'); return { city: p[0] || 'Desconhecida', uf: p[1] || '', cc: p[2] || '', lat: p[3] === '' || p[3] === undefined ? null : Number(p[3]), lon: p[4] === '' || p[4] === undefined ? null : Number(p[4]), n: Number(n) || 0 }; };
    const out = {
      now, today,
      live: Number(r[0]) || 0,
      sold: Number(r[1]) || 0,
      soldByColor: hgetall(r[2]),
      sales: (r[3] || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean),
      hours: hgetall(r[4]),
      online: Object.keys(online).map(k => toCity(k, online[k])).sort((a, b) => b.n - a.n),
      hook: (r[7] || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean),
      cities: Object.entries(hgetall(r[6])).map(([k, n]) => toCity(k, n)).sort((a, b) => b.n - a.n).slice(0, 60),
      days: days.map((d, i) => Object.assign({ day: d, uv: Number(r[B + 1 + i * 2]) || 0 }, hgetall(r[B + i * 2])))
    };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
};
