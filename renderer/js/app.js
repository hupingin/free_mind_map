/**
 * app.js — 应用控制器：工具栏、检查器、搜索、大纲、演示、导出、文件操作
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let map = null;
  let currentFilePath = null;
  let selectedId = null;
  let dirty = false; // 文档是否有未保存改动
  let inspectorOpen = false; // 右侧属性面板是否打开
  let preferredTheme = 'classic'; // 主进程下发的公共配置：默认主题（覆盖新建文档主题）
  let pendingConfig = null; // 配置到达早于 init 完成时的暂存

  /* ----------------------- 初始化 ----------------------- */

  function makeSample() {
    const m = Model.createMap(I18n.t('sample.title'));
    m.meta.theme = preferredTheme;
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

    Render.init($('canvas'), {
      onSelect: (id) => { selectedId = id; updateInspector(id); },
      onEdit: (id) => startInlineEdit(id),
      onContext: (id, ev) => showContextMenu(id, ev),
      onView: (k) => updateZoom(k),
      onResize: (id) => { if (id === selectedId) updateInspector(id); setStatus('status.resized'); },
      onToggleCollapse: (id) => toggleCollapseById(id),
    });

    Layout.layout(map);
    Render.setMap(map);
    Render.setTheme(Themes.get(map.meta.theme));
    Render.setStructure(map.meta.structure);
    Render.draw();
    Render.fit();
    applyInspectorTheme(); // 首开即让属性面板套用主题（init 走 Render.draw 不经 renderMap）
    applyPresentTheme();   // 首开即让演示画面套用主题
    updateZoom();

    // 若公共配置在 init 之前已到达（极少见），此处补应用；否则由 onConfigInit 异步应用
    if (pendingConfig) { applyConfig(pendingConfig); pendingConfig = null; }

    wireInspector();
    wireKeyboard();
    wirePanels();
    wireCloseConfirm();
    if (window.mm && window.mm.onAction) window.mm.onAction(handleMenuAction);
    setInspector(false); // 属性面板默认关闭
    syncMenu(); // 把初始结构与主题同步给系统菜单（用于勾选）

    applyI18n(); // 首次应用界面文案（含已恢复的语言）
    setStatus('status.ready');
    setWindowTitle();

    // 主进程（菜单切语言）下发的语言切换：刷新界面文案（语言已持久化到公共配置文件）
    if (window.mm && window.mm.onLangApply) {
      window.mm.onLangApply((lang) => {
        I18n.setLang(lang);
        applyI18n();
      });
    }

    // 主进程下发的公共配置（启动读取 config.json 得到）：应用语言与默认主题
    if (window.mm && window.mm.onConfigInit) {
      window.mm.onConfigInit((cfg) => {
        if (!cfg) return;
        if (map) applyConfig(cfg);
        else pendingConfig = cfg;
      });
    }
  }

  /* 应用公共配置：语言立即切换；主题作为偏好写入并套用到当前文档 */
  function applyConfig(cfg) {
    if (cfg.lang) { I18n.setLang(cfg.lang); applyI18n(); }
    if (cfg.theme) {
      preferredTheme = cfg.theme;
      map.meta.theme = cfg.theme;
      Render.setTheme(Themes.get(cfg.theme));
      renderMap();
      syncMenu();
    }
  }

  /* 把当前状态同步给系统菜单（结构/方向/主题/主题列表） */
  function syncMenu() {
    if (window.mm && window.mm.syncMenu) {
      window.mm.syncMenu({
        structure: map.meta.structure,
        direction: map.meta.direction,
        theme: map.meta.theme,
        themes: Themes.list(),
        inspector: inspectorOpen,
      });
    }
  }

  /* 打开 / 关闭右侧属性面板，并同步菜单勾选状态 */
  function setInspector(open) {
    inspectorOpen = !!open;
    const el = $('inspector');
    if (el) el.classList.toggle('hidden', !inspectorOpen);
    // 浮动开关：箭头指向面板所在方向；面板显示时停靠在面板左缘，隐藏时停靠画面最右
    const btn = $('btn-inspector-toggle');
    if (btn) {
      btn.classList.toggle('at-panel', inspectorOpen);
      btn.textContent = inspectorOpen ? '›' : '‹';
      btn.title = inspectorOpen ? I18n.t('insp.toggleClose') : I18n.t('insp.toggleOpen');
    }
    if (inspectorOpen && selectedId) updateInspector(selectedId); // 打开时刷新当前选中节点
    syncMenu();
  }
  function toggleInspector() { setInspector(!inspectorOpen); }

  function renderMap() {
    Layout.layout(map);
    Render.setMap(map);
    Render.setTheme(Themes.get(map.meta.theme));
    Render.setStructure(map.meta.structure);
    Render.draw();
    $('canvas').style.background = Themes.get(map.meta.theme).bg;
    applyInspectorTheme(); // 属性面板随主题联动
    applyPresentTheme();   // 演示画面随主题联动
  }

  let lastStatusKey = 'status.ready';
  function setStatus(key) { lastStatusKey = key; $('status-text').textContent = I18n.t(key); }
  function setFileStatus() { $('status-file').textContent = currentFilePath ? '📁 ' + currentFilePath : I18n.t('status.unsaved'); }

  /* 把界面上所有 data-i18n / data-i18n-ph 元素刷新为当前语言文案 */
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = I18n.t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', I18n.t(el.getAttribute('data-i18n-ph'))); });
    setStatus('status.ready' === lastStatusKey ? 'status.ready' : lastStatusKey); // 还原当前状态文案
  }

  /* 正在编辑的文档名：已保存取文件名（去扩展名），未保存显示"未命名" */
  function docName() {
    if (currentFilePath) {
      const base = currentFilePath.split(/[\\/]/).pop();
      return base.replace(/\.[^.]+$/, '');
    }
    return I18n.t('doc.untitled');
  }
  function setWindowTitle() {
    const name = docName() + (dirty ? ' *' : '');
    if (window.mm && window.mm.setTitle) window.mm.setTitle(name);
  }

  /* 标记文档为「有未保存改动」：标题加星号并通知主进程 */
  function markDirty() {
    if (dirty) return;
    dirty = true;
    setWindowTitle();
    if (window.mm && window.mm.setDirty) window.mm.setDirty(true);
  }
  function markClean() {
    if (!dirty) return;
    dirty = false;
    setWindowTitle();
    if (window.mm && window.mm.setDirty) window.mm.setDirty(false);
  }

  /* ----------------------- 缩放指示（状态栏） ----------------------- */

  function updateZoom(k) {
    const z = $('status-zoom');
    if (!z) return;
    const ratio = (k != null ? k : (Render.getState().view.k || 1));
    z.textContent = I18n.t('status.zoom') + ' ' + Math.round(ratio * 100) + '%';
  }

  function centerX() { const r = $('canvas').getBoundingClientRect(); return r.left + r.width / 2; }
  function centerY() { const r = $('canvas').getBoundingClientRect(); return r.top + r.height / 2; }

  /* ----------------------- 节点增删 ----------------------- */

  function addNode(kind) {
    if (!selectedId && kind === 'sibling') { addNode('child'); return; }
    const parentId = kind === 'child' ? (selectedId || map.root.id) : selectedId;
    let node;
    if (kind === 'child') node = Model.addChild(map, parentId, I18n.t('node.newNode'));
    else node = Model.addSibling(map, selectedId, I18n.t('node.newNode'));
    if (!node) return;
    markDirty();
    renderMap();
    Render.select(node.id);
    startInlineEdit(node.id);
  }

  function deleteSelected() {
    if (!selectedId || selectedId === map.root.id) { setStatus('status.rootNoDelete'); return; }
    Model.deleteNode(map, selectedId);
    selectedId = null;
    markDirty();
    renderMap();
    $('insp-body').classList.add('hidden');
    $('insp-empty').classList.remove('hidden');
  }

  function toggleCollapseById(id) {
    if (!id) return;
    const r = Model.find(map, id);
    if (!r) return;
    r.node.collapsed = !r.node.collapsed;
    markDirty();
    renderMap();
    Render.select(id);
  }

  function toggleCollapse() { toggleCollapseById(selectedId); }

  /* 与相邻兄弟节点交换位置（dir: -1 上移 / +1 下移） */
  function moveSibling(id, dir) {
    if (!id) return;
    if (Model.swapSibling(map, id, dir)) {
      markDirty();
      renderMap();
      Render.select(id); // 保持选中同一节点
    }
  }

  /* ----------------------- 检查器 ----------------------- */

  function wireInspector() {
    const fields = ['text', 'icon', 'labels', 'priority', 'assignee', 'due', 'link', 'note'];
    fields.forEach((f) => {
      const el = $('insp-' + f);
      el.addEventListener('input', () => applyInspector());
      el.addEventListener('change', () => applyInspector());
    });
    $('insp-width').addEventListener('input', applySize);
    $('insp-height').addEventListener('input', applySize);
    $('btn-insp-image').onclick = async () => {
      if (!selectedId) return;
      const data = await window.mm.pickImage();
      console.log('[FMM] pickImage result:', data ? ('len=' + data.length + ' prefix=' + data.slice(0, 30)) : 'NULL');
      if (!data) return;
      const r = Model.find(map, selectedId);
      r.node.image = data;
      console.log('[FMM] set node.image, node=', r.node.id, 'imgLen=', (r.node.image || '').length);
      renderMap(); Render.select(selectedId);
    };
    $('btn-insp-del-image').onclick = () => {
      const r = Model.find(map, selectedId); if (!r) return;
      r.node.image = ''; renderMap(); Render.select(selectedId);
    };
    $('btn-insp-delete').onclick = deleteSelected;
  }

  function applySize() {
    if (!selectedId) return;
    const r = Model.find(map, selectedId);
    if (!r) return;
    markDirty();
    const w = parseInt($('insp-width').value, 10);
    const h = parseInt($('insp-height').value, 10);
    r.node.width = (w > 0) ? w : 0;
    r.node.height = (h > 0) ? h : 0;
    Layout.layout(map);
    Render.draw();
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
    $('insp-width').value = (n.width > 0) ? n.width : '';
    $('insp-height').value = (n.height > 0) ? n.height : '';
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
    markDirty();
    renderMap(); // 仅重绘，不触发 onSelect，避免输入框光标跳位
  }

  /* ----------------------- 内联编辑 ----------------------- */

  function startInlineEdit(id) {
    const r0 = Model.find(map, id); if (!r0) return;
    const existing = document.getElementById('inline-editor');
    if (existing && existing.dataset.nodeId === id) return; // 已在编辑同一节点，避免重复打开/光标抖动
    const rect = Render.clientRectOf(id);
    if (!rect) return;
    const ta = document.createElement('textarea');
    ta.id = 'inline-editor';
    ta.dataset.nodeId = id;
    ta.value = r0.node.text || '';
    ta.style.left = rect.x + 'px';
    ta.style.top = rect.y + 'px';
    ta.style.width = Math.max(rect.w, 80) + 'px';
    ta.style.height = Math.max(rect.h, 36) + 'px';
    document.body.appendChild(ta);
    setTimeout(() => { ta.focus(); ta.select(); }, 0); // 挂载后再聚焦，避免被同步事件抢走焦点

    let done = false;
    const commit = (keep) => {
      if (done) return; done = true;
      const r = Model.find(map, id);
      if (keep && r) { r.node.text = ta.value.trim() || I18n.t('node.fallback'); markDirty(); renderMap(); Render.select(id); }
      ta.remove();
    };
    // 输入即同步到模型（不重绘，避免节点重建打断编辑）
    ta.addEventListener('input', () => { const r = Model.find(map, id); if (r) r.node.text = ta.value; });
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
      { label: I18n.t('ctx.addChild'), fn: () => addNode('child') },
      { label: I18n.t('ctx.addSibling'), fn: () => addNode('sibling') },
      { label: I18n.t('ctx.edit'), fn: () => startInlineEdit(id) },
      { label: I18n.t('ctx.addImage'), fn: () => $('btn-insp-image').click() },
      { label: (Model.find(map, id).node.collapsed ? I18n.t('ctx.expand') : I18n.t('ctx.collapse')), fn: toggleCollapse },
      { sep: true },
      { label: I18n.t('ctx.delete'), fn: deleteSelected, danger: true },
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
      // 注：Ctrl+N/O/S/F、Ctrl+Shift+O、F5、Ctrl+±=0/9 等全局快捷键由系统菜单接管，避免重复触发
      if (e.key === 'Escape') { closeAllPanels(); return; }
      if (isTyping()) return;
      if (e.key === 'Tab') { e.preventDefault(); addNode('child'); }
      else if (e.key === 'Enter') { e.preventDefault(); addNode('sibling'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (selectedId) moveSibling(selectedId, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (selectedId) moveSibling(selectedId, 1); }
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
    $('btn-inspector-toggle').onclick = toggleInspector;
  }

  /* 关闭前保存确认弹窗 */
  function wireCloseConfirm() {
    if (window.mm && window.mm.onRequestClose) {
      window.mm.onRequestClose(() => $('close-confirm').classList.remove('hidden'));
    }
    $('close-save').onclick = async () => {
      const ok = await save(false); // 保存（未命名会先弹另存为）
      $('close-confirm').classList.add('hidden');
      if (ok && window.mm && window.mm.allowClose) window.mm.allowClose();
    };
    $('close-discard').onclick = () => {
      $('close-confirm').classList.add('hidden');
      if (window.mm && window.mm.allowClose) window.mm.allowClose();
    };
    $('close-cancel').onclick = () => {
      $('close-confirm').classList.add('hidden'); // 取消关闭，留在软件内
    };
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
    if (!hits.length) { box.innerHTML = '<div class="search-item">' + I18n.t('search.noResult') + '</div>'; return; }
    hits.forEach(({ n }) => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = escapeHtml(n.text) + (n.note ? `<span class="path">📝 ${I18n.t('search.note')}</span>` : '');
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
    return root || Model.createNode(I18n.t('node.center'));
  }
  function applyOutline() {
    const root = parseOutline($('outline-text').value);
    map.root = root;
    selectedId = null;
    markDirty();
    renderMap();
    setStatus('status.outlineSynced');
  }
  function copyOutlineAsMd() {
    const out = [];
    serializeOutline(map.root, 0, out);
    navigator.clipboard.writeText(out.join('\n')).then(() => setStatus('status.outlineCopied'));
  }

  /* ----------------------- 演示 ----------------------- */

  // 把当前主题色写入演示模式容器的 CSS 变量，使演示画面随主题联动
  function hexToRgba(hex, a) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return `rgba(59,110,245,${a})`;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
  }
  function applyPresentTheme() {
    const t = Themes.get(map.meta.theme);
    const ov = $('present-overlay');
    if (!ov) return;
    ov.style.setProperty('--ps-bg', t.bg);
    ov.style.setProperty('--ps-text', t.nodeText);
    ov.style.setProperty('--ps-accent', t.rootFill);
    ov.style.setProperty('--ps-accent2', t.line);
    ov.style.setProperty('--ps-accent3', t.selected);
    ov.style.setProperty('--ps-accent-soft', hexToRgba(t.rootFill, 0.1));
  }

  // 把当前主题色写入属性面板的 CSS 变量，使面板内一切随主题联动
  function applyInspectorTheme() {
    const t = Themes.get(map.meta.theme);
    const el = $('inspector');
    if (!el) return;
    el.style.setProperty('--insp-bg', t.bg);
    el.style.setProperty('--insp-text', t.nodeText);
    el.style.setProperty('--insp-muted', t.line);
    el.style.setProperty('--insp-border', t.nodeStroke);
    el.style.setProperty('--insp-accent', t.rootFill);
    el.style.setProperty('--insp-input-bg', t.nodeFill);
    el.style.setProperty('--insp-accent-soft', hexToRgba(t.rootFill, 0.1));
  }

  let slides = [], slideIdx = 0;
  function openPresent() {
    slides = (map.root.children && map.root.children.length) ? map.root.children : [map.root];
    slideIdx = 0;
    $('present-overlay').classList.remove('hidden');
    applyPresentTheme(); // 让演示画面套用当前主题
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
    const base = (map.meta.title || I18n.t('doc.untitled')).replace(/[\\/:*?"<>|]/g, '_');
    return base + '.' + ext;
  }

  async function exportPNG() {
    const svgStr = Render.getSVGString();
    const p = await window.mm.savePath(defaultName('png'));
    if (!p) return;
    const r = await window.mm.exportPNG(p, svgStr);
    if (r && r.error) alert(I18n.t('alert.pngFail') + r.error);
    else setStatus('status.exportedPNG');
  }
  async function exportSVG() {
    const svgStr = Render.getSVGString();
    const p = await window.mm.savePath(defaultName('svg'));
    if (p) { await window.mm.writeText(p, svgStr); setStatus('status.exportedSVG'); }
  }
  async function exportMarkdown() {
    const out = [];
    serializeOutline(map.root, 0, out);
    const p = await window.mm.savePath(defaultName('md'));
    if (p) { await window.mm.writeText(p, '# ' + (map.meta.title || I18n.t('doc.untitled')) + '\n\n' + out.join('\n') + '\n'); setStatus('status.exportedMD'); }
  }
  async function exportPDF() {
    const svgStr = Render.getSVGString();
    const p = await window.mm.savePath(defaultName('pdf'));
    if (p) { const r = await window.mm.exportPDF(p, svgStr); if (r && r.error) alert(I18n.t('alert.pdfFail') + r.error); else setStatus('status.exportedPDF'); }
  }

  /* ----------------------- 文件操作 ----------------------- */

  function newMap() {
    if (currentFilePath && !confirm(I18n.t('confirm.newLose'))) return;
    map = makeSample();
    currentFilePath = null;
    selectedId = null;
    renderMap(); Render.fit();
    syncMenu();
    setFileStatus(); setStatus('status.new');
    markClean(); setWindowTitle();
  }

  async function openMap() {
    const r = await window.mm.openFile();
    if (!r) return;
    if (r.error) { alert(r.error); return; }
    map = Model.deserialize(r.json);
    currentFilePath = r.filePath;
    selectedId = null;
    renderMap(); Render.fit();
    syncMenu();
    setFileStatus(); setStatus('status.open');
    markClean(); setWindowTitle();
  }

  async function save(asNew) {
    if (!currentFilePath || asNew) {
      const p = await window.mm.savePath(defaultName('mdm'));
      if (!p) return false; // 用户取消另存为
      currentFilePath = p;
    }
    const r = await window.mm.saveFile(currentFilePath, Model.serialize(map));
    if (r && r.error) { alert(I18n.t('alert.saveFail') + r.error); return false; }
    setFileStatus(); setStatus('status.saved');
    markClean(); setWindowTitle();
    return true;
  }

  /* ----------------------- 菜单动作（来自原生菜单） ----------------------- */

  function handleMenuAction(action) {
    const map2 = {
      'new': newMap, 'open': openMap, 'save': () => save(false), 'saveAs': () => save(true),
      'export-png': exportPNG, 'export-svg': exportSVG, 'export-md': exportMarkdown, 'export-pdf': exportPDF,
      'toggle-inspector': toggleInspector,
      'outline': openOutline, 'search': openSearch, 'present': openPresent,
      'add-child': () => addNode('child'), 'add-sibling': () => addNode('sibling'),
      'collapse': toggleCollapse, 'delete': deleteSelected,
      'zoom-in': () => { Render.zoomAt(1.15, centerX(), centerY()); updateZoom(); },
      'zoom-out': () => { Render.zoomAt(1 / 1.15, centerX(), centerY()); updateZoom(); },
      'zoom-reset': () => { Render.resetView(); updateZoom(); },
      'zoom-fit': () => { Render.fit(); updateZoom(); },
    };
    if (map2[action]) return map2[action]();
    if (action.startsWith('structure:')) {
      map.meta.structure = action.slice(10);
      markDirty(); renderMap(); syncMenu();
    } else if (action.startsWith('direction:')) {
      map.meta.direction = action.slice(10);
      markDirty(); renderMap(); syncMenu();
    } else if (action.startsWith('theme:')) {
      map.meta.theme = action.slice(6);
      preferredTheme = map.meta.theme;
      Render.setTheme(Themes.get(map.meta.theme));
      markDirty(); renderMap(); syncMenu();
      applyPresentTheme(); // 切换主题时同步刷新演示画面
      if (!$('present-overlay').classList.contains('hidden')) renderSlide();
      if (window.mm && window.mm.setTheme) window.mm.setTheme(map.meta.theme); // 写回公共配置
    }
  }

  function closeAllPanels() {
    ['search-panel', 'outline-panel', 'ctxmenu'].forEach((id) => $(id).classList.add('hidden'));
    $('present-overlay').classList.add('hidden');
  }

  window.addEventListener('DOMContentLoaded', init);
})();
