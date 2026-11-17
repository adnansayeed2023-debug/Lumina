// POST /api/feedback {vote:'up'|'down'|'none'} — counts thumbs up / down per day (no message text is stored).
import { kget, kset } from '../lib/store.js';
import { bdDay } from '../lib/account.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const v = req.body && req.body.vote;
  if (v === 'up' || v === 'down') {
    const k = 'fb:' + bdDay() + ':' + v;
    try { await kset(k, ((await kget(k)) || 0) + 1, 60 * 86400); } catch (e) {}
  }
  return res.status(200).json({ ok: true });
}
