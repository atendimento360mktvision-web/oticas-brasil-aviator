// Proteções comuns das APIs: origem permitida, IP anônimo (hash), limite de tamanho e de frequência
const crypto = require('crypto');
const { cmd } = require('./kv');

const HOSTS = [/^oticas-brasil-aviator\.vercel\.app$/, /^oticas-brasil-aviator-[a-z0-9-]+-marketing-vision\.vercel\.app$/, /^localhost(:\d+)?$/];

function hostOf(u) { try { return new URL(u).host; } catch (e) { return ''; } }

// Aceita só chamadas feitas pela própria página (bloqueia outros sites e scripts simples)
function sameSite(req) {
  const o = req.headers.origin || req.headers.referer || '';
  const h = hostOf(o);
  return !!h && HOSTS.some(r => r.test(h));
}

// Nunca guardamos o IP: só um hash curto com sal, que serve para limitar abusos
function ipKey(req) {
  const ip = String(req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket && req.socket.remoteAddress || '').trim();
  if (!ip) return '';
  const salt = process.env.PAINEL_TOKEN || 'ob';
  return crypto.createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 16);
}

// Lê o corpo com limite de tamanho; acima disso devolve null
function readLimited(req, max) {
  return new Promise((resolve) => {
    if (typeof req.body === 'string') return resolve(req.body.length > max ? null : req.body);
    if (Buffer.isBuffer(req.body)) return resolve(req.body.length > max ? null : req.body.toString('utf8'));
    if (req.body && typeof req.body === 'object') { const s = JSON.stringify(req.body); return resolve(s.length > max ? null : s); }
    const len = parseInt(req.headers['content-length'] || '0', 10);
    if (len > max) return resolve(null);
    const chunks = []; let size = 0, done = false;
    req.on('data', c => { if (done) return; size += c.length; if (size > max) { done = true; resolve(null); return; } chunks.push(c); });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', () => { if (!done) { done = true; resolve(null); } });
  });
}

// Limite de chamadas por IP numa janela de tempo. Retorna true se passou do limite.
// peek=true só consulta, sem somar
async function limited(name, ip, max, windowSec, peek) {
  if (!ip) return false;
  const k = 'rl:' + name + ':' + ip + ':' + Math.floor(Date.now() / 1000 / windowSec);
  if (peek) return Number(await cmd(['GET', k]) || 0) >= max;
  const r = await cmd(['EVAL', "local c=redis.call('INCR',KEYS[1]) if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end return c", 1, k, windowSec * 2]);
  return Number(r) > max;
}

function deny(res, code) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end('{}');
}

module.exports = { sameSite, ipKey, readLimited, limited, deny };
