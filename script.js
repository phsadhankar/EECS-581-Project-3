/*
 * SEMESTER:        EECS 581 Fall 2026
 * PROJECT:         Project 3 - Calculator
 * FILE:            script.js
 *
 * DESCRIPTION:     Implements calculator logic, expression evaluation, saved history, and Ans recall.
 *
 * INPUT:           Expressions, button actions, and saved browser history.
 * OUTPUT:          Calculated results, error messages, and recalled calculations.
 * 
 * COLLABORATORS:   Ivan Kullaya, Gael Salazar-Morales, Gabriel Haro-Villa, Carter Ruff, Liam Kinghouser
 * SOURCES:         TBD
 * 
 * AUTHOR:          Pruthviraj Sadhankar
 * CREATION DATE:   11/01/2026
 */

(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  class PErr extends Error { constructor(pos, len, msg) { super(msg); this.pos = pos; this.len = Math.max(1, len); } }

  class Decimal {

    constructor(m, exp = 0n) {
      let val = BigInt(m);
      let e = BigInt(exp);
      if (val === 0n) {
        e = 0n;
      } else {
        while (val % 10n === 0n) {
          val /= 10n;
          e++;
        }
        if (e < 0n) {
          let sign = val < 0n ? -1n : 1n;
          let absVal = val < 0n ? -val : val;
          let absStr = absVal.toString();
          let decPos = absStr.length + Number(e);
          let fracPart = decPos > 0 ? absStr.slice(decPos) : absStr;

          if (/9{15,}$/.test(absStr)) {
            val += sign;
          } else {
            let m9 = fracPart.match(/(9{15,})(\d{1,3})$/);
            let m0 = fracPart.match(/(0{15,})(\d{1,3})$/);
            if (m9) {
              val += sign * (10n ** BigInt(m9[2].length) - (absVal % (10n ** BigInt(m9[2].length))));
            } else if (m0) {
              val -= sign * (absVal % (10n ** BigInt(m0[2].length)));
            }
          }
          
          while (val % 10n === 0n && val !== 0n) {
            val /= 10n;
            e++;
          }
        }
      }
      
      this.m = val;
      this.exp = e;
    }

    static fromString(s) {
      s = s.trim().replace('−', '-');
      if (!s) return new Decimal(0n);

      let sign = 1n;

      if (s.startsWith('-')) {
        sign = -1n;
        s = s.slice(1);
      } else if (s.startsWith('+')) {
        s = s.slice(1);
      }

      let [main, expPart] = s.split(/[eE]/);
      let exp = expPart ? BigInt(expPart) : 0n;

      let dot = main.indexOf('.');
      if (dot !== -1) {
        exp -= BigInt(main.length - 1 - dot);
        main = main.slice(0, dot) + main.slice(dot + 1);
      }

      let m = BigInt(main || '0') * sign;
      return new Decimal(m, exp);
    }

    static fromNumber(n) {
      if (!Number.isFinite(n)) throw new Error('Result is not finite');

      return Decimal.fromString(Number(n.toPrecision(15)).toString());
    }

    isZero() { return this.m === 0n; }

    isNegative() { return this.m < 0n; }

    neg() { return new Decimal(-this.m, this.exp); }

    abs() { return new Decimal(this.m < 0n ? -this.m : this.m, this.exp); }

    add(other) {
      if (this.isZero()) return other;
      if (other.isZero()) return this;

      let diff = this.exp - other.exp;

      if (diff > 0n) {
        return new Decimal(this.m * (10n ** diff) + other.m, other.exp);
      } else if (diff < 0n) {
        return new Decimal(this.m + other.m * (10n ** (-diff)), this.exp);
      }
      return new Decimal(this.m + other.m, this.exp);
    }

    sub(other) {
      return this.add(other.neg());
    }

    mul(other) {
      if (this.isZero() || other.isZero()) return new Decimal(0n);
      return new Decimal(this.m * other.m, this.exp + other.exp);
    }

    div(other, precision = 40) {
      if (other.isZero()) throw new Error('Division by zero');
      if (this.isZero()) return new Decimal(0n);

      let sign = (this.m < 0n !== other.m < 0n) ? -1n : 1n;
      let a = this.abs().m;
      let b = other.abs().m;

      let shift = precision + String(b).length - String(a).length + 1;
      if (shift < 1) shift = 1;

      let q = (a * (10n ** BigInt(shift))) / b;
      q = (q + 5n) / 10n;

      let exp = this.exp - other.exp - BigInt(shift - 1);
      return new Decimal(sign * q, exp);
    }

    pow(other) {
      if (other.isZero()) return new Decimal(1n);
      if (this.isZero()) return new Decimal(0n);

      if (other.exp >= 0n) {
        let k = other.m * (10n ** other.exp);
        if (k < 0n) return (new Decimal(1n)).div(this.pow(other.neg()));
        if (k > 10000n) throw new Error('Exponent too large');

        let base = this;
        let res = new Decimal(1n);
        while (k > 0n) {
          if (k % 2n === 1n) res = res.mul(base);
          base = base.mul(base);
          k /= 2n;
        }
        return res;
      }

      if (this.isNegative()) throw new Error('This power is not a real number');
      const r = Math.pow(this.toNumber(), other.toNumber());
      if (Number.isNaN(r)) throw new Error('This power is not a real number');
      return Decimal.fromNumber(r);
    }

    sqrt(precision = 40) {
      if (this.isNegative()) throw new Error('sqrt needs a value of 0 or more');
      if (this.isZero()) return new Decimal(0n);

      let m = this.m;
      let exp = this.exp;
      if (exp % 2n !== 0n) {
        m *= 10n;
        exp--;
      }

      let shift = BigInt(precision * 2);
      let target = m * (10n ** shift);
      let x0 = 10n ** BigInt(Math.ceil(String(target).length / 2));
      let x1 = (x0 + target / x0) / 2n;
      while (x1 < x0) {
        x0 = x1;
        x1 = (x0 + target / x0) / 2n;
      }

      return new Decimal(x0, (exp - shift) / 2n);
    }

    toNumber() {
      return Number(this.toString());
    }

    toString() {
      if (this.m === 0n) return '0';

      let sign = this.m < 0n ? '-' : '';
      let s = String(this.m < 0n ? -this.m : this.m);
      let exp = Number(this.exp);
      let decPos = s.length + exp;

      if (exp >= 0) {
        if (exp <= 20) return sign + s + '0'.repeat(exp);
        let frac = s.slice(1);
        return `${sign}${s[0]}${frac ? '.' + frac : ''}e+${s.length - 1 + exp}`;
      }

      if (decPos > 0) {
        return sign + s.slice(0, decPos) + '.' + s.slice(decPos);
      } else if (decPos >= -15) {
        return sign + '0.' + '0'.repeat(-decPos) + s;
      } else {
        let frac = s.slice(1);
        return `${sign}${s[0]}${frac ? '.' + frac : ''}e${decPos - 1}`;
      }
    }
  }

  const OPS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '·': '*', '/': '/', '÷': '/', '^': '^', '(': '(', ')': ')' };
  const FUNCS = { sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sqrt: 1, ln: 1, log: 1, exp: 1, abs: 1 };
  const CONSTS = {
    pi: Decimal.fromString('3.14159265358979323846264338327950288419716939937510'),
    'π': Decimal.fromString('3.14159265358979323846264338327950288419716939937510'),
    e: Decimal.fromString('2.71828182845904523536028747135266249775724709369995')
  };

  function tokenize(s) {
    const t = []; let i = 0, m;
    while (i < s.length) {
      const c = s[i], rest = s.slice(i);
      if (/\s/.test(c)) { i++; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)/.exec(rest))) { t.push({ k: 'num', v: Decimal.fromString(m[1]), text: m[1], pos: i, len: m[1].length }); i += m[1].length; continue; }
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
            // Make sure a previous answer exists, if not throw an error
            if ( ans === null ) 
              {
                throw new PErr( x.pos, x.len, 'No previous answer is available' );
              }

            // Use the previous answer as a number
            return { t: 'num', v: ans };
          }
        if (x.v in CONSTS) return { t: 'num', v: CONSTS[x.v], s: x.v === 'e' ? 'e' : 'π' };
        if (functionRegistry.has(x.v)) {
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
      case 'neg': return evaluate(n.x, deg).neg();
      case 'bin': {
        const a = evaluate(n.l, deg), b = evaluate(n.r, deg);
        if (n.op === '+') return a.add(b); if (n.op === '-') return a.sub(b); if (n.op === '*') return a.mul(b);
        if (n.op === '/') { if (b.isZero()) bad(n, 'Division by zero'); return a.div(b); }
        try { return a.pow(b); } catch (e) { bad(n, e.message); }
        break;
      }
      case 'call': {
        const a = evaluate(n.a, deg);
        if (n.f === 'abs') return a.abs();
        if (n.f === 'sqrt') { if (a.isNegative()) bad(n, 'sqrt needs a value of 0 or more'); return a.sqrt(); }
        const v = a.toNumber();
        switch (n.f) {
          case 'sin': return Decimal.fromNumber(snap(Math.sin(toR(v))));
          case 'cos': return Decimal.fromNumber(snap(Math.cos(toR(v))));
          case 'tan': if (Math.abs(Math.cos(toR(v))) < 1e-12) bad(n, 'tan is undefined at this angle'); return Decimal.fromNumber(snap(Math.tan(toR(v))));
          case 'asin': if (Math.abs(v) > 1) bad(n, 'asin needs a value from -1 to 1'); return Decimal.fromNumber(fromR(Math.asin(v)));
          case 'acos': if (Math.abs(v) > 1) bad(n, 'acos needs a value from -1 to 1'); return Decimal.fromNumber(fromR(Math.acos(v)));
          case 'atan': return Decimal.fromNumber(fromR(Math.atan(v)));
          case 'ln': if (v <= 0) bad(n, 'ln needs a value above 0'); return Decimal.fromNumber(Math.log(v));
          case 'log': if (v <= 0) bad(n, 'log needs a value above 0'); return Decimal.fromNumber(Math.log10(v));
          case 'exp': return Decimal.fromNumber(Math.exp(v));
        }
        break;
      }
    }
  }
  function run(src, deg, ans) {
    try {
      const v = evaluate(parse(src, ans), deg);
      return { ok: true, value: v.toString() };
    }
    catch (e) { if (e instanceof PErr) return { ok: false, err: e }; throw e; }
  }
  function openConverter() {
    converterPanel.hidden = false;
    out.hidden = false;
    msg.hidden = false;
  }

  function closeUnitConverter() {
    converterPanel.hidden = true;
    out.hidden = false;
    msg.hidden = false;
    preview();
  }

  /* ---------- step by step ---------- */
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
  function str(n, p, deg) {
    let s, q;
    if (n.t === 'num') { s = n.s || n.v.toString().replace('-', '−'); q = (n.v.isNegative() && !n.s) ? 3 : 5; }
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
      else if (n.t === 'neg') { fold(n.x); if (n.x.t === 'num' && !n.x.s) { n.v = n.x.v.neg(); delete n.x; n.t = 'num'; } }
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
      const sub = str(best, 0, deg), val = evaluate(best, deg), isNeg = best.t === 'neg';
      Object.keys(best).forEach(k => delete best[k]); best.t = 'num'; best.v = val;
      if (!isNeg) steps.push({ sub, val: val.toString().replace('-', '−'), rest: str(ast, 0, deg) });
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
  // Unit Converter elements
  const converterPanel = $('converterPanel');
  const categorySelect = $('conversionCategory');
  const conversionControls = $('conversionControls');
  const fromUnit = $('fromUnit');
  const toUnit = $('toUnit');

  const conversionUnits = {
    length: {
      Meter: 1,
      Kilometer: 1000,
      Centimeter: 0.01,
      Millimeter: 0.001,
      Mile: 1609.344,
      Foot: 0.3048,
      Inch: 0.0254
    },

    mass: {
      Kilogram: 1,
      Gram: 0.001,
      Milligram: 0.000001,
      Pound: 0.45359237,
      Ounce: 0.028349523125
    },

    volume: {
      Liter: 1,
      Milliliter: 0.001,
      "US Gallon": 3.785411784,
      "US Quart": 0.946352946,
      "US Cup": 0.2365882365
    },

    temperature: {
      Celsius: "C",
      Fahrenheit: "F",
      Kelvin: "K"
    },

    currency: {
      USD: "USD",
      EUR: "EUR",
      GBP: "GBP",
      CAD: "CAD",
      AUD: "AUD",
      JPY: "JPY"
    }
};
// Convert length, mass, and volume
function convertMeasurement(value, from, to, units) {
  // Convert the input into the base unit
  const baseValue = value * units[from];

  // Convert the base unit into the destination unit
  return baseValue / units[to];
}
function convertTemperature(value, from, to) {
  let celsius;

  // Convert the input to Celsius first
  if (from === 'C') {
    celsius = value;
  } else if (from === 'F') {
    celsius = (value - 32) * 5 / 9;
  } else if (from === 'K') {
    celsius = value - 273.15;
  }

  // Convert Celsius to the selected destination
  if (to === 'C') {
    return celsius;
  } else if (to === 'F') {
    return (celsius * 9 / 5) + 32;
  } else if (to === 'K') {
    return celsius + 273.15;
  }
}
// Calculate and display the conversion result
async function updateConversionResult() {
  const category = categorySelect.value;
  const value = Number(exp.value);

  // Make sure a category and valid number are selected
  if (!category) {
    out.textContent = '0';
    msg.textContent = '';
    return;
  }

  if (exp.value.trim() === '' || !Number.isFinite(value)) {
    out.textContent = '';
    msg.textContent = 'error';
    return;
  }

  // Handle temperature separately
if (category === 'temperature') {
  const result = convertTemperature(
    value,
    conversionUnits.temperature[fromUnit.value],
    conversionUnits.temperature[toUnit.value]
  );

  out.textContent = Number(result.toFixed(8));
  msg.textContent = '';
  return;
}

// Handle currency conversion
if (category === 'currency') {
  const from = fromUnit.value;
  const to = toUnit.value;

  // If both currencies are the same, no conversion is needed
  if (from === to) {
    out.textContent = Number(value.toFixed(2));
    msg.textContent = '';
    return;
  }

try {
  // Get the latest exchange rate
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${from}/${to}`
  );

  if (!response.ok) {
    throw new Error('Exchange rate unavailable');
  }

  const data = await response.json();

  // Calculate the converted amount
  const result = value * data.rate;

  out.textContent = Number(result.toFixed(2));
  msg.textContent = 
  `rate: 1 ${from} = ${data.rate} ${to}
  rate date: ${data.date}
  source: Frankfurter API`;

  } catch (error) {
    out.textContent = '';
    msg.textContent = 'Unable to retrieve exchange rate.';
  }

  return;
}

  const units = conversionUnits[category];

  const from = fromUnit.value;
  const to = toUnit.value;

  const result = convertMeasurement(value, from, to, units);

  out.textContent = Number(result.toFixed(8));
  msg.textContent = '';
}

// Update result whenever the user changes something
fromUnit.addEventListener('change', updateConversionResult);
toUnit.addEventListener('change', updateConversionResult);

// Update available units when category changes
categorySelect.addEventListener('change', () => {
  const category = categorySelect.value;

  fromUnit.innerHTML = '';
  toUnit.innerHTML = '';

  if (!category) {
    conversionControls.hidden = true;
    return;
  }

  conversionControls.hidden = false;

  const units = conversionUnits[category];

  for (const unit in units) {
    const option1 = document.createElement('option');
    option1.value = unit;
    option1.textContent = unit;

    const option2 = document.createElement('option');
    option2.value = unit;
    option2.textContent = unit;

    fromUnit.appendChild(option1);
    toUnit.appendChild(option2);
  }

  if (toUnit.options.length > 1) {
    toUnit.selectedIndex = 1;
  }
});

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

  const STORAGE_KEY = 'calculator-history-v1';  // Requirement 03: Name used to save our history in the browser.
  let history = [];                 // Requirement 03: The array to hold all completed calculations.
  let previousAnswer = null;        // Requirement 03: This variable stores the last successful answer.

  // Requirement 03: loadHistory() loads saved history when the calculator opens. Firstly getting the
  // saved history from localStorage. If the saved history exists, it'll be converted back into an
  // array where it only keeps the valid characters and the most recent 100 calculations. If the length
  // of the saved history is greater than zero, then it'll restore the last answer from the most recent
  // calculation. If there's an error, it'll start with an empty history and previous answer.
  function loadHistory() 
  {
    try 
    {
      const saved = localStorage.getItem( STORAGE_KEY );

      if ( saved ) 
        {
        const parsed = JSON.parse( saved );

        if ( Array.isArray( parsed ) )
          {
            history = parsed.filter( item => 
            item && typeof item.expression === 'string' && ( typeof item.result === 'string' ||
            ( typeof item.result === 'number' && Number.isFinite( item.result ) ) ) );

            history = history.slice( -100 );
          }
        }

        if ( history.length > 0 )
        {
          previousAnswer = Decimal.fromString( String( history[ history.length - 1 ].result ) );
        }
      }
    catch (e) 
    {
      history = [];
      previousAnswer = null;
    }
  }

  // Requirement 03: saveHistory() saves the history to the browser. It will convert the history
  // array into text and save it, even if the browser storage is unavailable.
  function saveHistory() 
  {
    try
    {
      localStorage.setItem( STORAGE_KEY, JSON.stringify( history ) );
    }
    catch (e) 
    { }
  }

  // Requirement 03: addHistory() adds a completed calculation to history. Firstly it stores the
  // original expression and numeric result. Then, after it only keeps the most 100 recent calculations
  // it will save and update the history display.
  function addHistory( expression, result )
  {
    history.push( { expression: expression, result: result } );

    if ( history.length > 100 )
    {
      history.shift();
    }

    saveHistory();
    renderHistory();
  }

  // Requirement 03: renderHistory() displays the saved calculations on the page. Firstly it finds the
  // history list in the HTML, removes the old displayed entries, then shows the empty message if
  // there are no calculations. Next it displays the newest calculation first by creating a new list
  // item and a new button. Afterwards it'll show the expression and its result, and when the button
  // is clicked it will put the old expression into the input. Then finally it'll add the button to
  // the list.
  function renderHistory() 
  {
    const list = $( 'historyList' );
    list.replaceChildren();
    $( 'historyEmpty' ).hidden = history.length > 0;

   history.slice().reverse().forEach( item => 
    {
      const li = document.createElement( 'li' );
      const button = document.createElement( 'button' );

      button.type = 'button';
      button.className = 'history-entry';
      button.textContent = item.expression + ' = ' + item.result;
      button.title = 'Recall this expression';

      button.addEventListener( 'click', () => 
      {
        exp.value = item.expression;
        fresh = false;
        preview();
        exp.focus();
      } );

      li.append(button);
      list.append(li);
    } );
  }

  // Requirement 03: clearHistory() clear all saved calculations. Firstly it'll empty the history
  // array and reset the previous answer. After saving the empty history it'll update the screen.
  function clearHistory() 
  {
    history = [];
    previousAnswer = null;
    last = '';

    saveHistory();
    renderHistory();
    preview();
  }

  // Requirement 23: downloadHistort() downloads a file to the user's computer. Firstly a new file,
  // a temporary link to the file and a temporary download button are all created. Once the button
  // connects to the link and the downloaded file is given a name, it will add the link to the page
  // to start downloading. Afterwards the temporary link and temporary file are removed.
  function downloadHistory( content, filename, fileType )
  {
    const file = new Blob( [content], { type: fileType } );
    const url = URL.createObjectURL( file );
    const link = document.createElement( 'a' );

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // exportTXT() exports the history as a TXT file. If there's no calculations to export, a message
  // is sent. If there are, the text starts with a title then goes through each calculation to
  // adds the expressions and its answer. Then it calls downloadHistory() to download the file then
  // lets the user know.
  function exportTXT()
  {
    if ( history.length === 0 )
    {
      $( 'exportMessage' ).textContent = 'No history to export.';
      return;
    }

    let text = 'Calculation History\n\n';

    history.forEach( item => { text += item.expression + ' = ' + item.result + '\n'; } );
    downloadHistory( text, 'calculator-history.txt', 'text/plain;charset=utf-8' );
    $( 'exportMessage' ).textContent = 'TXT export started.';
  }


  // Requirement 23: csvValue() prepares a value for a CSV file. The value is converted to text, then
  // replaces quotation marks with double quotation marks and puts the quotation marks around the
  function csvValue( value )
  {
    const text = String( value );
    const escaped = text.replace( /"/g, '""' );

    return '"' + escaped + '"';
  }


  // Requirement 23: exportCSV() exports the history as a CSV file. If the history is empty, a message
  // is sent. If there is history a colum heading is created then each calculation will have the 
  // expression and result added as a row. Afterwards downloadHistory() is called to download the CSV
  // then the user is let known through a message.
  function exportCSV()
  {
    if ( history.length === 0 )
    {
      $( 'exportMessage' ).textContent = 'No history to export.';
      return;
    }

    let csv = 'Expression,Result\n';

    history.forEach( item => { csv += csvValue( item.expression ) + ',' + csvValue( item.result )
    + '\n'; } );

    downloadHistory( csv, 'calculator-history.csv', 'text/csv;charset=utf-8' );
    $( 'exportMessage' ).textContent = 'CSV export started.';
  }
  
  // Requirement 23: Connects the export button to their respective function
  $( 'exportTXT' ).addEventListener( 'click', exportTXT );
  $( 'exportCSV' ).addEventListener( 'click', exportCSV );

  // Requirement 03: Connect the Clear History button to our function.
  $( 'clearHistory' ).addEventListener( 'click', clearHistory );
  loadHistory();      // Requirement 03: Load the saved history when the calculator starts.
  renderHistory();    // Requirement 03: Display the loaded history.
  
  if (matchMedia('(pointer:coarse)').matches) exp.inputMode = 'none';

  function preview() {
    msg.className = ''; msg.replaceChildren(); hideSteps();
    if (!exp.value.trim()) { out.textContent = '0'; return; }
    const r = run(exp.value, deg, previousAnswer);
    out.textContent = r.ok ? r.value.replace('-', '−') : '';
  }
  function commit() {
    const s = exp.value; if (!s.trim()) return;
    hideSteps();
    const r = run(s, deg, previousAnswer);
    msg.replaceChildren();
    if (r.ok) {
      out.textContent = r.value.replace('-', '−'); msg.textContent = s + ' ='; msg.className = '';
      last = r.value.replace(/^(-?[\d.]+)e([+-]?\d+)$/i, '($1×10^$2)'); fresh = true; showSteps(s); addHistory(s, r.value); previousAnswer = Decimal.fromString(r.value);
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
    if (b.dataset.k) {
      if (!converterPanel.hidden) {
        exp.value += b.dataset.k;
        updateConversionResult();
      } else {
      insert(b.dataset.k);
      }
    }
    else if (b.dataset.a === 'converter') {
      openConverter();
    }
    else if (b.dataset.a === 'clear') {
      if (!converterPanel.hidden) {
        exp.value = '';
        out.textContent = '0';
        msg.textContent = '';
        categorySelect.value = '';
        conversionControls.hidden = true;
        closeUnitConverter();
      } else {
        fresh = false; exp.value = ''; preview();
      }
    }
    else if (b.dataset.a === 'back') back();
    else if (b.dataset.a === 'angle') setAngle();
    else if (b.dataset.a === 'eq') commit();
  });
  exp.addEventListener('input', () => { 
    fresh = false; 
    if (!converterPanel.hidden) {
      updateConversionResult();
    } else {
    preview();
  }});
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

  // Allow the function menu to insert expressions
  window.insertCalculatorFunction = function(symbol) {
    if (!converterPanel.hidden) {
      closeUnitConverter();
    }

    insert(symbol);
  };

})();

// Element Variables
const menuToggle = document.getElementById("FuncToggle");
const sideMenu = document.getElementById("sideMenu");
const categoryFilter = document.getElementById("categoryFilter");
const functionSearch = document.getElementById("functionSearch");
const functionList = document.getElementById("functionList");

// Menu Toggle Logic
menuToggle.addEventListener("click", () => {
  sideMenu.classList.toggle("open");
  menuToggle.setAttribute(
    "aria-expanded",
    sideMenu.classList.contains("open")
  );
});

// Generate category dropdown automatically
function loadCategories() {
  const categories = new Set();

  calculatorFunctions.forEach(func => {
    func.categories.forEach(category => {
      categories.add(category);
    });
  });

  categoryFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Categories";
  categoryFilter.appendChild(allOption);

  [...categories].sort().forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

// Display functions matching category and search
function displayFunctions() {
  const search = functionSearch.value.toLowerCase().trim();
  const category = categoryFilter.value;

  const filtered = calculatorFunctions.filter(func => {
    const matchesCategory =
      category === "all" ||
      func.categories.includes(category);

    const matchesSearch =
      func.name.toLowerCase().includes(search) ||
      func.symbol.toLowerCase().includes(search) ||
      func.categories.some(tag =>
        tag.toLowerCase().includes(search)
      );

    return matchesCategory && matchesSearch;
  });

  functionList.replaceChildren();

  if (filtered.length === 0) {
    const message = document.createElement("p");
    message.textContent = "No functions found.";
    functionList.appendChild(message);
    return;
  }

  filtered.forEach(func => {
    const button = document.createElement("button");
    button.className = "function-item";
    button.type = "button";

    const name = document.createElement("span");
    name.textContent = func.name;

    const symbol = document.createElement("small");
    symbol.textContent = func.symbol;

    button.append(name, symbol);

    button.addEventListener("click", () => {
      window.insertCalculatorFunction(func.symbol);
    });

    functionList.appendChild(button);
  });
}

// Search and filter events
categoryFilter.addEventListener("change", displayFunctions);
functionSearch.addEventListener("input", displayFunctions);

// Initialize
loadCategories();
displayFunctions();