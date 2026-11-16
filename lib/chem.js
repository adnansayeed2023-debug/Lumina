/* Lumina chemistry helpers: formula parsing, molar mass, equation balancing.
   Works in the browser (window.LuminaChem) and on the server (globalThis.LuminaChem). */
(function (root) {
  const W = {H:1.008,He:4.0026,Li:6.94,Be:9.0122,B:10.81,C:12.011,N:14.007,O:15.999,F:18.998,Ne:20.180,Na:22.990,Mg:24.305,Al:26.982,Si:28.085,P:30.974,S:32.06,Cl:35.45,Ar:39.948,K:39.098,Ca:40.078,Sc:44.956,Ti:47.867,V:50.942,Cr:51.996,Mn:54.938,Fe:55.845,Co:58.933,Ni:58.693,Cu:63.546,Zn:65.38,Ga:69.723,Ge:72.630,As:74.922,Se:78.971,Br:79.904,Kr:83.798,Rb:85.468,Sr:87.62,Y:88.906,Zr:91.224,Nb:92.906,Mo:95.95,Tc:98,Ru:101.07,Rh:102.91,Pd:106.42,Ag:107.87,Cd:112.41,In:114.82,Sn:118.71,Sb:121.76,Te:127.60,I:126.90,Xe:131.29,Cs:132.91,Ba:137.33,La:138.91,Ce:140.12,Pr:140.91,Nd:144.24,Pm:145,Sm:150.36,Eu:151.96,Gd:157.25,Tb:158.93,Dy:162.50,Ho:164.93,Er:167.26,Tm:168.93,Yb:173.05,Lu:174.97,Hf:178.49,Ta:180.95,W:183.84,Re:186.21,Os:190.23,Ir:192.22,Pt:195.08,Au:196.97,Hg:200.59,Tl:204.38,Pb:207.2,Bi:208.98,Po:209,At:210,Rn:222,Fr:223,Ra:226,Ac:227,Th:232.04,Pa:231.04,U:238.03,Np:237,Pu:244,Am:243,Cm:247,Bk:247,Cf:251,Es:252,Fm:257,Md:258,No:259,Lr:262};
  const SUB = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};

  function clean(f) { return String(f).replace(/[₀-₉]/g, c => SUB[c]).replace(/\s+/g, '').replace(/\^?\d*[+-]$/, ''); }

  // returns {El: count}
  function parseFormula(formula) {
    let f = clean(formula);
    const parts = f.split(/[·•*.]/).filter(Boolean);           // hydrates: CuSO4·5H2O
    const total = {};
    for (let part of parts) {
      let mult = 1; const m = part.match(/^(\d+)(.*)$/);
      if (m && /[A-Z(\[]/.test(m[2])) { mult = +m[1]; part = m[2]; }
      const c = parseGroup(part);
      for (const k in c) total[k] = (total[k] || 0) + c[k] * mult;
    }
    if (!Object.keys(total).length) throw new Error('Could not read formula: ' + formula);
    return total;
  }
  function parseGroup(s) {
    let i = 0;
    function num() { let n = ''; while (i < s.length && /\d/.test(s[i])) n += s[i++]; return n ? +n : 1; }
    function group(close) {
      const out = {};
      while (i < s.length) {
        const ch = s[i];
        if (ch === '(' || ch === '[' || ch === '{') {
          i++; const g = group(ch === '(' ? ')' : ch === '[' ? ']' : '}'); const n = num();
          for (const k in g) out[k] = (out[k] || 0) + g[k] * n;
        } else if (ch === ')' || ch === ']' || ch === '}') {
          if (ch !== close) throw new Error('Unbalanced brackets in ' + s);
          i++; return out;
        } else if (/[A-Z]/.test(ch)) {
          let el = ch; i++; while (i < s.length && /[a-z]/.test(s[i])) el += s[i++];
          if (!(el in W)) throw new Error('Unknown element: ' + el);
          const n = num(); out[el] = (out[el] || 0) + n;
        } else throw new Error('Unexpected "' + ch + '" in ' + s);
      }
      if (close) throw new Error('Missing ' + close + ' in ' + s);
      return out;
    }
    return group(null);
  }

  function molarMass(formula) {
    const c = parseFormula(formula); let total = 0; const parts = [];
    for (const el in c) { const m = W[el] * c[el]; total += m; parts.push({ element: el, count: c[el], atomic_mass: W[el], subtotal: +m.toFixed(3) }); }
    return { formula: String(formula).trim(), molar_mass_g_per_mol: +total.toFixed(3), breakdown: parts };
  }

  // ---- exact fractions with BigInt ----
  const babs = x => x < 0n ? -x : x;
  function gcd(a, b) { a = babs(a); b = babs(b); while (b) { [a, b] = [b, a % b]; } return a; }
  function frac(n, d = 1n) { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return [n / g, d / g]; }
  const fsub = (a, b) => frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
  const fmul = (a, b) => frac(a[0] * b[0], a[1] * b[1]);
  const fdiv = (a, b) => frac(a[0] * b[1], a[1] * b[0]);

  function balance(equation) {
    const eq = String(equation).replace(/→|⟶|=>|-+>|=/g, '->');
    const sides = eq.split('->');
    if (sides.length !== 2) throw new Error('Write the equation like: H2 + O2 -> H2O');
    const strip = t => t.trim().replace(/^\d+\s*(?=[A-Z(\[])/, '');
    const left = sides[0].split(/\s\+\s|\+(?=\s*[A-Z(\[\d])/).map(strip).filter(Boolean);
    const right = sides[1].split(/\s\+\s|\+(?=\s*[A-Z(\[\d])/).map(strip).filter(Boolean);
    const species = [...left, ...right];
    if (left.length < 1 || right.length < 1) throw new Error('Need reactants and products');
    const comps = species.map(parseFormula);
    const els = [...new Set(comps.flatMap(c => Object.keys(c)))];
    const n = species.length;
    // matrix rows = elements, cols = species (products negative)
    let M = els.map(el => species.map((_, j) => frac(BigInt((comps[j][el] || 0) * (j < left.length ? 1 : -1)))));
    // reduced row echelon
    let r = 0; const pivots = [];
    for (let c = 0; c < n && r < M.length; c++) {
      let p = r; while (p < M.length && M[p][c][0] === 0n) p++;
      if (p === M.length) continue;
      [M[r], M[p]] = [M[p], M[r]];
      const pv = M[r][c]; M[r] = M[r].map(x => fdiv(x, pv));
      for (let i = 0; i < M.length; i++) if (i !== r && M[i][c][0] !== 0n) { const f = M[i][c]; M[i] = M[i].map((x, k) => fsub(x, fmul(f, M[r][k]))); }
      pivots.push(c); r++;
    }
    const free = [...Array(n).keys()].filter(c => !pivots.includes(c));
    if (free.length !== 1) throw new Error(free.length === 0 ? 'This equation cannot be balanced' : 'More than one way to balance this; check the formulas');
    const fc = free[0]; const sol = Array(n).fill(null); sol[fc] = frac(1n);
    pivots.forEach((c, i) => { sol[c] = frac(-M[i][fc][0], M[i][fc][1]); });
    let lcm = 1n; sol.forEach(s => { lcm = lcm * s[1] / gcd(lcm, s[1]); });
    let ints = sol.map(s => s[0] * (lcm / s[1]));
    if (ints.some(x => x <= 0n)) { if (ints.every(x => x <= 0n)) ints = ints.map(x => -x); else throw new Error('This equation cannot be balanced as written'); }
    const g = ints.reduce((a, b) => gcd(a, b)); ints = ints.map(x => x / g);
    const fmt = (s, k) => (ints[k] === 1n ? '' : ints[k].toString()) + s;
    const balanced = left.map((s, k) => fmt(s, k)).join(' + ') + ' → ' + right.map((s, k) => fmt(s, k + left.length)).join(' + ');
    return { balanced, coefficients: species.map((s, k) => ({ species: s, coefficient: Number(ints[k]) })) };
  }

  root.LuminaChem = { parseFormula, molarMass, balance, ATOMIC_WEIGHTS: W };
})(typeof window !== 'undefined' ? window : globalThis);
