/* ---------- Requirement 06: additive 2D graphing module ---------- */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const form = $('graphForm');
  const input = $('graphExpr');
  const canvas = $('graphCanvas');
  const status = $('graphStatus');
  const viewLabel = $('graphView');
  if (!form || !input || !canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const MIN_SCALE = 12;
  const MAX_SCALE = 320;
  let scale = 40;
  let centerX = 0;
  let centerY = 0;
  let curve = null;
  let plottedExpression = 'x^2';
  let dragging = null;

  class GraphSyntaxError extends Error {}

  function tokenize(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      const rest = source.slice(i);
      if (/^\s+/.test(rest)) { i += /^\s+/.exec(rest)[0].length; continue; }
      let match = /^(?:\d+\.?\d*|\.\d+)/.exec(rest);
      if (match) {
        tokens.push({ type: 'number', value: Number(match[0]), at: i });
        i += match[0].length;
      } else if (source[i] === 'π') {
        tokens.push({ type: 'name', value: 'pi', at: i++ });
      } else if ((match = /^[A-Za-z_]+/.exec(rest))) {
        tokens.push({ type: 'name', value: match[0].toLowerCase(), at: i });
        i += match[0].length;
      } else if (source.slice(i, i + 2) === '**') {
        tokens.push({ type: 'op', value: '^', at: i });
        i += 2;
      } else if ('+-−×*/÷^()'.includes(source[i])) {
        const c = source[i++];
        tokens.push({ type: c === '(' || c === ')' ? 'paren' : 'op', value: ({ '−': '-', '×': '*', '÷': '/' })[c] || c, at: i - 1 });
      } else {
        throw new GraphSyntaxError(`Unsupported character “${source[i]}” at column ${i + 1}.`);
      }
      if (tokens.length > 256) throw new GraphSyntaxError('This function is too long to plot.');
    }
    tokens.push({ type: 'end', value: '', at: source.length });
    return tokens;
  }

  function parse(source) {
    const cleaned = source.trim().replace(/^y\s*=\s*/i, '');
    if (!cleaned) throw new GraphSyntaxError('Enter a function of x, such as x^2 or sin(x).');
    const tokens = tokenize(cleaned);
    let index = 0;
    let depth = 0;
    const peek = () => tokens[index];
    const take = () => tokens[index++];
    const isOp = (...ops) => peek().type === 'op' && ops.includes(peek().value);
    const startsAtom = () => peek().type === 'number' || peek().type === 'name' || (peek().type === 'paren' && peek().value === '(');

    function expression() {
      let node = term();
      while (isOp('+', '-')) {
        const op = take().value;
        node = { type: 'binary', op, left: node, right: term() };
      }
      return node;
    }
    function term() {
      let node = unary();
      while (true) {
        if (isOp('*', '/')) {
          const op = take().value;
          node = { type: 'binary', op, left: node, right: unary() };
        } else if (startsAtom()) {
          node = { type: 'binary', op: '*', left: node, right: unary() };
        } else return node;
      }
    }
    function unary() {
      if (isOp('-')) { take(); return { type: 'negate', value: unary() }; }
      if (isOp('+')) { take(); return unary(); }
      return power();
    }
    function power() {
      const base = atom();
      if (isOp('^')) { take(); return { type: 'binary', op: '^', left: base, right: unary() }; }
      return base;
    }
    function atom() {
      const token = take();
      if (token.type === 'number') return { type: 'number', value: token.value };
      if (token.type === 'name') {
        if (token.value === 'x') return { type: 'x' };
        if (token.value === 'pi') return { type: 'number', value: Math.PI };
        if (token.value === 'e') return { type: 'number', value: Math.E };
        if (/^(sin|cos|tan|asin|acos|atan|sqrt|ln|log|exp|abs)$/.test(token.value)) {
          if (peek().type !== 'paren' || peek().value !== '(') {
            throw new GraphSyntaxError(`“${token.value}” needs parentheses, e.g. ${token.value}(x).`);
          }
          take();
          if (++depth > 64) throw new GraphSyntaxError('The function is nested too deeply.');
          const argument = expression();
          depth--;
          if (peek().type !== 'paren' || peek().value !== ')') throw new GraphSyntaxError('A closing “)” is missing.');
          take();
          return { type: 'call', name: token.value, argument };
        }
        throw new GraphSyntaxError(`Unknown name “${token.value}”. Use x, pi, e, or a calculator function.`);
      }
      if (token.type === 'paren' && token.value === '(') {
        if (++depth > 64) throw new GraphSyntaxError('The function is nested too deeply.');
        const inside = expression();
        depth--;
        if (peek().type !== 'paren' || peek().value !== ')') throw new GraphSyntaxError('A closing “)” is missing.');
        take();
        return inside;
      }
      if (token.type === 'end') throw new GraphSyntaxError('The function ends early; add a value or closing parenthesis.');
      throw new GraphSyntaxError(`Unexpected “${token.value}” at column ${token.at + 1}.`);
    }

    const tree = expression();
    if (peek().type !== 'end') throw new GraphSyntaxError(`Unexpected “${peek().value}” at column ${peek().at + 1}.`);
    return { tree, expression: cleaned };
  }

  function evaluate(node, x, degrees) {
    switch (node.type) {
      case 'number': return node.value;
      case 'x': return x;
      case 'negate': return -evaluate(node.value, x, degrees);
      case 'binary': {
        const a = evaluate(node.left, x, degrees);
        const b = evaluate(node.right, x, degrees);
        if (node.op === '+') return a + b;
        if (node.op === '-') return a - b;
        if (node.op === '*') return a * b;
        if (node.op === '/') return a / b;
        return Math.pow(a, b);
      }
      case 'call': {
        const value = evaluate(node.argument, x, degrees);
        const radians = degrees ? value * Math.PI / 180 : value;
        switch (node.name) {
          case 'sin': return Math.sin(radians);
          case 'cos': return Math.cos(radians);
          case 'tan': return Math.tan(radians);
          case 'asin': return (degrees ? 180 / Math.PI : 1) * Math.asin(value);
          case 'acos': return (degrees ? 180 / Math.PI : 1) * Math.acos(value);
          case 'atan': return (degrees ? 180 / Math.PI : 1) * Math.atan(value);
          case 'sqrt': return Math.sqrt(value);
          case 'ln': return Math.log(value);
          case 'log': return Math.log10(value);
          case 'exp': return Math.exp(value);
          case 'abs': return Math.abs(value);
        }
      }
    }
    return NaN;
  }

  function niceStep(target) {
    const power = Math.pow(10, Math.floor(Math.log10(target)));
    const fraction = target / power;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  }

  function formatNumber(value) {
    if (Math.abs(value) < 1e-9) return '0';
    if (Math.abs(value) >= 10000 || Math.abs(value) < 0.001) return value.toExponential(1).replace('e+', 'e');
    return Number(value.toPrecision(4)).toString();
  }

  function updateViewLabel() {
    viewLabel.textContent = `${formatNumber(scale)} px/unit`;
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const styles = getComputedStyle(document.documentElement);
    const line = styles.getPropertyValue('--line').trim() || '#cdd6d0';
    const ink = styles.getPropertyValue('--ink').trim() || '#17231f';
    const mute = styles.getPropertyValue('--mute').trim() || '#5d6b65';
    const accent = styles.getPropertyValue('--accent').trim() || '#0b6b57';
    const step = niceStep(76 / scale);
    const minX = centerX - width / (2 * scale);
    const maxX = centerX + width / (2 * scale);
    const minY = centerY - height / (2 * scale);
    const maxY = centerY + height / (2 * scale);

    ctx.lineWidth = 1;
    ctx.strokeStyle = line;
    ctx.beginPath();
    for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
      const px = width / 2 + (x - centerX) * scale;
      ctx.moveTo(Math.round(px) + 0.5, 0);
      ctx.lineTo(Math.round(px) + 0.5, height);
    }
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
      const py = height / 2 - (y - centerY) * scale;
      ctx.moveTo(0, Math.round(py) + 0.5);
      ctx.lineTo(width, Math.round(py) + 0.5);
    }
    ctx.stroke();

    const xAxisY = height / 2 + centerY * scale;
    const yAxisX = width / 2 - centerX * scale;
    ctx.strokeStyle = mute;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (xAxisY >= 0 && xAxisY <= height) { ctx.moveTo(0, Math.round(xAxisY) + 0.5); ctx.lineTo(width, Math.round(xAxisY) + 0.5); }
    if (yAxisX >= 0 && yAxisX <= width) { ctx.moveTo(Math.round(yAxisX) + 0.5, 0); ctx.lineTo(Math.round(yAxisX) + 0.5, height); }
    ctx.stroke();

    ctx.fillStyle = mute;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
      const px = width / 2 + (x - centerX) * scale;
      if (px < 24 || px > width - 24) continue;
      if (xAxisY < 0 || xAxisY > height || Math.abs(px - yAxisX) > 26) {
        ctx.textAlign = 'center';
        ctx.fillText(formatNumber(x), px, xAxisY >= 0 && xAxisY <= height ? Math.min(height - 15, xAxisY + 4) : 4);
      }
    }
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
      const py = height / 2 - (y - centerY) * scale;
      if (py < 8 || py > height - 8 || Math.abs(py - xAxisY) < 16) continue;
      if (yAxisX < 0 || yAxisX > width || yAxisX > 36) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatNumber(y), yAxisX >= 0 && yAxisX <= width ? yAxisX + 5 : 5, py);
      }
    }

    if (curve) {
      const angleButton = $('angle');
      const degrees = !!angleButton && angleButton.textContent.trim() === 'Deg';
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let active = false;
      let previousY = 0;
      for (let px = 0; px <= width; px += 1) {
        const x = centerX + (px - width / 2) / scale;
        let y;
        try { y = evaluate(curve, x, degrees); } catch (_) { y = NaN; }
        const py = height / 2 - (y - centerY) * scale;
        if (!Number.isFinite(py) || Math.abs(py) > height * 4 || (active && Math.abs(py - previousY) > height * 1.5)) {
          active = false;
          continue;
        }
        if (!active) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        active = true;
        previousY = py;
      }
      ctx.stroke();
      ctx.restore();
    }
    updateViewLabel();
  }

  function announceView() {
    viewLabel.textContent = `${formatNumber(centerX)}, ${formatNumber(centerY)} · ${formatNumber(scale)} px/unit`;
  }

  function plot() {
    try {
      const result = parse(input.value);
      curve = result.tree;
      plottedExpression = result.expression;
      status.className = 'graph-status';
      status.textContent = `Showing y = ${plottedExpression}. Trig angles follow the calculator’s Rad/Deg setting.`;
      canvas.setAttribute('aria-label', `Graph of y equals ${plottedExpression}`);
      render();
    } catch (error) {
      status.className = 'graph-status error';
      status.textContent = error instanceof GraphSyntaxError ? error.message : 'This function could not be plotted.';
    }
  }

  function zoom(factor, x = canvas.clientWidth / 2, y = canvas.clientHeight / 2) {
    const oldScale = scale;
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale * factor));
    if (nextScale === oldScale) return;
    const anchorX = centerX + (x - canvas.clientWidth / 2) / oldScale;
    const anchorY = centerY - (y - canvas.clientHeight / 2) / oldScale;
    scale = nextScale;
    centerX = anchorX - (x - canvas.clientWidth / 2) / scale;
    centerY = anchorY + (y - canvas.clientHeight / 2) / scale;
    render();
    announceView();
  }

  function resetView() {
    centerX = 0;
    centerY = 0;
    scale = 40;
    render();
    announceView();
  }

  form.addEventListener('submit', event => { event.preventDefault(); plot(); });
  $('graphZoomIn').addEventListener('click', () => zoom(1.25));
  $('graphZoomOut').addEventListener('click', () => zoom(0.8));
  $('graphReset').addEventListener('click', resetView);

  canvas.addEventListener('pointerdown', event => {
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging || dragging.id !== event.pointerId) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    centerX -= dx / scale;
    centerY += dy / scale;
    dragging.x = event.clientX;
    dragging.y = event.clientY;
    render();
    announceView();
  });
  const stopDragging = event => {
    if (dragging && dragging.id === event.pointerId) dragging = null;
  };
  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Home') { event.preventDefault(); resetView(); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.25); }
    else if (event.key === '-' || event.key === '−') { event.preventDefault(); zoom(0.8); }
    else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const amount = 40 / scale;
      if (event.key === 'ArrowLeft') centerX -= amount;
      if (event.key === 'ArrowRight') centerX += amount;
      if (event.key === 'ArrowUp') centerY += amount;
      if (event.key === 'ArrowDown') centerY -= amount;
      render();
      announceView();
    }
  });

  if (typeof ResizeObserver === 'function') new ResizeObserver(render).observe(canvas);
  else window.addEventListener('resize', render);
  const angleButton = $('angle');
  if (angleButton && typeof MutationObserver === 'function') {
    new MutationObserver(render).observe(angleButton, { childList: true, characterData: true, subtree: true });
  }
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', render);
  }

  plot();
  render();
})();
