// GET /api/health — quick setup check (shows only yes/no, never the keys themselves).
import { kget, kset, persistent } from '../lib/store.js';

export default async function handler(req, res) {
  const out = {
    anthropic_key_set: !!process.env.ANTHROPIC_API_KEY,
    anthropic_key_works: null,
    super_admin_key_set: (process.env.SUPER_ADMIN_KEY || process.env.ADMIN_KEY || '').length >= 8,
    database_connected: persistent,
    database_works: null
  };
  if (out.anthropic_key_set) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } });
      out.anthropic_key_works = r.ok;
      if (!r.ok) out.anthropic_status = r.status;
    } catch (e) { out.anthropic_key_works = false; }
  }
  if (persistent) {
    try { const v = Date.now(); await kset('health:ping', v, 60); out.database_works = (await kget('health:ping')) === v; }
    catch (e) { out.database_works = false; out.database_error = String(e.message || e).slice(0, 120); }
  }
  res.setHeader('cache-control', 'no-store');
  return res.status(200).json(out);
}
