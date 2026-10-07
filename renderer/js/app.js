/**
 * app.js — 应用控制器：工具栏、检查器、搜索、大纲、演示、导出、文件操作
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let map = null;
  let currentFilePath = null;
  let selectedId = null;

  /* ----------------------- 初始化 ----------------------- */

  function makeSample() {
    const m = Model.createMap('Free Mind Map 演示');
    m.meta.theme = 'classic';
    m.meta.structure = 'mindmap';
    const r = m.root;
    r.icon = '🧠';
    const a = Model.addChild(m, r.id, '核心创作');
    a.icon = '🎨'; a.labels = ['重点'];
    Model.addChild(m, a.id, '多种结构');
    Model.addChild(m, a.id, '富文本 / 公式');
    const b = Model.addChild(m, r.id, 'AI 辅助');
    b.icon = '🤖'; b.priority = 'high';
    Model.addChild(m, b.id, '一句话生成导图');
    Model.addChild(m, b.id, '内容扩写');
    const c = Model.addChild(m, r.id, '协作与项目');
    c.icon = '🤝';
    Model.addChild(m, c.id, '实时协作');
    Model.addChild(m, c.id, '任务 / 甘特图');
    const d = Model.addChild(m, r.id, '导出分享');
    d.icon = '📤';
    Model.addChild(m, d.id, 'PNG / PDF / SVG');
    Model.addChild(m, d.id, 'Word / Excel / PPT');
    return m;
  }

  function init() {
    map = makeSample();
    // 主题下拉
    const selTheme = $('sel-theme');
    Themes.list().forEach((t) => {
      const o = document.createElement('option');
      o.value = t.key; o.textContent = t.name;
      selTheme.appendChild(o);
    });
    selTheme.value = map.meta.theme;

    Render.init($('canvas'), {
      onSelect: (id) => { selectedId = id; updateInspector(id); },
      onEdit: (id) => startInlineEdit(id),
      onContext: (id, ev) => showContextMenu(id, ev),
    });

    Layout.layout(map);
    Render.setMap(map);
    Render.setTheme(Themes.get(map.meta.theme));
    Render.setStructure(map.meta.structure);
    Render.draw();
    Render.fit();
    $('inspector').classList.remove('hidden');

    wireToolbar();
    wireInspector();
    wireKeyboard();
    wirePanels();
    if (window.mm && window.mm.onAction) window.mm.onAction(handleMenuAction);

    setStatus('就绪 · 示例导图已加载');
  }

  function renderMap() {
    Layout.layout(map);
    Render.setMap(map);
    Render.setTheme(Themes.get(map.meta.theme));
    Render.setStructure(map.meta.structure);
    Render.draw();
    $('canvas').style.background = Themes.get(map.meta.theme).bg;
  }

  function setStatus(t) { $('status-text').textContent = t; }
  function setFileStatus() { $('status-file').textContent = currentFilePath ? '📁 ' + currentFilePath : '（未保存）'; }

  /* ----------------------- 工具栏 ----------------------- */

  function wireToolbar() {
    $('btn-new').onclick = newMap;
    $('btn-open').onclick = openMap;
    $('btn-save').onclick = () => save(false);
    $('btn-saveas').onclick = () => save(true);

    $('sel-structure').onchange = (e) => {
      map.meta.structure = e.target.value;
      $('sel-direction').classList.toggle('hidden', e.target.value !== 'logical');
      renderMap();
    };
    $('sel-direction').onchange = (e) => { map.meta.direction = e.target.value; renderMap(); };
    $('sel-theme').onchange = (e) => { map.meta.theme = e.target.value; renderMap(); };

    $('btn-add-child').onclick = () => addNode('child');
    $('btn-add-sibling').onclick = () => addNode('sibling');
    $('btn-del').onclick = deleteSelected;
    $('btn-collapse').onclick = toggleCollapse;

    $('btn-outline').onclick = openOutline;
    $('btn-search').onclick = openSearch;
    $('btn-present').onclick = openPresent;

    $('btn-exp-png').onclick = exportPNG;
    $('btn-exp-svg').onclick = exportSVG;
    $('btn-exp-md').onclick = exportMarkdown;
    $('btn-exp-pdf').onclick = exportPDF;

    $('btn-zoom-in').onclick = () => Render.zoomAt(1.15, centerX(), centerY());
    $('btn-zoom-out').onclick = () => Render.zoomAt(1 / 1.15, centerX(), centerY());
    $('btn-zoom-fit').onclick = () => Render.fit();
  }

  function centerX() { const r = $('canvas').getBoundingClientRect(); return r.left + r.width / 2; }
  function centerY() { const r = $('canvas').getBoundingClientRect(); return r.top + r.height / 2; }

  /* ----------------------- 节点增删 ----------------------- */

  function addNode(kind) {
    if (!selectedId && kind === 'sibling') { addNode('child'); return; }
    const parentId = kind === 'child' ? (selectedId || map.root.id) : selectedId;
    let node;
    if (kind === 'child') node = Model.addChild(map, parentId, '新节点');
    else node = Model.addSibling(map, selectedId, '新节点');
    if (!node) return;
    renderMap();
    Render.select(node.id);
    startInlineEdit(node.id);
  }

  function deleteSelected() {
    if (!selectedId || selectedId === map.root.id) { setStatus('根节点不可删除'); return; }
    Model.deleteNode(map, selectedId);
    selectedId = null;
    renderMap();
    $('insp-body').classList.add('hidden');
    $('insp-empty').classList.remove('hidden');
  }

  function toggleCollapse() {
    if (!selectedId) return;
    const r = Model.find(map, selectedId);
    if (!r) return;
    r.node.collapsed = !r.node.collapsed;
    renderMap();
    Render.select(selectedId);
  }

  /* ----------------------- 检查器 ----------------------- */

  function wireInspector() {
    const fields = ['text', 'icon', 'labels', 'priority', 'assignee', 'due', 'link', 'note'];
    fields.forEach((f) => {
      const el = $('insp-' + f);
      el.addEventListener('input', () => applyInspector());
      el.addEventListener('change', () => applyInspector());
    });
    $('btn-insp-image').onclick = async () => {
      if (!selectedId) return;
      const data = await window.mm.pickImage();
      if (!data) return;
      const r = Model.find(map, selectedId);
      r.node.image = data;
      renderMap(); Render.select(selectedId);
    };
    $('btn-insp-del-image').onclick = () => {
      const r = Model.find(map, selectedId); if (!r) return;
      r.node.image = ''; renderMap(); Render.select(selectedId);
    };
    $('btn-insp-delete').onclick = deleteSelected;
  }

  function updateInspector(id) {
    const empty = $('insp-empty'); const body = $('insp-body');
    if (!id) { empty.classList.remove('hidden'); body.classList.add('hidden'); return; }
    const r = Model.find(map, id);
    if (!r) { empty.classList.remove('hidden'); body.classList.add('hidden'); return; }
    empty.classList.add('hidden'); body.classList.remove('hidden');
    const n = r.node;
    $('insp-text').value = n.text || '';
    $('insp-icon').value = n.icon || '';
    $('insp-labels').value = (n.labels || []).join(', ');
    $('insp-priority').value = n.priority || '';
    $('insp-assignee').value = n.assignee || '';
    $('insp-due').value = n.due || '';
    $('insp-link').value = n.link || '';
    $('insp-note').value = n.note || '';
  }

  function applyInspector() {
    if (!selectedId) return;
    const r = Model.find(map, selectedId);
    if (!r) return;
    const n = r.node;
    n.text = $('insp-text').value;
    n.icon = $('insp-icon').value;
    n.labels = $('insp-labels').value.split(',').map((s) => s.trim()).filter(Boolean);
    n.priority = $('insp-priority').value;
    n.assignee = $('insp-assignee').value;
    n.due = $('insp-due').value;
    n.link = $('insp-link').value;
    n.note = $('insp-note').value;
    renderMap(); // 仅重绘，不触发 onSelect，避免输入框光标跳位
  }

  /* ----------------------- 内联编辑 ----------------------- */

  function startInlineEdit(id) {
    const r = Model.find(map, id); if (!r) return;
    const rect = Render.clientRectOf(id);
    if (!rect) return;
    const ta = document.createElement('textarea');
    ta.id = 'inline-editor';
    ta.value = r.node.text || '';
    ta.style.left = rect.x + 'px';
    ta.style.top = rect.y + 'px';
    ta.style.width = Math.max(rect.w, 80) + 'px';
    ta.style.height = Math.max(rect.h, 36) + 'px';
    document.body.appendChild(ta);
    ta.focus(); ta.select();

    let done = false;
    const commit = (keep) => {
      if (done) return; done = true;
      if (keep) { r.node.text = ta.value.trim() || '节点'; renderMap(); Render.select(id); }
      ta.remove();
    };
    ta.addEventListener('blur', () => commit(true));
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
      e.stopPropagation();
    });
  }

  /* ----------------------- 右键菜单 ----------------------- */

  function showContextMenu(id, ev) {
    selectedId = id; Render.select(id); updateInspector(id);
    const menu = $('ctxmenu');
    menu.innerHTML = '';
    const items = [
      { label: '➕ 添加子节点', fn: () => addNode('child') },
      { label: '➕ 添加同级', fn: () => addNode('sibling') },
      { label: '✏️ 编辑文本', fn: () => startInlineEdit(id) },
      { label: '🖼 添加图片', fn: () => $('btn-insp-image').click() },
      { label: (Model.find(map, id).node.collapsed ? '⊞ 展开' : '⊟ 折叠'), fn: toggleCollapse },
      { sep: true },
      { label: '🗑 删除', fn: deleteSelected, danger: true },
    ];
    items.forEach((it) => {
      if (it.sep) { const s = document.createElement('div'); s.className = 'sep'; menu.appendChild(s); return; }
      const d = document.createElement('div');
      d.className = 'item' + (it.danger ? ' danger' : '');
      d.textContent = it.label;
      d.onclick = () => { menu.classList.add('hidden'); it.fn(); };
      menu.appendChild(d);
    });
    menu.style.left = ev.clientX + 'px';
    menu.style.top = ev.clientY + 'px';
    menu.classList.remove('hidden');
  }

  /* ----------------------- 键盘 ----------------------- */

  function isTyping() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.id === 'inline-editor' || a.id === 'outline-text' || a.id === 'search-input');
  }

  function wireKeyboard() {
    window.addEventListener('keydown', (e) => {
      // 全局快捷键（即使处于输入态也响应）
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(false); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); openSearch(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); newMap(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); openMap(); return; }
      if (e.key === 'Escape') { closeAllPanels(); return; }
      if (isTyping()) return;
      if (e.key === 'Tab') { e.preventDefault(); addNode('child'); }
      else if (e.key === 'Enter') { e.preventDefault(); addNode('sibling'); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      else if (e.key === 'F2') { e.preventDefault(); if (selectedId) startInlineEdit(selectedId); }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#ctxmenu')) $('ctxmenu').classList.add('hidden');
    });
  }

  /* ----------------------- 搜索 ----------------------- */

  function openSearch() {
    const p = $('search-panel'); p.classList.remove('hidden');
    $('search-input').value = ''; $('search-results').innerHTML = '';
    $('search-input').focus();
  }
  function wirePanels() {
    $('search-input').addEventListener('input', (e) => runSearch(e.target.value));
    $('search-close').onclick = () => $('search-panel').classList.add('hidden');
    $('outline-close').onclick = () => $('outline-panel').classList.add('hidden');
    $('outline-apply').onclick = applyOutline;
    $('outline-md').onclick = copyOutlineAsMd;

    $('present-exit').onclick = () => $('present-overlay').classList.add('hidden');
    $('present-prev').onclick = () => presentNav(-1);
    $('present-next').onclick = () => presentNav(1);
  }
  function runSearch(q) {
    const box = $('search-results'); box.innerHTML = '';
    if (!q) return;
    const lc = q.toLowerCase();
    const hits = [];
    Model.traverse(map.root, (n, d) => {
      const hay = [n.text, n.note, (n.labels || []).join(' '), n.assignee].join(' ').toLowerCase();
      if (hay.includes(lc)) hits.push({ n, d });
    });
    if (!hits.length) { box.innerHTML = '<div class="search-item">无匹配结果</div>'; return; }
    hits.forEach(({ n }) => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = escapeHtml(n.text) + (n.note ? `<span class="path">📝 含备注</span>` : '');
      div.onclick = () => {
        $('search-panel').classList.add('hidden');
        Render.select(n.id);
        Render.centerOn(n.id);
      };
      box.appendChild(div);
    });
  }
  function escapeHtml(s) { return (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  /* ----------------------- 大纲互转 ----------------------- */

  function serializeOutline(node, depth, out) {
    const indent = '  '.repeat(depth);
    out.push(indent + '- ' + (node.text || ''));
    (node.children || []).forEach((c) => serializeOutline(c, depth + 1, out));
  }
  function openOutline() {
    const out = [];
    serializeOutline(map.root, 0, out);
    $('outline-text').value = out.join('\n');
    $('outline-panel').classList.remove('hidden');
  }
  function parseOutline(text) {
    const lines = text.split('\n');
    let root = null; const stack = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const m = /^(\s*)[-*]?\s*(.*)$/.exec(line);
      const indent = m[1].length;
      const level = Math.floor(indent / 2);
      const node = Model.createNode(m[2]);
      if (level === 0 && !root) { root = node; stack[0] = node; stack.length = 1; continue; }
      stack.length = level; // 保留祖先
      const parent = level === 0 ? null : stack[level - 1];
      if (parent) parent.children.push(node);
      else if (!root) { root = node; }
      stack[level] = node; stack.length = level + 1;
    }
    return root || Model.createNode('中心主题');
  }
  function applyOutline() {
    const root = parseOutline($('outline-text').value);
    map.root = root;
    selectedId = null;
    renderMap();
    setStatus('已从大纲同步导图');
  }
  function copyOutlineAsMd() {
    const out = [];
    serializeOutline(map.root, 0, out);
    navigator.clipboard.writeText(out.join('\n')).then(() => setStatus('大纲已复制到剪贴板'));
  }

  /* ----------------------- 演示 ----------------------- */

  let slides = [], slideIdx = 0;
  function openPresent() {
    slides = (map.root.children && map.root.children.length) ? map.root.children : [map.root];
    slideIdx = 0;
    $('present-overlay').classList.remove('hidden');
    renderSlide();
  }
  function renderSlide() {
    const node = slides[slideIdx];
    const html = [`<div class="slide-title">${escapeHtml(node.text || '')}</div>`, '<ul>'];
    (node.children || []).forEach((c1) => {
      html.push(`<li>${escapeHtml(c1.text || '')}</li>`);
      (c1.children || []).forEach((c2) => {
        html.push(`<li class="sub">${escapeHtml(c2.text || '')}</li>`);
        (c2.children || []).forEach((c3) => html.push(`<li class="sub2">${escapeHtml(c3.text || '')}</li>`));
      });
    });
    html.push('</ul>');
    $('present-content').innerHTML = html.join('');
    $('present-indicator').textContent = (slideIdx + 1) + ' / ' + slides.length;
  }
  function presentNav(d) {
    slideIdx = Math.max(0, Math.min(slides.length - 1, slideIdx + d));
    renderSlide();
  }

  /* ----------------------- 导出 ----------------------- */

  function defaultName(ext) {
    const base = (map.meta.title || '思维导图').replace(/[\\/:*?"<>|]/g, '_');
    return base + '.' + ext;
  }

  async function exportPNG() {
    const svgStr = Render.getSVGString();
    const vb = /viewBox="([^"]+)"/.exec(svgStr);
    const [, minX, minY, w, h] = vb[1].split(/\s+/).map(Number);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(w * scale); canvas.height = Math.ceil(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      const dataURL = canvas.toDataURL('image/png');
      window.mm.savePath(defaultName('png')).then((p) => { if (p) window.mm.writeBinary(p, dataURL).then(() => setStatus('已导出 PNG')); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  }
  async function exportSVG() {
    const svgStr = Render.getSVGString();
    const p = await window.mm.savePath(defaultName('svg'));
    if (p) { await window.mm.writeText(p, svgStr); setStatus('已导出 SVG'); }
  }
  async function exportMarkdown() {
    const out = [];
    serializeOutline(map.root, 0, out);
    const p = await window.mm.savePath(defaultName('md'));
    if (p) { await window.mm.writeText(p, '# ' + (map.meta.title || '思维导图') + '\n\n' + out.join('\n') + '\n'); setStatus('已导出 Markdown'); }
  }
  async function exportPDF() {
    const svgStr = Render.getSVGString();
    const p = await window.mm.savePath(defaultName('pdf'));
    if (p) { const r = await window.mm.exportPDF(p, svgStr); if (r && r.error) alert('PDF 导出失败：' + r.error); else setStatus('已导出 PDF'); }
  }

  /* ----------------------- 文件操作 ----------------------- */

  function newMap() {
    if (currentFilePath && !confirm('新建将丢失未保存的更改，继续？')) return;
    map = makeSample();
    currentFilePath = null;
    selectedId = null;
    $('sel-theme').value = map.meta.theme;
    $('sel-structure').value = map.meta.structure;
    $('sel-direction').classList.add('hidden');
    renderMap(); Render.fit();
    setFileStatus(); setStatus('已新建');
  }

  async function openMap() {
    const r = await window.mm.openFile();
    if (!r) return;
    if (r.error) { alert(r.error); return; }
    map = Model.deserialize(r.json);
    currentFilePath = r.filePath;
    selectedId = null;
    $('sel-theme').value = map.meta.theme;
    $('sel-structure').value = map.meta.structure;
    $('sel-direction').classList.toggle('hidden', map.meta.structure !== 'logical');
    $('sel-direction').value = map.meta.direction;
    renderMap(); Render.fit();
    setFileStatus(); setStatus('已打开');
  }

  async function save(asNew) {
    if (!currentFilePath || asNew) {
      const p = await window.mm.savePath(defaultName('mdm'));
      if (!p) return;
      currentFilePath = p;
    }
    const r = await window.mm.saveFile(currentFilePath, Model.serialize(map));
    if (r && r.error) { alert('保存失败：' + r.error); return; }
    setFileStatus(); setStatus('已保存');
  }

  /* ----------------------- 菜单动作（来自原生菜单） ----------------------- */

  function handleMenuAction(action) {
    const map2 = {
      'new': newMap, 'open': openMap, 'save': () => save(false), 'saveAs': () => save(true),
      'export-png': exportPNG, 'export-svg': exportSVG, 'export-md': exportMarkdown, 'export-pdf': exportPDF,
      'outline': openOutline, 'search': openSearch, 'present': openPresent,
      'zoom-in': () => Render.zoomAt(1.15, centerX(), centerY()),
      'zoom-out': () => Render.zoomAt(1 / 1.15, centerX(), centerY()),
      'zoom-reset': () => Render.resetView(),
    };
    if (map2[action]) return map2[action]();
    if (action.startsWith('theme-')) {
      const key = action.slice(6);
      map.meta.theme = key; $('sel-theme').value = key; renderMap();
    }
  }

  function closeAllPanels() {
    ['search-panel', 'outline-panel', 'ctxmenu'].forEach((id) => $(id).classList.add('hidden'));
    $('present-overlay').classList.add('hidden');
  }

  window.addEventListener('DOMContentLoaded', init);
})();
