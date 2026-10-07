/**
 * layout.js — 多结构自动布局引擎
 *
 * 支持结构：
 *   mindmap  思维导图（中心主题，左右平衡）
 *   logical  逻辑图（向右 / 向左，由 meta.direction 决定）
 *   tree     树形图（自上而下）
 *   org      组织结构图（自上而下，父节点居中）
 *   fishbone 鱼骨图（实验性）
 *   timeline 时间轴（实验性）
 *
 * 布局结果写入每个节点的 _x / _y（左上角）/ _w / _h，以及 _orient（连接方向）。
 */

(function () {
  const FONT_SIZE = 14;
  const LINE_HEIGHT = 20;
  const PAD_X = 14;
  const PAD_Y = 9;
  const MAX_TEXT_WIDTH = 220;
  const MIN_W = 46;
  const MAX_W = 360;
  const H_GAP = 56; // 主轴方向：父子间距
  const V_GAP = 16; // 交叉轴方向：兄弟间距
  const IMG_H = 56;
  const IMG_MAX_W = 160;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function charWidth(ch) {
    // CJK / 全角字符按 1em 计，其余按 ~0.56em
    const code = ch.codePointAt(0);
    if (code > 0x2e7f) return FONT_SIZE; // 粗略覆盖 CJK 与全角
    if (ch === ' ') return FONT_SIZE * 0.4;
    return FONT_SIZE * 0.58;
  }

  function wrapText(text, maxW) {
    const lines = [];
    const tokens = text.split(/(\s+)/); // 保留空格
    let cur = '';
    let curW = 0;
    const pushCur = () => { lines.push(cur); cur = ''; curW = 0; };
    for (const tk of tokens) {
      if (tk === '') continue;
      const tkW = [...tk].reduce((s, c) => s + charWidth(c), 0);
      if (curW + tkW <= maxW || cur === '') {
        // 单词过长则按字符硬拆
        if (cur !== '' && curW + tkW > maxW) pushCur();
        if ([...tk].reduce((s, c) => s + charWidth(c), 0) > maxW && cur === '') {
          // 单个超长 token：逐字符拆行
          let acc = ''; let accW = 0;
          for (const c of tk) {
            const cw = charWidth(c);
            if (accW + cw > maxW && acc !== '') { lines.push(acc); acc = ''; accW = 0; }
            acc += c; accW += cw;
          }
          if (acc !== '') { cur = acc; curW = accW; }
          continue;
        }
        cur += tk; curW += tkW;
      } else {
        pushCur();
        cur = tk; curW = tkW;
      }
    }
    if (cur !== '') lines.push(cur);
    return lines.length ? lines : [''];
  }

  function measureNode(node) {
    const text = node.text || '节点';
    // 用户手动设定了宽度：按该宽度换行，行高自动；高度不足时再撑开
    if (node.width && node.width > 0) {
      const lines = wrapText(text, node.width - 2 * PAD_X);
      const textW = Math.max(1, ...lines.map((l) => [...l].reduce((s, c) => s + charWidth(c), 0)));
      let w = node.width;
      let h = lines.length * LINE_HEIGHT + 2 * PAD_Y;
      if (node.image) {
        w = Math.max(w, Math.min(IMG_MAX_W, textW) + 2 * PAD_X);
        h += IMG_H + 6;
      }
      if (node.height && node.height > 0) h = Math.max(h, node.height);
      node._lines = lines;
      node._textW = textW;
      node._w = w; node._h = h;
      return { w, h, lines };
    }
    const lines = wrapText(text, MAX_TEXT_WIDTH);
    const textW = Math.max(1, ...lines.map((l) => [...l].reduce((s, c) => s + charWidth(c), 0)));
    let w = clamp(textW + 2 * PAD_X, MIN_W, MAX_W);
    let h = lines.length * LINE_HEIGHT + 2 * PAD_Y;
    if (node.image) {
      w = Math.max(w, Math.min(IMG_MAX_W, textW) + 2 * PAD_X);
      h += IMG_H + 6;
    }
    node._lines = lines;
    node._textW = textW;
    node._w = w; node._h = h;
    return { w, h, lines };
  }

  /* -------------------- 通用树布局（水平 / 垂直） -------------------- */

  function measureH(node) {
    measureNode(node);
    const kids = node.collapsed ? [] : (node.children || []);
    if (!kids.length) { node._sw = node._w; node._sh = node._h; return; }
    let childrenHeight = 0;
    kids.forEach((c) => { measureH(c); childrenHeight += c._sh; });
    childrenHeight += V_GAP * (kids.length - 1);
    const childrenWidth = Math.max(...kids.map((c) => c._sw));
    node._sh = Math.max(node._h, childrenHeight);
    node._sw = node._w + H_GAP + childrenWidth;
  }

  function placeH(node, xLeft, yTop, dir) {
    node._x = xLeft;
    node._y = yTop + (node._sh - node._h) / 2;
    const kids = node.collapsed ? [] : (node.children || []);
    if (!kids.length) return;
    let childrenHeight = 0;
    kids.forEach((c) => { childrenHeight += c._sh; });
    childrenHeight += V_GAP * (kids.length - 1);
    let curY = yTop + (node._sh - childrenHeight) / 2;
    const childSubW = Math.max(...kids.map((c) => c._sw));
    const childLeft = dir === 'right' ? xLeft + node._w + H_GAP : xLeft - H_GAP - childSubW;
    kids.forEach((c) => {
      c._orient = dir;
      placeH(c, childLeft, curY, dir);
      curY += c._sh + V_GAP;
    });
  }

  function measureV(node) {
    measureNode(node);
    const kids = node.collapsed ? [] : (node.children || []);
    if (!kids.length) { node._sw = node._w; node._sh = node._h; return; }
    let childrenWidth = 0;
    kids.forEach((c) => { measureV(c); childrenWidth += c._sw; });
    childrenWidth += H_GAP * (kids.length - 1);
    const childrenHeight = Math.max(...kids.map((c) => c._sh));
    node._sw = Math.max(node._w, childrenWidth);
    node._sh = node._h + V_GAP + childrenHeight;
  }

  function placeV(node, xLeft, yTop, dir) {
    node._x = xLeft + (node._sw - node._w) / 2;
    node._y = yTop;
    const kids = node.collapsed ? [] : (node.children || []);
    if (!kids.length) return;
    let childrenWidth = 0;
    kids.forEach((c) => { childrenWidth += c._sw; });
    childrenWidth += H_GAP * (kids.length - 1);
    let curX = xLeft + (node._sw - childrenWidth) / 2;
    const childSubH = Math.max(...kids.map((c) => c._sh));
    const childTop = dir === 'bottom' ? yTop + node._h + V_GAP : yTop - V_GAP - childSubH;
    kids.forEach((c) => {
      c._orient = dir === 'bottom' ? 'bottom' : 'top';
      placeV(c, curX, childTop, dir);
      curX += c._sw + H_GAP;
    });
  }

  function layoutTree(root, dir) {
    if (dir === 'right' || dir === 'left') { measureH(root); placeH(root, 0, 0, dir); }
    else { measureV(root); placeV(root, 0, 0, dir); }
  }

  /* -------------------- 思维导图（平衡左右） -------------------- */

  function layoutMindmap(root) {
    measureNode(root);
    const kids = root.children || [];
    const right = kids.filter((_, i) => i % 2 === 0);
    const left = kids.filter((_, i) => i % 2 === 1);
    right.forEach((c) => measureH(c));
    left.forEach((c) => measureH(c));
    const rightH = right.length ? right.reduce((s, c) => s + c._sh, 0) + V_GAP * (right.length - 1) : 0;
    const leftH = left.length ? left.reduce((s, c) => s + c._sh, 0) + V_GAP * (left.length - 1) : 0;
    const totalH = Math.max(root._h, rightH, leftH);
    root._x = 0; root._y = (totalH - root._h) / 2;
    if (right.length) {
      let curY = (totalH - rightH) / 2;
      right.forEach((c) => { c._orient = 'right'; placeH(c, root._w + H_GAP, curY, 'right'); curY += c._sh + V_GAP; });
    }
    if (left.length) {
      let curY = (totalH - leftH) / 2;
      const childSubW = Math.max(...left.map((c) => c._sw));
      left.forEach((c) => { c._orient = 'left'; placeH(c, -H_GAP - childSubW, curY, 'left'); curY += c._sh + V_GAP; });
    }
  }

  /* -------------------- 鱼骨图（实验性） -------------------- */

  function layoutFishbone(root) {
    measureNode(root);
    const causes = root.children || [];
    const n = causes.length;
    const rootX = 720;
    const startX = 90;
    const spacing = n > 0 ? (rootX - startX - 140) / Math.max(n, 1) : 0;
    const spineY = 0;
    root._x = rootX; root._y = spineY - root._h / 2;
    causes.forEach((c, i) => {
      measureNode(c);
      const cx = startX + spacing * (i + 0.5);
      const above = i % 2 === 0;
      const cy = spineY + (above ? -1 : 1) * 64;
      c._x = cx - c._w / 2; c._y = cy - c._h / 2;
      c._orient = above ? 'top' : 'bottom';
      c._fish = { spineX: cx, spineY, above, kind: 'cause' };
      const subs = c.children || [];
      subs.forEach((s, j) => {
        measureNode(s);
        const t = (j + 1) / (subs.length + 1);
        const sx = cx - 150 * t;
        const sy = cy + (above ? -1 : 1) * 80 * t;
        s._x = sx - s._w / 2; s._y = sy - s._h / 2;
        s._orient = above ? 'top' : 'bottom';
        s._fish = { fromX: cx, fromY: cy, kind: 'sub' };
      });
    });
  }

  /* -------------------- 时间轴（实验性） -------------------- */

  function layoutTimeline(root) {
    measureNode(root);
    const events = root.children || [];
    const axisY = 220;
    root._x = 40; root._y = axisY - root._h / 2;
    const step = 220;
    events.forEach((e, i) => {
      measureNode(e);
      const ex = 200 + i * step;
      e._x = ex - e._w / 2; e._y = axisY - e._h / 2;
      e._orient = 'bottom';
      e._tl = { axisX: ex, axisY, kind: 'event' };
      const subs = e.children || [];
      subs.forEach((s, j) => {
        measureNode(s);
        const above = j % 2 === 0;
        const sy = axisY + (above ? -1 : 1) * (80 + Math.floor(j / 2) * 52);
        s._x = ex - s._w / 2; s._y = sy - s._h / 2;
        s._orient = above ? 'top' : 'bottom';
        s._tl = { axisX: ex, axisY, kind: 'sub' };
      });
    });
  }

  /* -------------------- 入口与边界计算 -------------------- */

  function reset(map) {
    Model.traverse(map.root, (n) => {
      n._x = n._y = n._w = n._h = 0;
      n._orient = null; n._fish = null; n._tl = null;
    });
  }

  function computeBounds(map) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    Model.traverse(map.root, (n) => {
      minX = Math.min(minX, n._x);
      minY = Math.min(minY, n._y);
      maxX = Math.max(maxX, n._x + n._w);
      maxY = Math.max(maxY, n._y + n._h);
    });
    const pad = 60;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad,
             width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
  }

  function layout(map) {
    reset(map);
    const struct = map.meta.structure;
    if (struct === 'mindmap') layoutMindmap(map.root);
    else if (struct === 'logical') layoutTree(map.root, map.meta.direction === 'left' ? 'left' : 'right');
    else if (struct === 'tree' || struct === 'org') layoutTree(map.root, 'bottom');
    else if (struct === 'fishbone') layoutFishbone(map.root);
    else if (struct === 'timeline') layoutTimeline(map.root);
    else layoutMindmap(map.root);
    return { bounds: computeBounds(map), root: map.root };
  }

  window.Layout = { layout, measureNode, wrapText, constants: { FONT_SIZE, LINE_HEIGHT, PAD_X, PAD_Y, H_GAP, V_GAP } };
})();
