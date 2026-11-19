// Lumina accounts: plans, usage limits, roles (super admin / admin), activation codes, editable settings.
import crypto from 'node:crypto';
import './plans.js';
import { kget, kset, kdel, persistent } from './store.js';

const DEF = globalThis.LuminaPlans;
const IP_FACTOR = 6;                         // a shared IP may use up to 6× the free limit (mobile networks share IPs)

export const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
// The id that plans, usage and chats belong to: the signed-in Google account if this device is linked, otherwise the device.
export async function whoOf(req) {
  const device = deviceOf(req); if (!device) return { id: null, device: null, user: null };
  const link = await kget('link:' + device);
  return link && link.sub ? { id: 'u_' + link.sub, device, user: link } : { id: device, device, user: null };
}
export function deviceOf(req) { return String(req.headers['x-lumina-device'] || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64) || null; }
export function ipOf(req) { return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || null; }

/* ---------- settings (super admin can edit plans, prices, payment, window) ---------- */
let cache = { at: 0, val: null };
export async function getConfig() {
  if (cache.val && Date.now() - cache.at < 20000) return cache.val;
  const s = (await kget('settings')) || {};
  const plans = JSON.parse(JSON.stringify(DEF.PLANS));
  for (const id in s.plans || {}) if (plans[id]) {
    const p = s.plans[id];
    if (typeof p.name === 'string' && p.name.trim()) plans[id].name = p.name.trim().slice(0, 20);
    if (s.priceRev === DEF.PRICE_REV && Number.isFinite(+p.price) && +p.price >= 0) plans[id].price = +p.price;
    for (const k of DEF.KINDS) if (p.limits && Number.isFinite(+p.limits[k])) plans[id].limits[k] = Math.max(-1, Math.round(+p.limits[k]));
  }
  const payment = Object.assign({}, DEF.PAYMENT);
  for (const k in s.payment || {}) { const v = String(s.payment[k] || '').trim(); if (v && !v.includes('[')) payment[k] = v.slice(0, 120); }
  const daily = Object.assign({}, DEF.DAILY);
  for (const k in s.daily || {}) if (Number.isFinite(+s.daily[k]) && +s.daily[k] >= 0) daily[k] = Math.round(+s.daily[k]);
  const windowHours = Number.isFinite(+s.windowHours) && +s.windowHours >= 1 && +s.windowHours <= 168 ? +s.windowHours : DEF.WINDOW_HOURS;
  const planDays = Number.isFinite(+s.planDays) && +s.planDays >= 1 ? +s.planDays : DEF.PLAN_DAYS;
  const discount = Number.isFinite(+s.discount) && +s.discount >= 0 && +s.discount <= 90 ? Math.round(+s.discount) : DEF.DISCOUNT;
  cache = { at: Date.now(), val: { plans, payment, windowHours, planDays, daily, discount } };
  return cache.val;
}
export async function saveConfig(next) { next = Object.assign({}, next, { priceRev: DEF.PRICE_REV }); await kset('settings', next); cache = { at: 0, val: null }; return getConfig(); }

// calendar day in Bangladesh time (UTC+6)
export const bdDay = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
const fresh = (rec, hrs) => (!rec || !rec.start || Date.now() - rec.start >= hrs * 3600e3) ? { start: null, chat: 0, upload: 0, design: 0 } : Object.assign({ chat: 0, upload: 0, design: 0 }, rec);

/* ---------- roles ---------- */
export function superKey() { return process.env.SUPER_ADMIN_KEY || process.env.ADMIN_KEY || ''; }
// who is calling with an admin key? -> {role:'super'} | {role:'admin', id, name} | null
export async function staffFromKey(key) {
  key = String(key || '');
  if (key.length < 8) return null;
  const sk = superKey();
  if (sk && sk.length >= 8 && crypto.timingSafeEqual(Buffer.from(sha(key)), Buffer.from(sha(sk)))) return { role: 'super', name: 'Super admin' };
  const id = await kget('adminkey:' + sha(key));
  if (!id) return null;
  const a = await kget('admin:' + id);
  return a && !a.disabled ? { role: 'admin', id, name: a.name } : null;
}
async function roleOfDevice(device) {
  const r = await kget('role:' + device);
  if (!r) return null;
  if (r.role === 'admin') { const a = await kget('admin:' + r.id); if (!a || a.disabled) return null; return { role: 'admin', name: a.name }; }
  if (r.role === 'super' && r.keyHash === sha(superKey())) return { role: 'super', name: 'Super admin' };
  return null;
}

/* ---------- usage ---------- */
export async function getState(device, rawDevice) {
  const cfg = await getConfig();
  const role = device ? ((await roleOfDevice(device)) || (rawDevice && rawDevice !== device ? await roleOfDevice(rawDevice) : null)) : null;
  const p = device ? await kget('plan:' + device) : null;
  const plan = p && cfg.plans[p.plan] && p.until > Date.now() ? p.plan : 'free';
  const used = fresh(device ? await kget('use:' + device) : null, cfg.windowHours);
  return {
    plan, until: plan !== 'free' ? p.until : null, used,
    resetAt: used.start ? used.start + cfg.windowHours * 3600e3 : null,
    limits: cfg.plans[plan].limits, role: role ? role.role : null, adminName: role ? role.name : '',
    plans: cfg.plans, payment: cfg.payment, windowHours: cfg.windowHours, discount: cfg.discount, persistent, id: device,
    bonus: device ? ((await kget('bonus:' + device)) || 0) : 0
  };
}
// need = {chat:1} | {design:1} | {chat:1, upload:n}
export async function check(device, ip, need, rawDevice) {
  const st = await getState(device, rawDevice);
  if (st.role) return { ok: true, st };
  const canBonus = st.plan === 'free' && need.chat > 0 && (st.bonus || 0) >= need.chat;
  for (const k in need) { const l = st.limits[k]; if (need[k] > 0 && l >= 0 && st.used[k] + need[k] > l) {
    if (k === 'chat' && canBonus) { st.useBonus = true; continue; }   // free questions used up: spend referral bonus
    return { ok: false, kind: k, st };
  } }
  if (st.plan === 'free' && need.chat > 0) {
    const cfg = await getConfig(), day = bdDay();
    const du = (await kget('dayuse:' + device + ':' + day)) || 0;
    if (cfg.daily.freePerUser > 0 && du + need.chat > cfg.daily.freePerUser) {
      // over today's free limit: spend referral bonus questions if the person has any
      if (canBonus) st.useBonus = true; else return { ok: false, kind: 'daily', st };
    }
    const sw = (await kget('dayall:' + day)) || 0;
    if (cfg.daily.freeSiteWide > 0 && sw + need.chat > cfg.daily.freeSiteWide) return { ok: false, kind: 'site', st };
  }
  if (st.plan === 'free' && ip) {
    const cfg = await getConfig(); const iu = fresh(await kget('ipuse:' + ip), cfg.windowHours);
    for (const k in need) if (need[k] > 0 && iu[k] + need[k] > cfg.plans.free.limits[k] * IP_FACTOR) return { ok: false, kind: k, st };
  }
  return { ok: true, st };
}
export async function commit(device, ip, need, st) {
  if (st.role) return st;
  const cfg = await getConfig(); const ttl = cfg.windowHours * 3600 + 120;
  const u = st.used; if (!u.start) u.start = Date.now();
  for (const k in need) u[k] = (u[k] || 0) + (need[k] || 0);
  await kset('use:' + device, u, ttl);
  if (st.plan === 'free' && need.chat > 0 && st.useBonus) {
    st.bonus = Math.max(0, ((await kget('bonus:' + device)) || 0) - need.chat);
    await kset('bonus:' + device, st.bonus);
    delete st.useBonus;
    const day = bdDay(); await kset('dayall:' + day, ((await kget('dayall:' + day)) || 0) + need.chat, 2 * 86400);
  } else if (st.plan === 'free' && need.chat > 0) {
    const day = bdDay();
    await kset('dayuse:' + device + ':' + day, ((await kget('dayuse:' + device + ':' + day)) || 0) + need.chat, 2 * 86400);
    await kset('dayall:' + day, ((await kget('dayall:' + day)) || 0) + need.chat, 2 * 86400);
  }
  if (st.plan === 'free' && ip) {
    const iu = fresh(await kget('ipuse:' + ip), cfg.windowHours); if (!iu.start) iu.start = Date.now();
    for (const k in need) iu[k] = (iu[k] || 0) + (need[k] || 0);
    await kset('ipuse:' + ip, iu, ttl);
  }
  st.resetAt = u.start + cfg.windowHours * 3600e3;
  return st;
}

/* ---------- plans & codes ---------- */
export async function setPlan(device, plan, days) {
  const cfg = await getConfig();
  if (plan === 'free') { await kdel('plan:' + device); return; }
  if (!cfg.plans[plan]) throw new Error('unknown plan');
  const cur = await kget('plan:' + device);
  const base = cur && cur.plan === plan && cur.until > Date.now() ? cur.until : Date.now();
  await kset('plan:' + device, { plan, until: base + (days || cfg.planDays) * 86400e3 });
}
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() { const b = crypto.randomBytes(8); let s = ''; for (const x of b) s += ALPH[x % ALPH.length]; return `LUMI-${s.slice(0, 4)}-${s.slice(4)}`; }
export async function createCodes(plan, days, count, by) {
  const cfg = await getConfig(); if (!cfg.plans[plan] || plan === 'free') throw new Error('unknown plan');
  const out = []; const recent = (await kget('codes:recent')) || [];
  for (let i = 0; i < Math.min(50, Math.max(1, +count || 1)); i++) {
    const code = newCode();
    await kset('code:' + code, { plan, days: +days || cfg.planDays, by, createdAt: Date.now() });
    out.push(code); recent.unshift(code);
  }
  await kset('codes:recent', recent.slice(0, 300));
  return out;
}
export async function listCodes() {
  const recent = (await kget('codes:recent')) || [];
  const out = [];
  for (const c of recent.slice(0, 100)) { const r = await kget('code:' + c); if (r) out.push({ code: c, ...r }); }
  return out;
}
export async function redeem(device, code) {
  code = String(code || '').toUpperCase().replace(/\s+/g, '');
  if (!/^LUMI-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return { error: 'invalid' };
  const r = await kget('code:' + code);
  if (!r) return { error: 'invalid' };
  if (r.usedBy) return { error: 'used' };
  await setPlan(device, r.plan, r.days);
  r.usedBy = device; r.usedAt = Date.now(); await kset('code:' + code, r);
  return { ok: true };
}

/* ---------- admins (super admin only) ---------- */
export async function createAdmin(name) {
  const id = crypto.randomBytes(6).toString('hex');
  const key = 'adm_' + crypto.randomBytes(18).toString('base64url');
  await kset('admin:' + id, { name: String(name || 'Admin').slice(0, 40), createdAt: Date.now() });
  await kset('adminkey:' + sha(key), id);
  const list = (await kget('admins:list')) || []; list.push(id); await kset('admins:list', list);
  return { id, key };
}
export async function listAdmins() {
  const list = (await kget('admins:list')) || []; const out = [];
  for (const id of list) { const a = await kget('admin:' + id); if (a) out.push({ id, ...a }); }
  return out;
}
export async function removeAdmin(id) {
  await kdel('admin:' + id);
  const list = ((await kget('admins:list')) || []).filter(x => x !== id); await kset('admins:list', list);
}
export async function loginDevice(device, staff, key) {
  await kset('role:' + device, staff.role === 'super' ? { role: 'super', keyHash: sha(key) } : { role: 'admin', id: staff.id }, 60 * 86400);
}
export async function logoutDevice(device) { await kdel('role:' + device); }

/* ---------- referrals: invite a friend, both get bonus questions ---------- */
export const REF_BONUS = 10;          // extra questions each side gets
export const REF_MAX = 50;            // most friends one person can be rewarded for
export async function refCodeOf(acct) {
  let code = await kget('refcode:' + acct);
  if (code) return code;
  for (let i = 0; i < 5; i++) {
    const b = crypto.randomBytes(6); let c = ''; for (const x of b) c += ALPH[x % ALPH.length];
    if (!(await kget('ref:' + c))) { code = c; break; }
  }
  if (!code) throw new Error('no code');
  await kset('ref:' + code, acct); await kset('refcode:' + acct, code);
  return code;
}
export async function addBonus(id, n) { const v = ((await kget('bonus:' + id)) || 0) + n; await kset('bonus:' + id, v); return v; }
