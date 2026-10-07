/**
 * render.js — SVG 渲染与交互（选择 / 内联编辑 / 平移缩放 / 导出）
 */
(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const { FONT_SIZE, LINE_HEIGHT, PAD_X, PAD_Y, IMG_H, IMG_MAX_W } = Layout.constants;

  const state = {
    map: null,
    theme: null,
    selectedId: null,
    structure: 'mindmap',
    view: { x: 40, y: 40, k: 1 },
    callbacks: {},
    svg: null,
    viewport: null,
    bgRect: null,
  };

  function el(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function hashRot(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
    return ((h % 7) - 3) * 0.4;
  }

  function computeBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    Model.traverse(state.map.root, (n) => {
      minX = Math.min(minX, n._x);
      minY = Math.min(minY, n._y);
      maxX = Math.max(maxX, n._x + n._w);
      maxY = Math.max(maxY, n._y + n._h);
    });
    const pad = 60;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad,
             width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
  }

  function depthColor(depth) {
    const pal = Themes.rainbowPalette;
    return pal[(depth - 1) % pal.length];
  }

  /* ---------------- 边 ---------------- */

  function connPoints(parent, child) {
    const o = child._orient;
    if (o === 'right') return { p: { x: parent._x + parent._w, y: parent._y + parent._h / 2 }, c: { x: child._x, y: child._y + child._h / 2 } };
    if (o === 'left') return { p: { x: parent._x, y: parent._y + parent._h / 2 }, c: { x: child._x + child._w, y: child._y + child._h / 2 } };
    if (o === 'bottom') return { p: { x: parent._x + parent._w / 2, y: parent._y + parent._h }, c: { x: child._x + child._w / 2, y: child._y } };
    return { p: { x: parent._x + parent._w / 2, y: parent._y }, c: { x: child._x + child._w / 2, y: child._y + child._h } };
  }

  function edgePath(p, c, o) {
    if (o === 'right') { const dx = (c.x - p.x) / 2; return `M ${p.x} ${p.y} C ${p.x + dx} ${p.y}, ${c.x - dx} ${c.y}, ${c.x} ${c.y}`; }
    if (o === 'left') { const dx = (p.x - c.x) / 2; return `M ${p.x} ${p.y} C ${p.x - dx} ${p.y}, ${c.x + dx} ${c.y}, ${c.x} ${c.y}`; }
    if (o === 'bottom') { const dy = (c.y - p.y) / 2; return `M ${p.x} ${p.y} C ${p.x} ${p.y + dy}, ${c.x} ${c.y - dy}, ${c.x} ${c.y}`; }
    const dy = (p.y - c.y) / 2; return `M ${p.x} ${p.y} C ${p.x} ${p.y - dy}, ${c.x} ${c.y + dy}, ${c.x} ${c.y}`;
  }

  function drawEdges(g) {
    const t = state.theme;
    const struct = state.structure;
    if (struct === 'fishbone') return drawFishboneEdges(g, t);
    if (struct === 'timeline') return drawTimelineEdges(g, t);

    (function walk(n) {
      if (n.collapsed) return;
      (n.children || []).forEach((c) => {
        const { p, c: cc } = connPoints(n, c);
        const color = t.rainbow ? depthColor(c._depth) : t.line;
        const path = el('path', {
          d: edgePath(p, cc, c._orient),
          fill: 'none', stroke: color, 'stroke-width': t.lineWidth,
          'stroke-linecap': 'round',
        });
        g.appendChild(path);
        walk(c);
      });
    })(state.map.root);
  }

  function drawFishboneEdges(g, t) {
    const root = state.map.root;
    const causes = root.children || [];
    if (causes.length) {
      const firstX = causes[0]._fish.spineX;
      const lastX = causes[causes.length - 1]._fish.spineX;
      g.appendChild(el('line', { x1: firstX - 60, y1: 0, x2: root._x, y2: 0, stroke: t.line, 'stroke-width': t.lineWidth + 1 }));
      causes.forEach((c) => {
        g.appendChild(el('line', { x1: c._fish.spineX, y1: 0, x2: c._x + c._w / 2, y2: c._y + c._h / 2, stroke: t.line, 'stroke-width': t.lineWidth }));
        (c.children || []).forEach((s) => {
          g.appendChild(el('line', { x1: c._fish.fromX, y1: c._fish.fromY, x2: s._x + s._w / 2, y2: s._y + s._h / 2, stroke: t.line, 'stroke-width': t.lineWidth - 0.5 }));
        });
      });
    }
  }

  function drawTimelineEdges(g, t) {
    const root = state.map.root;
    const events = root.children || [];
    if (events.length) {
      const lastX = events[events.length - 1]._tl.axisX;
      g.appendChild(el('line', { x1: root._x + root._w / 2, y1: 220, x2: lastX, y2: 220, stroke: t.line, 'stroke-width': t.lineWidth + 1 }));
      events.forEach((e) => {
        g.appendChild(el('line', { x1: e._tl.axisX, y1: 220, x2: e._x + e._w / 2, y2: e._y + e._h / 2, stroke: t.line, 'stroke-width': t.lineWidth }));
        (e.children || []).forEach((s) => {
          g.appendChild(el('line', { x1: e._tl.axisX, y1: 220, x2: s._x + s._w / 2, y2: s._y + s._h / 2, stroke: t.line, 'stroke-width': t.lineWidth - 0.5 }));
        });
      });
    }
  }

  /* ---------------- 节点 ---------------- */

  function drawNode(g, n) {
    const t = state.theme;
    const isRoot = n === state.map.root;
    const fill = isRoot ? t.rootFill : t.nodeFill;
    const stroke = isRoot ? t.rootStroke : t.nodeStroke;
    const textColor = isRoot ? t.rootText : t.nodeText;

    const grp = el('g', { 'data-id': n.id, transform: `translate(${n._x},${n._y})`, class: 'node' + (n.id === state.selectedId ? ' selected' : '') });
    if (t.handdrawn && !isRoot) grp.setAttribute('transform', `translate(${n._x},${n._y}) rotate(${hashRot(n.id)} ${n._w / 2} ${n._h / 2})`);

    const rect = el('rect', {
      x: 0, y: 0, width: n._w, height: n._h, rx: isRoot ? 14 : 9, ry: isRoot ? 14 : 9,
      fill, stroke, 'stroke-width': isRoot ? 2.4 : 1.4,
    });
    grp.appendChild(rect);

    if (n.id === state.selectedId) {
      grp.appendChild(el('rect', {
        x: -3, y: -3, width: n._w + 6, height: n._h + 6, rx: (isRoot ? 14 : 9) + 3, ry: (isRoot ? 14 : 9) + 3,
        fill: 'none', stroke: t.selected, 'stroke-width': 2, 'stroke-dasharray': '5 4',
      }));
    }

    let textTop = PAD_Y;
    if (n.image) {
      const imgW = Math.min(IMG_MAX_W, n._w - 2 * PAD_X);
      grp.appendChild(el('image', { x: (n._w - imgW) / 2, y: PAD_Y, width: imgW, height: IMG_H, href: n.image, preserveAspectRatio: 'xMidYMid meet' }));
      textTop = PAD_Y + IMG_H + 6;
    }

    const iconOffset = n.icon ? 22 : 0;
    const firstBaseline = textTop + LINE_HEIGHT * 0.72;
    if (n.icon) {
      const it = el('text', { x: PAD_X, y: firstBaseline, 'font-size': 16, 'font-family': t.font });
      it.textContent = n.icon;
      grp.appendChild(it);
    }
    const lines = n._lines || [n.text || ''];
    lines.forEach((line, i) => {
      const ts = el('text', {
        x: PAD_X + iconOffset,
        y: firstBaseline + i * LINE_HEIGHT,
        'font-size': isRoot ? FONT_SIZE + 2 : FONT_SIZE,
        'font-family': t.font,
        fill: textColor,
        'text-anchor': 'start',
      });
      ts.textContent = line;
      grp.appendChild(ts);
    });

    // 优先级圆点
    if (n.priority) {
      const col = n.priority === 'high' ? '#ef4444' : n.priority === 'medium' ? '#f59e0b' : '#10b981';
      grp.appendChild(el('circle', { cx: n._w - 10, cy: 10, r: 5, fill: col }));
    }
    // 备注 / 链接 指示
    let indX = n._w - (n.priority ? 26 : 12);
    if (n.note) { const tx = el('text', { x: indX, y: 15, 'font-size': 11 }); tx.textContent = '📝'; grp.appendChild(tx); indX -= 14; }
    if (n.link) { const tx = el('text', { x: indX, y: 15, 'font-size': 11 }); tx.textContent = '🔗'; grp.appendChild(tx); }

    // 标签 pills（节点下方）
    if (n.labels && n.labels.length) {
      let px = n._w / 2;
      const total = n.labels.reduce((s, l) => s + l.length * 12 + 16, 0);
      px = (n._w - total) / 2;
      n.labels.forEach((l) => {
        const w = l.length * 12 + 16;
        grp.appendChild(el('rect', { x: px, y: n._h + 6, width: w, height: 18, rx: 9, ry: 9, fill: isRoot ? t.rootFill : t.line, opacity: 0.85 }));
        const lt = el('text', { x: px + w / 2, y: n._h + 19, 'font-size': 11, 'text-anchor': 'middle', fill: isRoot ? t.rootText : t.nodeText, 'font-family': t.font });
        lt.textContent = l;
        grp.appendChild(lt);
        px += w + 6;
      });
    }

    g.appendChild(grp);

    grp.addEventListener('mousedown', (e) => e.stopPropagation());
    grp.addEventListener('click', (e) => { e.stopPropagation(); select(n.id); });
    grp.addEventListener('dblclick', (e) => { e.stopPropagation(); state.callbacks.onEdit && state.callbacks.onEdit(n.id); });
    grp.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); state.callbacks.onContext && state.callbacks.onContext(n.id, e); });
  }

  /* ---------------- 主渲染 ---------------- */

  function draw() {
    Model.traverse(state.map.root, (n, d) => { n._depth = d; });
    const vg = state.viewport;
    while (vg.firstChild) vg.removeChild(vg.firstChild);
    const b = computeBounds();
    state.bgRect = el('rect', { x: b.minX, y: b.minY, width: b.width, height: b.height, fill: state.theme.bg });
    vg.appendChild(state.bgRect);
    const edgesG = el('g', { class: 'edges' });
    const nodesG = el('g', { class: 'nodes' });
    vg.appendChild(edgesG);
    vg.appendChild(nodesG);
    drawEdges(edgesG);
    Model.traverse(state.map.root, (n) => drawNode(nodesG, n));
    applyTransform();
  }

  function applyTransform() {
    const { x, y, k } = state.view;
    state.viewport.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
  }

  /* ---------------- 视图操作 ---------------- */

  function select(id) {
    state.selectedId = id;
    draw();
    state.callbacks.onSelect && state.callbacks.onSelect(id);
  }

  function fit() {
    const b = computeBounds();
    const svg = state.svg;
    const rect = svg.getBoundingClientRect();
    const kw = rect.width / b.width;
    const kh = rect.height / b.height;
    const k = Math.min(kw, kh, 1.4);
    state.view.k = k;
    state.view.x = (rect.width - b.width * k) / 2 - b.minX * k;
    state.view.y = (rect.height - b.height * k) / 2 - b.minY * k;
    applyTransform();
  }

  function zoomAt(factor, cx, cy) {
    const svg = state.svg;
    const rect = svg.getBoundingClientRect();
    const ox = (cx - rect.left - state.view.x) / state.view.k;
    const oy = (cy - rect.top - state.view.y) / state.view.k;
    state.view.k = Math.max(0.2, Math.min(3, state.view.k * factor));
    state.view.x = cx - rect.left - ox * state.view.k;
    state.view.y = cy - rect.top - oy * state.view.k;
    applyTransform();
  }

  function init(svgEl, callbacks) {
    state.svg = svgEl;
    state.callbacks = callbacks || {};
    state.viewport = el('g', { class: 'viewport' });
    svgEl.appendChild(state.viewport);

    svgEl.addEventListener('click', () => { state.selectedId = null; draw(); state.callbacks.onSelect && state.callbacks.onSelect(null); });
    svgEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });

    let panning = false, sx = 0, sy = 0;
    svgEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('.node')) return;
      panning = true; sx = e.clientX; sy = e.clientY;
      svgEl.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
      if (!panning) return;
      state.view.x += e.clientX - sx;
      state.view.y += e.clientY - sy;
      sx = e.clientX; sy = e.clientY;
      applyTransform();
    });
    window.addEventListener('mouseup', () => { panning = false; svgEl.style.cursor = 'default'; });
  }

  function clientRectOf(id) {
    const n = Model.find(state.map, id);
    if (!n) return null;
    const rect = state.svg.getBoundingClientRect();
    return {
      x: rect.left + state.view.x + n._x * state.view.k,
      y: rect.top + state.view.y + n._y * state.view.k,
      w: n._w * state.view.k,
      h: n._h * state.view.k,
    };
  }

  function centerOn(id) {
    const n = Model.find(state.map, id);
    if (!n) return;
    const rect = state.svg.getBoundingClientRect();
    state.view.x = rect.width / 2 - (n._x + n._w / 2) * state.view.k;
    state.view.y = rect.height / 2 - (n._y + n._h / 2) * state.view.k;
    applyTransform();
  }

  function getSVGString() {
    // 克隆当前 svg，去掉选择与视口变换，套用 bounds 作为 viewBox
    const clone = state.svg.cloneNode(true);
    const vp = clone.querySelector('.viewport');
    if (vp) vp.removeAttribute('transform');
    // 去除选中虚线
    clone.querySelectorAll('.selected').forEach((g) => {
      const dashes = g.querySelectorAll('rect[stroke-dasharray]');
      dashes.forEach((d) => d.remove());
    });
    const b = computeBounds();
    clone.setAttribute('xmlns', SVGNS);
    clone.setAttribute('viewBox', `${b.minX} ${b.minY} ${b.width} ${b.height}`);
    clone.setAttribute('width', b.width);
    clone.setAttribute('height', b.height);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }

  function setMap(map) { state.map = map; }
  function setTheme(theme) { state.theme = theme; }
  function setStructure(s) { state.structure = s; }
  function getSelected() { return state.selectedId; }
  function getState() { return state; }

  window.Render = {
    init, draw, select, fit, setMap, setTheme, setStructure, getSelected, getState,
    clientRectOf, getSVGString, zoomAt, centerOn,
    resetView() { state.view = { x: 40, y: 40, k: 1 }; applyTransform(); },
  };
})();
