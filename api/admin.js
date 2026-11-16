// POST /api/admin — admin actions. Send the admin key in the "x-admin-key" header.
// Super admin key = SUPER_ADMIN_KEY env variable. Admin keys are created by the super admin.
import {
  deviceOf, staffFromKey, getState, getConfig, saveConfig, setPlan, createCodes, listCodes,
  createAdmin, listAdmins, removeAdmin, loginDevice, logoutDevice
} from '../lib/account.js';
import { persistent } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const body = req.body || {};
  const device = deviceOf(req);
  try {
    if (body.action === 'logout') { if (device) await logoutDevice(device); return res.status(200).json({ ok: true }); }

    const key = String(req.headers['x-admin-key'] || '');
    const staff = await staffFromKey(key);
    if (!staff) return res.status(401).json({ error: 'bad_key' });
    const isSuper = staff.role === 'super';
    const superOnly = () => { if (!isSuper) { res.status(403).json({ error: 'super_only' }); return true; } return false; };

    switch (body.action) {
      case 'login':            // unlimited use for this browser
        if (!device) return res.status(400).json({ error: 'no device' });
        await loginDevice(device, staff, key);
        return res.status(200).json({ ok: true, role: staff.role, usage: await getState(device) });
      case 'whoami':
        return res.status(200).json({ role: staff.role, name: staff.name, persistent, config: await getConfig() });
      case 'create_codes':
        return res.status(200).json({ codes: await createCodes(body.plan, body.days, body.count, staff.name) });
      case 'list_codes':
        return res.status(200).json({ codes: await listCodes() });
      case 'set_plan': {    // give a user a plan directly by their ID
        const id = String(body.device || '').replace(/[^a-zA-Z0-9-]/g, '');
        if (!id) return res.status(400).json({ error: 'no user id' });
        await setPlan(id, body.plan, +body.days);
        return res.status(200).json({ ok: true, user: await getState(id) });
      }
      case 'lookup': {
        const id = String(body.device || '').replace(/[^a-zA-Z0-9-]/g, '');
        return res.status(200).json({ user: await getState(id) });
      }
      // ---- super admin only ----
      case 'create_admin': if (superOnly()) return;
        return res.status(200).json(await createAdmin(body.name));
      case 'list_admins': if (superOnly()) return;
        return res.status(200).json({ admins: await listAdmins() });
      case 'remove_admin': if (superOnly()) return;
        await removeAdmin(String(body.id || '')); return res.status(200).json({ ok: true });
      case 'save_settings': if (superOnly()) return;
        return res.status(200).json({ config: await saveConfig(body.settings || {}) });
      default:
        return res.status(400).json({ error: 'unknown action' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message || 'error' });
  }
}
