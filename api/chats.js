// /api/chats — saved chats for a signed-in account (GET to read, PUT {chats} to save). Not available without sign-in.
import { whoOf } from '../lib/account.js';
import { kget, kset } from '../lib/store.js';

export default async function handler(req, res) {
  const w = await whoOf(req);
  if (!w.user) return res.status(401).json({ error: 'sign in' });
  const key = 'chats:' + w.id;
  if (req.method === 'GET') return res.status(200).json({ chats: (await kget(key)) || [] });
  if (req.method !== 'PUT' && req.method !== 'POST') return res.status(405).json({ error: 'GET or PUT' });
  let chats = Array.isArray((req.body || {}).chats) ? req.body.chats.slice(0, 40) : [];
  chats = chats.filter(c => c && typeof c.id === 'string').map(c => ({
    id: c.id.slice(0, 40), title: String(c.title || '').slice(0, 80), ts: +c.ts || 0, mode: c.mode || null, subj: c.subj || null, lvl: c.lvl ?? null,
    msgs: (Array.isArray(c.msgs) ? c.msgs : []).slice(-40).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 8000), view: m.view ? String(m.view).slice(0, 2000) : undefined }))
  }));
  while (chats.length > 1 && JSON.stringify(chats).length > 800000) chats.pop();
  await kset(key, chats);
  return res.status(200).json({ ok: true, n: chats.length });
}
