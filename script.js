(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  class PErr extends Error { constructor(pos, len, msg) { super(msg); this.pos = pos; this.len = Math.max(1, len); } }
  const OPS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '·': '*', '/': '/', '÷': '/', '^': '^', '(': '(', ')': ')' };
  const FUNCS = { sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sqrt: 1, ln: 1, log: 1, exp: 1, abs: 1 };
  const CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E };

  function tokenize(s) {
    const t = []; let i = 0, m;
    while (i < s.length) {
      const c = s[i], rest = s.slice(i);
      if (/\s/.test(c)) { i++; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)/.exec(rest))) { t.push({ k: 'num', v: parseFloat(m[1]), text: m[1], pos: i, len: m[1].length }); i += m[1].length; continue; }
      if (c === 'π') { t.push({ k: 'id', v: 'π', text: c, pos: i, len: 1 }); i++; continue; }
      if ((m = /^[A-Za-z_]+/.exec(rest))) { t.push({ k: 'id', v: m[0].toLowerCase(), text: m[0], pos: i, len: m[0].length }); i += m[0].length; continue; }
      if (c === '*' && s[i + 1] === '*') { t.push({ k: 'op', v: '^', text: '**', pos: i, len: 2 }); i += 2; continue; }
      if (OPS[c]) { t.push({ k: 'op', v: OPS[c], text: c, pos: i, len: 1 }); i++; continue; }
      throw new PErr(i, 1, `Unsupported character "${c}"`);
    }
    t.push({ k: 'eof', text: 'end of expression', pos: s.length, len: 1 });
    return t;
  }

  function parse(src, ans) {
    const T = tokenize(src); let i = 0;
    const peek = () => T[i], next = () => T[i++];
    const isOp = (x, ...v) => x.k === 'op' && v.includes(x.v);
    const startsAtom = x => x.k === 'num' || x.k === 'id' || isOp(x, '(');
    function expr() {
      let l = term();
      while (isOp(peek(), '+', '-')) { const o = next(); l = { t: 'bin', op: o.v, l, r: term(), pos: o.pos }; } return l;
    }
    function term() {
      let l = unary();
      for (; ;) {
        if (isOp(peek(), '*', '/')) { const o = next(); l = { t: 'bin', op: o.v, l, r: unary(), pos: o.pos }; }
        else if (startsAtom(peek())) { const p = peek().pos; l = { t: 'bin', op: '*', l, r: unary(), pos: p }; }
        else return l;
      }
    }
    function unary() {
      const x = peek();
      if (isOp(x, '-')) { next(); return { t: 'neg', x: unary(), pos: x.pos }; }
      if (isOp(x, '+')) { next(); return unary(); }
      return power();
    }
    function power() {
      const b = atom();
      if (isOp(peek(), '^')) { const o = next(); return { t: 'bin', op: '^', l: b, r: unary(), pos: o.pos }; }
      return b;
    }
    function atom() {
      const x = next();
      if (x.k === 'num') return { t: 'num', v: x.v };
      if (x.k === 'id') {
        // Requirement 03: Allow the user to type Ans
        if ( x.v === 'ans' )
          {
            // Make sure a previous answer exists
            if ( ans === null ) 
              {
                throw new PErr( x.pos, x.len, 'No previous answer is available' );
              }

            // Use the previous answer as a number
            return { t: 'num', v: ans };
          }
        if (x.v in CONSTS) return { t: 'num', v: CONSTS[x.v], s: x.v === 'e' ? 'e' : 'π' };
        if (x.v in FUNCS) {
          if (!isOp(peek(), '(')) throw new PErr(x.pos, x.len, `"${x.text}" needs parentheses, for example ${x.text}(1)`);
          const open = next(), a = expr();
          if (!isOp(peek(), ')')) throw new PErr(peek().pos, peek().len, `Missing ")" for the "(" at column ${open.pos + 1}`);
          next(); return { t: 'call', f: x.v, a, pos: x.pos };
        }
        throw new PErr(x.pos, x.len, `Unknown name "${x.text}"`);
      }
      if (isOp(x, '(')) {
        const a = expr();
        if (!isOp(peek(), ')')) throw new PErr(peek().pos, peek().len, `Missing ")" for the "(" at column ${x.pos + 1}`);
        next(); return a;
      }
      if (x.k === 'eof') throw new PErr(x.pos, 1, 'The expression ends early. Add a number, function or "("');
      throw new PErr(x.pos, x.len, `Unexpected "${x.text}". Expected a number, function or "("`);
    }
    if (T.length === 1) throw new PErr(0, 1, 'Enter an expression');
    const ast = expr(), x = peek();
    if (x.k !== 'eof') throw new PErr(x.pos, x.len, isOp(x, ')') ? 'Unmatched ")" with no opening "("' : `Unexpected "${x.text}"`);
    return ast;
  }

  function evaluate(n, deg) {
    const toR = x => deg ? x * Math.PI / 180 : x, fromR = x => deg ? x * 180 / Math.PI : x;
    const snap = x => Math.abs(x) < 1e-12 ? 0 : x;
    const bad = (n, msg) => { throw new PErr(n.pos, n.t === 'call' ? n.f.length : 1, msg); };
    switch (n.t) {
      case 'num': return n.v;
      case 'neg': return -evaluate(n.x, deg);
      case 'bin': {
        const a = evaluate(n.l, deg), b = evaluate(n.r, deg);
        if (n.op === '+') return a + b; if (n.op === '-') return a - b; if (n.op === '*') return a * b;
        if (n.op === '/') { if (b === 0) bad(n, 'Division by zero'); return a / b; }
        const r = Math.pow(a, b); if (Number.isNaN(r)) bad(n, 'This power is not a real number'); return r;
      }
      case 'call': {
        const a = evaluate(n.a, deg);
        switch (n.f) {
          case 'sin': return snap(Math.sin(toR(a)));
          case 'cos': return snap(Math.cos(toR(a)));
          case 'tan': if (Math.abs(Math.cos(toR(a))) < 1e-12) bad(n, 'tan is undefined at this angle'); return snap(Math.tan(toR(a)));
          case 'asin': if (Math.abs(a) > 1) bad(n, 'asin needs a value from -1 to 1'); return fromR(Math.asin(a));
          case 'acos': if (Math.abs(a) > 1) bad(n, 'acos needs a value from -1 to 1'); return fromR(Math.acos(a));
          case 'atan': return fromR(Math.atan(a));
          case 'sqrt': if (a < 0) bad(n, 'sqrt needs a value of 0 or more'); return Math.sqrt(a);
          case 'ln': if (a <= 0) bad(n, 'ln needs a value above 0'); return Math.log(a);
          case 'log': if (a <= 0) bad(n, 'log needs a value above 0'); return Math.log10(a);
          case 'exp': return Math.exp(a);
          case 'abs': return Math.abs(a);
        }
      }
    }
  }
  function run(src, deg, ans) {
    try {
      // Requirement 03: Parse the expression, including the previous answer
      const v = evaluate( parse( src, ans ), deg );
      if (!Number.isFinite(v)) throw new PErr(0, src.length || 1, 'The result is too large to show');
      return { ok: true, value: Number(v.toPrecision(12)) };
    }
    catch (e) { if (e instanceof PErr) return { ok: false, err: e }; throw e; }
  }

  /* ---------- step by step ---------- */
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
  function str(n, p, deg) {
    let s, q;
    if (n.t === 'num') { s = n.s || String(n.v).replace('-', '−'); q = (n.v < 0 && !n.s) ? 3 : 5; }
    else if (n.t === 'neg') { s = '−' + str(n.x, 4, deg); q = 3; }
    else if (n.t === 'call') { s = `${n.f === 'sqrt' ? '√' : n.f}(${str(n.a, 0, deg)}${deg && /^(sin|cos|tan)$/.test(n.f) ? '°' : ''})`; q = 5; }
    else {
      const m = n.op === '+' || n.op === '-' ? [1, 1, 2] : n.op === '^' ? [4, 5, 3] : [2, 2, 3];
      q = m[0]; const l = str(n.l, m[1], deg), r = str(n.r, m[2], deg);
      s = n.op === '^' ? `${l}^${r}` : `${l} ${SYM[n.op]} ${r}`;
    }
    return q < p ? `(${s})` : s;
  }
  function solve(src, deg, ans) {
    const ast = parse(src, ans), steps = [];
    (function fold(n) {
      if (n.t === 'bin') { fold(n.l); fold(n.r); }
      else if (n.t === 'call') fold(n.a);
      else if (n.t === 'neg') { fold(n.x); if (n.x.t === 'num' && !n.x.s) { n.v = -n.x.v; delete n.x; n.t = 'num'; } }
    })(ast);
    while (ast.t !== 'num') {
      let best = null, rank = 0;
      (function walk(n) {
        if (n.t === 'bin') walk(n.l); else if (n.t === 'neg') walk(n.x); else walk2(n);
        function walk2(n) { if (n.t === 'call') walk(n.a); }
        const ok = n.t === 'bin' ? n.l.t === 'num' && n.r.t === 'num' : n.t === 'neg' ? n.x.t === 'num' : n.t === 'call' && n.a.t === 'num';
        if (ok) { const r = n.t !== 'bin' || n.op === '^' ? 3 : n.op === '*' || n.op === '/' ? 2 : 1; if (r > rank) { rank = r; best = n; } }
        if (n.t === 'bin') walk(n.r);
      })(ast);
      const sub = str(best, 0, deg), val = Number(evaluate(best, deg).toPrecision(10)), isNeg = best.t === 'neg';
      Object.keys(best).forEach(k => delete best[k]); best.t = 'num'; best.v = val;
      if (!isNeg) steps.push({ sub, val: String(val).replace('-', '−'), rest: str(ast, 0, deg) });
    }
    return steps;
  }
  const stepsBox = $('steps'), stepList = $('stepList');
  function hideSteps() { stepsBox.hidden = true; stepsBox.open = false; stepList.replaceChildren(); }
  function showSteps(src) {
    hideSteps(); let st = [];
    try { st = solve(src, deg, previousAnswer); } catch (e) { }
    if (!st.length) return;
    st.forEach((x, i) => {
      const li = document.createElement('li'), a = document.createElement('span');
      a.textContent = `${x.sub} = ${x.val}`; li.append(a);
      if (i < st.length - 1) { const m = document.createElement('small'); m.textContent = '→ ' + x.rest; li.append(m); }
      stepList.append(li);
    });
    stepsBox.hidden = false;
  }

  /* ---------- interface ---------- */
  const exp = $('expr'), out = $('out'), msg = $('msg'), angleBtn = $('angle');
  const modeSelect = $('modeSelect');
  const sciKeys = document.querySelector('.keys.sci');
  let deg = false, fresh = false, last = '';
  let mode = 'basic';

  const modeNames = {
    basic: 'Basic calculation mode',
    scientific: 'Scientific calculation mode',
    financial: 'Financial calculation mode',
    conversion: 'Conversion calculation mode'
  };

  function setMode(nextMode) {
    if (!modeNames[nextMode]) return;
    mode = nextMode;
    modeSelect.value = mode;
    sciKeys.hidden = mode === 'basic';
  }

  /* ---------- Requirement 03: Calculation History ---------- */

  // This is the name used to save our history in the browser.
  const STORAGE_KEY = 'calculator-history-v1';

  // This array will hold all completed calculations.
  let history = [];

  // This variable stores the last successful answer.
  let previousAnswer = null;

  // Load saved history when the calculator opens.
  function loadHistory() 
  {
    try 
    {
      // Get the saved history from localStorage.
      const saved = localStorage.getItem( STORAGE_KEY );

      // If saved history exists, convert it back into an array.
      if ( saved ) 
        {
        const parsed = JSON.parse( saved );

        if ( Array.isArray( parsed ) )
          {
            history = parsed.filter( item => item && typeof item.expression === 'string' && 
            typeof item.result === 'number' && Number.isFinite( item.result ) ).slice( -100 );
          }
        }

        // Restore the last answer from the most recent calculation.
        if ( history.length > 0 )
        {
          previousAnswer = history[history.length - 1].result;
        }
      }
    catch (e) 
    {
      // If loading fails, start with an empty history.
      history = [];
      previousAnswer = null;
    }
  }

  // Save the history to the browser.
  function saveHistory() 
  {
    try
    {
      // Convert the history array into text and save it.
      localStorage.setItem( STORAGE_KEY, JSON.stringify( history ) );
    }
    catch (e) 
    {
      // Calculator still works if browser storage is unavailable.
    }
  }

  // Add a completed calculation to history.
  function addHistory( expression, result )
  {
    // Store the original expression and numeric result.
    history.push( { expression: expression, result: result } );

    // Keep only the 100 most recent calculations.
    if ( history.length > 100 )
    {
      history.shift();
    }

    // Save and update the history display.
    saveHistory();
    renderHistory();
  }

  // Display the saved calculations on the page.
  function renderHistory() 
  {
    // Find the history list in HTML.
    const list = $( 'historyList' );

    // Remove the old displayed entries.
    list.replaceChildren();

    // Show the empty message if there are no calculations.
    $( 'historyEmpty' ).hidden = history.length > 0;

   // Display newest calculations first.
   history.slice().reverse().forEach( item => 
    {
      // Create a new list item.
      const li = document.createElement( 'li' );

      // Create a button for recalling the calculation.
      const button = document.createElement( 'button' );

      button.type = 'button';
      button.className = 'history-entry';

      // Show the expression and its result.
     button.textContent = item.expression + ' = ' + item.result;

      button.title = 'Recall this expression';

      // When clicked, put the old expression into the input.
      button.addEventListener( 'click', () => 
      {
        exp.value = item.expression;
        fresh = false;
        preview();
        exp.focus();
      } );

      // Add the button to the list.
      li.append(button);
      list.append(li);
    } );
  }

  // Clear all saved calculations.
  function clearHistory() 
  {
    // Empty the history array.
    history = [];

    // Reset the previous answer.
    previousAnswer = null;
    last = '';

    // Save the empty history.
    saveHistory();

    // Update the screen.
    renderHistory();
    preview();
  }

  // Connect the Clear History button to our function.
  $( 'clearHistory' ).addEventListener( 'click', clearHistory );

  // Load the saved history when the calculator starts.
  loadHistory();

  // Display the loaded history.
  renderHistory();
  
  if (matchMedia('(pointer:coarse)').matches) exp.inputMode = 'none';

  function preview() {
    msg.className = ''; msg.replaceChildren(); hideSteps();
    if (!exp.value.trim()) { out.textContent = '0'; return; }
    const r = run(exp.value, deg, previousAnswer);
    out.textContent = r.ok ? String(r.value) : '';
  }
  function commit() {
    const s = exp.value; if (!s.trim()) return;
    hideSteps();
    const r = run(s, deg, previousAnswer);
    msg.replaceChildren();
    if (r.ok) {
      out.textContent = String(r.value); msg.textContent = s + ' ='; msg.className = '';
      last = String(r.value).replace(/^(-?[\d.]+)e([+-]\d+)$/, '($1×10^$2)'); fresh = true; showSteps(s);
      addHistory(s, r.value);   // Requirement 03: Save the successful calculation
      previousAnswer = r.value; // Requirement 03: Update the previous answer
    } else {
      const e = r.err, pre = document.createElement('pre'), u = document.createElement('u');
      msg.className = 'err'; msg.append(`${e.message} (column ${e.pos + 1})`);
      u.textContent = s.substr(e.pos, e.len) || ' ';
      pre.append(s.slice(0, e.pos), u, s.slice(e.pos + e.len)); msg.append(pre);
    }
  }
  function insert(t) {
    if (fresh) { exp.value = /^[+−×÷^]/.test(t) ? last : ''; exp.setSelectionRange(exp.value.length, exp.value.length); fresh = false; }
    exp.setRangeText(t, exp.selectionStart, exp.selectionEnd, 'end'); preview();
  }
  function back() {
    fresh = false;
    if (exp.selectionStart === exp.selectionEnd && exp.selectionStart > 0) exp.setSelectionRange(exp.selectionStart - 1, exp.selectionEnd);
    exp.setRangeText('', exp.selectionStart, exp.selectionEnd, 'end'); preview();
  }
  function setAngle() {
    deg = !deg; angleBtn.textContent = deg ? 'Deg' : 'Rad';
    angleBtn.setAttribute('aria-label', `Angle unit: ${deg ? 'degrees' : 'radians'}. Press to switch to ${deg ? 'radians' : 'degrees'}.`);
    preview();
  }
  document.querySelector('main').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  document.querySelector('main').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) insert(b.dataset.k);
    else if (b.dataset.a === 'clear') { fresh = false; exp.value = ''; preview(); }
    else if (b.dataset.a === 'back') back();
    else if (b.dataset.a === 'angle') setAngle();
    else if (b.dataset.a === 'eq') commit();
  });
  exp.addEventListener('input', () => { fresh = false; preview(); });
  exp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  modeSelect.addEventListener('change', () => setMode(modeSelect.value));
  setMode(mode);

  /* background: particles.js */
  function bg() {
    if (typeof particlesJS !== 'function') return;
    if (window.pJSDom && pJSDom.length) { pJSDom[0].pJS.fn.vendors.destroypJS(); window.pJSDom = []; }
    const c = matchMedia('(prefers-color-scheme:dark)').matches ? '#4fd1ae' : '#0b6b57';
    const still = matchMedia('(prefers-reduced-motion:reduce)').matches;
    particlesJS('bg', { particles: { number: { value: 55, density: { enable: true, value_area: 900 } }, color: { value: c }, opacity: { value: .35 }, size: { value: 3 }, line_linked: { enable: true, distance: 150, color: c, opacity: .25, width: 1 }, move: { enable: !still, speed: 1.2 } }, interactivity: { events: { onhover: { enable: false }, onclick: { enable: false } } } });
  }
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change', bg);
  bg();
  if (!matchMedia('(pointer:coarse)').matches) exp.focus();
})();
