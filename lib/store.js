// Lumina storage: Upstash Redis / Vercel KV (REST) when configured, otherwise in-memory (testing only).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const mem = globalThis.__luminaMem || (globalThis.__luminaMem = new Map());

export const persistent = !!(URL_ && TOKEN);

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export async function kget(key) {
  if (persistent) { const v = await redis(['GET', key]); return v == null ? null : JSON.parse(v); }
  const v = mem.get(key); if (!v) return null;
  if (v.exp && v.exp < Date.now()) { mem.delete(key); return null; }
  return v.val;
}
export async function kset(key, val, ttlSec) {
  if (persistent) { await redis(['SET', key, JSON.stringify(val), ...(ttlSec ? ['EX', String(Math.ceil(ttlSec))] : [])]); return; }
  mem.set(key, { val, exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 });
}
export async function kdel(key) {
  if (persistent) { await redis(['DEL', key]); return; }
  mem.delete(key);
}
