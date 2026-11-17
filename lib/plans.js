/* Lumina plans & limits — one place to change prices and limits.
   Used by the page (window.LuminaPlans) and by the server (globalThis.LuminaPlans). */
(function (root) {
  const WINDOW_HOURS = 4;                    // limits reset 4 hours after the first use in a window

  const PLANS = {
    free: { name: 'Free', price: 0,   limits: { chat: 10,  upload: 3,   design: 3   } },
    go:   { name: 'Go',   price: 99,  limits: { chat: 40,  upload: 15,  design: 15  } },
    plus: { name: 'Plus', price: 299, limits: { chat: 120, upload: 40,  design: 40  }, popular: true },
    pro:  { name: 'Pro',  price: 699, limits: { chat: 300, upload: 100, design: 100 } }
  };
  const PLAN_DAYS = 30;                      // one purchase = 30 days

  // Payment details shown on the plans page. Replace the [..] placeholders with your real details.
  const PAYMENT = {
    methods: 'bKash / Nagad (Send Money)',
    number: '[আপনার bKash/Nagad নম্বর]',
    contact: '[আপনার WhatsApp নম্বর বা ইমেইল]'
  };

  // AI models inside Al Bayan. weight = how many "questions" one answer counts as.
  const MODELS = {
    lite:  { name: 'Bayan Lite',  icon: '⚡', id: 'claude-haiku-5-5',  weight: 1, maxTokens: 2500 },
    smart: { name: 'Bayan Smart', icon: '✨', id: 'claude-sonnet-5-5', weight: 1, maxTokens: 4000 },
    pro:   { name: 'Bayan Pro',   icon: '💎', id: 'claude-opus-5-5',   weight: 2, maxTokens: 6000 },
    ultra: { name: 'Bayan Ultra', icon: '👑', id: 'claude-fable-5-2',  weight: 3, maxTokens: 8000 }
  };
  // which models each plan can use
  const MODEL_ACCESS = { free: ['lite', 'smart'], go: ['lite', 'smart', 'pro'], plus: ['lite', 'smart', 'pro', 'ultra'], pro: ['lite', 'smart', 'pro', 'ultra'] };

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

  root.LuminaPlans = { WINDOW_HOURS, PLANS, PLAN_DAYS, PAYMENT, KINDS, MODELS, MODEL_ACCESS, fresh, resetAt, planOf };
})(typeof window !== 'undefined' ? window : globalThis);
