// Acesso ao Upstash Redis pela API REST (variáveis criadas pela integração na Vercel)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function call(path, body) {
  if (!URL_ || !TOKEN) throw new Error('kv-not-configured');
  const r = await fetch(URL_.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok) throw new Error('kv-' + r.status + ':' + (j && j.error));
  return j;
}

// Um comando: cmd(['GET','x'])
async function cmd(args) {
  const j = await call('', args);
  if (j.error) throw new Error(j.error);
  return j.result;
}

// Vários comandos numa ida só: pipe([['GET','a'],['GET','b']])
async function pipe(list) {
  const j = await call('/pipeline', list);
  return j.map(x => (x && x.error) ? null : x.result);
}

// Data e hora de Brasília (UTC-3, sem horário de verão)
function brt(ts) {
  const d = new Date((ts || Date.now()) - 3 * 3600 * 1000);
  return { day: d.toISOString().slice(0, 10), hour: d.toISOString().slice(11, 13) };
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    if (typeof req.body === 'string') return resolve(req.body);
    if (Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = { cmd, pipe, brt, readRaw };
