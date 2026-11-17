// POST /api/redeem {code} — activate a plan with a code an admin created.
import { whoOf, ipOf, redeem, getState } from '../lib/account.js';
import { kget, kset } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const W = await whoOf(req), device = W.id;
  if (!device) return res.status(400).json({ error: 'no device' });
  // slow down guessing: 10 tries per IP per hour
  const ip = ipOf(req) || 'x';
  const tries = ((await kget('redeemtries:' + ip)) || 0) + 1;
  await kset('redeemtries:' + ip, tries, 3600);
  if (tries > 10) return res.status(429).json({ error: 'too_many' });
  try {
    const r = await redeem(device, (req.body || {}).code);
    if (r.error) return res.status(400).json(r);
    return res.status(200).json({ ok: true, usage: await getState(device, W.device) });
  } catch (e) { return res.status(500).json({ error: 'error' }); }
}
