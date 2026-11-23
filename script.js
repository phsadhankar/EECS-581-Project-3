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
  // ========================================
  // CALCULATOR CORE
  // ========================================
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

    toString(plain = false) {
      if (this.m === 0n) return '0';

      let sign = this.m < 0n ? '-' : '';
      let s = String(this.m < 0n ? -this.m : this.m);
      let exp = Number(this.exp);
      let decPos = s.length + exp;

      if (exp >= 0) {
        if (plain || exp <= 20) return sign + s + '0'.repeat(exp);
        let frac = s.slice(1);
        return `${sign}${s[0]}${frac ? '.' + frac : ''}e+${s.length - 1 + exp}`;
      }

      if (decPos > 0) {
        return sign + s.slice(0, decPos) + '.' + s.slice(decPos);
      } else if (plain || decPos >= -15) {
        return sign + '0.' + '0'.repeat(-decPos) + s;
      } else {
        let frac = s.slice(1);
        return `${sign}${s[0]}${frac ? '.' + frac : ''}e${decPos - 1}`;
      }
    }
  }

  /* Matrix operations and limits */
  const MATRIX_ENTRY_LIMIT = 2500;
  const MATRIX_PRODUCT_LIMIT = 125000;
  const MATRIX_SQUARE_LIMIT = 32;
  const MATRIX_FUNCTIONS = new Set(['matrix', 'transpose', 'det', 'inverse']);
  const SYMBOLIC_FUNCTIONS = new Set(['derivative', 'integral', 'solve']);

  /* Matrix class to represent matrices and perform operations */
  class Matrix {
    constructor(rows) {
      this.rows = rows;
      this.height = rows.length;
      this.width = rows[0].length;
    }

    /* Applies a function to each entry of the matrix and returns a new matrix */
    map(fn) {
      return new Matrix(this.rows.map((row, i) => row.map((value, j) => fn(value, i, j))));
    }

    transpose() {
      return new Matrix(this.rows[0].map((_, j) => this.rows.map(row => row[j])));
    }

    toString() {
      return `matrix([${this.rows.map(row => `[${row.map(value => value.toString(true)).join(',')}]`).join(',')}])`;
    }
  }

  /* Performs matrix operations based on the operator and operands */
  function matrixOperation(op, a, b, fail) {
    const aMatrix = a instanceof Matrix, bMatrix = b instanceof Matrix;
    if (op === '+' || op === '-') {
      if (!aMatrix || !bMatrix || a.height !== b.height || a.width !== b.width) {
        fail('Matrix addition and subtraction require two matrices with identical dimensions');
      }
      return a.map((value, i, j) => op === '+' ? value.add(b.rows[i][j]) : value.sub(b.rows[i][j]));
    }
    if (op !== '*') fail(`Operator "${op}" is unsupported for matrices`);
    if (!aMatrix) return b.map(value => a.mul(value));
    if (!bMatrix) return a.map(value => value.mul(b));
    if (a.width !== b.height) {
      fail('Matrix multiplication requires the left column count to match the right row count');
    }
    if (a.height * b.width > MATRIX_ENTRY_LIMIT || a.height * b.width * a.width > MATRIX_PRODUCT_LIMIT) {
      fail('Matrix product is too large');
    }
    const columns = b.transpose().rows;
    return new Matrix(a.rows.map(row => columns.map(column =>
      row.reduce((sum, value, k) => sum.add(value.mul(column[k])), new Decimal(0n))
    )));
  }

  /* Performs fraction-free Gaussian elimination to compute the determinant or inverse of a matrix */
  function eliminateMatrix(matrix, inverse, fail) {
    const size = matrix.height;
    const operation = inverse ? 'inverse' : 'det';
    if (size !== matrix.width) fail(`${operation} requires a square matrix`);
    if (size > MATRIX_SQUARE_LIMIT) fail(`${operation} supports matrices up to ${MATRIX_SQUARE_LIMIT} × ${MATRIX_SQUARE_LIMIT}`);

    // Scale the entries to integers so fraction-free elimination can detect exact zero pivots.
    const scale = matrix.rows.flat().reduce((min, value) =>
      !value.isZero() && (min === null || value.exp < min) ? value.exp : min, null) ?? 0n;
    const rows = matrix.rows.map((row, i) => {
      const values = row.map(value => {
        if (value.isZero()) return 0n;
        const shift = value.exp - scale;
        if (shift + BigInt(String(value.m).length) > 512n) {
          fail(`${operation} exceeds the matrix calculation precision limit`);
        }
        return value.m * 10n ** shift;
      });
      if (inverse) {
        for (let j = 0; j < size; j++) values.push(i === j ? 1n : 0n);
      }
      return values;
    });

    /* Requirement 27: Implement fraction-free Gaussian elimination to compute the determinant or inverse of a matrix */
    let previousPivot = 1n, sign = 1n;
    for (let k = 0; k < size; k++) {
      let pivotRow = k;
      while (pivotRow < size && rows[pivotRow][k] === 0n) pivotRow++;
      if (pivotRow === size) {
        if (inverse) fail('Singular-matrix error; no inverse.');
        return new Decimal(0n);
      }
      if (pivotRow !== k) {
        [rows[k], rows[pivotRow]] = [rows[pivotRow], rows[k]];
        sign = -sign;
      }
      const pivot = rows[k][k];
      for (let i = inverse ? 0 : k + 1; i < size; i++) {
        if (i === k) continue;
        const factor = rows[i][k];
        for (let j = inverse ? 0 : k + 1; j < rows[i].length; j++) {
          if (j !== k) rows[i][j] = (pivot * rows[i][j] - factor * rows[k][j]) / previousPivot;
        }
        rows[i][k] = 0n;
      }
      previousPivot = pivot;
    }
    if (!inverse) return new Decimal(sign * previousPivot, scale * BigInt(size));
    const denominator = new Decimal(previousPivot);
    return new Matrix(rows.map(row => row.slice(size).map(value =>
      new Decimal(value, -scale).div(denominator)
    )));
  }

  const OPS = { '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '·': '*', '/': '/', '÷': '/', '^': '^', '(': '(', ')': ')', ',': ',', '[': '[', ']': ']', '=': '=' };
  const FUNCS = { sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sqrt: 1, ln: 1, log: 1, exp: 1, abs: 1, prime: 1, fact: 1, gcd: 2, lcm: 2, pinc: 2, pdec: 2, pdiff: 2, mean: 1, medn: 1, mode: 1, stdev: 1, var: 1, stats: 1 };
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
      if ((m = /^d\s*\/\s*d([a-z]?)(?=\s*\()/i.exec(rest))) {
        t.push({ k: 'id', v: 'derivative', variable: m[1].toLowerCase(), text: m[0], pos: i, len: m[0].length });
        i += m[0].length;
        continue;
      }
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
    const T = tokenize(src); let i = 0, usesMatrix = false;
    let usesSymbolic = false, symbolicDepth = 0;
    const peek = () => T[i], next = () => T[i++];
    const isOp = (x, ...v) => x.k === 'op' && v.includes(x.v);
    const startsAtom = x => x.k === 'num' || x.k === 'id' || isOp(x, '(', '[');
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
      if (x.k === 'num') return { t: 'num', v: x.v, raw: x.text };
      if (x.k === 'id') {
        // Requirement 03: Allow the user to type Ans
        if ( x.v === 'ans' )
          {
            // Make sure a previous answer exists, if not throw an error
            if ( ans === null ) 
              {
                throw new PErr( x.pos, x.len, 'No previous answer is available' );
              }

            if (ans instanceof Matrix) {
              usesMatrix = true;
              return { t: 'matrixValue', v: ans };
            }
            return { t: 'num', v: ans };
          }
        if (Object.hasOwn(CONSTS, x.v)) return { t: 'num', v: CONSTS[x.v], s: x.v === 'e' ? 'e' : 'π' };
        if (functionRegistry.has(x.v)) {
          /* Requirement 27: Matrix functions */
          if (MATRIX_FUNCTIONS.has(x.v)) usesMatrix = true;
          if (!isOp(peek(), '(')) {
            throw new PErr(x.pos, x.len, `"${x.text}" needs parentheses, for example ${x.text}(1)`);
          }
          const open = next();
          const args = [];
          const symbolic = SYMBOLIC_FUNCTIONS.has(x.v);
          if (symbolic) {
            usesSymbolic = true;
            symbolicDepth++;
            if (x.variable === '' || (x.variable && Object.hasOwn(CONSTS, x.variable))) {
              throw new PErr(x.pos, x.len, 'Specify a variable, for example x');
            }
          }
          const missingArg = token => {
            let message = x.v === 'integral' && args.length >= 2
              ? 'Definite integral requires both lower and upper bounds'
              : 'Missing argument near ","';
            if (args.length === 1 && !x.variable) message = 'Specify a variable, for example x';
            if (x.v === 'solve' && !args.length) message = 'Enter an equation, for example 2x + 3 = 11';
            throw new PErr(token.pos, token.len, message);
          };

          // Parse comma-separated arguments inside the function call
          if (!isOp(peek(), ')')) {
            if (isOp(peek(), ',')) {
              if (symbolic) missingArg(peek());
              throw new PErr(peek().pos, peek().len, 'Missing argument before ","');
            }
            const first = expr();
            if (x.v === 'solve') {
              const equal = peek();
              if (!isOp(equal, '=')) throw new PErr(equal.pos, equal.len, 'Enter an equation with one "=" sign');
              next();
              const right = expr();
              if (isOp(peek(), '=')) throw new PErr(peek().pos, peek().len, 'Enter an equation with one "=" sign');
              args.push({ t: 'equation', l: first, r: right });
            } else {
              args.push(first);
            }
            while (isOp(peek(), ',')) {
              const comma = next();
              if (isOp(peek(), ')') || isOp(peek(), ',')) {
                if (symbolic) missingArg(comma);
                throw new PErr(comma.pos, comma.len, 'Missing argument after ","');
              }
              args.push(expr());
            }
          }

          if (!isOp(peek(), ')')) {
            throw new PErr(peek().pos, peek().len, `Missing ")" for the "(" at column ${open.pos + 1}`);
          }
          next();
          if (symbolic) symbolicDepth--;
          if (x.variable) {
            if (args.length !== 1) throw new PErr(x.pos, x.len, 'Derivative requires one expression inside parentheses');
            args.push({ t: 'var', name: x.variable, pos: x.pos });
          }

          return {
            t: 'call',
            f: x.v,
            a: args[0],
            args: args,
            pos: x.pos
          };
        }
        if (symbolicDepth && /^[a-z]$/.test(x.v)) return { t: 'var', name: x.v, pos: x.pos };
        if (symbolicDepth && isOp(peek(), '(')) throw new PErr(x.pos, x.len, `Unsupported function "${x.text}"`);
        throw new PErr(x.pos, x.len, `Unknown name "${x.text}"`);
      }
      if (isOp(x, '[')) {
        const items = [];
        if (!isOp(peek(), ']')) {
          if (isOp(peek(), ',')) {
            throw new PErr(peek().pos, peek().len, 'Missing value before "," in brackets');
          }
          items.push(expr());
          while (isOp(peek(), ',')) {
            const comma = next();
            if (isOp(peek(), ']') || isOp(peek(), ',')) {
              throw new PErr(comma.pos, comma.len, 'Missing value after "," in brackets');
            }
            items.push(expr());
          }
        }
        if (!isOp(peek(), ']')) {
          throw new PErr(peek().pos, peek().len, `Missing "]" for the "[" at column ${x.pos + 1}`);
        }
        next();
        return { t: 'list', items, pos: x.pos };
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
    if (x.k !== 'eof') {
      const errMsg = isOp(x, ')')
        ? 'Unmatched ")" with no opening "("'
        : isOp(x, ']')
          ? 'Unmatched "]" with no opening "["'
          : `Unexpected "${x.text}"`;
      throw new PErr(x.pos, x.len, errMsg);
    }
    ast.usesMatrix = usesMatrix;
    ast.usesSymbolic = usesSymbolic;
    return ast;
  }

  function evaluate(n, deg, allowSymbolic = false) {
    const toR = x => deg ? x * Math.PI / 180 : x, fromR = x => deg ? x * 180 / Math.PI : x;
    const snap = x => Math.abs(x) < 1e-12 ? 0 : x;
    const bad = (n, msg) => { throw new PErr(n.pos, n.t === 'call' ? n.f.length : 1, msg); };
    switch (n.t) {
      case 'num': return n.v;
      case 'matrixValue': return n.v;
      case 'neg': {
        const value = evaluate(n.x, deg);
        return value instanceof Matrix ? value.map(entry => entry.neg()) : value.neg();
      }
      case 'list': bad(n, 'Datasets "[...]" can only be used inside statistics functions');
      case 'bin': {
        const a = evaluate(n.l, deg), b = evaluate(n.r, deg);
        if (a instanceof Matrix || b instanceof Matrix) {
          return matrixOperation(n.op, a, b, message => bad(n, message));
        }
        if (n.op === '+') return a.add(b); if (n.op === '-') return a.sub(b); if (n.op === '*') return a.mul(b);
        if (n.op === '/') { if (b.isZero()) bad(n, 'Division by zero'); return a.div(b); }
        try { return a.pow(b); } catch (e) { bad(n, e.message); }
        break;
      }
      /* Requirement 27: Matrix functions and operations */
      case 'call': {
        if (SYMBOLIC_FUNCTIONS.has(n.f)) {
          try {
            const result = calculatorSymbolic(n);
            if (result.symbolic !== undefined) {
              if (!allowSymbolic) bad(n, 'Symbolic results must be evaluated as standalone expressions');
              return { symbolic: true, toString: () => result.symbolic };
            }
            if (result.numerator !== undefined) {
              const answer = new Decimal(result.numerator).div(new Decimal(result.denominator));
              answer.display = result.exact;
              return answer;
            }
            const answer = Decimal.fromNumber(result.approximate);
            answer.display = result.exact ?? `≈ ${answer.toString()}`;
            return answer;
          } catch (error) {
            if (error instanceof PErr) throw error;
            bad(n, error.message);
          }
        }
        const scalar = arg => {
          const value = evaluate(arg, deg);
          if (value instanceof Matrix) bad(n, `${n.f} requires scalar values`);
          return value;
        };
        /* Requirement 27: Validate that the matrix function is called with a single matrix argument and perform the operation */
        if (n.f === 'matrix') {
          const list = n.args[0];
          if (n.args.length !== 1 || list.t !== 'list' || !list.items.length) {
            bad(n, 'matrix requires a nonempty list of rows, for example matrix([[1,2],[3,4]])');
          }
          const width = list.items[0].items?.length;
          if (!width || list.items.some(row => row.t !== 'list' || row.items.length !== width)) {
            bad(n, 'Matrix rows must be nonempty bracketed lists with the same number of columns');
          }
          if (list.items.length * width > MATRIX_ENTRY_LIMIT) {
            bad(n, `Matrices can contain at most ${MATRIX_ENTRY_LIMIT} entries`);
          }
          /* Requirement 27: Validate that all matrix entries are scalar expressions and evaluate them */
          return new Matrix(list.items.map(row => row.items.map(entry => {
            if (entry.t === 'list') bad(entry, 'Matrix entries must be scalar expressions');
            const value = evaluate(entry, deg);
            if (value instanceof Matrix) bad(n, 'Matrix entries must be scalar expressions');
            return value;
          })));
        }
        /* Requirement 27: Validate that matrix functions are called with a single matrix argument and perform the operation */
        if (MATRIX_FUNCTIONS.has(n.f)) {
          if (n.args.length !== 1) bad(n, `${n.f} requires one matrix argument`);
          const value = evaluate(n.a, deg);
          if (!(value instanceof Matrix)) bad(n, `${n.f} requires a matrix argument`);
          if (n.f === 'transpose') return value.transpose();
          return eliminateMatrix(value, n.f === 'inverse', message => bad(n, message));
        }

        // Helper to validate and extract BigInt integers for number theory functions
        const toInteger = (dec, funcName) => {
          if (dec.exp < 0n) {
            bad(n, `${funcName} requires integer inputs`);
          }
          return dec.m * (10n ** dec.exp);
        };

        // Helper to format percentage values (rounding to 2 decimals when needed)
        const formatPercent = (dec) => {
          const rawStr = dec.toString();
          const dot = rawStr.indexOf('.');
          if (dot === -1) {
            return rawStr;
          }
          const decimals = rawStr.slice(dot + 1);
          if (decimals.length <= 2) {
            return rawStr;
          }
          const num = dec.toNumber();
          return (Math.round(num * 100) / 100).toString();
        };

        // Requirement 13: Prime Check
        if (n.f === 'prime') {
          if (n.args.length !== 1) {
            bad(n, 'prime requires 1 argument, for example prime(17)');
          }

          const val = toInteger(scalar(n.args[0]), 'prime');

          if (val > 10000000000000n) {
            bad(n, 'Value is too large for prime check');
          }

          // 0, 1, and negative numbers are neither prime nor composite
          if (val < 2n) {
            const res = new Decimal(-1n);
            res.display = 'N/A';
            res.note = `${val} is neither prime nor composite`;
            return res;
          }

          let isPrime = true;
          if (val === 2n || val === 3n) {
            isPrime = true;
          } else if (val % 2n === 0n || val % 3n === 0n) {
            isPrime = false;
          } else {
            // Check divisibility using 6k ± 1 optimization
            for (let d = 5n; d * d <= val; d += 6n) {
              if (val % d === 0n || val % (d + 2n) === 0n) {
                isPrime = false;
                break;
              }
            }
          }

          const res = new Decimal(isPrime ? 1n : 0n);
          res.display = isPrime ? 'Prime' : 'Composite';
          res.note = `${val} is ${isPrime ? 'prime' : 'composite'}`;
          return res;
        }

        // Requirement 13: Prime Factorization
        if (n.f === 'fact') {
          if (n.args.length !== 1) {
            bad(n, 'fact requires 1 argument, for example fact(60)');
          }

          const val = toInteger(scalar(n.args[0]), 'fact');

          if (val <= 0n) {
            bad(n, 'fact requires a positive integer');
          }
          if (val > 10000000000000n) {
            bad(n, 'Value is too large for prime factorization');
          }

          let remaining = val;
          const factors = [];
          let divisor = 2n;

          // Trial division for factor extraction
          while (divisor * divisor <= remaining) {
            if (remaining % divisor === 0n) {
              let count = 0;
              while (remaining % divisor === 0n) {
                count++;
                remaining /= divisor;
              }
              factors.push({ prime: divisor, count: count });
            }
            divisor = divisor === 2n ? 3n : divisor + 2n;
          }

          if (remaining > 1n) {
            factors.push({ prime: remaining, count: 1 });
          }

          // Format superscripts for exponents
          const superscripts = {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
          };
          const toSuperscript = (num) => {
            return String(num).split('').map(ch => superscripts[ch] || ch).join('');
          };

          const factorStr = factors.length === 0 ? '1' : factors.map(f => {
            return f.prime.toString() + (f.count > 1 ? toSuperscript(f.count) : '');
          }).join('×');

          const res = new Decimal(val);
          res.display = factorStr;
          res.note = `${val} = ${factorStr}`;
          return res;
        }

        // Requirement 13: Greatest Common Divisor
        if (n.f === 'gcd') {
          if (n.args.length !== 2) {
            bad(n, 'gcd requires 2 arguments, for example gcd(12, 18)');
          }

          let a = toInteger(scalar(n.args[0]), 'gcd');
          let b = toInteger(scalar(n.args[1]), 'gcd');

          a = a < 0n ? -a : a;
          b = b < 0n ? -b : b;

          while (b !== 0n) {
            const remainder = a % b;
            a = b;
            b = remainder;
          }

          return new Decimal(a);
        }

        // Requirement 13: Least Common Multiple
        if (n.f === 'lcm') {
          if (n.args.length !== 2) {
            bad(n, 'lcm requires 2 arguments, for example lcm(12, 18)');
          }

          let a = toInteger(scalar(n.args[0]), 'lcm');
          let b = toInteger(scalar(n.args[1]), 'lcm');

          if (a === 0n || b === 0n) {
            return new Decimal(0n);
          }

          const absA = a < 0n ? -a : a;
          const absB = b < 0n ? -b : b;

          let num1 = absA;
          let num2 = absB;
          while (num2 !== 0n) {
            const remainder = num1 % num2;
            num1 = num2;
            num2 = remainder;
          }
          const gcdVal = num1;

          const lcmVal = (absA * absB) / gcdVal;
          return new Decimal(lcmVal);
        }

        // Requirement 18: Percentage Increase
        if (n.f === 'pinc') {
          if (n.args.length !== 2) {
            bad(n, 'pinc requires 2 arguments: pinc(from, to), for example pinc(80, 100)');
          }

          const fromVal = scalar(n.args[0]);
          const toVal = scalar(n.args[1]);

          if (fromVal.isZero()) {
            bad(n, 'Starting value cannot be zero for percent increase');
          }

          // Formula: ((to - from) / from) * 100
          const change = toVal.sub(fromVal);
          const percent = change.div(fromVal).mul(Decimal.fromString('100'));

          const formatted = formatPercent(percent);
          const res = percent;

          res.display = `${formatted}%`;
          res.note = `Increase ${fromVal.toString()} → ${toVal.toString()}: ${formatted}%`;
          return res;
        }

        // Requirement 18: Percentage Decrease
        if (n.f === 'pdec') {
          if (n.args.length !== 2) {
            bad(n, 'pdec requires 2 arguments: pdec(from, to), for example pdec(100, 80)');
          }

          const fromVal = scalar(n.args[0]);
          const toVal = scalar(n.args[1]);

          if (fromVal.isZero()) {
            bad(n, 'Starting value cannot be zero for percent decrease');
          }

          // Formula: ((from - to) / from) * 100
          const change = fromVal.sub(toVal);
          const percent = change.div(fromVal).mul(Decimal.fromString('100'));

          const formatted = formatPercent(percent);
          const res = percent;

          res.display = `${formatted}%`;
          res.note = `Decrease ${fromVal.toString()} → ${toVal.toString()}: ${formatted}%`;
          return res;
        }

        // Requirement 18: Percentage Difference (Symmetric convention)
        if (n.f === 'pdiff') {
          if (n.args.length !== 2) {
            bad(n, 'pdiff requires 2 arguments: pdiff(a, b), for example pdiff(80, 100)');
          }

          const valA = scalar(n.args[0]);
          const valB = scalar(n.args[1]);

          // Formula: |valB - valA| / ((valA + valB) / 2) * 100
          const difference = valB.sub(valA).abs();
          const average = valA.add(valB).div(Decimal.fromString('2'));

          if (average.isZero()) {
            bad(n, 'Average of values cannot be zero for percent difference');
          }

          const percent = difference.div(average).mul(Decimal.fromString('100'));
          const formatted = formatPercent(percent);

          const res = percent;
          res.display = `${formatted}%`;
          res.note = `Difference between ${valA.toString()} and ${valB.toString()}: ${formatted}%`;
          return res;
        }

        // Requirement 16: Statistical Calculations (Population convention: ÷ N)
        if (n.f === 'mean' || n.f === 'medn' || n.f === 'mode' || n.f === 'stdev' || n.f === 'var' || n.f === 'stats') {
          const extractDataset = (args, funcName) => {
            if (!args || args.length === 0) {
              bad(n, 'Statistics cannot be computed for an empty dataset');
            }

            let rawNodes = args;
            if (args.length === 1 && args[0].t === 'list') {
              rawNodes = args[0].items;
              if (rawNodes.length === 0) {
                bad(n, 'Statistics cannot be computed for an empty dataset');
              }
            }

            const values = [];
            for (let i = 0; i < rawNodes.length; i++) {
              const item = rawNodes[i];
              if (item.t === 'list') {
                bad(item, `Pass a single dataset to ${funcName}, for example ${funcName}(1, 2, 3) or ${funcName}([1, 2, 3])`);
              }
              values.push(scalar(item));
            }
            return values;
          };

          const compareDecimals = (a, b) => {
            const diff = a.sub(b);
            if (diff.isZero()) return 0;
            return diff.isNegative() ? -1 : 1;
          };

          const formatStatDecimal = (dec, maxDecimals = 6) => {
            const rawStr = dec.toString();
            const dot = rawStr.indexOf('.');
            if (dot === -1 || rawStr.includes('e') || rawStr.includes('E')) {
              return rawStr;
            }
            const decimals = rawStr.slice(dot + 1);
            if (decimals.length <= maxDecimals) {
              return rawStr;
            }
            const num = dec.toNumber();
            if (!Number.isFinite(num)) {
              return rawStr;
            }
            const factor = 10 ** maxDecimals;
            const rounded = Math.round(num * factor) / factor;
            if (rounded === 0 && !dec.isZero()) {
              return Number(num.toPrecision(4)).toString();
            }
            return rounded.toString();
          };

          const computeStatistics = (values) => {
            const countDec = new Decimal(BigInt(values.length));

            // Arithmetic mean
            let sum = new Decimal(0n);
            for (let i = 0; i < values.length; i++) {
              sum = sum.add(values[i]);
            }
            const meanVal = sum.div(countDec);

            // Median from sorted dataset
            const sorted = values.slice().sort(compareDecimals);
            let medianVal;
            const mid = Math.floor(sorted.length / 2);
            if (sorted.length % 2 === 1) {
              medianVal = sorted[mid];
            } else {
              medianVal = sorted[mid - 1].add(sorted[mid]).div(new Decimal(2n));
            }

            // Mode frequency count in sorted order
            const freqMap = new Map();
            const distinctValues = [];
            for (let i = 0; i < sorted.length; i++) {
              const val = sorted[i];
              const key = val.toString();
              if (!freqMap.has(key)) {
                freqMap.set(key, 1);
                distinctValues.push(val);
              } else {
                freqMap.set(key, freqMap.get(key) + 1);
              }
            }

            let maxFreq = 0;
            for (const freq of freqMap.values()) {
              if (freq > maxFreq) {
                maxFreq = freq;
              }
            }

            const modes = [];
            for (let i = 0; i < distinctValues.length; i++) {
              const val = distinctValues[i];
              if (freqMap.get(val.toString()) === maxFreq) {
                modes.push(val);
              }
            }

            let modeDisplay;
            let modeNote;
            let modeNumeric;

            if (values.length > 1 && maxFreq === 1) {
              modeDisplay = 'No mode';
              modeNote = 'No mode (all values appear once)';
              modeNumeric = new Decimal(0n);
            } else if (modes.length > 1) {
              const modeLabels = modes.map(m => m.toString()).join(', ');
              modeDisplay = modeLabels;
              modeNote = `Multiple modes (${modeLabels}; each appears ${maxFreq} times)`;
              modeNumeric = modes[0];
            } else {
              modeDisplay = modes[0].toString();
              modeNote = `Mode: ${modeDisplay} (appears ${maxFreq} ${maxFreq === 1 ? 'time' : 'times'})`;
              modeNumeric = modes[0];
            }

            // Population variance (÷ N) and population standard deviation
            let squaredDiffSum = new Decimal(0n);
            for (let i = 0; i < values.length; i++) {
              const diff = values[i].sub(meanVal);
              squaredDiffSum = squaredDiffSum.add(diff.mul(diff));
            }
            const varianceVal = squaredDiffSum.div(countDec);
            const stdevVal = varianceVal.sqrt();

            return {
              count: values.length,
              meanVal,
              medianVal,
              modeDisplay,
              modeNote,
              modeNumeric,
              varianceVal,
              stdevVal
            };
          };

          const values = extractDataset(n.args, n.f);
          const statsResult = computeStatistics(values);

          if (n.f === 'mean') {
            const res = new Decimal(statsResult.meanVal.m, statsResult.meanVal.exp);
            res.note = `Arithmetic mean (n = ${statsResult.count})`;
            return res;
          }

          if (n.f === 'medn') {
            const res = new Decimal(statsResult.medianVal.m, statsResult.medianVal.exp);
            res.note = `Median (n = ${statsResult.count})`;
            return res;
          }

          if (n.f === 'mode') {
            const res = new Decimal(statsResult.modeNumeric.m, statsResult.modeNumeric.exp);
            res.display = statsResult.modeDisplay;
            res.note = statsResult.modeNote;
            return res;
          }

          if (n.f === 'var') {
            const res = new Decimal(statsResult.varianceVal.m, statsResult.varianceVal.exp);
            res.note = `Population variance (÷ N, n = ${statsResult.count})`;
            return res;
          }

          if (n.f === 'stdev') {
            const res = new Decimal(statsResult.stdevVal.m, statsResult.stdevVal.exp);
            res.note = `Population standard deviation (÷ N, n = ${statsResult.count})`;
            return res;
          }

          if (n.f === 'stats') {
            const res = new Decimal(0n);
            res.display = [
              `Mean: ${formatStatDecimal(statsResult.meanVal)}`,
              `Median: ${formatStatDecimal(statsResult.medianVal)}`,
              `Mode: ${statsResult.modeDisplay}`,
              `Pop. Variance: ${formatStatDecimal(statsResult.varianceVal)}`,
              `Pop. Stdev: ${formatStatDecimal(statsResult.stdevVal)}`
            ].join('\n');
            res.note = `Statistics (n = ${statsResult.count}, population ÷ N)`;
            return res;
          }
        }

        if (n.args.length !== 1) {
          bad(n, `${n.f} requires 1 argument`);
        }
        const a = scalar(n.a);
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

  // ========================================
  // SYMBOLIC MATH (NERDAMER)
  // ========================================
  /* Shared adapter for Nerdamer 1.1.13's browser calculus and equation solver. */
  const calculatorSymbolic = (() => {
    const functions = new Map([
      ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'],
      ['ln', 'log'], ['log', 'log'], ['abs', 'abs'], ['sqrt', 'sqrt']
    ]);
    const engineVariable = 'x';
    const rationalPattern = /^(-?\d+)(?:\/(\d+))?$/;
    const fail = message => { throw new Error(message); };
    const text = result => result.text('fractions');
    const numeric = result => {
      if (result.variables().length || result.isImaginary()) return NaN;
      const fraction = rationalPattern.exec(text(result));
      if (fraction) {
        const n = Number(fraction[1]), d = Number(fraction[2] ?? 1);
        if (Number.isFinite(n) && Number.isFinite(d)) return n / d;
      }
      return Number(result.evaluate().text('decimals'));
    };

    function display(value, variable = engineVariable) {
      return value.replace(/\bx\b/g, variable).replace(/\bpi\b/g, 'π').replace(/\blog\(/g, 'ln(')
        .replace(/(?<![\w.])(\d+)\*([a-z])(?![a-z_(])/g, '$1$2')
        .replace(/\+(-)/g, '$1').replace(/\+(?=.)/g, ' + ').replace(/(?<=[\w)])-(?=[\w(])/g, ' - ');
    }

    function compile(ast, variable, algebra = false) {
      let budget = 180;
      function read(node) {
        if (--budget < 0) fail('Expression is too complex for symbolic calculation');
        if (node.t === 'num') {
          if (node.s && algebra) fail('Solve supports rational coefficients');
          const source = node.s === 'π' ? 'pi' : node.s ?? node.raw ?? node.v.toString(true);
          if (source.length > 256) fail('Number is too large for symbolic calculation');
          return source;
        }
        if (node.t === 'var') {
          if (node.name !== variable) {
            fail(algebra ? 'Unsupported additional unknown "' + node.name + '"' :
              'Missing value for variable "' + node.name + '"');
          }
          return engineVariable;
        }
        if (node.t === 'neg') return '(-(' + read(node.x) + '))';
        if (node.t === 'bin') {
          const left = read(node.l), right = read(node.r);
          if (!algebra && node.op === '/' && text(nerdamer(right)) === '0') fail('Division by zero');
          if (!algebra && node.op === '^' && Math.abs(numeric(nerdamer(right))) > 1000) {
            fail('Exponent is too large for symbolic calculation');
          }
          return '(' + left + node.op + right + ')';
        }
        if (node.t === 'call' && !algebra && functions.has(node.f) && node.args.length === 1) {
          const call = functions.get(node.f) + '(' + read(node.a) + ')';
          // Nerdamer 1.1.13 differentiates log(u, 10) as though it were a natural log.
          return node.f === 'log' ? '(' + call + '/log(10))' : call;
        }
        fail('Unsupported ' + (algebra ? 'equation' : 'calculus') + ' expression' + (node.f ? ': ' + node.f : ''));
      }
      return read(ast);
    }

    // Check the original AST so cancellation in the symbolic engine cannot hide poles.
    function range(node, lo, hi, checkPhase = false) {
      let limits;
      if (node.t === 'num') {
        const n = node.s === 'π' ? Math.PI : node.s === 'e' ? Math.E : Number(node.raw ?? node.v.toString());
        limits = [n, n];
      } else if (node.t === 'var') {
        limits = [lo, hi];
      } else if (node.t === 'neg') {
        const [a, b] = range(node.x, lo, hi, checkPhase);
        limits = [-b, -a];
      } else if (node.t === 'call') {
        const [a, b] = range(node.a, lo, hi, checkPhase);
        const crosses = (offset, period) => Math.ceil((a - offset - 1e-14) / period) <= (b - offset + 1e-14) / period;
        if (/^(sin|cos|tan)$/.test(node.f) && checkPhase && b - a > Math.PI / 2) throw new RangeError();
        if (node.f === 'tan') {
          if (crosses(Math.PI / 2, Math.PI)) throw new RangeError();
          limits = [Math.tan(a), Math.tan(b)];
        } else if (node.f === 'sin' || node.f === 'cos') {
          const peak = node.f === 'sin' ? Math.PI / 2 : 0, period = 2 * Math.PI;
          const left = Math[node.f](a), right = Math[node.f](b);
          limits = [crosses(peak + Math.PI, period) ? -1 : Math.min(left, right),
            crosses(peak, period) ? 1 : Math.max(left, right)];
        } else if (node.f === 'abs') {
          limits = [a <= 0 && b >= 0 ? 0 : Math.min(Math.abs(a), Math.abs(b)), Math.max(Math.abs(a), Math.abs(b))];
        } else {
          const logarithm = node.f === 'ln' || node.f === 'log';
          if (logarithm ? a <= 0 : a < 0) throw new RangeError();
          const fn = node.f === 'log' ? Math.log10 : logarithm ? Math.log : Math.sqrt;
          limits = [fn(a), fn(b)];
        }
      } else {
        const [a, b] = range(node.l, lo, hi, checkPhase);
        const [c, d] = range(node.r, lo, hi, checkPhase);
        if (node.op === '+') limits = [a + c, b + d];
        if (node.op === '-') limits = [a - d, b - c];
        if (node.op === '*' || node.op === '/') {
          if (node.op === '/' && c <= 0 && d >= 0) throw new RangeError();
          const corners = node.op === '*' ? [a * c, a * d, b * c, b * d] : [a / c, a / d, b / c, b / d];
          limits = [Math.min(...corners), Math.max(...corners)];
        }
        if (node.op === '^') {
          if ((a <= 0 && b >= 0 && c <= 0) || (a < 0 && (c !== d || !Number.isSafeInteger(c)))) throw new RangeError();
          const corners = [a ** c, a ** d, b ** c, b ** d];
          if (a <= 0 && b >= 0) corners.push(0);
          if (a <= 1 && b >= 1) corners.push(1);
          limits = [Math.min(...corners), Math.max(...corners)];
        }
      }
      if (!limits?.every(Number.isFinite)) throw new RangeError();
      return limits;
    }

    function checkedIntervals(ast, start, end, checkPhase) {
      const intervals = [];
      let budget = 4096;
      function check(a, b, depth) {
        if (--budget < 0) fail('Integral could not be evaluated over these bounds');
        try {
          range(ast, a, a);
          range(ast, b, b);
        } catch {
          fail('Integrand is undefined or outside the numerical range over these bounds');
        }
        try {
          range(ast, a, b, checkPhase);
        } catch {
          const middle = a + (b - a) / 2;
          if (!depth || middle === a || middle === b) fail('Integrand is undefined or could not be verified over these bounds');
          check(a, middle, depth - 1);
          check(middle, b, depth - 1);
          return;
        }
        intervals.push([a, b]);
      }
      check(Math.min(start, end), Math.max(start, end), 22);
      return intervals;
    }

    function bound(ast) {
      try {
        const result = nerdamer(compile(ast));
        const value = numeric(result);
        if (!Number.isFinite(value)) throw new RangeError();
        range(ast, 0, 0);
        return { result, value };
      } catch {
        fail('Integration bounds must be finite, defined numbers without variables');
      }
    }

    function checkExactEndpoint(ast, variable, at) {
      const get = node => nerdamer(compile(node, variable)).sub(engineVariable, text(at));
      function check(node) {
        if (node.t === 'neg') check(node.x);
        if (node.t === 'call') check(node.a);
        if (node.t !== 'bin') return;
        check(node.l);
        check(node.r);
        const singular = (node.op === '/' && text(get(node.r)) === '0') ||
          (node.op === '^' && text(get(node.l)) === '0' && numeric(get(node.r)) < 0);
        if (singular) fail('Integrand is undefined at an integration bound');
      }
      check(ast);
    }

    function exactResult(result) {
      const source = text(result);
      const match = rationalPattern.exec(source);
      if (!match) {
        const value = numeric(result);
        return Number.isFinite(value) ? { exact: display(source), approximate: value } : null;
      }
      const numerator = BigInt(match[1]), denominator = BigInt(match[2] ?? 1);
      let remaining = denominator;
      for (const factor of [2n, 5n]) {
        while (remaining % factor === 0n) remaining /= factor;
      }
      const terminating = remaining === 1n;
      // Keep the fraction if the decimal would exceed the calculator's display precision.
      let decimal = '';
      if (terminating) {
        const magnitude = numerator < 0n ? -numerator : numerator;
        let remainder = magnitude % denominator, digits = '';
        while (remainder && digits.length < 40) {
          remainder *= 10n;
          digits += remainder / denominator;
          remainder %= denominator;
        }
        if (!remainder) decimal = (numerator < 0n ? '-' : '') + magnitude / denominator + (digits ? '.' + digits : '');
      }
      return { exact: decimal || source, numerator, denominator };
    }

    function realLogarithms(source) {
      const stack = [];
      return source.replace(/\blog\(|[()]/g, token => {
        if (token === ')') return stack.pop() ? '))' : ')';
        const logarithm = token === 'log(';
        stack.push(logarithm);
        return logarithm ? 'log(abs(' : '(';
      });
    }

    function calculus(name, args, variable) {
      if (name === 'integral' && args.length === 3) fail('Definite integral requires both lower and upper bounds');
      if (name === 'derivative' ? args.length !== 2 : ![2, 4].includes(args.length)) {
        fail('Provide an expression, a variable, and both bounds for a definite integral');
      }
      const source = compile(args[0], variable);
      const expression = nerdamer(source);
      if (expression.isImaginary() || /\b(?:Infinity|NaN)\b/.test(text(expression))) fail('Undefined calculus expression');
      if (name === 'derivative') {
        const derivative = text(nerdamer.diff(source, engineVariable));
        if (/\bdiff\(/.test(derivative)) fail('No supported symbolic derivative for this expression');
        return { symbolic: display(derivative, variable) };
      }
      let lower, upper;
      if (args.length === 4) {
        lower = bound(args[2]);
        upper = bound(args[3]);
        checkExactEndpoint(args[0], variable, lower.result);
        checkExactEndpoint(args[0], variable, upper.result);
        checkedIntervals(args[0], lower.value, upper.value, false);
        if (lower.value === upper.value) {
          if (text(nerdamer.expand('(' + text(upper.result) + ')-(' + text(lower.result) + ')')) !== '0') {
            fail('Integration bounds are too close for numerical domain checking');
          }
          return exactResult(nerdamer('0'));
        }
      }
      let primitive;
      try { primitive = nerdamer.integrate(source, engineVariable); }
      catch {
        if (!lower) fail('No supported symbolic antiderivative for this expression');
      }
      const evaluated = primitive && !/\b(?:integrate|defint)\(/.test(text(primitive));
      if (!lower) {
        if (!evaluated || primitive.isImaginary()) fail('No supported symbolic antiderivative for this expression');
        const shown = display(realLogarithms(text(primitive)), variable);
        return { symbolic: shown + ' + C' };
      }
      if (evaluated) {
        try {
          const a = text(primitive.sub(engineVariable, text(lower.result)));
          const b = text(primitive.sub(engineVariable, text(upper.result)));
          const result = exactResult(nerdamer.expand('(' + b + ')-(' + a + ')'));
          if (result) return result;
        } catch {
          // A real integrand can have a primitive that Nerdamer represents using complex logs.
        }
      }
      // Supply a callback directly to Nerdamer's integrator. Its defint fallback compiles JavaScript.
      const integrate = nerdamer.getCore().Math2.num_integrate;
      const total = checkedIntervals(args[0], lower.value, upper.value, true).reduce((sum, [a, b]) =>
        sum + integrate(x => range(args[0], x, x)[0], a, b), 0);
      if (!Number.isFinite(total)) fail('Integral could not be evaluated over these bounds');
      return { approximate: total * Math.sign(upper.value - lower.value) };
    }


    // ========================================
    // EQUATION SOLVING
    // ========================================
    const expand = source => text(nerdamer.expand(source));
    const product = (a, b) => '((' + a + ')*(' + b + '))';

    function polynomialRoots(source) {
      const polynomial = expand(source);
      const coefficients = nerdamer('coeffs(' + polynomial + ',' + engineVariable + ')').symbol.elements.map(String);
      if (coefficients.length > 3 || !coefficients.every(c => rationalPattern.test(c))) {
        fail('Solve supports linear or quadratic equations with rational coefficients');
      }
      if (coefficients.length === 1) return { identity: coefficients[0] === '0', roots: [] };
      let expected = 1, complex = false;
      if (coefficients.length === 3) {
        const [c, b, a] = coefficients;
        const discriminant = expand('(' + b + ')^2-4*(' + a + ')*(' + c + ')');
        complex = discriminant.startsWith('-');
        expected = complex ? 0 : discriminant === '0' ? 1 : 2;
      }
      if (!expected) return { roots: [], complex };
      const roots = [];
      for (const candidate of nerdamer.solveEquations(polynomial, engineVariable)) {
        const root = nerdamer(String(candidate));
        if (!Number.isFinite(numeric(root))) continue;
        if (roots.some(other => expand('(' + text(other) + ')-(' + text(root) + ')') === '0')) continue;
        roots.push(root);
      }
      if (roots.length !== expected) fail('Could not determine all real solutions');
      roots.sort((a, b) => numeric(a) - numeric(b));
      return { roots };
    }

    // Clear polynomial denominators while recording every original exclusion.
    function rationalEquation(equation, variable) {
      const exclusions = new Set();
      function polynomial(source, degree) {
        if (degree > 16) fail('Equation is too complex to reduce to a linear or quadratic equation');
        return { source, degree };
      }
      const multiply = (a, b) => polynomial(product(a.source, b.source), a.degree + b.degree);
      const one = polynomial('1', 0);
      function exclude(source) {
        const value = expand(source);
        if (value === '0') fail('Division by zero in equation');
        if (!rationalPattern.test(value)) exclusions.add(value);
      }
      function read(node) {
        if (node.t === 'num' || node.t === 'var') {
          return [polynomial(compile(node, variable, true), node.t === 'var' ? 1 : 0), one];
        }
        if (node.t === 'neg') {
          const [a, b] = read(node.x);
          return [polynomial('-(' + a.source + ')', a.degree), b];
        }
        if (node.t !== 'bin') fail('Unsupported function or expression in equation' + (node.f ? ': ' + node.f : ''));
        const [a, b] = read(node.l), [c, d] = read(node.r);
        if (node.op === '/') exclude(c.source);
        if (node.op === '^') {
          const exponentText = expand('(' + c.source + ')/(' + d.source + ')');
          if (!/^-?\d+$/.test(exponentText) || Math.abs(Number(exponentText)) > 8) {
            fail('Solve supports only small integer powers of algebraic expressions');
          }
          const exponent = Number(exponentText), power = Math.abs(exponent);
          if (exponent < 0) exclude(a.source);
          const raise = value => polynomial('(' + value.source + ')^' + power, value.degree * power);
          return exponent < 0 ? [raise(b), raise(a)] : [raise(a), raise(b)];
        }
        if (node.op === '*') return [multiply(a, c), multiply(b, d)];
        if (node.op === '/') return [multiply(a, d), multiply(b, c)];
        const first = multiply(a, d), second = multiply(c, b);
        return [polynomial(first.source + node.op + second.source, Math.max(first.degree, second.degree)), multiply(b, d)];
      }
      // Check size, supported syntax and variables before clearing denominators.
      const left = compile(equation.l, variable, true), right = compile(equation.r, variable, true);
      const [a, b] = read(equation.l), [c, d] = read(equation.r);
      return { polynomial: multiply(a, d).source + '-' + multiply(c, b).source, exclusions: [...exclusions], left, right };
    }

    function solve(equation, variable) {
      if (equation?.t !== 'equation') fail('Enter an equation, for example 2x + 3 = 11');
      const { polynomial, exclusions, left, right } = rationalEquation(equation, variable);
      const result = polynomialRoots(polynomial);
      const excluded = exclusions.flatMap(source => polynomialRoots(source).roots);
      if (result.identity) {
        const distinct = [...new Set(excluded.map(root => display(text(root))))];
        if (!distinct.length) return 'All real values of ' + variable + ' satisfy this equation';
        return 'All real values of ' + variable + ' except ' + distinct.join(', ') + ' satisfy this equation';
      }
      if (!result.roots.length) return result.complex ? 'No real solutions' : 'No solution';
      const verified = [];
      for (const root of result.roots) {
        const rootText = text(root);
        if (excluded.some(point => expand('(' + text(point) + ')-(' + rootText + ')') === '0')) continue;
        for (const denominator of exclusions) {
          if (expand(text(nerdamer(denominator).sub(engineVariable, rootText))) === '0') {
            fail('Could not verify the domain of a candidate solution');
          }
        }
        const a = nerdamer(left).sub(engineVariable, rootText), b = nerdamer(right).sub(engineVariable, rootText);
        const av = numeric(a), bv = numeric(b);
        const residual = expand('(' + text(a) + ')-(' + text(b) + ')');
        if (!Number.isFinite(av) || !Number.isFinite(bv) ||
            (residual !== '0' && Math.abs(av - bv) > 1e-10 * Math.max(1, Math.abs(av), Math.abs(bv)))) {
          fail('Could not verify a candidate solution in the original equation');
        }
        verified.push(variable + ' = ' + display(rootText));
      }
      return verified.join(', ') || 'No solution';
    }

    return function calculate({ f, args }) {
      if (typeof nerdamer !== 'function') fail('The symbolic math library could not be loaded');
      if (f === 'solve' && !args.length) fail('Enter an equation, for example 2x + 3 = 11');
      if (!args[1] || args[1].t !== 'var') fail('Specify a variable, for example x');
      if (f === 'solve') {
        if (args.length !== 2) fail('Solve requires one equation and one variable');
        return { symbolic: solve(args[0], args[1].name) };
      }
      return calculus(f, args, args[1].name);
    };
  })();

  // ========================================
  // CALCULATION ENTRY POINT
  // ========================================
  function run(src, deg, ans) {
    let ast;
    try {
      ast = parse(src, ans);
      const answer = evaluate(ast, deg, true);
      return { ok: true, answer, value: answer.toString(), display: answer.display, note: answer.note,
        usesMatrix: ast.usesMatrix, usesSymbolic: ast.usesSymbolic };
    } catch (e) {
      if (e instanceof PErr) return { ok: false, err: e };
      if (ast?.usesMatrix && (e instanceof RangeError || e.message === 'Result is not finite')) {
        return { ok: false, err: new PErr(ast.pos ?? 0, 1, 'Matrix calculation exceeds the numerical range') };
      }
      throw e;
    }
  }
  function openConverter() {
    converterPanel.hidden = false;
    tolerancePanel.hidden = true;
    out.hidden = false;
    msg.hidden = false;
  }

  function closeUnitConverter() {
    converterPanel.hidden = true;
    out.hidden = false;
    msg.hidden = false;
    preview();
  }

  function calculateTolerance() { // tolerance calculator, R15
    const nominal = Number($('nominalValue').value);
    const tolerance = Number($('toleranceValue').value);
    const unit = $('toleranceUnit').value;
    if (
        $('nominalValue').value === '' ||
        $('toleranceValue').value === '' ||
        tolerance < 0
    ) {
        msg.textContent = 'Enter a nominal value and a non-negative tolerance.';
        return;
    }

    msg.textContent = '';

    const minimum = nominal - tolerance;
    const maximum = nominal + tolerance;

    out.textContent = `[${minimum.toFixed(1)}, ${maximum.toFixed(1)}] ${unit}`;
  }
  $('calculateTolerance').addEventListener('click', calculateTolerance);

  /* ---------- step by step ---------- */
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
  function str(n, p, deg) {
    let s, q;
    if (n.t === 'num') { s = n.s || n.v.toString().replace('-', '−'); q = (n.v.isNegative() && !n.s) ? 3 : 5; }
    else if (n.t === 'neg') { s = '−' + str(n.x, 4, deg); q = 3; }
    else if (n.t === 'call') {
      const inner = n.args ? n.args.map(x => str(x, 0, deg)).join(', ') : str(n.a, 0, deg);
      s = `${n.f === 'sqrt' ? '√' : n.f}(${inner}${deg && /^(sin|cos|tan)$/.test(n.f) ? '°' : ''})`;
      q = 5;
    }
    else if (n.t === 'list') {
      s = `[${n.items.map(x => str(x, 0, deg)).join(', ')}]`;
      q = 5;
    }
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
      else if (n.t === 'call') (n.args || [n.a]).forEach(fold);
      else if (n.t === 'list') n.items.forEach(fold);
      else if (n.t === 'neg') { fold(n.x); if (n.x.t === 'num' && !n.x.s) { n.v = n.x.v.neg(); delete n.x; n.t = 'num'; } }
    })(ast);
    while (ast.t !== 'num') {
      let best = null, rank = 0;
      (function walk(n) {
        if (n.t === 'bin') walk(n.l); else if (n.t === 'neg') walk(n.x); else walk2(n);
        function walk2(n) {
          if (n.t === 'call') (n.args || [n.a]).forEach(walk);
          else if (n.t === 'list') n.items.forEach(walk);
        }
        const ok = n.t === 'bin'
          ? n.l.t === 'num' && n.r.t === 'num'
          : n.t === 'neg'
            ? n.x.t === 'num'
            : n.t === 'call' && (n.args || [n.a]).every(x => x.t === 'num' || (x.t === 'list' && x.items.every(item => item.t === 'num')));
        if (ok) { const r = n.t !== 'bin' || n.op === '^' ? 3 : n.op === '*' || n.op === '/' ? 2 : 1; if (r > rank) { rank = r; best = n; } }
        if (n.t === 'bin') walk(n.r);
      })(ast);
      const sub = str(best, 0, deg), val = evaluate(best, deg), isNeg = best.t === 'neg';
      Object.keys(best).forEach(k => delete best[k]); best.t = 'num'; best.v = val;
      if (!isNeg) steps.push({ sub, val: (val.display || val.toString()).replace('-', '−'), rest: str(ast, 0, deg) });
    }
    return steps;
  }
  const stepsBox = $('steps'), stepList = $('stepList');
  function hideSteps() { stepsBox.hidden = true; stepsBox.open = false; stepList.replaceChildren(); }
  function showSteps(src, usesMatrix) {
    hideSteps(); let st = [];
    // Requirement 27: If the expression uses matrices, display a message indicating that step-by-step solutions are unavailable for matrix expressions
    if (usesMatrix) {
      const li = document.createElement('li');
      li.textContent = 'Step-by-step solutions are unavailable for matrix expressions.';
      stepList.append(li);
      stepsBox.hidden = false;
      stepsBox.open = true;
      return;
    }
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
  const tolerancePanel = $('tolerancePanel');
  const categorySelect = $('conversionCategory');
  const conversionControls = $('conversionControls');
  const fromUnit = $('fromUnit');
  const toUnit = $('toUnit');
  const conversionValue = $('conversionValue');

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
  const value = Number(conversionValue.value);
  conversionValue.min = category === 'temperature' ? '' : '0';
  if (category && category !== 'temperature' && conversionValue.value !== '' && value < 0) {
    conversionValue.value = '0';
  }

  // Make sure a category and valid number are selected
  if (!category) {
    out.textContent = '0';
    msg.textContent = '';
    return;
  }

  if (conversionValue.value.trim() === '' || !Number.isFinite(value)) {
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
conversionValue.addEventListener('input', updateConversionResult);
async function calculateConversionHistory() {
  await updateConversionResult();
  if (!categorySelect.value || conversionValue.value.trim() === '' || out.textContent.trim() === '') return;
  const expression = `${conversionValue.value} ${fromUnit.value} to ${toUnit.value}`;
  addHistory(expression, out.textContent, out.textContent);
}
$('conversionCalculate').addEventListener('click', calculateConversionHistory);

// Update available units when category changes
categorySelect.addEventListener('change', () => {
  const category = categorySelect.value;
  if (category) {
    const placeholderOption = categorySelect.querySelector('option[value=""]');
    if (placeholderOption) placeholderOption.disabled = true;
  }
  conversionValue.min = category === 'temperature' ? '' : '0';

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
  const expressionField = exp.closest('.expression-field');
  const modeSelect = $('modeSelect');
  const sciKeys = document.querySelector('.keys.sci');
  const basicKeys = $('basicKeys');
  const financialPanel = $('financialPanel');
  const financialType = $('financialType');
  const compoundInterestPanel = $('compoundInterestPanel');
  const loanPaymentPanel = $('loanPaymentPanel');
  const fractionPanel = $('fractionPanel');
  const programmerPanel = $('programmerPanel');
  const complexPanel = $('complexPanel');
  let deg = false, fresh = false, last = '';
  let mode = 'basic';

  const modeNames = {
    basic: 'Basic calculation mode',
    scientific: 'Scientific calculation mode',
    financial: 'Financial calculation mode',
  conversion: 'Conversion calculation mode',
  fraction: 'Fraction calculation mode',
  programmer: 'Programmer calculation mode',
  complex: 'Complex-number calculation mode'
  };

  function setMode(nextMode) {
    if (!modeNames[nextMode]) return;
    mode = nextMode;
    modeSelect.value = mode;
    sciKeys.hidden = mode !== 'scientific';
    basicKeys.hidden = mode !== 'basic' && mode !== 'scientific';
    expressionField.hidden = basicKeys.hidden;
    converterPanel.hidden = mode !== 'conversion';
    financialPanel.hidden = mode !== 'financial';
    tolerancePanel.hidden = true;
    fractionPanel.hidden = mode !== 'fraction';
    programmerPanel.hidden = mode !== 'programmer';
    complexPanel.hidden = mode !== 'complex';
    conversionControls.hidden = mode !== 'conversion' || !categorySelect.value;
    const functionMenu = $('sideMenu');
    if (functionMenu) functionMenu.classList.remove('open');
    $('FuncToggle').setAttribute('aria-expanded', 'false');
    hideSteps();
    out.classList.remove('stats-out', 'fraction-out');
    msg.className = '';
    if (mode === 'conversion') {
      updateConversionResult();
    } else if (basicKeys.hidden) {
      out.textContent = '0';
      out.classList.remove('stats-out');
      out.classList.remove('fraction-out');
      msg.textContent = '';
      msg.className = '';
    } else {
      preview();
    }
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

        const mostRecentValue = history.findLast(item => {
          const result = String(item.result);
          return !item.symbolic && (result.startsWith('matrix(') ||
            /^[-+−]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(result));
        });
        if ( mostRecentValue )
        {
          const result = String(mostRecentValue.result);
          previousAnswer = result.startsWith('matrix(')
            ? evaluate(parse(result, null), false)
            : Decimal.fromString(result);
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

  // Add a completed calculation to history.
  function addHistory( expression, result, display, symbolic )
  {
    // Store the original expression and reusable result text.
    history.push( { expression: expression, result: result, display: display, symbolic: symbolic } );

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

      // Show the expression and its result.
      button.textContent = item.expression + ' = ' + (item.display || item.result);

      button.title = 'Recall this expression';

      button.addEventListener( 'click', () => 
      {
        if (expressionField.hidden) {
          modeSelect.value = 'scientific';
          modeSelect.dispatchEvent(new Event('change'));
        }
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
  
  // ========================================
  // CALCULUS AND ALGEBRA INPUT PLACEHOLDERS
  // ========================================
  /* Render argument hints while keeping the native input as the source of truth. */
  function attachExpressionHints(input, overlay) {
    const preview = document.createElement('div');
    preview.className = 'expression-preview';
    overlay.append(preview);

    const defaultInputMode = input.inputMode;
    const slotsForIntegral = ['expr', 'var', 'Low BD', 'Up BD'];
    let cachedValue, cachedSelection, calls = [], pieces = [], pointerAnchor = null;

    function findCalls(value) {
      const result = [];
      const names = /(?<![a-z_])(integral|derivative|d\s*\/\s*d[a-z]|solve)\s*\(/gi;
      for (const match of value.matchAll(names)) {
        const name = match[1].toLowerCase();
        const labels = name === 'integral' ? slotsForIntegral :
          name === 'solve' ? ['equation', 'variable'] :
          name === 'derivative' ? slotsForIntegral.slice(0, 2) : ['expression'];
        const start = match.index + match[0].length;
        const slots = [];
        let from = start, depth = 0, end = start;
        for (; end <= value.length; end++) {
          const char = value[end];
          if (end === value.length || (depth === 0 && (char === ',' || char === ')'))) {
            const text = value.slice(from, end);
            const trimStart = text.trimStart();
            const left = end - trimStart.length, right = left + trimStart.trimEnd().length;
            slots.push({ from, to: end, left, right, label: labels[slots.length] });
            if (char !== ',') break;
            from = end + 1;
          } else if (char === '(' || char === '[') {
            depth++;
          } else if (char === ')' || char === ']') {
            depth = Math.max(0, depth - 1);
          }
        }
        if (slots.length <= labels.length) result.push({ start, end, slots });
      }
      return result;
    }

    function render() {
      const { value, selectionStart, selectionEnd, selectionDirection } = input;
      const focused = document.activeElement === input;
      if (cachedValue !== value) {
        cachedValue = value;
        cachedSelection = null;
        calls = findCalls(value);
      }

      const state = [focused, selectionStart, selectionEnd, selectionDirection].join('/');
      if (state === cachedSelection) return;
      cachedSelection = state;
      if (defaultInputMode === 'none') input.inputMode = calls.length ? 'text' : defaultInputMode;

      const ghosts = new Map();
      for (const { slots } of calls) {
        for (const slot of slots) {
          if (slot.left === slot.right) ghosts.set(slot.left, slot.label);
        }
      }
      overlay.hidden = !ghosts.size;
      if (overlay.hidden) {
        pieces = [];
        preview.replaceChildren();
        return;
      }

      const cursor = selectionDirection === 'backward' ? selectionStart : selectionEnd;
      const marks = new Set([0, value.length, ...ghosts.keys()]);
      if (focused) { marks.add(selectionStart); marks.add(selectionEnd); }
      const ordered = [...marks].sort((a, b) => a - b);
      const nodes = [];
      let caret;
      pieces = [];

      function span(text, from, to, className) {
        const node = document.createElement('span');
        node.textContent = text;
        if (className) node.className = className;
        nodes.push(node);
        pieces.push({ node, from, to });
        return node;
      }

      for (let i = 0; i < ordered.length; i++) {
        const from = ordered[i], to = ordered[i + 1];
        if (focused && from === cursor) caret = span('', from, from, 'expression-caret');
        if (ghosts.has(from)) span(ghosts.get(from), from, from, 'expression-ghost');
        if (to !== undefined) {
          const selected = focused && from >= selectionStart && to <= selectionEnd;
          span(value.slice(from, to), from, to, selected ? 'expression-selection' : '');
        }
      }
      preview.replaceChildren(...nodes);

      if (caret) {
        const x = caret.getBoundingClientRect().left;
        const { left, right } = overlay.getBoundingClientRect();
        // A long formula scrolls horizontally just enough to keep the editing position visible.
        if (x < left) overlay.scrollLeft -= left - x;
        if (x > right - 2) overlay.scrollLeft += x - right + 2;
      } else if (!focused) {
        overlay.scrollLeft = overlay.scrollWidth;
      }
    }

    function offsetAt(x) {
      for (const { node, from, to } of pieces) {
        const rect = node.getBoundingClientRect();
        if (x > rect.right) continue;
        if (x <= rect.left || from === to) return from;
        const range = document.createRange();
        let low = 0, high = to - from;
        const text = node.firstChild;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          range.setStart(text, middle);
          range.setEnd(text, middle + 1);
          const { left, right } = range.getBoundingClientRect();
          if (x <= (left + right) / 2) high = middle;
          else low = middle + 1;
        }
        return from + low;
      }
      return input.value.length;
    }

    function select(anchor, end) {
      input.setSelectionRange(Math.min(anchor, end), Math.max(anchor, end), end < anchor ? 'backward' : 'forward');
      render();
    }

    overlay.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const end = offsetAt(event.clientX);
      pointerAnchor = event.shiftKey && document.activeElement === input
        ? (input.selectionDirection === 'backward' ? input.selectionEnd : input.selectionStart)
        : end;
      event.preventDefault();
      input.focus();
      select(pointerAnchor, end);
      overlay.setPointerCapture(event.pointerId);
    });
    overlay.addEventListener('pointermove', event => {
      if (pointerAnchor !== null && overlay.hasPointerCapture(event.pointerId)) {
        select(pointerAnchor, offsetAt(event.clientX));
      }
    });
    overlay.addEventListener('lostpointercapture', () => { pointerAnchor = null; });

    input.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
      render();
      const from = input.selectionStart, to = input.selectionEnd;
      for (let i = calls.length - 1; i >= 0; i--) {
        const call = calls[i];
        if (from < call.start || to > call.end) continue;
        const current = call.slots.findIndex(slot => from >= slot.from && to <= slot.to);
        if (current < 0) continue;
        const next = call.slots[current + (event.shiftKey ? -1 : 1)];
        if (!next) continue;
        event.preventDefault();
        select(next.left, next.right);
        return;
      }
    });
    for (const event of ['focus', 'blur', 'input', 'select', 'keyup', 'selectionchange']) {
      input.addEventListener(event, render);
    }
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === input) render();
    });

    return render;
  }

  if (matchMedia('(pointer:coarse)').matches) exp.inputMode = 'none';
  const renderExpressionHints = attachExpressionHints(exp, $('expr-ghosts'));

  function displayResult(result) {
    const matrix = result.answer instanceof Matrix;
    const display = matrix ? result.value : (result.display || result.value).replaceAll('-', '−');
    out.textContent = display;
    out.classList.toggle('stats-out', matrix || result.answer.symbolic === true || display.includes('\n'));
  }

  function preview() {
    renderExpressionHints();
    msg.className = ''; msg.replaceChildren(); hideSteps();
    if (!exp.value.trim()) {
      out.textContent = '0';
      out.className = '';
      return;
    }
    const r = run(exp.value, deg, previousAnswer);
    if (r.ok) displayResult(r);
    else {
      out.textContent = '';
      out.classList.remove('stats-out');
    }
  }
  function commit() {
    const s = exp.value; if (!s.trim()) return;
    hideSteps();
    const r = run(s, deg, previousAnswer);
    msg.replaceChildren();
    if (r.ok) {
      displayResult(r);
      msg.textContent = r.note || (s + ' ='); msg.className = '';
      last = r.answer.symbolic ? '' : r.value.replace(/^(-?[\d.]+)e([+-]?\d+)$/i, '($1×10^$2)');
      fresh = true;
      if (!r.usesSymbolic) showSteps(s, r.usesMatrix);
      addHistory(s, r.value, r.display, r.answer.symbolic);
      if (!r.answer.symbolic) previousAnswer = r.answer;
    } else {
      const e = r.err, pre = document.createElement('pre'), u = document.createElement('u');
      out.textContent = e.message;
      out.classList.add('stats-out');
      msg.className = 'err'; msg.append(`Column ${e.pos + 1}`);
      u.textContent = s.substr(e.pos, e.len) || ' ';
      pre.append(s.slice(0, e.pos), u, s.slice(e.pos + e.len)); msg.append(pre);
    }
  }
  function insert(t, caretOffset = t.length) {
    if (fresh) { exp.value = /^[+−×÷^]/.test(t) ? last : ''; exp.setSelectionRange(exp.value.length, exp.value.length); fresh = false; }
    const caret = exp.selectionStart + caretOffset;
    exp.setRangeText(t, exp.selectionStart, exp.selectionEnd, 'end');
    exp.setSelectionRange(caret, caret);
    preview();
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
        if (/^[0-9.]$/.test(b.dataset.k)) {
          conversionValue.value += b.dataset.k;
        }
        updateConversionResult();
      } else {
      insert(b.dataset.k);
      }
    }
    else if (b.dataset.a === 'converter') {
      openConverter();
    }
    else if (b.dataset.a === 'tolerance') {
      tolerancePanel.hidden = !tolerancePanel.hidden;
      converterPanel.hidden = true;
    }
    else if (b.dataset.a === 'clear') {
      if (!converterPanel.hidden) {
        conversionValue.value = '';
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
  modeSelect.addEventListener('change', () => { converterPanel.hidden = true; tolerancePanel.hidden = true; setMode(modeSelect.value)});
  // Requirement 09: Show the selected financial calculation
  financialType.addEventListener('change', () => {
    compoundInterestPanel.hidden = financialType.value !== 'compound';
    loanPaymentPanel.hidden = financialType.value !== 'loan';
    const placeholder = financialType.querySelector('option[value=""]');
    if (financialType.value && placeholder) placeholder.disabled = true;

    out.textContent = '0';
    msg.textContent = '';
  });

  // Requirement 09: Compound Interest calculation
  $('calculateCompound').addEventListener('click', () => {
    const principal = Number($('principal').value);
    const annualRate = Number($('annualRate').value);
    const frequency = Number($('compoundingFrequency').value);
    const years = Number($('investmentYears').value);

    // Validate the inputs
    if (
      $('principal').value.trim() === '' ||
      $('annualRate').value.trim() === '' ||
      $('investmentYears').value.trim() === '' ||
      !Number.isFinite(principal) ||
      !Number.isFinite(annualRate) ||
      !Number.isFinite(years) ||
      principal <= 0 ||
      annualRate < 0 ||
      years <= 0
    ) {
      out.textContent = '';
      msg.className = 'err';
      msg.textContent = 'Please enter a valid principal, interest rate, and investment term.';
      return;
    }

    // Convert the annual rate from a percentage to a decimal
    const rate = annualRate / 100;

    // Calculate the final balance
    const amount = principal * Math.pow(1 + rate / frequency, frequency * years);

    if (!Number.isFinite(amount)) {
      out.textContent = '';
      msg.className = 'err';
      msg.textContent = 'The result is too large to calculate.';
      return;
    }

    // Calculate the interest earned
    const interest = amount - principal;

    // Display the results
    out.textContent = amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });

    msg.textContent = '';
    msg.className = '';
  });
    // Requirement 09: Loan Payment calculation
  $('calculateLoan').addEventListener('click', () => {
    const principal = Number($('loanPrincipal').value);
    const annualRate = Number($('loanRate').value);
    const frequency = Number($('paymentFrequency').value);
    const years = Number($('loanYears').value);

    // Calculate the total number of payments
    const totalPayments = frequency * years;

    // Validate the inputs
    if (
      $('loanPrincipal').value.trim() === '' ||
      $('loanRate').value.trim() === '' ||
      $('loanYears').value.trim() === '' ||
      !Number.isFinite(principal) ||
      !Number.isFinite(annualRate) ||
      !Number.isFinite(years) ||
      principal <= 0 ||
      annualRate < 0 ||
      years <= 0 ||
      !Number.isInteger(totalPayments)
    ) {
      out.textContent = '';
      msg.className = 'err';
      msg.textContent = 'Please enter valid loan information. The loan term must result in a whole number of payments.';
      return;
    }

    // Convert the annual interest rate to a periodic rate
    const periodicRate = (annualRate / 100) / frequency;

    let payment;

    // Calculate payment (special case for zero interest)
    if (periodicRate === 0) {
      payment = principal / totalPayments;
    } else {
      payment =
        principal * periodicRate /
        (1 - Math.pow(1 + periodicRate, -totalPayments));
    }

    // Display the payment amount
    out.textContent = payment.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });

    msg.textContent = '';
    msg.className = '';
  });
  setMode(mode);

  function showModeMessage(text, error = false) {
    msg.className = error ? 'err' : '';
    msg.textContent = text;
  }

  function integerGcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) [a, b] = [b, a % b];
    return a || 1n;
  }

  function parseFraction(value) {
    const text = value.trim();
    if (!text) throw new Error('Enter a fraction or decimal');
    if (/^[+-]?\d+\s*\/\s*[+-]?\d+$/.test(text)) {
      const parts = text.split('/');
      const denominator = BigInt(parts[1].trim());
      if (denominator === 0n) throw new Error('A fraction denominator cannot be zero');
      return { numerator: BigInt(parts[0].trim()), denominator };
    }
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) {
      const decimal = Decimal.fromString(text);
      const denominator = decimal.exp < 0n ? 10n ** (-decimal.exp) : 1n;
      return { numerator: decimal.m, denominator };
    }
    throw new Error('Use a fraction such as 1/2 or a decimal');
  }

  function reduceFraction(fraction) {
    let numerator = fraction.numerator;
    let denominator = fraction.denominator;
    if (denominator < 0n) {
      numerator = -numerator;
      denominator = -denominator;
    }
    const divisor = integerGcd(numerator, denominator);
    return { numerator: numerator / divisor, denominator: denominator / divisor };
  }

  function fractionText(fraction) {
    const reduced = reduceFraction(fraction);
    return reduced.denominator === 1n
      ? reduced.numerator.toString()
      : `${reduced.numerator}/${reduced.denominator}`;
  }

  function calculateFraction() {
    try {
      const a = parseFraction($('fractionA').value);
      const b = parseFraction($('fractionB').value);
      const operator = $('fractionOperator').value;
      let result;
      if (operator === '+') result = { numerator: a.numerator * b.denominator + b.numerator * a.denominator, denominator: a.denominator * b.denominator };
      if (operator === '-') result = { numerator: a.numerator * b.denominator - b.numerator * a.denominator, denominator: a.denominator * b.denominator };
      if (operator === '*') result = { numerator: a.numerator * b.numerator, denominator: a.denominator * b.denominator };
      if (operator === '/') {
        if (b.numerator === 0n) throw new Error('Cannot divide by a zero fraction');
        result = { numerator: a.numerator * b.denominator, denominator: a.denominator * b.numerator };
      }
      const reduced = reduceFraction(result);
      const decimal = Number(reduced.numerator) / Number(reduced.denominator);
      const fractionResult = fractionText(reduced);
      const decimalText = Number.isFinite(decimal) ? String(decimal) : 'out of range';
      out.classList.remove('stats-out');
      out.classList.add('fraction-out');
      const primary = document.createElement('span');
      primary.className = 'fraction-primary';
      primary.textContent = fractionResult;
      const secondary = document.createElement('span');
      secondary.className = 'fraction-secondary';
      secondary.textContent = decimalText;
      out.replaceChildren(primary, secondary);
      showModeMessage('');
      addHistory(`${$('fractionA').value} ${operator} ${$('fractionB').value}`, fractionResult, fractionResult);
    } catch (error) {
      out.textContent = '';
      showModeMessage(error.message, true);
    }
  }

  function convertDecimalToFraction() {
    try {
      const fraction = parseFraction($('fractionA').value);
      const reduced = reduceFraction(fraction);
      out.textContent = fractionText(reduced);
      out.className = '';
      showModeMessage('');
      addHistory($('fractionA').value, fractionText(reduced), fractionText(reduced));
    } catch (error) {
      out.textContent = '';
      showModeMessage(error.message, true);
    }
  }

  function updateFractionMode() {
    const operation = $('fractionOperator').value;
    const converting = operation === 'convert';
    $('fractionB').hidden = converting;
    $('fractionArithmetic').classList.toggle('convert-layout', converting);
    $('fractionCalculate').textContent = converting ? 'Convert' : 'Calculate';
  }

  function calculateFractionMode() {
    const operation = $('fractionOperator').value;
    if (!operation) {
      showModeMessage('Choose an operation', true);
      return;
    }
    if (operation === 'convert') convertDecimalToFraction();
    else calculateFraction();
  }

  function programmerValue(text, base) {
    const pattern = base === 2 ? /^[01]+$/ : base === 16 ? /^[0-9a-f]+$/i : /^\d+$/;
    if (!pattern.test(text.trim())) throw new Error(`Invalid digit for base ${base}`);
    return BigInt(`0${base === 16 ? 'x' : base === 2 ? 'b' : ''}${text.trim()}`);
  }

  function calculateProgrammer() {
    try {
      if (!$('programmerOperation').value) throw new Error('Choose an operation');
      if (!$('programmerBase').value) throw new Error('Choose an input base');
      const base = Number($('programmerBase').value);
      let value = programmerValue($('programmerInput').value, base);
      const operation = $('programmerOperation').value;
      if (operation !== 'none') {
        const operand = programmerValue($('programmerOperand').value, base);
        if (operation === 'and') value &= operand;
        if (operation === 'or') value |= operand;
        if (operation === 'xor') value ^= operand;
      }
      out.textContent = `Decimal: ${value.toString()}\nBinary: ${value.toString(2)}\nHexadecimal: ${value.toString(16).toUpperCase()}`;
      out.classList.add('stats-out');
      showModeMessage('');
      addHistory(`${$('programmerInput').value} ${operation}`, value.toString(), `Decimal: ${value.toString()}, Binary: ${value.toString(2)}, Hexadecimal: ${value.toString(16).toUpperCase()}`);
    } catch (error) {
      out.textContent = '';
      showModeMessage(error.message, true);
    }
  }

  function updateProgrammerOperation() {
    const operand = $('programmerOperand');
    const operation = $('programmerOperation').value;
    const converting = operation === 'none';
    operand.hidden = converting;
    $('programmerOperationRow').classList.toggle('one-column', converting);
    $('programmerCalculate').textContent = converting ? 'Convert' : 'Calculate';
  }

  function parseComplex(value) {
    let text = value.replace(/\s+/g, '').toLowerCase();
    while (text.startsWith('(') && text.endsWith(')')) {
      let depth = 0;
      let wrapsWholeValue = false;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '(') depth++;
        if (text[i] === ')') depth--;
        if (depth === 0 && i === text.length - 1) wrapsWholeValue = true;
        if (depth === 0 && i < text.length - 1) break;
      }
      if (!wrapsWholeValue) break;
      text = text.slice(1, -1);
    }

    const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
    let match = new RegExp(`^(${number})([+-])((?:\\d+(?:\\.\\d*)?|\\.\\d+)?)i$`).exec(text);
    if (match) {
      return { real: Number(match[1]), imaginary: Number(match[2] + (match[3] || '1')) };
    }
    match = new RegExp(`^(${number})i([+-])(${number.slice(3)})?$`).exec(text);
    if (match) {
      return { real: 0, imaginary: Number(match[1].replace(/i$/, '')) };
    }
    if (/^([+-]?)(?:i)$/.test(text)) {
      return { real: 0, imaginary: text.startsWith('-') ? -1 : 1 };
    }
    match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)?)i$/.exec(text);
    if (match) {
      const coefficient = text.endsWith('-i') ? '-1' : text.endsWith('+i') ? '1' : (match[1] || '1');
      return { real: 0, imaginary: Number(coefficient) };
    }
    match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(text);
    if (match) return { real: Number(match[1]), imaginary: 0 };
    throw new Error('Use complex values such as 1+2i or 3-i');
  }

  function calculateComplex() {
    try {
      const expression = $('complexInput').value.replace(/\s+/g, '').replace(/−/g, '-');
      if (!expression) throw new Error('Enter a complex expression');

      try {
        const standalone = parseComplex(expression);
        const real = Number(standalone.real.toFixed(12));
        const imaginary = Number(standalone.imaginary.toFixed(12));
        if (imaginary === 0) out.textContent = real.toString();
        else if (real === 0) {
          if (imaginary === 1) out.textContent = 'i';
          else if (imaginary === -1) out.textContent = '-i';
          else out.textContent = `${imaginary < 0 ? '-' : ''}${Math.abs(imaginary)}i`;
        }
        else {
          const imaginaryPart = imaginary === 1 ? 'i' : imaginary === -1 ? '-i' : `${Math.abs(imaginary)}i`;
          out.textContent = `${real}${imaginary < 0 ? ' - ' : ' + '}${imaginaryPart}`;
        }
        showModeMessage('');
        addHistory(expression, out.textContent, out.textContent);
        return;
      } catch (_) {}

      let split = null;
      let depth = 0;
      for (let i = 0; i < expression.length; i++) {
        if (expression[i] === '(') depth++;
        else if (expression[i] === ')') depth--;
        else if (depth === 0 && /^[+*\/-]$/.test(expression[i])) {
          const leftText = expression.slice(0, i);
          const rightText = expression.slice(i + 1);
          try {
            split = { left: parseComplex(leftText), right: parseComplex(rightText), operator: expression[i] };
            break;
          } catch (_) {}
        }
      }
      if (!split) throw new Error('Enter two complex values and an operator');
      const left = split.left;
      const right = split.right;
      let real, imaginary;
      if (split.operator === '+') {
        real = left.real + right.real; imaginary = left.imaginary + right.imaginary;
      } else if (split.operator === '-') {
        real = left.real - right.real; imaginary = left.imaginary - right.imaginary;
      } else if (split.operator === '*') {
        real = left.real * right.real - left.imaginary * right.imaginary;
        imaginary = left.real * right.imaginary + left.imaginary * right.real;
      } else {
        const denominator = right.real ** 2 + right.imaginary ** 2;
        if (denominator === 0) throw new Error('Cannot divide by zero complex value');
        real = (left.real * right.real + left.imaginary * right.imaginary) / denominator;
        imaginary = (left.imaginary * right.real - left.real * right.imaginary) / denominator;
      }
      const realText = Number(real.toFixed(12));
      const imaginaryText = Number(imaginary.toFixed(12));
      let result;
      if (imaginaryText === 0) {
        result = realText.toString();
      } else if (realText === 0) {
        if (imaginaryText === 1) result = 'i';
        else if (imaginaryText === -1) result = '-i';
        else result = `${imaginaryText < 0 ? '-' : ''}${Math.abs(imaginaryText)}i`;
      } else {
        const imaginaryPart = imaginaryText === 1 ? 'i' : imaginaryText === -1 ? '-i' : `${Math.abs(imaginaryText)}i`;
        result = `${realText}${imaginaryText < 0 ? ' - ' : ' + '}${imaginaryPart}`;
      }
      out.textContent = result;
      showModeMessage('');
      addHistory(expression, result, result);
    } catch (error) {
      out.textContent = '';
      showModeMessage(error.message, true);
    }
  }

  $('fractionCalculate').addEventListener('click', calculateFractionMode);
  $('fractionOperator').addEventListener('change', updateFractionMode);
  updateFractionMode();
  $('programmerCalculate').addEventListener('click', calculateProgrammer);
  $('programmerOperation').addEventListener('change', updateProgrammerOperation);
  updateProgrammerOperation();
  $('programmerBase').addEventListener('change', () => {
    const placeholder = $('programmerBase').querySelector('option[value=""]');
    if ($('programmerBase').value && placeholder) placeholder.disabled = true;
  });
  $('complexCalculate').addEventListener('click', calculateComplex);

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
  window.insertCalculatorFunction = function(symbol, hasGhostSlots = false) {
    if (!converterPanel.hidden) {
      closeUnitConverter();
    }

    insert(symbol, hasGhostSlots ? symbol.indexOf('(') + 1 : symbol.length);
    if (hasGhostSlots) exp.focus();
  };

  /* ---------- matrix ---------- */
  window.insertCalculatorMatrix = function(rows, columns) {
    if (rows * columns > MATRIX_ENTRY_LIMIT) {
      msg.className = 'err';
      msg.textContent = `Matrices can contain at most ${MATRIX_ENTRY_LIMIT} entries.`;
      return;
    }
    const row = `[${Array(columns).fill('0').join(',')}]`;
    window.insertCalculatorFunction(`matrix([${Array(rows).fill(row).join(',')}])`);
    exp.focus();
  };

})();

// Element Variables
const menuToggle = document.getElementById("FuncToggle");
const sideMenu = document.getElementById("sideMenu");
const categoryFilter = document.getElementById("categoryFilter");
const functionSearch = document.getElementById("functionSearch");
const functionList = document.getElementById("functionList");
const SYMBOLIC_SIDEBAR_FUNCTIONS = new Set(["derivative", "integral", "definite_integral", "solve"]);

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
    const isMatrix =
      func.symbol === "matrix" ||
      func.symbol === "matrix(";

    const row = document.createElement("div");
    row.className = "function-item";

    const name = document.createElement("span");
    name.className = "function-name";
    name.textContent = func.name;

    const symbol = document.createElement("small");
    symbol.className = "function-symbol";
    symbol.textContent = func.symbol;

    // Regular functions
    if (!isMatrix) {
      row.setAttribute("role", "button");
      row.tabIndex = 0;

      const insert = () => {
        window.insertCalculatorFunction(func.symbol, SYMBOLIC_SIDEBAR_FUNCTIONS.has(func.id));
      };

      row.addEventListener("click", insert);

      row.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          insert();
        }
      });

      row.append(name, symbol);
    }

    // Matrix function
    else {
      const matrixButton = document.createElement("button");
      matrixButton.type = "button";
      matrixButton.className = "matrix-function-button";
      matrixButton.append(name);

      const dimensions = document.createElement("div");
      dimensions.className = "matrix-dimensions";

      const rows = document.createElement("input");
      rows.type = "number";
      rows.min = "1";
      rows.step = "1";
      rows.value = "2";
      rows.setAttribute("aria-label", "Matrix rows");

      const multiply = document.createElement("span");
      multiply.textContent = "×";

      const cols = document.createElement("input");
      cols.type = "number";
      cols.min = "1";
      cols.step = "1";
      cols.value = "2";
      cols.setAttribute("aria-label", "Matrix columns");

      const insertMatrix = () => {
        const r = Number(rows.value);
        const c = Number(cols.value);

        if (
          !Number.isSafeInteger(r) ||
          !Number.isSafeInteger(c) ||
          r < 1 ||
          c < 1
        ) {
          alert("Enter valid positive whole numbers.");
          return;
        }

        window.insertCalculatorMatrix(r, c);
      };

      matrixButton.addEventListener("click", insertMatrix);

      // Clicking the symbol also inserts the matrix.
      symbol.classList.add("matrix-symbol");
      symbol.setAttribute("role", "button");
      symbol.tabIndex = 0;
      symbol.addEventListener("click", insertMatrix);
      symbol.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          insertMatrix();
        }
      });

      dimensions.append(rows, multiply, cols);
      row.append(matrixButton, dimensions, symbol);
    }

    functionList.appendChild(row);
  });
}

// Search and filter events
categoryFilter.addEventListener("change", displayFunctions);
functionSearch.addEventListener("input", displayFunctions);

// Initialize
loadCategories();
displayFunctions();
