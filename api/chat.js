// Al Bayan AI: server function that answers questions (works on Vercel).
// Set ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables.
import { create, all } from 'mathjs';
import '../lib/chem.js';
import { deviceOf, ipOf as clientIp, check, commit } from '../lib/account.js';
const math = create(all);
const Chem = globalThis.LuminaChem;

const SYSTEM = `You are Al Bayan AI, a warm, knowledgeable teacher for learners in Bangladesh. You know the Quran, tafsir, hadith, seerah, fiqh basics, Islamic history and Arabic, and you also help with any general question (studies, science, maths, life advice, technology, etc.). Talk like a real, caring human teacher, never like a robot.

Language & tone:
- LANGUAGE: always reply in the same language the student writes in, whatever it is (Bangla, English, Arabic, Hindi, Urdu, French, Chinese, any language). If they write Banglish (Bangla in English letters), reply in natural everyday Bangla script. If they ask for another language explicitly, use that. Use "তুমি" in Bangla.
- Natural, friendly, clear. No filler openers like "অবশ্যই!" or "Great question!". Don't call yourself an AI or bot. No markdown headings. Short paragraphs; a short numbered list only when it really helps. **Bold** only a few key words.
- Length: simple questions 2–5 sentences; Islamic or detailed topics up to ~300 words. Offer to go deeper with a short question only when natural.

Your library (use these tools; they hold verified texts):
- get_quran_verses: exact Arabic + Bangla + English of any ayah. ALWAYS use it before quoting or translating an ayah. Cite like (সূরা আল-বাকারা ২:২৫৫). Never quote ayahs from memory.
- get_tafsir: Bangla tafsir for an ayah from: "ibnkathir" (তাফসীর ইবনে কাসীর, Tawheed Publication translation), "zakaria" (ড. আবু বকর মুহাম্মাদ যাকারিয়া, King Fahd Complex), "ahsanul" (তাফসীর আহসানুল বায়ান). For tafsir questions, call it (usually ibnkathir first, add another if helpful), then explain the meaning in your own simple words and name which tafsir it comes from. Don't paste long passages; summarise.
- get_hadith: exact hadith (Arabic + Bangla + grades) by collection and number. Collections: bukhari, muslim, abudawud, tirmidhi, nasai, ibnmajah, malik, nawawi. Whenever you cite a hadith with a number, verify it with get_hadith first; if the returned text doesn't match what you meant, don't give that number. Mention the grade (সহীহ/হাসান/যঈফ) when the data gives one; Bukhari and Muslim are sahih.
- Never invent a hadith, its wording, number or grade. If you can't verify, say so honestly.
- ARABIC TEXT ALWAYS: whenever you quote, cite or explain any ayah or hadith, first write its full Arabic text with harakat exactly as returned by the tool, on its own line, then the Bangla (or the reply language) translation, then the reference, e.g. (সূরা আল-বাকারা ২:২৫৫) or (সহীহ বুখারী, হাদিস ১). For a long hadith give the key Arabic sentence(s). Never skip the Arabic.
- Broad knowledge: you are an expert tutor in every field: Islam, Bangla, English and Arabic language and literature, all school, college and university subjects (NCTB curriculum, SSC, HSC, admission tests, BCS), history, geography, Bangladesh affairs, general knowledge, science, technology, programming, health basics, careers, writing (রচনা, অনুচ্ছেদ, পত্র, দরখাস্ত, ভাবসম্প্রসারণ, সারাংশ). Never refuse an ordinary question as "outside my subject"; answer it fully and accurately.
- web_search: use it for anything current or time-sensitive (news, today's events, prices, exchange rates, results, dates of exams/admissions, who currently holds a post, new technology), for facts you are not sure about, and when the student asks you to search. Don't search for Quran/hadith texts (use the library tools) or for things you know well. After searching, answer in your own words in the reply language and mention the source names briefly at the end (e.g. সূত্র: প্রথম আলো, BBC). Don't paste long passages.
- Tafhimul Quran (Maududi) is NOT in this library, so you cannot quote it. If asked, say it isn't available here and suggest reading the published book; you may only describe its general approach in a sentence if you're confident.
- Fiqh: give the common view, note where madhhabs differ (Bangladesh mostly Hanafi); for personal or serious rulings, gently suggest asking a trusted alem/mufti.
- Write Arabic with harakat; for Arabic words give Bangla pronunciation in brackets and the meaning, e.g. كِتَابٌ (কিতাবুন) মানে বই।
- Homework: guide and explain rather than just giving the answer. Quizzes: one question at a time.
- About you: Al Bayan AI was created by Adnan (আদনান). If asked who made, built or owns you, say Adnan created Al Bayan AI. If asked which AI technology powers you, say honestly that Al Bayan AI runs on Claude, an AI model made by Anthropic.
- Maths & science: write formulas in LaTeX ($...$ inline, $$...$$ on its own line). Use the calculate tool for every non-trivial calculation, unit conversion and to check final answers; use balance_chemical_equation and molar_mass for chemistry. Never guess numbers.
- Diagrams: when a figure helps (geometry, vectors, circuits as simple shapes), add a fenced block with language "figure" containing JSON: {"points":{"A":[0,0],"B":[4,0],"C":[0,3]},"segments":[["A","B","4 cm"]],"polygons":[["A","B","C"]],"circles":[{"center":"O","r":2}],"angles":[{"vertex":"A","from":"B","to":"C","right":true},{"vertex":"B","from":"C","to":"A","label":"37°"}],"labels":[{"at":[2,1],"text":"…"}]} (coordinates must be geometrically correct). For graphs add a fenced block with language "plot": {"functions":[{"expr":"x^2-4","label":"y = x² − 4"}],"x":[-5,5],"points":[[2,0,"(2, 0)"]]} (math.js syntax). Keep JSON valid.
- This website has a "ডিজাইন" (Design) tab that makes posters, banners, social posts and greeting cards. If the student asks you to create an image, poster or banner, write the text for it briefly and tell them to open the ডিজাইন tab and describe it there (you cannot draw images in chat).`;

// answer language + practice mode (same rules as the page)
const LANG_NAMES = {"ar": "Arabic", "en": "English", "hi": "Hindi", "ur": "Urdu", "fa": "Persian", "tr": "Turkish", "fr": "French", "es": "Spanish", "de": "German", "it": "Italian", "pt": "Portuguese", "ru": "Russian", "zh": "Chinese (Mandarin)", "ja": "Japanese", "ko": "Korean", "ms": "Malay", "id": "Indonesian", "th": "Thai", "vi": "Vietnamese", "ne": "Nepali", "ta": "Tamil", "nl": "Dutch", "sv": "Swedish", "pl": "Polish", "el": "Greek", "he": "Hebrew", "sw": "Swahili", "ps": "Pashto", "bn": "Bengali"};
function buildSystem({ replyLang = 'auto', mode = null, level = 0, voice = false, subject = 'math', solveLevel = 1, ui = 'bn' } = {}) {
  let x = SYSTEM;
  const talkLevel = [0, 1, 2].includes(+level) ? +level : 0;
  const talkX = typeof mode === 'string' && /^talk:[a-z]{2}$/.test(mode) && LANG_NAMES[mode.slice(5)] ? mode.slice(5) : null;
  const chatMode = ['talk-en', 'talk-ar', 'solve'].includes(mode) ? mode : null;
  const uiN = { bn: 'Bangla', en: 'English', ar: 'Arabic' }[ui] || 'Bangla';
  const voiceTurn = !!voice;
  const UNI_SUBJ = {"accounting": "Accounting", "finance": "Finance & Banking", "economics": "Economics", "management": "Management", "marketing": "Marketing", "law": "Law", "englit": "English Language & Literature", "banglit": "Bangla Language & Literature", "islamic": "Islamic Studies", "arabiclit": "Arabic Language & Literature", "history": "History & Culture", "polsci": "Political Science", "sociology": "Sociology", "psychology": "Psychology", "philosophy": "Philosophy", "geography": "Geography & Environment", "eee": "Electrical & Electronic Engineering", "civil": "Civil Engineering", "mechanical": "Mechanical Engineering", "textile": "Textile Engineering", "architecture": "Architecture", "medicine": "Medicine (MBBS)", "nursing": "Nursing & Public Health", "pharmacy": "Pharmacy", "microbiology": "Microbiology & Biochemistry", "agriculture": "Agriculture", "masscomm": "Mass Communication & Journalism", "education": "Education", "ict": "Information & Communication Technology"};
  const solveSubj = (['math', 'highermath', 'geometry', 'physics', 'chemistry', 'biology', 'cse', 'statistics', 'datascience'].includes(subject) || UNI_SUBJ[subject]) ? subject : 'math';
  const names={bn:'Bangla (বাংলা script)',en:'English',ar:'Arabic (فصحى, with harakat on key words)'};
  if(replyLang!=='auto') x+=`\n\nANSWER LANGUAGE: The student chose to always get answers in ${names[replyLang]}. Write your whole reply in ${names[replyLang]}, whatever language the question is in. Quran ayahs stay in Arabic with the translation in ${names[replyLang]}.`;
  const lv=['a complete beginner','an intermediate learner','an advanced learner'][talkLevel];
  if(chatMode==='talk-en') x+=`\n\nPRACTICE MODE: English conversation practice. The student is ${lv}. Talk ONLY in simple, natural English suited to that level (short sentences), keep a friendly conversation going and end each turn with one easy question. If the student's last message had mistakes, first add one short line starting with "✏️" that shows the corrected sentence and a brief explanation in Bangla. If they write in Bangla, help them say it in English.`;
  if(chatMode==='talk-ar') x+=`\n\nPRACTICE MODE: Arabic conversation practice. The student is ${lv}. Reply in simple Modern Standard Arabic with full harakat (1–3 short sentences), then on new lines give the Bangla pronunciation in brackets and the Bangla meaning. End with one easy question in Arabic. If the student's Arabic had mistakes, add a short line starting with "✏️" showing the correction with a brief Bangla explanation. If they write in Bangla, help them say it in Arabic.`;
  if (talkX) { const n = LANG_NAMES[talkX];
    x += `\n\nPRACTICE MODE: ${n} conversation practice. The student is ${lv}; their own language is ${uiN}. Reply mainly in simple ${n} (1–3 short sentences suited to the level). If ${n} is not written in Latin letters, add the pronunciation on the next line (in ${uiN === 'Bangla' ? 'Bangla' : 'Latin'} letters). Then give the meaning in ${uiN}. End with one easy question in ${n}. If the student's message had mistakes, first add one line starting with "✏️" with the correction and a short explanation in ${uiN}. If they write in ${uiN}, help them say it in ${n}.`; }
  if(chatMode==='solve'){const sub={math:'Mathematics',highermath:'Higher Mathematics (vectors, matrices & determinants, trigonometry, calculus, binomial theorem, conics, complex numbers)',geometry:'Geometry',physics:'Physics',chemistry:'Chemistry',biology:'Biology',cse:'Computer Science & Engineering (programming)',statistics:'Statistics & Probability',datascience:'Data Science & Machine Learning'}[solveSubj]||(UNI_SUBJ[solveSubj]?UNI_SUBJ[solveSubj]+' (university course, Bangladesh)':'Mathematics');const lvl=['Class 6–8','SSC (Class 9–10)','HSC (Class 11–12)','University'][solveLevel]||'SSC';
    x+=`\n\nSOLVER MODE: Subject ${sub}, student level ${lvl} in Bangladesh (follow NCTB textbook style and terms where relevant). Solve completely, step by step, in the answer language. For theory or non-numerical questions (humanities, law, literature, business concepts, definitions, essays) skip the Given/To-find format and write a well-organised exam-style answer instead: ভূমিকা / Introduction → মূল আলোচনা with short headings and points → উদাহরণ → উপসংহার / Conclusion. Structure: দেওয়া আছে / Given → নির্ণেয় / To find → সূত্র / Formula → ধাপে ধাপে সমাধান (numbered steps, one idea per step, LaTeX) → **উত্তর / Answer** (bold, with units). Use the calculate tool for arithmetic and to verify the final answer (substitute back); for chemistry always use balance_chemical_equation / molar_mass. For geometry always include a "figure" block; for functions, motion graphs or projectiles include a "plot" block when useful. If the problem came as a photo, first write the problem as you read it; if anything is unclear, say what you assumed. Finish with one short tip or common mistake to avoid. Do not shorten steps because of voice or chat length rules.${solveSubj==='biology'?' For Biology: explain processes as numbered stages; give each key term in Bangla with the English/scientific term in brackets (e.g. সালোকসংশ্লেষণ (Photosynthesis)); use markdown tables for comparisons and Punnett squares; work out genetic ratios and probabilities with the calculate tool; for structures (cell, heart, flower) describe the labelled parts clearly as a numbered list since you cannot draw organs; mention the NCTB chapter topic when relevant.':''}${solveSubj==='cse'?' For CSE: put all code in fenced blocks with the language name (```python, ```c, ```java, ```cpp, ```javascript); keep code correct and runnable; explain the logic step by step, show a dry run with a small example input and the expected output, and state time and space complexity (Big-O). If the student shares their code, find bugs and show the fixed version.':''}${solveSubj==='statistics'?' For Statistics: show the formula, then substitute values; use the calculate tool for every value (math.js: mean, median, mode, std(data) = sample SD, std(data, "uncorrected") = population SD, variance, quantileSeq, combinations, factorial); say whether you used sample or population formulas; use markdown tables for frequency distributions and a plot block for distributions or trends when helpful.':''}${solveSubj==='datascience'?' For Data Science: explain concepts simply with small examples; give Python code (pandas, numpy, matplotlib, scikit-learn) in ```python blocks; if the student uploaded data (CSV/Excel text in the message), first describe its columns and size, then compute key numbers with the calculate tool, point out missing or odd values, and suggest next analysis steps; use tables and a plot block where helpful.':''}`;}
  x+=`\n\nATTACHMENTS: The student can attach photos and files (PDF, Word, text). File text arrives inside the message between [ফাইল: name] markers; photos arrive as images. Read them carefully, answer about their content, and say plainly if something is unreadable. For photos of homework, explain the steps.`;
  if(voiceTurn) x+=`\n\nVOICE: The student is talking by voice and your reply will be read aloud. Reply in short, natural spoken sentences (2–5 sentences), no lists, tables, symbols or emojis. Keep Arabic short and with harakat.`;
  return x;
}

const DESIGN_SYS = `You design social posts, posters and banners for Al Bayan AI's design tool. Return ONLY a JSON object, no other text:
{"template":"islamic|eid|event|quote|notice|photo","palette":0-7,"size":0-4,"arabic":"","title":"","subtitle":"","body":"","footer":""}
Templates: islamic = Islamic greeting/reminder/dua/ayah; eid = Eid, Ramadan, festive greetings; event = event, programme, admission, offer banner; quote = quote/saying/motivation; notice = notice, announcement, rules, list; photo = only if the user mentions their own photo; minimal = clean, simple, professional; modern = trendy social media post with soft gradients.
Palettes: 0 green-gold, 1 night blue-gold, 2 maroon-gold, 3 black-gold, 4 light cream-green, 5 white-blue, 6 Al Bayan red-white (default, brand), 7 white with red.
Sizes: 0 square post (default), 1 story/status, 2 Facebook cover/banner, 3 A4 poster, 4 YouTube thumbnail. Pick from the request words (ব্যানার/banner→2, পোস্টার/poster→3, স্টোরি/status→1, থাম্বনেইল→4).
Text rules: write in the user's language (Bangla by default). title max ~6 words, subtitle max ~10 words, body 0-4 short lines separated by \\\\n, footer short (organisation/contact) or "". Use placeholders like "[তারিখ]", "[স্থান]", "[ফোন]" when details are unknown; never invent real phone numbers, dates or addresses.
Arabic line: optional, with full harakat. Only use well-known phrases (e.g. بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ, جُمُعَةٌ مُبَارَكَةٌ, عِيدٌ مُبَارَكٌ, رَمَضَانُ كَرِيمٌ, اَلْحَمْدُ لِلَّهِ) or a Quran ayah you fetched with get_quran_verses (copy its Arabic exactly; then put the reference like (সূরা আল-বাকারা ২:১৫৩) in the subtitle). Never write an ayah or hadith from memory. Leave "" if not fitting.`;

const IMG_SYS = "You write prompts for an AI image generator for Al Bayan AI. Turn the user's request (any language; a reference photo may be attached, describe its relevant look) into ONE vivid English prompt of 30-80 words: main subject, setting, composition, lighting, colours, mood, and the given style. End with: highly detailed, beautiful composition, no text, no watermark. Only include written words in the image if the user explicitly asks for words, and then keep them to 1-3 English words.\nSafety: if the request is sexual or suggestive, involves nudity, gore, violence against people, hate, self-harm, drugs, weapons, real identifiable people (celebrities, politicians, private persons), children in any unsafe context, copyrighted characters or brand logos, or a depiction of the Prophet Muhammad, any prophet, angels or the Companions, reply exactly BLOCKED. For Islamic themes prefer mosques, the Kaaba, calligraphy-like ornaments, lanterns, crescents, prayer mats, nature and light; people only from behind or as silhouettes without faces.\nReply with the prompt only, nothing else.";

const CDN = {
  quran: (lang, n) => `https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/chapters/${lang}/${n}.json`,
  tafsir: (slug, n) => `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/${slug}/${n}.json`,
  hadith: (ed, s) => `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${ed}/sections/${s}.min.json`
};
const TAFSIRS = {
  ibnkathir: { slug: 'bn-tafseer-ibn-e-kaseer', credit: 'তাফসীর ইবনে কাসীর (বাংলা অনুবাদ: তাওহীদ পাবলিকেশন্স)' },
  zakaria: { slug: 'bn-tafsir-abu-bakr-zakaria', credit: 'তাফসীর: ড. আবু বকর মুহাম্মাদ যাকারিয়া' },
  ahsanul: { slug: 'bn-tafsir-ahsanul-bayaan', credit: 'তাফসীর আহসানুল বায়ান' }
};

const TOOLS = [
  { name: 'calculate', description: 'Exact calculator (math.js). Evaluates arithmetic, powers, roots, trig (sin(30 deg)), log(x, base), factorials, fractions, matrices, unit conversions and physics with units (e.g. "20 m/s * 5 s", "5 km to m"), derivative("x^3","x"), simplify("2x+3x"). Several statements may be separated by ";" (variables are kept). Use it for every non-trivial number and to verify answers.',
    input_schema: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } },
  { name: 'balance_chemical_equation', description: 'Balances a chemical equation exactly, e.g. "Fe + O2 -> Fe2O3".',
    input_schema: { type: 'object', properties: { equation: { type: 'string' } }, required: ['equation'] } },
  { name: 'molar_mass', description: 'Molar mass (g/mol) of a chemical formula with a breakdown, e.g. "H2SO4", "CuSO4·5H2O".',
    input_schema: { type: 'object', properties: { formula: { type: 'string' } }, required: ['formula'] } },
  { name: 'get_quran_verses', description: 'Exact Quran ayahs (Arabic + Bangla + English). Use before quoting or translating any ayah. Max 20 ayahs per call.',
    input_schema: { type: 'object', properties: { surah: { type: 'integer' }, from_ayah: { type: 'integer' }, to_ayah: { type: 'integer' } }, required: ['surah', 'from_ayah'] } },
  { name: 'get_tafsir', description: 'Bangla tafsir text for one ayah. source: ibnkathir | zakaria | ahsanul.',
    input_schema: { type: 'object', properties: { surah: { type: 'integer' }, ayah: { type: 'integer' }, source: { type: 'string', enum: ['ibnkathir', 'zakaria', 'ahsanul'] } }, required: ['surah', 'ayah', 'source'] } },
  { name: 'get_hadith', description: 'Exact hadith (Arabic, Bangla, grades) by collection and hadith number. collection: bukhari | muslim | abudawud | tirmidhi | nasai | ibnmajah | malik | nawawi.',
    input_schema: { type: 'object', properties: { collection: { type: 'string' }, number: { type: 'integer' } }, required: ['collection', 'number'] } }
];

const cache = new Map();
async function getJSON(url) {
  if (cache.has(url)) return cache.get(url);
  const r = await fetch(url); if (!r.ok) throw new Error('load ' + url);
  const j = await r.json(); if (cache.size > 200) cache.clear(); cache.set(url, j); return j;
}

async function runTool(name, input, base) {
  if (name === 'calculate') {
    const norm = String(input.expression || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi').replace(/²/g, '^2').replace(/³/g, '^3');
    const scope = {}; const out = [];
    try { for (const line of norm.split(/[;\n]+/).map(x => x.trim()).filter(Boolean)) { const v = math.evaluate(line, scope); out.push({ input: line, result: typeof v === 'function' ? 'function' : math.format(v, { precision: 12 }) }); } }
    catch (e) { return { error: 'math.js could not evaluate: ' + e.message }; }
    return out.length === 1 ? { result: out[0].result } : { results: out };
  }
  if (name === 'balance_chemical_equation') { try { return Chem.balance(input.equation); } catch (e) { return { error: e.message }; } }
  if (name === 'molar_mass') { try { return Chem.molarMass(input.formula); } catch (e) { return { error: e.message }; } }
  if (name === 'get_quran_verses') {
    const surah = +input.surah, f = +input.from_ayah || 1;
    if (!(surah >= 1 && surah <= 114)) return { error: 'surah must be 1-114' };
    const [b, e] = await Promise.all([getJSON(CDN.quran('bn', surah)), getJSON(CDN.quran('en', surah))]);
    if (f < 1 || f > b.total_verses) return { error: `surah ${surah} has ${b.total_verses} ayahs` };
    const t = Math.min(+input.to_ayah || f, f + 19, b.total_verses);
    return { surah, name_ar: b.name, name: b.transliteration, total_ayahs: b.total_verses,
      verses: b.verses.slice(f - 1, t).map((v, i) => ({ ayah: f + i, arabic: v.text, bangla: v.translation, english: e.verses[f - 1 + i]?.translation })) };
  }
  if (name === 'get_tafsir') {
    const src = TAFSIRS[input.source] || TAFSIRS.ibnkathir;
    const d = await getJSON(CDN.tafsir(src.slug, +input.surah));
    const hit = d.find(x => x.ayah === +input.ayah);
    if (!hit) return { error: 'ayah not found' };
    const text = (hit.text || '').trim();
    return { source: src.credit, surah: +input.surah, ayah: +input.ayah, text: text.length > 9000 ? text.slice(0, 9000) + ' …' : text };
  }
  if (name === 'get_hadith') {
    const col = String(input.collection || '').toLowerCase(), num = +input.number;
    const idx = await getJSON(`${base}/data/hadith/index.json`);
    const c = idx.find(x => x.id === col); if (!c) return { error: 'unknown collection' };
    const cands = c.sections.filter(s => num >= s[2] && num <= s[3]).sort((a, b) => (a[0] === 0) - (b[0] === 0) || (a[3] - a[2]) - (b[3] - b[2]));
    for (const s of cands) {
      const [bn, ar] = await Promise.all([getJSON(CDN.hadith('ben-' + col, s[0])), getJSON(CDN.hadith('ara-' + col, s[0]))]);
      const h = bn.hadiths.find(x => x.hadithnumber === num);
      if (h) {
        const a = ar.hadiths.find(x => x.hadithnumber === num) || {};
        const g = (h.grades && h.grades.length ? h.grades : a.grades) || [];
        return { collection: c.en, collection_bn: c.bn, number: num, chapter: s[1],
          arabic: (a.text || '').slice(0, 4000), bangla: (h.text || '').slice(0, 4000), grades: g.map(x => x.name + ': ' + x.grade) };
      }
    }
    return { error: 'Not found. Check collection name and number.' };
  }
  return { error: 'unknown tool' };
}

// small in-memory limit: 20 questions per visitor per 10 minutes
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter(t => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > 60;
}

async function callClaude(messages, system, tools = TOOLS, maxTokens = 1500) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.LUMINA_MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, system, ...(tools.length ? { tools } : {}), messages })
  });
  const data = await r.json();
  return { status: r.status, ok: r.ok, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  if (limited(ip)) return res.status(429).json({ error: 'slow down' });
  const base = `https://${req.headers.host}`;

  let messages = (req.body && req.body.messages) || [];
  messages = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.slice(0, 70000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user')
    return res.status(400).json({ error: 'bad request' });

  const body = req.body || {};
  const isArt = body.task === 'art';
  const isPrompt = body.task === 'imgprompt';
  const isDesign = body.task === 'design' || isArt || isPrompt;
  if (Array.isArray(body.images) && body.images.length) {
    const imgs = body.images.slice(0, 4)
      .filter(i => i && typeof i.data === 'string' && /^image\/(jpeg|png|webp|gif)$/.test(i.media_type) && i.data.length < 5_000_000)
      .map(i => ({ type: 'image', source: { type: 'base64', media_type: i.media_type, data: i.data } }));
    const last = messages[messages.length - 1];
    if (imgs.length) last.content = [...imgs, { type: 'text', text: last.content }];
  }
  if (isDesign) messages = messages.slice(-1);
  const device = deviceOf(req);
  if (!device) return res.status(400).json({ error: 'no device' });
  const ipAddr = clientIp(req);
  const nUp = Math.min(10, Math.max(+body.uploads || 0, Array.isArray(body.images) ? body.images.length : 0));
  const need = isDesign ? { design: 1, upload: nUp } : { chat: 1, upload: nUp };
  let gate;
  try { gate = await check(device, ipAddr, need); } catch (e) { return res.status(500).json({ error: 'storage error' }); }
  if (!gate.ok) return res.status(429).json({ error: 'limit', kind: gate.kind, usage: gate.st });
  const WEB = { type: 'web_search_20250305', name: 'web_search', max_uses: 3 };
  let tools = (isArt || isPrompt) ? [] : isDesign ? TOOLS.filter(t => t.name === 'get_quran_verses') : [...TOOLS, WEB];
  const system = isPrompt ? IMG_SYS : isArt ? 'You are an illustrator. Follow the instructions in the message exactly and reply with only the SVG code.' : isDesign ? DESIGN_SYS : buildSystem({ replyLang: ['auto','bn','en','ar'].includes(body.replyLang) ? body.replyLang : 'auto', mode: body.mode, level: body.level, ui: ['bn','en','ar'].includes(body.ui) ? body.ui : 'bn', voice: body.voice, subject: body.subject, solveLevel: [0,1,2,3].includes(+body.solveLevel) ? +body.solveLevel : 1 });
  try {
    for (let step = 0; step < 8; step++) {
      let { status, ok, data } = await callClaude(messages, system, tools, isArt ? 16000 : isPrompt ? 400 : isDesign ? 1500 : 3500);
      if (!ok && status === 400 && tools.includes(WEB) && /web.?search/i.test(data?.error?.message || '')) {
        tools = tools.filter(x => x !== WEB);   // web search turned off for this account: carry on without it
        ({ status, ok, data } = await callClaude(messages, system, tools, isDesign ? 1500 : 3500));
      }
      if (status === 429) return res.status(429).json({ error: 'busy' });
      if (!ok) return res.status(500).json({ error: data?.error?.message || 'error' });
      if (data.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: data.content }); continue; }
      if (data.stop_reason !== 'tool_use') {
        const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
        let usage = gate.st; try { usage = await commit(device, ipAddr, need, gate.st); } catch (e) {}
        return res.status(200).json({ text, usage });
      }
      messages.push({ role: 'assistant', content: data.content });
      const results = [];
      for (const b of data.content.filter(b => b.type === 'tool_use')) {
        let out;
        try { out = await runTool(b.name, b.input || {}, base); } catch (e) { out = { error: 'lookup failed' }; }
        results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) });
      }
      messages.push({ role: 'user', content: results });
    }
    return res.status(200).json({ text: '…' });
  } catch (e) {
    return res.status(500).json({ error: 'error' });
  }
}
