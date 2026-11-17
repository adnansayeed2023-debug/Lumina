// /api/share — share a conversation as a link.
// POST {title, msgs:[{role, content}]} -> {id}   (stored 180 days)
// GET  ?id=XXXX -> {title, msgs, at}
import crypto from 'node:crypto';
import { deviceOf, bdDay } from '../lib/account.js';
import { kget, kset } from '../lib/store.js';

const TTL = 180 * 86400, PER_DAY = 30;
const ALPH = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const id = String(req.query?.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    if (!id) return res.status(400).json({ error: 'no id' });
    const s = await kget('share:' + id);
    if (!s) return res.status(404).json({ error: 'not found' });
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(s);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  const device = deviceOf(req); if (!device) return res.status(400).json({ error: 'no device' });
  const body = req.body || {};
  const msgs = (Array.isArray(body.msgs) ? body.msgs : []).slice(-40)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 20000) }));
  if (!msgs.some(m => m.role === 'assistant')) return res.status(400).json({ error: 'empty' });
  if (JSON.stringify(msgs).length > 200000) return res.status(413).json({ error: 'too big' });
  const dk = 'sharecount:' + device + ':' + bdDay(), n = (await kget(dk)) || 0;
  if (n >= PER_DAY) return res.status(429).json({ error: 'limit' });
  let id = '';
  for (let i = 0; i < 4; i++) {
    id = ''; for (const x of crypto.randomBytes(10)) id += ALPH[x % ALPH.length];
    if (!(await kget('share:' + id))) break;
  }
  const title = String(body.title || '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Al Bayan AI';
  await kset('share:' + id, { title, msgs, at: Date.now() }, TTL);
  await kset(dk, n + 1, 2 * 86400);
  return res.status(200).json({ id });
}
