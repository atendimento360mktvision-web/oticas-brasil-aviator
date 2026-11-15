// Dados do painel. Protegido pela chave PAINEL_TOKEN (header x-k).
const crypto = require('crypto');
const { pipe, brt } = require('./_lib/kv');

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
      ['HGETALL', 'h:' + today]
    ];
    days.forEach(d => { list.push(['HGETALL', 'd:' + d]); list.push(['PFCOUNT', 'uv:' + d]); });
    const r = await pipe(list);
    const out = {
      now, today,
      live: Number(r[0]) || 0,
      sold: Number(r[1]) || 0,
      soldByColor: hgetall(r[2]),
      sales: (r[3] || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean),
      hours: hgetall(r[4]),
      days: days.map((d, i) => Object.assign({ day: d, uv: Number(r[6 + i * 2]) || 0 }, hgetall(r[5 + i * 2])))
    };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
};
