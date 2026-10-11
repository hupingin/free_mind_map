/**
 * render.js — SVG 渲染与交互（选择 / 内联编辑 / 平移缩放 / 导出）
 */
(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const { FONT_SIZE, LINE_HEIGHT, PAD_X, PAD_Y, IMG_H, IMG_MAX_W } = Layout.constants;
  const MIN_W = 46;
  const MIN_H = 28;
  const HANDLE = 14;
  const DBG = true; // 调试开关（临时开启：图片渲染诊断，定位后关闭）
  const log = (...a) => { if (DBG && typeof console !== 'undefined') console.log('[FMM]', ...a); };

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
    // 折叠节点的子树不计入边界（其坐标已被 layout 清零）
    (function walk(n) {
      minX = Math.min(minX, n._x);
      minY = Math.min(minY, n._y);
      maxX = Math.max(maxX, n._x + n._w);
      maxY = Math.max(maxY, n._y + n._h);
      if (!n.collapsed) (n.children || []).forEach(walk);
    })(state.map.root);
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

  // 折叠/展开 切换按钮：放在节点向子树延伸的那一侧，点击切换 collapsed
  function makeCollapseToggle(n) {
    const t = state.theme;
    const R = 9;
    const o = n._orient;
    let cx, cy;
    if (o === 'right') { cx = n._w + 8; cy = n._h / 2; }
    else if (o === 'left') { cx = -8; cy = n._h / 2; }
    else if (o === 'bottom') { cx = n._w / 2; cy = n._h + 8; }
    else if (o === 'top') { cx = n._w / 2; cy = -8; }
    else { cx = n._w + 8; cy = n._h / 2; } // 根节点（无方向）默认右侧
    const tg = el('g', { class: 'collapse-toggle' });
    tg.appendChild(el('circle', { cx, cy, r: R, class: 'collapse-toggle-circle', fill: t.bg, stroke: t.line, 'stroke-width': 1.6 }));
    const sign = el('text', { x: cx, y: cy + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 15, 'font-family': t.font, fill: t.line, 'font-weight': 'bold' });
    sign.textContent = n.collapsed ? '+' : '−'; // 折叠态显示 +（可展开），展开态显示 −（可折叠）
    tg.appendChild(sign);
    tg.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    tg.addEventListener('click', (e) => {
      e.stopPropagation();
      log('collapse-toggle click', n.id, '->', n.collapsed ? 'expand' : 'collapse');
      state.callbacks.onToggleCollapse && state.callbacks.onToggleCollapse(n.id);
    });
    return tg;
  }

  function drawNode(g, n) {
    const t = state.theme;
    const isRoot = n === state.map.root;
    const fill = isRoot ? t.rootFill : t.nodeFill;
    const stroke = isRoot ? t.rootStroke : t.nodeStroke;
    const textColor = isRoot ? t.rootText : t.nodeText;

    const grp = el('g', { 'data-id': n.id, transform: `translate(${n._x},${n._y})`, class: 'node' });
    if (t.handdrawn && !isRoot) grp.setAttribute('transform', `translate(${n._x},${n._y}) rotate(${hashRot(n.id)} ${n._w / 2} ${n._h / 2})`);

    const rect = el('rect', {
      x: 0, y: 0, width: n._w, height: n._h, rx: isRoot ? 14 : 9, ry: isRoot ? 14 : 9,
      fill, stroke, 'stroke-width': isRoot ? 2.4 : 1.4,
    });
    grp.appendChild(rect);

    let textTop = PAD_Y;
    if (n.image) {
      const imgW = Math.max(1, Math.min(IMG_MAX_W, n._w - 2 * PAD_X));
      const img = el('image', { x: (n._w - imgW) / 2, y: PAD_Y, width: imgW, height: IMG_H, preserveAspectRatio: 'xMidYMid meet' });
      // SVG <image> 在内联 SVG 中图片源需 xlink:href 才能稳定渲染（单独 href 在 Chromium 内联 SVG 下常不显示）
      img.setAttribute('href', n.image);
      if (img.setAttributeNS) img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', n.image);
      log('drawNode image:', n.id, 'imgW=', imgW, 'hrefPrefix=', String(n.image).slice(0, 48));
      grp.appendChild(img);
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

    // 有子节点的，在延伸侧加 折叠/展开 切换按钮
    if (n.children && n.children.length) grp.appendChild(makeCollapseToggle(n));

    g.appendChild(grp);

    grp.addEventListener('mousedown', (e) => {
      log('node mousedown', n.id, 'target=', e.target.tagName, 'cls=', e.target.getAttribute && e.target.getAttribute('class'));
      e.stopPropagation();
    });
    // 单击即进入内联编辑；双击时第二次点击落在编辑框上，复用同一编辑框、不重复打开
    grp.addEventListener('click', (e) => {
      e.stopPropagation();
      const editing = document.getElementById('inline-editor');
      log('node click', n.id, 'editingSame=', !!(editing && editing.dataset.nodeId === n.id));
      select(n.id);
      if (editing && editing.dataset.nodeId === n.id) return;
      state.callbacks.onEdit && state.callbacks.onEdit(n.id);
    });
    grp.addEventListener('dblclick', (e) => { e.stopPropagation(); });
    grp.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); state.callbacks.onContext && state.callbacks.onContext(n.id, e); });
  }

  /* ---------------- 手动缩放节点 ---------------- */

  // 按当前宽度重新计算换行与最小高度（拖拽过程中实时调用）
  function recomputeBox(n, w, h) {
    const text = n.text || '节点';
    const lines = Layout.wrapText(text, Math.max(20, w - 2 * PAD_X));
    let nh = lines.length * LINE_HEIGHT + 2 * PAD_Y;
    if (n.image) nh += IMG_H + 6;
    n._lines = lines;
    n._w = w;
    n._h = Math.max(h, nh);
  }

  // 仅重绘单个节点组（拖拽预览，不影响其它节点位置）
  function redrawSingleNode(n) {
    const parent = state.viewport && state.viewport.querySelector('.nodes');
    if (!parent) return;
    const oldG = parent.querySelector(`.node[data-id="${n.id}"]`);
    if (!oldG) return;
    const tmp = el('g', {});
    drawNode(tmp, n);
    const fresh = tmp.firstChild;
    if (fresh) parent.replaceChild(fresh, oldG);
    // 拖拽过程中保留选中虚线框与缩放手柄，避免重绘后选中态“消失”
    if (n.id === state.selectedId) {
      fresh.appendChild(makeSelRect(n));
      fresh.appendChild(makeHandle(n));
    }
  }

  function startResize(e, n) {
    e.preventDefault();
    e.stopPropagation();
    // 若内联编辑框正打开（覆盖在节点上，会拦截手柄的 mousedown），先关闭它，保证拖拽不被挡
    const editing = document.getElementById('inline-editor');
    if (editing) { editing.blur(); editing.remove(); }
    const k = state.view.k || 1;
    const startX = e.clientX, startY = e.clientY;
    const startW = n._w, startH = n._h;
    log('startResize ENTER', n.id, 'k=', k, 'startW=', startW, 'startH=', startH, 'editorWasOpen=', !!editing);
    let moved = false;
    let moveCount = 0;
    const onMove = (ev) => {
      moved = true;
      const dw = (ev.clientX - startX) / k;
      const dh = (ev.clientY - startY) / k;
      const w = Math.max(MIN_W, startW + dw);
      const h = Math.max(MIN_H, startH + dh);
      if (moveCount % 4 === 0) log('  resize move', 'dw=', dw.toFixed(1), 'dh=', dh.toFixed(1), 'w=', w.toFixed(1), 'h=', h.toFixed(1));
      moveCount++;
      recomputeBox(n, w, h);
      redrawSingleNode(n);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      log('resize onUp', 'moved=', moved, 'finalW=', n._w.toFixed(1), 'finalH=', n._h.toFixed(1));
      if (!moved) return;
      // 提交为用户自定义尺寸，整树重新布局让连线/父节点归位
      n.width = Math.round(n._w);
      n.height = Math.round(n._h);
      Layout.layout(state.map);
      draw();
      state.callbacks.onResize && state.callbacks.onResize(n.id);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
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
    // 设置深度并绘制节点；折叠节点的子树不绘制（其坐标已被 layout 清零，连线在 drawEdges 也已跳过）
    (function drawNodes(n, d) {
      n._depth = d;
      drawNode(nodesG, n);
      if (!n.collapsed) (n.children || []).forEach((c) => drawNodes(c, d + 1));
    })(state.map.root, 0);
    applySelection();
    applyTransform();
  }

  function applyTransform() {
    const { x, y, k } = state.view;
    state.viewport.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
  }

  /* ---------------- 选中高亮（轻量，不重绘整树，保证双击可触发） ---------------- */

  function makeSelRect(n) {
    return el('rect', {
      x: -3, y: -3, width: n._w + 6, height: n._h + 6,
      rx: (n === state.map.root ? 14 : 9) + 3, ry: (n === state.map.root ? 14 : 9) + 3,
      fill: 'none', stroke: state.theme.selected, 'stroke-width': 2, 'stroke-dasharray': '5 4',
    });
  }

  function makeHandle(n) {
    // 手柄放在节点右下角外侧：露出在节点框之外，避免被内联编辑框（覆盖整个节点）挡住，保证可抓取
    const handle = el('rect', {
      x: n._w - 3, y: n._h - 3, width: HANDLE, height: HANDLE,
      rx: 2, ry: 2,
      class: 'resize-handle', fill: state.theme.selected, stroke: '#ffffff', 'stroke-width': 1.5,
    });
    log('makeHandle', n.id, 'x=', n._w - 3, 'y=', n._h - 3);
    handle.addEventListener('mousedown', (e) => startResize(e, n));
    handle.addEventListener('click', (e) => e.stopPropagation());
    return handle;
  }

  function applySelection() {
    if (!state.viewport) return;
    const groups = state.viewport.querySelectorAll('.node');
    if (!groups || !groups.forEach) return;
    groups.forEach((g) => {
      const id = g.getAttribute('data-id');
      const isSel = id === state.selectedId;
      g.setAttribute('class', isSel ? 'node selected' : 'node');
      // 移除旧的虚线框与缩放手柄
      let dash = null, handle = null;
      g.childNodes.forEach((c) => {
        const tname = (c.tagName || c.tag || '').toLowerCase();
        const sa = c.getAttribute && c.getAttribute('stroke-dasharray');
        const rh = c.getAttribute && c.getAttribute('class') === 'resize-handle';
        if (tname === 'rect' && sa) dash = c;
        if (rh) handle = c;
      });
      if (dash) g.removeChild(dash);
      if (handle) g.removeChild(handle);
      if (isSel) {
        const found = Model.find(state.map, id);
        const n = found && found.node; // 注意：Model.find 返回 {node, parent} 包装对象
        if (n) g.appendChild(makeSelRect(n));
        if (n) {
          const h = g.appendChild(makeHandle(n));
          log('applySelection: handle ATTACHED', id, 'nodeBox=', n._w + 'x' + n._h, 'viewK=', state.view.k);
          // 下一帧测量手柄真实屏幕坐标，确认其可见且位置正确
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              try {
                const r = h.getBoundingClientRect();
                log('  handle screen rect', 'left=', r.left.toFixed(0), 'top=', r.top.toFixed(0), 'w=', r.width.toFixed(0), 'h=', r.height.toFixed(0), 'visible=', r.width > 0 && r.height > 0);
              } catch (e) { log('  handle rect measure error', e.message); }
            });
          }
        }
      }
    });
  }

  /* ---------------- 视图操作 ---------------- */

  function select(id) {
    state.selectedId = id;
    applySelection();
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
    state.callbacks.onView && state.callbacks.onView(state.view.k);
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
    state.callbacks.onView && state.callbacks.onView(state.view.k);
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
      const onNode = !!(e.target.closest && e.target.closest('.node'));
      if (onNode) { log('svg mousedown: on .node, skip pan'); return; }
      log('svg mousedown: PAN start');
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
    if (!state.viewport) return null;
    const g = state.viewport.querySelector(`.node[data-id="${id}"]`);
    if (!g) return null;
    // 优先用节点本体矩形（第一个 rect），排除选中虚线框（第二个 rect）
    const rectEl = g.querySelector('rect');
    const r = (rectEl || g).getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function centerOn(id) {
    const found = Model.find(state.map, id);
    const n = found && found.node; // 注意：Model.find 返回 {node, parent} 包装对象
    if (!n) return;
    const rect = state.svg.getBoundingClientRect();
    state.view.x = rect.width / 2 - (n._x + n._w / 2) * state.view.k;
    state.view.y = rect.height / 2 - (n._y + n._h / 2) * state.view.k;
    applyTransform();
  }

  function rmNode(n) {
    // 兼容真实浏览器（Element.remove）与测试垫片（仅 removeChild）
    if (n && typeof n.remove === 'function') n.remove();
    else if (n && n.parentNode) n.parentNode.removeChild(n);
  }

  function getSVGString() {
    // 克隆当前 svg，去掉选择与视口变换，套用 bounds 作为 viewBox
    const clone = state.svg.cloneNode(true);
    const vp = clone.querySelector('.viewport');
    if (vp) vp.removeAttribute('transform');
    // 去除选中虚线
    clone.querySelectorAll('.selected').forEach((g) => {
      const dashes = g.querySelectorAll('rect[stroke-dasharray]');
      dashes.forEach((d) => rmNode(d));
    });
    // 去除缩放手柄（不导出）
    clone.querySelectorAll('.resize-handle').forEach((h) => rmNode(h));
    // 去除折叠/展开切换按钮（不导出）
    clone.querySelectorAll('.collapse-toggle').forEach((h) => rmNode(h));
    const b = computeBounds();
    clone.setAttribute('xmlns', SVGNS);
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
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
    resetView() { state.view = { x: 40, y: 40, k: 1 }; applyTransform(); state.callbacks.onView && state.callbacks.onView(state.view.k); },
  };
})();
