// Registro de vendas do lançamento (usado pelo webhook da Yampi e pelo registro manual do painel)
const { cmd, pipe } = require('./kv');

async function addOrder(id, number, c) {
  const q = Object.values(c).reduce((a, b) => a + b, 0);
  if (!q) return { ok: true, ignored: 'no-launch-items' };
  const set = await cmd(['HSETNX', 'orders', String(id), JSON.stringify({ q, c, n: String(number || id) })]);
  if (!set) return { ok: true, ignored: 'dup' };
  const list = [['INCRBY', 'sold', q]];
  Object.keys(c).forEach(k => list.push(['HINCRBY', 'soldc', k, c[k]]));
  list.push(['LPUSH', 'sales', JSON.stringify({ id: number || id, q, c, at: Date.now() })], ['LTRIM', 'sales', 0, 99]);
  await pipe(list);
  return { ok: true, added: q };
}

async function removeOrder(id, number) {
  const prev = await cmd(['HGET', 'orders', String(id)]);
  if (!prev) return { ok: true, ignored: 'not-counted' };
  const p = JSON.parse(prev);
  const list = [['HDEL', 'orders', String(id)], ['DECRBY', 'sold', p.q]];
  Object.keys(p.c).forEach(k => list.push(['HINCRBY', 'soldc', k, -p.c[k]]));
  list.push(['LPUSH', 'sales', JSON.stringify({ id: number || p.n || id, q: -p.q, c: p.c, at: Date.now(), x: 'cancelado' })], ['LTRIM', 'sales', 0, 99]);
  await pipe(list);
  return { ok: true, removed: p.q };
}

// Histórico curto das chamadas do webhook, sem dados de cliente, para diagnóstico no painel
async function logHook(entry) {
  try { await pipe([['LPUSH', 'whlog', JSON.stringify(Object.assign({ at: Date.now() }, entry))], ['LTRIM', 'whlog', 0, 29]]); } catch (e) {}
}

module.exports = { addOrder, removeOrder, logHook };
