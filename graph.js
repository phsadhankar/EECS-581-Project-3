/*
 * SEMESTER:        EECS 581 Fall 2026
 * PROJECT:         Project 3 - Calculator
 * FILE:            graph.js
 *
 * DESCRIPTION:     Implements interactive 2D graphing of single-variable expressions with input validation, panning, zooming, and view reset.
 * INPUT:           Single-variable expressions in x; plot, pan, zoom, and reset actions.
 * OUTPUT:          A 2D graph rendered on a canvas, view-scale information, and input-validation messages.
 *
 * SOURCES:         TBD
 *
 * AUTHOR:          Joshua Fakunmoju
 * CREATION DATE:   11/12/2026
 */


/* Requirements 06, 19, 22, 24: plotting, per-graph customization, saved views, comparison. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const form = $('graphForm');
  const input = $('graphExpr');
  const canvas = $('graphCanvas');
  const status = $('graphStatus');
  const viewLabel = $('graphView');
  const toggle = $('graphToggle');
  const panel = $('graphPanel');
  const modeSelect = $('modeSelect');
  const historyList = $('graphHistoryList');
  const historyEmpty = $('graphHistoryEmpty');
  const compareModeSelect = $('graphCompareMode');
  const compareStatus = $('graphCompareStatus');
  const compareView = $('graphCompareView');
  const title = $('graphTitle');
  const rangeStatus = $('graphRangeStatus');
  const controls = {
    label: $('graphLabel'),
    color: $('graphColor'),
    grid: $('graphGrid'),
    tickLabels: $('graphTickLabels'),
    xMin: $('graphXMin'),
    xMax: $('graphXMax'),
    yMin: $('graphYMin'),
    yMax: $('graphYMax')
  };
  if (!form || !input || !canvas || !canvas.getContext || !toggle || !panel || !modeSelect || !historyList || !compareView) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const STORAGE_KEY = 'calculator-graph-history-v1';
  const MAX_COMPARE = 4;
  const MAX_COORDINATE = 1e12;
  const MIN_SPAN = 1e-9;
  const COLOR_KEYS = ['teal', 'blue', 'orange', 'purple', 'rose'];
  const COLOR_TOKENS = {
    teal: '--graph-teal', blue: '--graph-blue', orange: '--graph-orange',
    purple: '--graph-purple', rose: '--graph-rose'
  };
  let store = { version: 1, graphs: [], activeId: null, selectedIds: [], compareMode: 'separate' };
  let activeGraph = null;
  let curve = null;
  let currentExpression = input.value.trim() || 'x^2';
  let viewBounds = null;
  let dragging = null;
  let saveTimer = 0;

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

  function isValidBounds(bounds) {
    if (!bounds) return false;
    const values = [bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax];
    if (!values.every(Number.isFinite) || values.some(value => Math.abs(value) > MAX_COORDINATE)) return false;
    return bounds.xMin < bounds.xMax && bounds.yMin < bounds.yMax &&
      bounds.xMax - bounds.xMin >= MIN_SPAN && bounds.yMax - bounds.yMin >= MIN_SPAN;
  }
  function copyBounds(bounds) {
    return bounds ? { xMin: bounds.xMin, xMax: bounds.xMax, yMin: bounds.yMin, yMax: bounds.yMax } : null;
  }
  function defaultBounds(width, height) {
    width = Math.max(1, width || 364);
    height = Math.max(1, height || 280);
    const unitsPerPixel = 1 / 40;
    return { xMin: -width * unitsPerPixel / 2, xMax: width * unitsPerPixel / 2,
      yMin: -height * unitsPerPixel / 2, yMax: height * unitsPerPixel / 2 };
  }
  function currentBounds() {
    if (isValidBounds(viewBounds)) return copyBounds(viewBounds);
    if (activeGraph && isValidBounds(activeGraph.bounds)) return copyBounds(activeGraph.bounds);
    return defaultBounds(canvas.clientWidth, canvas.clientHeight);
  }
  function nextId() {
    return `graph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function normalizeGraph(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.expression !== 'string') return null;
    const expression = raw.expression.trim();
    if (!expression || expression.length > 300) return null;
    try { parse(expression); } catch (_) { return null; }
    return {
      id: typeof raw.id === 'string' && raw.id.length < 100 ? raw.id : nextId(),
      expression,
      label: typeof raw.label === 'string' ? raw.label.slice(0, 80) : '',
      color: COLOR_KEYS.includes(raw.color) ? raw.color : 'teal',
      gridlines: raw.gridlines !== false,
      tickLabels: raw.tickLabels !== false,
      manualRange: raw.manualRange === true,
      bounds: isValidBounds(raw.bounds) ? copyBounds(raw.bounds) : null
    };
  }
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.graphs)) return;
      store.graphs = parsed.graphs.map(normalizeGraph).filter(Boolean);
      store.activeId = typeof parsed.activeId === 'string' ? parsed.activeId : null;
      store.selectedIds = Array.isArray(parsed.selectedIds) ? parsed.selectedIds.filter(id => typeof id === 'string') : [];
      store.compareMode = parsed.compareMode === 'overlay' ? 'overlay' : 'separate';
      store.selectedIds = [...new Set(store.selectedIds)].filter(id => store.graphs.some(graph => graph.id === id)).slice(0, MAX_COMPARE);
      activeGraph = store.graphs.find(graph => graph.id === store.activeId) || store.graphs[0] || null;
      if (activeGraph) {
        store.activeId = activeGraph.id;
        input.value = activeGraph.expression;
        currentExpression = activeGraph.expression;
        curve = parse(currentExpression).tree;
        viewBounds = copyBounds(activeGraph.bounds);
        syncSettingsFromGraph(activeGraph);
      }
    } catch (_) {
      setGraphStatus('Saved graph history could not be read; new plots can still be saved.', true);
    }
  }
  function writeState() {
    if (activeGraph && isValidBounds(viewBounds)) activeGraph.bounds = copyBounds(viewBounds);
    store.activeId = activeGraph ? activeGraph.id : null;
    const data = {
      version: 1,
      graphs: store.graphs,
      activeId: store.activeId,
      selectedIds: store.selectedIds,
      compareMode: store.compareMode
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (_) {
      setGraphStatus('This browser could not save graph history. The current plot remains open.', true);
      return false;
    }
  }
  function persistSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeState, 140);
  }
  function persistNow() {
    clearTimeout(saveTimer);
    return writeState();
  }

  function niceStep(target) {
    if (!Number.isFinite(target) || target <= 0) return 1;
    const power = Math.pow(10, Math.floor(Math.log10(target)));
    const fraction = target / power;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  }
  function formatNumber(value) {
    if (Math.abs(value) < 1e-9) return '0';
    if (Math.abs(value) >= 10000 || Math.abs(value) < 0.001) return value.toExponential(1).replace('e+', 'e');
    return Number(value.toPrecision(4)).toString();
  }
  function formatInputNumber(value) {
    if (!Number.isFinite(value)) return '';
    return Number(value.toPrecision(8)).toString();
  }
  function graphLabelFor(graph) {
    if (graph && graph.label && graph.label.trim()) return graph.label.trim();
    const expression = graph ? graph.expression : currentExpression;
    try { return `y = ${parse(expression).expression}`; }
    catch (_) { return `y = ${expression || 'x^2'}`; }
  }
  function colorValue(color) {
    const token = COLOR_TOKENS[COLOR_KEYS.includes(color) ? color : 'teal'];
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#087f68';
  }
  function setGraphStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.className = isError ? 'graph-status error' : 'graph-status';
  }
  function setRangeStatus() {
    if (!rangeStatus) return;
    if (activeGraph && activeGraph.manualRange) {
      rangeStatus.textContent = 'Manual axis bounds active for this graph.';
    } else {
      rangeStatus.textContent = 'Automatic tick spacing uses 1–2–5 steps; saved bounds track pan and zoom.';
    }
    rangeStatus.className = 'graph-range-status';
  }
  function syncRangeInputs(bounds = currentBounds()) {
    if (!isValidBounds(bounds)) return;
    controls.xMin.value = formatInputNumber(bounds.xMin);
    controls.xMax.value = formatInputNumber(bounds.xMax);
    controls.yMin.value = formatInputNumber(bounds.yMin);
    controls.yMax.value = formatInputNumber(bounds.yMax);
  }
  function syncSettingsFromGraph(graph) {
    controls.label.value = graph ? graph.label : '';
    controls.color.value = graph && COLOR_KEYS.includes(graph.color) ? graph.color : 'teal';
    controls.grid.checked = !graph || graph.gridlines !== false;
    controls.tickLabels.checked = !graph || graph.tickLabels !== false;
    compareModeSelect.value = store.compareMode;
    setRangeStatus();
  }
  function updateTitle() {
    title.textContent = graphLabelFor(activeGraph);
    canvas.setAttribute('aria-label', `Graph of ${graphLabelFor(activeGraph)}`);
  }
  function updateViewLabel(bounds = currentBounds()) {
    viewLabel.textContent = `x ${formatNumber(bounds.xMin)}…${formatNumber(bounds.xMax)} · y ${formatNumber(bounds.yMin)}…${formatNumber(bounds.yMax)}`;
  }

  function drawCanvas(targetCanvas, graphs, explicitBounds, options = {}) {
    const targetContext = targetCanvas.getContext('2d');
    if (!targetContext) return;
    const rect = targetCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (targetCanvas.width !== pixelWidth || targetCanvas.height !== pixelHeight) {
      targetCanvas.width = pixelWidth;
      targetCanvas.height = pixelHeight;
    }
    targetContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    targetContext.clearRect(0, 0, width, height);

    const bounds = isValidBounds(explicitBounds) ? explicitBounds :
      (graphs[0] && isValidBounds(graphs[0].bounds) ? graphs[0].bounds : defaultBounds(width, height));
    const xSpan = bounds.xMax - bounds.xMin;
    const ySpan = bounds.yMax - bounds.yMin;
    const xScale = width / xSpan;
    const yScale = height / ySpan;
    const styles = getComputedStyle(document.documentElement);
    const line = styles.getPropertyValue('--line').trim() || '#cdd6d0';
    const ink = styles.getPropertyValue('--ink').trim() || '#17231f';
    const mute = styles.getPropertyValue('--mute').trim() || '#5d6b65';
    const grid = options.grid !== undefined ? options.grid : (!graphs.length || graphs.some(graph => graph.gridlines));
    const tickLabels = options.tickLabels !== undefined ? options.tickLabels : (!graphs.length || graphs.some(graph => graph.tickLabels));

    if (grid) {
      const stepX = niceStep(xSpan * 76 / width);
      const stepY = niceStep(ySpan * 76 / height);
      targetContext.strokeStyle = line;
      targetContext.lineWidth = 1;
      targetContext.beginPath();
      let count = 0;
      for (let x = Math.ceil(bounds.xMin / stepX) * stepX; x <= bounds.xMax && count++ < 500; x += stepX) {
        const px = (x - bounds.xMin) * xScale;
        targetContext.moveTo(Math.round(px) + 0.5, 0);
        targetContext.lineTo(Math.round(px) + 0.5, height);
      }
      count = 0;
      for (let y = Math.ceil(bounds.yMin / stepY) * stepY; y <= bounds.yMax && count++ < 500; y += stepY) {
        const py = (bounds.yMax - y) * yScale;
        targetContext.moveTo(0, Math.round(py) + 0.5);
        targetContext.lineTo(width, Math.round(py) + 0.5);
      }
      targetContext.stroke();
    }

    const xZero = (0 - bounds.xMin) * xScale;
    const yZero = (bounds.yMax - 0) * yScale;
    const hasXAxis = bounds.yMin <= 0 && bounds.yMax >= 0;
    const hasYAxis = bounds.xMin <= 0 && bounds.xMax >= 0;
    targetContext.strokeStyle = mute;
    targetContext.lineWidth = 1.5;
    targetContext.beginPath();
    if (hasXAxis) { targetContext.moveTo(0, Math.round(yZero) + 0.5); targetContext.lineTo(width, Math.round(yZero) + 0.5); }
    if (hasYAxis) { targetContext.moveTo(Math.round(xZero) + 0.5, 0); targetContext.lineTo(Math.round(xZero) + 0.5, height); }
    targetContext.stroke();

    if (tickLabels) {
      const stepX = niceStep(xSpan * 76 / width);
      const stepY = niceStep(ySpan * 76 / height);
      targetContext.fillStyle = mute;
      targetContext.font = '11px system-ui, sans-serif';
      targetContext.textBaseline = 'top';
      let count = 0;
      for (let x = Math.ceil(bounds.xMin / stepX) * stepX; x <= bounds.xMax && count++ < 500; x += stepX) {
        const px = (x - bounds.xMin) * xScale;
        if (px < 23 || px > width - 23 || (hasYAxis && Math.abs(px - xZero) < 24)) continue;
        targetContext.textAlign = 'center';
        targetContext.fillText(formatNumber(x), px, hasXAxis ? Math.min(height - 15, yZero + 4) : height - 16);
      }
      count = 0;
      for (let y = Math.ceil(bounds.yMin / stepY) * stepY; y <= bounds.yMax && count++ < 500; y += stepY) {
        const py = (bounds.yMax - y) * yScale;
        if (py < 8 || py > height - 8 || (hasXAxis && Math.abs(py - yZero) < 15)) continue;
        targetContext.textAlign = 'left';
        targetContext.textBaseline = 'middle';
        targetContext.fillText(formatNumber(y), hasYAxis ? Math.min(width - 35, xZero + 5) : 5, py);
      }
    }

    const angleButton = $('angle');
    const degrees = !!angleButton && angleButton.textContent.trim() === 'Deg';
    const comparisonDashes = [[], [8, 4], [2, 3], [10, 3, 2, 3]];
    for (const [graphIndex, graph] of graphs.entries()) {
      let tree;
      try { tree = graph.expression === currentExpression && graph === activeGraph ? curve : parse(graph.expression).tree; }
      catch (_) { continue; }
      if (!tree) continue;
      targetContext.save();
      targetContext.beginPath();
      targetContext.rect(0, 0, width, height);
      targetContext.clip();
      targetContext.strokeStyle = colorValue(graph.color);
      targetContext.lineWidth = 2.5;
      targetContext.lineJoin = 'round';
      targetContext.setLineDash(graphs.length > 1 ? comparisonDashes[graphIndex % comparisonDashes.length] : []);
      targetContext.beginPath();
      let active = false;
      let previousY = 0;
      for (let px = 0; px <= width; px += 1) {
        const x = bounds.xMin + px / xScale;
        let y;
        try { y = evaluate(tree, x, degrees); } catch (_) { y = NaN; }
        const py = (bounds.yMax - y) * yScale;
        if (!Number.isFinite(py) || Math.abs(py) > height * 4 || (active && Math.abs(py - previousY) > height * 1.5)) {
          active = false;
          continue;
        }
        if (!active) targetContext.moveTo(px, py);
        else targetContext.lineTo(px, py);
        active = true;
        previousY = py;
      }
      targetContext.stroke();
      targetContext.restore();
    }
    if (options.titleText) {
      targetContext.fillStyle = ink;
      targetContext.font = '600 12px system-ui, sans-serif';
      targetContext.textAlign = 'left';
      targetContext.textBaseline = 'top';
      targetContext.fillText(options.titleText, 8, 7, Math.max(40, width - 16));
    }
  }

  function renderMain() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (!isValidBounds(viewBounds)) viewBounds = activeGraph && isValidBounds(activeGraph.bounds) ? copyBounds(activeGraph.bounds) : defaultBounds(rect.width, rect.height);
    const graphForDrawing = curve ? [{
      id: activeGraph ? activeGraph.id : 'preview',
      expression: currentExpression,
      label: graphLabelFor(activeGraph),
      color: activeGraph ? activeGraph.color : controls.color.value,
      gridlines: controls.grid.checked,
      tickLabels: controls.tickLabels.checked,
      bounds: viewBounds
    }] : [];
    drawCanvas(canvas, graphForDrawing, viewBounds, {
      grid: controls.grid.checked,
      tickLabels: controls.tickLabels.checked,
      titleText: graphForDrawing.length ? graphLabelFor(activeGraph) : ''
    });
    updateTitle();
    updateViewLabel(viewBounds);
    setRangeStatus();
    if (activeGraph && isValidBounds(viewBounds)) activeGraph.bounds = copyBounds(viewBounds);
  }
  function selectedGraphs() {
    return store.selectedIds.map(id => store.graphs.find(graph => graph.id === id)).filter(Boolean);
  }
  function unionBounds(graphs) {
    const bounds = graphs.map(graph => isValidBounds(graph.bounds) ? graph.bounds : defaultBounds(canvas.clientWidth, canvas.clientHeight));
    return {
      xMin: Math.min(...bounds.map(item => item.xMin)),
      xMax: Math.max(...bounds.map(item => item.xMax)),
      yMin: Math.min(...bounds.map(item => item.yMin)),
      yMax: Math.max(...bounds.map(item => item.yMax))
    };
  }
  function drawComparisonCanvases() {
    const graphs = selectedGraphs();
    const overlay = $('graphOverlayCanvas');
    if (overlay && graphs.length >= 2) {
      const combined = unionBounds(graphs);
      drawCanvas(overlay, graphs, combined, {
        grid: graphs.some(graph => graph.gridlines),
        tickLabels: graphs.some(graph => graph.tickLabels)
      });
    }
    compareView.querySelectorAll('canvas[data-graph-id]').forEach(compareCanvas => {
      const graph = graphs.find(item => item.id === compareCanvas.dataset.graphId);
      if (graph) drawCanvas(compareCanvas, [graph], graph.bounds, {
        grid: graph.gridlines, tickLabels: graph.tickLabels, titleText: graphLabelFor(graph)
      });
    });
  }
  function addLegend(container, graphs) {
    const list = document.createElement('ul');
    list.className = 'graph-legend';
    const legendDashStyles = ['solid', 'dashed', 'dotted', 'dashed'];
    graphs.forEach((graph, index) => {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'graph-color-swatch';
      swatch.style.backgroundColor = 'transparent';
      swatch.style.border = '0';
      swatch.style.borderRadius = '0';
      swatch.style.width = '18px';
      swatch.style.flexBasis = '18px';
      swatch.style.borderBottom = `3px ${legendDashStyles[index % legendDashStyles.length]} ${colorValue(graph.color)}`;
      swatch.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.textContent = graphLabelFor(graph);
      item.append(swatch, text);
      list.append(item);
    });
    container.append(list);
  }
  function renderComparison() {
    compareModeSelect.value = store.compareMode;
    compareView.replaceChildren();
    const graphs = selectedGraphs();
    compareStatus.className = 'graph-help';
    if (graphs.length < 2) {
      compareStatus.textContent = `Choose at least two saved graphs using the Compare boxes above (${graphs.length}/${MAX_COMPARE} selected).`;
      return;
    }
    if (store.compareMode === 'separate') {
      compareStatus.textContent = `${graphs.length} equations shown in separate panes; each keeps its saved view.`;
      const grid = document.createElement('div');
      grid.className = 'graph-compare-grid';
      graphs.forEach(graph => {
        const card = document.createElement('article');
        card.className = 'graph-compare-card';
        const heading = document.createElement('h4');
        heading.textContent = graphLabelFor(graph);
        const wrap = document.createElement('div');
        wrap.className = 'graph-compare-canvas-wrap';
        const compareCanvas = document.createElement('canvas');
        compareCanvas.className = 'graph-compare-canvas';
        compareCanvas.dataset.graphId = graph.id;
        compareCanvas.setAttribute('role', 'img');
        compareCanvas.setAttribute('aria-label', `Separate plot of ${graphLabelFor(graph)}`);
        wrap.append(compareCanvas);
        card.append(heading, wrap);
        grid.append(card);
      });
      compareView.append(grid);
    } else {
      compareStatus.textContent = 'Overlay uses shared axes spanning the selected saved views; line colors and the legend identify each equation.';
      const card = document.createElement('article');
      card.className = 'graph-compare-card';
      const wrap = document.createElement('div');
      wrap.className = 'graph-compare-canvas-wrap';
      const compareCanvas = document.createElement('canvas');
      compareCanvas.id = 'graphOverlayCanvas';
      compareCanvas.className = 'graph-compare-canvas';
      compareCanvas.setAttribute('role', 'img');
      compareCanvas.setAttribute('aria-label', `Overlay comparison of ${graphs.map(graphLabelFor).join(' and ')}`);
      wrap.append(compareCanvas);
      card.append(wrap);
      addLegend(card, graphs);
      compareView.append(card);
    }
    requestAnimationFrame(drawComparisonCanvases);
  }

  function renderHistory() {
    historyList.replaceChildren();
    historyEmpty.hidden = store.graphs.length > 0;
    store.graphs.forEach(graph => {
      const item = document.createElement('li');
      item.className = 'graph-history-item';
      const pick = document.createElement('label');
      pick.className = 'graph-history-pick';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.compareId = graph.id;
      checkbox.checked = store.selectedIds.includes(graph.id);
      checkbox.setAttribute('aria-label', `Compare ${graphLabelFor(graph)}`);
      pick.append(checkbox, document.createTextNode('Compare'));

      const info = document.createElement('div');
      info.className = 'graph-history-info';
      const swatch = document.createElement('span');
      swatch.className = 'graph-color-swatch';
      swatch.style.backgroundColor = colorValue(graph.color);
      swatch.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('div');
      copy.className = 'graph-history-copy';
      const name = document.createElement('strong');
      name.textContent = graphLabelFor(graph);
      const equation = document.createElement('small');
      const bounds = isValidBounds(graph.bounds) ? graph.bounds : null;
      equation.textContent = bounds ? `${graph.expression} · saved x ${formatNumber(bounds.xMin)}…${formatNumber(bounds.xMax)}` : graph.expression;
      copy.append(name, equation);
      info.append(swatch, copy);

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'graph-history-open';
      openButton.dataset.openId = graph.id;
      openButton.textContent = 'Open';
      openButton.setAttribute('aria-label', `Open ${graphLabelFor(graph)}`);
      item.append(pick, info, openButton);
      historyList.append(item);
    });
  }

  function nextGraphColor(excludeId = null) {
    const usage = Object.fromEntries(COLOR_KEYS.map(color => [color, 0]));
    store.graphs.forEach(graph => {
      if (graph.id !== excludeId && COLOR_KEYS.includes(graph.color)) usage[graph.color] += 1;
    });
    return COLOR_KEYS.find(color => usage[color] === 0) ||
      COLOR_KEYS.reduce((leastUsed, color) => usage[color] < usage[leastUsed] ? color : leastUsed, COLOR_KEYS[0]);
  }
  function populateDefaults(graph = null) {
    controls.label.value = graph ? graph.label : '';
    controls.color.value = graph && COLOR_KEYS.includes(graph.color) ? graph.color : 'teal';
    controls.grid.checked = graph ? graph.gridlines !== false : true;
    controls.tickLabels.checked = graph ? graph.tickLabels !== false : true;
  }
  function createGraph(expression, bounds) {
    const graph = {
      id: nextId(), expression, label: '',
      color: nextGraphColor(),
      gridlines: true, tickLabels: true, manualRange: false,
      bounds: isValidBounds(bounds) ? copyBounds(bounds) : null
    };
    store.graphs.unshift(graph);
    activeGraph = graph;
    store.activeId = graph.id;
    viewBounds = copyBounds(graph.bounds);
    populateDefaults(graph);
    return graph;
  }
  function activateGraph(graph) {
    if (!graph) return;
    activeGraph = graph;
    store.activeId = graph.id;
    input.value = graph.expression;
    currentExpression = graph.expression;
    curve = parse(currentExpression).tree;
    viewBounds = isValidBounds(graph.bounds) ? copyBounds(graph.bounds) : null;
    syncSettingsFromGraph(graph);
    syncRangeInputs(viewBounds || defaultBounds(canvas.clientWidth, canvas.clientHeight));
    setGraphStatus(`Showing ${graphLabelFor(graph)}. Its saved view and settings are restored.`);
    renderMain();
    persistNow();
    renderHistory();
    renderComparison();
  }
  function prepareGraph(expression, parsed) {
    const previousBounds = currentBounds();
    if (activeGraph && activeGraph.expression === expression) {
      activeGraph.bounds = copyBounds(previousBounds);
      store.activeId = activeGraph.id;
      return activeGraph;
    }
    const graph = createGraph(expression, previousBounds);
    return graph;
  }

  function plot() {
    const expression = input.value.trim();
    let result;
    try { result = parse(expression); }
    catch (error) {
      curve = null;
      currentExpression = expression;
      setGraphStatus(error instanceof GraphSyntaxError ? error.message : 'This function could not be plotted.', true);
      canvas.setAttribute('aria-label', 'No valid function is currently plotted');
      renderMain();
      return false;
    }
    const graph = prepareGraph(expression, result);
    activeGraph = graph;
    curve = result.tree;
    currentExpression = expression;
    graph.expression = expression;
    graph.bounds = copyBounds(viewBounds || currentBounds());
    store.activeId = graph.id;
    syncSettingsFromGraph(graph);
    syncRangeInputs(graph.bounds);
    setGraphStatus(`Showing y = ${result.expression}. Trig angles follow the calculator’s Rad/Deg setting.`);
    persistNow();
    renderMain();
    renderHistory();
    renderComparison();
    return true;
  }
  function readAxisBounds() {
    const raw = [controls.xMin.value.trim(), controls.xMax.value.trim(), controls.yMin.value.trim(), controls.yMax.value.trim()];
    if (raw.some(value => value === '')) return { error: 'Enter all four numeric axis bounds.' };
    const [xMin, xMax, yMin, yMax] = raw.map(Number);
    const bounds = { xMin, xMax, yMin, yMax };
    if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || [xMin, xMax, yMin, yMax].some(value => Math.abs(value) > MAX_COORDINATE)) {
      return { error: 'Bounds must be finite numbers between −1e12 and 1e12.' };
    }
    if (xMin >= xMax || yMin >= yMax) return { error: 'Each minimum must be less than its maximum.' };
    if (xMax - xMin < MIN_SPAN || yMax - yMin < MIN_SPAN) return { error: 'Each axis range must span at least 1e−9 units.' };
    return { bounds };
  }
  function applySettings() {
    const checked = readAxisBounds();
    if (checked.error) {
      rangeStatus.textContent = checked.error;
      rangeStatus.className = 'graph-range-status error';
      return;
    }
    let parsed;
    const expression = input.value.trim();
    try { parsed = parse(expression); }
    catch (error) {
      setGraphStatus(error instanceof GraphSyntaxError ? error.message : 'Plot a valid equation before applying settings.', true);
      return;
    }
    const graph = prepareGraph(expression, parsed);
    activeGraph = graph;
    currentExpression = expression;
    curve = parsed.tree;
    graph.expression = expression;
    graph.label = controls.label.value.trim().slice(0, 80);
    graph.color = COLOR_KEYS.includes(controls.color.value) ? controls.color.value : 'teal';
    graph.gridlines = controls.grid.checked;
    graph.tickLabels = controls.tickLabels.checked;
    graph.manualRange = true;
    graph.bounds = copyBounds(checked.bounds);
    viewBounds = copyBounds(checked.bounds);
    store.activeId = graph.id;
    setGraphStatus(`Settings applied to ${graphLabelFor(graph)}.`);
    setRangeStatus();
    syncRangeInputs(viewBounds);
    persistNow();
    renderMain();
    renderHistory();
    renderComparison();
  }
  function resetView() {
    viewBounds = defaultBounds(canvas.clientWidth, canvas.clientHeight);
    if (activeGraph) {
      activeGraph.bounds = copyBounds(viewBounds);
      activeGraph.manualRange = false;
      persistNow();
      renderHistory();
      renderComparison();
    }
    syncRangeInputs(viewBounds);
    renderMain();
    setGraphStatus('View reset to the automatic origin-centered range.');
  }
  function restoreDefaults() {
    const bounds = defaultBounds(canvas.clientWidth, canvas.clientHeight);
    controls.label.value = '';
    controls.color.value = nextGraphColor(activeGraph ? activeGraph.id : null);
    controls.grid.checked = true;
    controls.tickLabels.checked = true;
    viewBounds = bounds;
    if (activeGraph) {
      activeGraph.label = '';
      activeGraph.color = controls.color.value;
      activeGraph.gridlines = true;
      activeGraph.tickLabels = true;
      activeGraph.manualRange = false;
      activeGraph.bounds = copyBounds(bounds);
      persistNow();
      renderHistory();
      renderComparison();
    }
    syncRangeInputs(bounds);
    renderMain();
    setGraphStatus('Graph display settings restored to defaults.');
  }
  function zoom(factor, px = canvas.clientWidth / 2, py = canvas.clientHeight / 2) {
    const bounds = currentBounds();
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const xSpan = (bounds.xMax - bounds.xMin) / factor;
    const ySpan = (bounds.yMax - bounds.yMin) / factor;
    if (xSpan < MIN_SPAN || ySpan < MIN_SPAN || xSpan > MAX_COORDINATE * 2 || ySpan > MAX_COORDINATE * 2) return;
    const anchorX = bounds.xMin + (px / width) * (bounds.xMax - bounds.xMin);
    const anchorY = bounds.yMax - (py / height) * (bounds.yMax - bounds.yMin);
    const xMin = anchorX - (px / width) * xSpan;
    const yMax = anchorY + (py / height) * ySpan;
    const next = { xMin, xMax: xMin + xSpan, yMin: yMax - ySpan, yMax };
    if (!isValidBounds(next)) return;
    viewBounds = next;
    if (activeGraph) activeGraph.bounds = copyBounds(next);
    syncRangeInputs(next);
    renderMain();
    drawComparisonCanvases();
    updateViewLabel(next);
    persistNow();
    if (activeGraph) { renderHistory(); renderComparison(); }
  }
  function panByPixels(dx, dy) {
    const bounds = currentBounds();
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const xScale = width / (bounds.xMax - bounds.xMin);
    const yScale = height / (bounds.yMax - bounds.yMin);
    const next = {
      xMin: bounds.xMin - dx / xScale,
      xMax: bounds.xMax - dx / xScale,
      yMin: bounds.yMin + dy / yScale,
      yMax: bounds.yMax + dy / yScale
    };
    if (!isValidBounds(next)) return;
    viewBounds = next;
    if (activeGraph) activeGraph.bounds = copyBounds(next);
    renderMain();
    drawComparisonCanvases();
    updateViewLabel(next);
    persistSoon();
  }
  function stopDragging(event) {
    if (!dragging || dragging.id !== event.pointerId) return;
    dragging = null;
    syncRangeInputs(currentBounds());
    if (activeGraph) { persistNow(); renderHistory(); renderComparison(); }
  }
  function closeGraph() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('graph-open');
  }
  function syncMode() {
    const available = modeSelect.value === 'scientific';
    toggle.hidden = !available;
    if (!available) closeGraph();
  }
  function openGraph() {
    if (modeSelect.value !== 'scientific') return;
    panel.hidden = false;
    document.body.classList.add('graph-open');
    toggle.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      if (!isValidBounds(viewBounds)) viewBounds = activeGraph && isValidBounds(activeGraph.bounds) ? copyBounds(activeGraph.bounds) : defaultBounds(canvas.clientWidth, canvas.clientHeight);
      syncRangeInputs(currentBounds());
      renderMain();
      drawComparisonCanvases();
      input.focus();
    });
  }

  form.addEventListener('submit', event => { event.preventDefault(); plot(); });
  $('graphZoomIn').addEventListener('click', () => zoom(1.25));
  $('graphZoomOut').addEventListener('click', () => zoom(0.8));
  $('graphReset').addEventListener('click', resetView);
  $('graphApplySettings').addEventListener('click', applySettings);
  $('graphDefaults').addEventListener('click', restoreDefaults);
  toggle.addEventListener('click', () => panel.hidden ? openGraph() : closeGraph());
  modeSelect.addEventListener('change', syncMode);
  compareModeSelect.addEventListener('change', () => {
    store.compareMode = compareModeSelect.value === 'overlay' ? 'overlay' : 'separate';
    persistNow();
    renderComparison();
  });
  historyList.addEventListener('click', event => {
    const button = event.target.closest('button[data-open-id]');
    if (!button) return;
    activateGraph(store.graphs.find(graph => graph.id === button.dataset.openId));
  });
  historyList.addEventListener('change', event => {
    const checkbox = event.target.closest('input[data-compare-id]');
    if (!checkbox) return;
    const id = checkbox.dataset.compareId;
    if (checkbox.checked) {
      if (store.selectedIds.length >= MAX_COMPARE) {
        checkbox.checked = false;
        compareStatus.textContent = `Compare up to ${MAX_COMPARE} graphs at a time.`;
        compareStatus.className = 'graph-help graph-compare-status error';
        return;
      }
      if (!store.selectedIds.includes(id)) store.selectedIds.push(id);
    } else {
      store.selectedIds = store.selectedIds.filter(selectedId => selectedId !== id);
    }
    persistNow();
    renderComparison();
  });
  function saveDisplayChange() {
    if (!activeGraph) return;
    persistNow();
    renderMain();
    renderHistory();
    renderComparison();
  }
  $('graphColor').addEventListener('change', () => {
    if (!activeGraph) return;
    activeGraph.color = COLOR_KEYS.includes(controls.color.value) ? controls.color.value : 'teal';
    saveDisplayChange();
  });
  $('graphGrid').addEventListener('change', () => { if (activeGraph) { activeGraph.gridlines = controls.grid.checked; saveDisplayChange(); } });
  $('graphTickLabels').addEventListener('change', () => { if (activeGraph) { activeGraph.tickLabels = controls.tickLabels.checked; saveDisplayChange(); } });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { closeGraph(); toggle.focus(); }
  });

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging || dragging.id !== event.pointerId) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    dragging.x = event.clientX;
    dragging.y = event.clientY;
    panByPixels(dx, dy);
  });
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
      if (event.key === 'ArrowLeft') panByPixels(40, 0);
      if (event.key === 'ArrowRight') panByPixels(-40, 0);
      if (event.key === 'ArrowUp') panByPixels(0, 40);
      if (event.key === 'ArrowDown') panByPixels(0, -40);
      if (activeGraph) { persistNow(); renderHistory(); renderComparison(); }
    }
  });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { renderMain(); drawComparisonCanvases(); }).observe(canvas);
  else window.addEventListener('resize', () => { renderMain(); drawComparisonCanvases(); });
  const angleButton = $('angle');
  if (angleButton && typeof MutationObserver === 'function') {
    new MutationObserver(() => { renderMain(); drawComparisonCanvases(); }).observe(angleButton, { childList: true, characterData: true, subtree: true });
  }
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { renderMain(); renderHistory(); renderComparison(); });
  }

  loadState();
  if (!activeGraph) {
    currentExpression = input.value.trim() || 'x^2';
    input.value = currentExpression;
    try { curve = parse(currentExpression).tree; }
    catch (_) { curve = null; }
    populateDefaults();
  }
  syncMode();
  renderHistory();
  renderComparison();
  updateTitle();
  setRangeStatus();
  renderMain();
})();
