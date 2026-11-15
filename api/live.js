// Contador ao vivo e eventos da página.
// POST {v:id do visitante, t:'pv'|'hb'|'ev', e:nome do evento}
// Resposta para pv/hb: {live: pessoas na página agora, sold: pares vendidos no lançamento}
const { cmd, brt, readRaw } = require('./_lib/kv');

const WINDOW = 70 * 1000; // quem mandou sinal nos últimos 70 s está na página
const EVENTS = new Set(['cor_mg', 'cor_m1', 'cor_mh', 'cart', 'buy', 'wa', 'story', 'video']);

// Tudo numa chamada só ao Redis, para gastar um comando por sinal
const SCRIPT = `
local now=tonumber(ARGV[1]); local v=ARGV[2]; local day=ARGV[3]; local hour=ARGV[4]
redis.call('ZADD','live',now,v)
if ARGV[6]=='1' then redis.call('ZREMRANGEBYSCORE','live',0,now-600000) end
local n=redis.call('ZCOUNT','live',now-${WINDOW},'+inf')
local pk=tonumber(redis.call('HGET','d:'..day,'peak') or '0')
if n>pk then redis.call('HSET','d:'..day,'peak',n) end
if ARGV[5]=='1' then
  redis.call('PFADD','uv:'..day,v)
  redis.call('HINCRBY','d:'..day,'pv',1)
  redis.call('HINCRBY','h:'..day,hour,1)
end
local s=tonumber(redis.call('GET','sold') or '0')
return {n,s}`;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    let b = {};
    try { b = JSON.parse(await readRaw(req) || '{}'); } catch (e) { b = {}; }
    const v = String(b.v || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    if (v.length < 8) { res.statusCode = 400; return res.end(); }
    const { day, hour } = brt();

    if (b.t === 'ev') {
      const e = String(b.e || '');
      if (EVENTS.has(e)) await cmd(['HINCRBY', 'd:' + day, 'ev_' + e, 1]);
      res.statusCode = 204; return res.end();
    }

    const pv = b.t === 'pv' ? '1' : '0';
    const clean = Math.random() < 0.05 ? '1' : '0';
    const r = await cmd(['EVAL', SCRIPT, 0, Date.now(), v, day, hour, pv, clean]);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ live: Number(r[0]) || 0, sold: Number(r[1]) || 0 }));
  } catch (e) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ live: 0, sold: 0, off: true }));
  }
};
