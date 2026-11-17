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
    const k = process.env.ANTHROPIC_API_KEY;
    out.anthropic_key_checks = {
      looks_like_api_key: /^sk-ant-api\d*-/.test(k.trim()),
      has_spaces_or_newlines: /\s/.test(k),
      has_quotes: /["']/.test(k)
    };
    try {
      const r = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } });
      out.anthropic_key_works = r.ok;
      if (!r.ok) out.anthropic_status = r.status;
    } catch (e) { out.anthropic_key_works = false; out.anthropic_error = (e && (e.name || 'error')) + (e && e.cause && e.cause.code ? ':' + e.cause.code : ''); }
  }
  // ?models=1 lists the model ids this key can use (ids only)
  if (out.anthropic_key_works && req.query && req.query.models === '1') {
    try { const r = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } });
      const j = await r.json(); out.models = (j.data || []).map(m => m.id); } catch (e) { out.models = null; }
  }
  // ?deep=1 also sends one tiny test message (max 10 tests per hour)
  if (out.anthropic_key_works && req.query && req.query.deep === '1') {
    const n = ((await kget('health:deep')) || 0) + 1; await kset('health:deep', n, 3600);
    if (n <= 10) {
      try {
        const model = process.env.LUMINA_MODEL || 'claude-sonnet-5-5';
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: 'user', content: 'Say OK' }] }) });
        out.chat_model = model; out.chat_works = r.ok; if (!r.ok) { const j = await r.json().catch(() => ({})); out.chat_status = r.status; out.chat_error_type = j?.error?.type || null; }
      } catch (e) { out.chat_works = false; }
    } else out.chat_test = 'skipped (limit)';
  }
  if (persistent) {
    try { const v = Date.now(); await kset('health:ping', v, 60); out.database_works = (await kget('health:ping')) === v; }
    catch (e) { out.database_works = false; out.database_error = String(e.message || e).slice(0, 120); }
  }
  res.setHeader('cache-control', 'no-store');
  return res.status(200).json(out);
}
