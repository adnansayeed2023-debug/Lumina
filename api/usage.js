// GET /api/usage — the visitor's plan, limits and how much is used in this window.
import { whoOf, getState } from '../lib/account.js';

export default async function handler(req, res) {
  const w = await whoOf(req);
  if (!w.id) return res.status(400).json({ error: 'no device' });
  try { const st = await getState(w.id, w.device); st.user = w.user ? { name: w.user.name, email: w.user.email, picture: w.user.picture } : null; return res.status(200).json(st); }
  catch (e) { return res.status(500).json({ error: 'error' }); }
}
