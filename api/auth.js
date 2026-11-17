// /api/auth — sign in with Google so plans, usage and chats follow the person to any device.
// GET  -> { googleClientId, user }
// POST {action:'google', credential} -> verifies the Google ID token and links this device to the account
// POST {action:'logout'} -> unlinks this device
import { deviceOf, getState, getConfig, refCodeOf, addBonus, REF_BONUS, REF_MAX } from '../lib/account.js';
import { kget, kset, kdel } from '../lib/store.js';

const CLIENT_ID = () => (process.env.GOOGLE_CLIENT_ID || '').trim();

export default async function handler(req, res) {
  const device = deviceOf(req);
  if (req.method === 'GET') {
    const link = device ? await kget('link:' + device) : null;
    return res.status(200).json({ googleClientId: CLIENT_ID() || null, user: link ? { name: link.name, email: link.email, picture: link.picture } : null });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!device) return res.status(400).json({ error: 'no device' });
  const body = req.body || {};
  if (body.action === 'invite') {
    const link = await kget('link:' + device);
    if (!link || !link.sub) return res.status(401).json({ error: 'signin' });
    const acct = 'u_' + link.sub, code = await refCodeOf(acct);
    const stat = (await kget('refstat:' + acct)) || { count: 0 };
    return res.status(200).json({ code, count: stat.count || 0, bonus: (await kget('bonus:' + acct)) || 0, per: REF_BONUS });
  }
  if (body.action === 'logout') { await kdel('link:' + device); return res.status(200).json({ ok: true, usage: await getState(device) }); }
  if (body.action !== 'google') return res.status(400).json({ error: 'unknown action' });
  if (!CLIENT_ID()) return res.status(400).json({ error: 'not_configured' });
  const cred = String(body.credential || '');
  if (!cred || cred.length > 5000) return res.status(400).json({ error: 'bad token' });
  let info;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
    info = await r.json();
    if (!r.ok) return res.status(401).json({ error: 'invalid token' });
  } catch (e) { return res.status(502).json({ error: 'google unreachable' }); }
  if (info.aud !== CLIENT_ID() || !['accounts.google.com', 'https://accounts.google.com'].includes(info.iss) || !info.sub || +info.exp * 1000 < Date.now())
    return res.status(401).json({ error: 'invalid token' });
  const user = { sub: String(info.sub), email: String(info.email || '').slice(0, 120), name: String(info.name || info.email || '').slice(0, 80), picture: String(info.picture || '').slice(0, 300) };
  const acct = 'u_' + user.sub;
  // carry a plan bought on this device over to the account (if the account has none or a shorter one)
  const dp = await kget('plan:' + device), ap = await kget('plan:' + acct);
  if (dp && dp.until > Date.now() && (!ap || ap.until < dp.until)) await kset('plan:' + acct, dp);
  const isNew = !(await kget('user:' + user.sub));
  await kset('link:' + device, user);
  // referral: a brand-new account on a device that has never claimed one before -> both sides get bonus questions
  let referred = false;
  const ref = String(body.ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (isNew && ref && !(await kget('refdev:' + device))) {
    const inviter = await kget('ref:' + ref);
    if (inviter && inviter !== acct) {
      const stat = (await kget('refstat:' + inviter)) || { count: 0 };
      if ((stat.count || 0) < REF_MAX) {
        await kset('refdev:' + device, { by: inviter, at: Date.now() });
        stat.count = (stat.count || 0) + 1; await kset('refstat:' + inviter, stat);
        await addBonus(inviter, REF_BONUS); await addBonus(acct, REF_BONUS);
        referred = true;
      }
    }
  }
  await kset('user:' + user.sub, Object.assign({}, user, { lastLogin: Date.now() }));
  const st = await getState(acct, device);
  st.user = { name: user.name, email: user.email, picture: user.picture };
  return res.status(200).json({ ok: true, usage: st, referred, refBonus: referred ? REF_BONUS : 0 });
}
