// Contador ao vivo e eventos da página.
// POST {v:id do visitante, t:'pv'|'hb'|'ev', e:nome do evento}
// Resposta para pv/hb: {live: pessoas na página agora, sold: pares vendidos no lançamento}
const { cmd, brt } = require('./_lib/kv');
const { sameSite, ipKey, readLimited, deny } = require('./_lib/guard');

const WINDOW = 70 * 1000; // quem mandou sinal nos últimos 70 s está na página
const EVENTS = new Set(['cor_mg', 'cor_m1', 'cor_mh', 'cart', 'buy', 'wa', 'story', 'video']);
const RATE = 90;       // chamadas por minuto por IP (uma pessoa normal faz umas 4)
const IDS_PER_IP = 12; // visitantes diferentes por IP em 15 min (cobre Wi-Fi da loja; barra quem inventa IDs)

// Tudo numa chamada só ao Redis, para gastar um comando por sinal.
// Retorno {n, s, bloqueado}
const SCRIPT = `
local now=tonumber(ARGV[1]); local v=ARGV[2]; local day=ARGV[3]; local hour=ARGV[4]; local geo=ARGV[7]; local ip=ARGV[8]
local ok=1
if ip~='' then
  local rk='rl:live:'..ip..':'..math.floor(now/60000)
  local c=redis.call('INCR',rk); if c==1 then redis.call('EXPIRE',rk,120) end
  if c>${RATE} then return {-1,0,1} end
  local sk='ipv:'..ip
  if redis.call('SISMEMBER',sk,v)==0 then
    if redis.call('SCARD',sk)>=${IDS_PER_IP} then ok=0 else redis.call('SADD',sk,v) end
  end
  redis.call('EXPIRE',sk,900)
end
if ok==1 then
  redis.call('ZADD','live',now,v)
  if geo~='' then redis.call('HSET','lg',v,geo) end
end
if ARGV[6]=='1' then
  local old=redis.call('ZRANGEBYSCORE','live',0,now-600000,'LIMIT',0,500)
  if #old>0 then redis.call('HDEL','lg',unpack(old)); redis.call('ZREM','live',unpack(old)) end
end
local n=redis.call('ZCOUNT','live',now-${WINDOW},'+inf')
if ok==1 then
  local pk=tonumber(redis.call('HGET','d:'..day,'peak') or '0')
  if n>pk then redis.call('HSET','d:'..day,'peak',n) end
  if ARGV[5]=='1' then
    local nw=redis.call('PFADD','uv:'..day,v)
    redis.call('HINCRBY','d:'..day,'pv',1)
    redis.call('HINCRBY','h:'..day,hour,1)
    if nw==1 and geo~='' then redis.call('HINCRBY','c:'..day,geo,1) end
  end
end
local s=tonumber(redis.call('GET','sold') or '0')
return {n,s,1-ok}`;

// Evento só conta se vier de um visitante já registrado por esse IP, dentro do limite de frequência
const EV_SCRIPT = `
if ARGV[1]~='' then
  local rk='rl:live:'..ARGV[1]..':'..math.floor(tonumber(ARGV[4])/60000)
  local c=redis.call('INCR',rk); if c==1 then redis.call('EXPIRE',rk,120) end
  if c>${RATE} then return 0 end
  if redis.call('SISMEMBER','ipv:'..ARGV[1],ARGV[5])==0 then return 0 end
end
redis.call('HINCRBY',ARGV[2],ARGV[3],1)
return 1`;

// Cidade aproximada pelo IP (cabeçalhos da Vercel). Só a cidade é guardada, nunca o IP.
function geoOf(req) {
  const h = req.headers;
  const dec = x => { try { return decodeURIComponent(String(x || '')); } catch (e) { return String(x || ''); } };
  const clean = x => dec(x).replace(/[|\r\n<>"'`]/g, ' ').trim().slice(0, 60);
  const lat = parseFloat(h['x-vercel-ip-latitude']), lon = parseFloat(h['x-vercel-ip-longitude']);
  if (!isFinite(lat) || !isFinite(lon)) return '';
  return [clean(h['x-vercel-ip-city']) || 'Desconhecida', clean(h['x-vercel-ip-country-region']).slice(0, 5), clean(h['x-vercel-ip-country']).slice(0, 3), lat.toFixed(2), lon.toFixed(2)].join('|');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return deny(res, 405);
  // Só aceita chamadas feitas pela própria página
  if (!sameSite(req)) return deny(res, 403);
  // Robôs, geradores de prévia e scripts não contam como pessoas
  if (/bot|crawl|spider|headless|lighthouse|vercel|facebookexternalhit|preview|pagespeed|gtmetrix|curl|wget|python|httpclient|okhttp|axios|node-fetch|go-http/i.test(req.headers['user-agent'] || '')) {
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ live: 0, sold: 0 }));
  }
  try {
    const raw = await readLimited(req, 1024);
    if (raw === null) return deny(res, 413);
    let b;
    try { b = JSON.parse(raw || '{}'); } catch (e) { return deny(res, 400); }
    if (!b || typeof b !== 'object') return deny(res, 400);
    const v = String(b.v || '');
    if (!/^[a-z0-9]{8,32}$/i.test(v)) return deny(res, 400);
    const ip = ipKey(req);
    const { day, hour } = brt();

    if (b.t === 'ev') {
      const e = String(b.e || '');
      if (EVENTS.has(e)) await cmd(['EVAL', EV_SCRIPT, 0, ip, 'd:' + day, 'ev_' + e, Date.now(), v]);
      res.statusCode = 204; return res.end();
    }
    if (b.t !== 'pv' && b.t !== 'hb') return deny(res, 400);

    const pv = b.t === 'pv' ? '1' : '0';
    const clean = Math.random() < 0.05 ? '1' : '0';
    const r = await cmd(['EVAL', SCRIPT, 0, Date.now(), v, day, hour, pv, clean, geoOf(req), ip]);
    if (Number(r[0]) < 0) return deny(res, 429);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ live: Number(r[0]) || 0, sold: Number(r[1]) || 0 }));
  } catch (e) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ live: 0, sold: 0, off: true }));
  }
};
