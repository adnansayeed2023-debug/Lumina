/* Lumina plans & limits — one place to change prices and limits.
   Used by the page (window.LuminaPlans) and by the server (globalThis.LuminaPlans). */
(function (root) {
  const WINDOW_HOURS = 4;                    // limits reset 4 hours after the first use in a window

  const PLANS = {
    free: { name: 'Free', price: 0,   limits: { chat: 10,  upload: 3,   design: 3   } },
    go:   { name: 'Go',   price: 890,  limits: { chat: 40,  upload: 15,  design: 15  } },
    plus: { name: 'Plus', price: 1450, limits: { chat: 120, upload: 40,  design: 40  }, popular: true },
    pro:  { name: 'Pro',  price: 2450, limits: { chat: 300, upload: 100, design: 100 } }
  };
  const PLAN_DAYS = 30;                      // one purchase = 30 days

  // Payment details shown on the plans page. Replace the [..] placeholders with your real details.
  const PAYMENT = {
    methods: 'bKash (Send Money)',
    number: '01727723883',
    contact: 'WhatsApp 01727723883'
  };

  // AI models inside Al Bayan. weight = how many "questions" one answer counts as.
  const MODELS = {
    lite:  { name: 'Bayan Lite',  icon: '⚡', id: 'claude-haiku-5-5',  weight: 1, maxTokens: 2500 },
    smart: { name: 'Bayan Smart', icon: '✨', id: 'claude-sonnet-5-5', weight: 1, maxTokens: 5000 },
    pro:   { name: 'Bayan Pro',   icon: '💎', id: 'claude-opus-5-5',   weight: 2, maxTokens: 6000 },
    ultra: { name: 'Bayan Ultra', icon: '👑', id: 'claude-fable-5-2',  weight: 3, maxTokens: 8000 }
  };
  // which models each plan can use
  const MODEL_ACCESS = { free: ['lite', 'smart'], go: ['lite', 'smart', 'pro'], plus: ['lite', 'smart', 'pro', 'ultra'], pro: ['lite', 'smart', 'pro', 'ultra'] };

  // Daily limits for FREE users (in questions; Pro/Ultra answers count by their weight).
  // freePerUser: one free user per day. freeSiteWide: all free users together per day (protects your AI bill).
  const DAILY = { freePerUser: 10, freeSiteWide: 200 };
  // Discount on every paid plan, in percent (0 = no discount). The super admin can change it in the admin panel.
  const DISCOUNT = 30;
  // price after discount, rounded to the nearest 5 taka
  function salePrice(price, pct) { pct = Math.max(0, Math.min(90, +pct || 0)); return price ? Math.round(price * (100 - pct) / 100 / 5) * 5 : 0; }
  const PRICE_REV = 2;                       // bump when default prices change, so old saved prices are replaced

  const KINDS = ['chat', 'upload', 'design'];

  // Pure helper: bring a usage record up to date (reset when the window has passed).
  function fresh(rec, now) {
    now = now || Date.now();
    const win = WINDOW_HOURS * 3600 * 1000;
    if (!rec || !rec.start || now - rec.start >= win) return { start: null, chat: 0, upload: 0, design: 0 };
    return Object.assign({ chat: 0, upload: 0, design: 0 }, rec);
  }
  function resetAt(rec) { return rec && rec.start ? rec.start + WINDOW_HOURS * 3600 * 1000 : null; }
  function planOf(p, now) { now = now || Date.now(); return p && PLANS[p.plan] && p.until && p.until > now ? p.plan : 'free'; }

  root.LuminaPlans = { WINDOW_HOURS, PLANS, PLAN_DAYS, PAYMENT, DAILY, DISCOUNT, salePrice, PRICE_REV, KINDS, MODELS, MODEL_ACCESS, fresh, resetAt, planOf };
})(typeof window !== 'undefined' ? window : globalThis);
