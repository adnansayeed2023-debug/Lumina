// GET /api/usage — the visitor's plan, limits and how much is used in this window.
import { deviceOf, getState } from '../lib/account.js';

export default async function handler(req, res) {
  const device = deviceOf(req);
  if (!device) return res.status(400).json({ error: 'no device' });
  try { return res.status(200).json(await getState(device)); }
  catch (e) { return res.status(500).json({ error: 'error' }); }
}
