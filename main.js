/**
 * Free Mind Map - Electron 主进程
 *
 * 职责：
 *  - 创建窗口、构建菜单
 *  - 通过 preload 暴露受控的文件系统 API（保证 contextIsolation 安全）
 *  - 处理 .mdm 文本文件的读写，以及图片资源外部化到 .swdt 文件夹
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let mainWindow = null;
let currentFile = null; // { filePath, dir }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 860,
    minHeight: 600,
    backgroundColor: '#1e1f29',
    title: 'Free Mind Map',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  buildMenu();
}

/* ----------------------------- 菜单 ----------------------------- */

// 当前勾选状态：渲染进程通过 menu:sync 同步；菜单点击时也即时更新
const menuState = {
  structure: 'mindmap',
  direction: 'right',
  theme: 'classic',
  themes: [],
};

function sendAction(action) {
  if (mainWindow) mainWindow.webContents.send('action', action);
}

function setStructure(v) { menuState.structure = v; rebuildMenu(); sendAction('structure:' + v); }
function setDirection(v) { menuState.direction = v; rebuildMenu(); sendAction('direction:' + v); }
function setTheme(v) { menuState.theme = v; rebuildMenu(); sendAction('theme:' + v); }

const STRUCTURES = [
  { value: 'mindmap', label: '思维导图' },
  { value: 'logical', label: '逻辑图' },
  { value: 'tree', label: '树形图' },
  { value: 'org', label: '组织结构图' },
  { value: 'fishbone', label: '鱼骨图' },
  { value: 'timeline', label: '时间轴' },
];

function themeSubmenu() {
  if (menuState.themes && menuState.themes.length) {
    return menuState.themes.map((t) => ({
      label: t.name,
      type: 'radio',
      checked: menuState.theme === t.key,
      click: () => setTheme(t.key),
    }));
  }
  return [{ label: '（加载中…）', enabled: false }];
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => sendAction('new') },
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: () => sendAction('open') },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => sendAction('save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendAction('saveAs') },
        { type: 'separator' },
        {
          label: '导出',
          submenu: [
            { label: 'PNG 图片', click: () => sendAction('export-png') },
            { label: 'SVG 矢量图', click: () => sendAction('export-svg') },
            { label: 'Markdown', click: () => sendAction('export-md') },
            { label: 'PDF 文档', click: () => sendAction('export-pdf') },
          ],
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '节点',
      submenu: [
        // 注意：Tab / Enter / Del 不挂加速器，避免编辑节点文本时与输入框冲突；
        // 对应键盘快捷键由渲染层在非输入态下处理（见 app.js wireKeyboard）
        { label: '添加子节点 (Tab)', click: () => sendAction('add-child') },
        { label: '添加同级 (Enter)', click: () => sendAction('add-sibling') },
        { label: '折叠 / 展开', click: () => sendAction('collapse') },
        { type: 'separator' },
        { label: '删除 (Del)', click: () => sendAction('delete') },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '结构',
          submenu: STRUCTURES.map((s) => ({
            label: s.label, type: 'radio', checked: menuState.structure === s.value,
            click: () => setStructure(s.value),
          })),
        },
        {
          label: '方向',
          submenu: [
            { label: '→ 向右', type: 'radio', checked: menuState.direction === 'right', click: () => setDirection('right') },
            { label: '← 向左', type: 'radio', checked: menuState.direction === 'left', click: () => setDirection('left') },
          ],
        },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => sendAction('zoom-in') },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => sendAction('zoom-out') },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => sendAction('zoom-reset') },
        { label: '适应窗口', accelerator: 'CmdOrCtrl+9', click: () => sendAction('zoom-fit') },
        { type: 'separator' },
        { label: '大纲模式', accelerator: 'CmdOrCtrl+Shift+O', click: () => sendAction('outline') },
        { label: '搜索', accelerator: 'CmdOrCtrl+F', click: () => sendAction('search') },
        { label: '演示模式', accelerator: 'F5', click: () => sendAction('present') },
        { type: 'separator' },
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
    {
      label: '主题',
      submenu: themeSubmenu(),
    },
    {
      label: '帮助',
      submenu: [
        {
          label: 'GitHub 仓库',
          click: () => shell.openExternal('https://github.com/hupingin/free_mind_map'),
        },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 Free Mind Map',
              message: 'Free Mind Map v0.1.0',
              detail: '一个开源、免费、跨平台的思维导图软件。\n基于 Electron 构建，文件以纯文本存储。',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function rebuildMenu() { buildMenu(); }

/* ----------------------- 文件 / 图片 工具 ----------------------- */

function walk(node, fn) {
  fn(node);
  if (node.children) for (const c of node.children) walk(c, fn);
}

function genId() {
  return crypto.randomBytes(6).toString('hex');
}

function mimeFromDataURI(dataURI) {
  const m = /^data:([^;]+);/.exec(dataURI);
  return m ? m[1] : 'image/png';
}

function extFromMime(mime) {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
  };
  return map[mime] || 'png';
}

function dataURIBuffer(dataURI) {
  const comma = dataURI.indexOf(',');
  const meta = dataURI.slice(0, comma);
  const isBase64 = /;base64/.test(meta);
  const body = dataURI.slice(comma + 1);
  return isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf-8');
}

/* 保存：把内存里 data: URI 的图片外部化到 .swdt 文件夹，节点只保留文件名 */
function externalizeImages(root, dir) {
  const swdtDir = path.join(dir, '.swdt');
  fs.mkdirSync(swdtDir, { recursive: true });
  const usedNames = new Set();
  walk(root, (n) => {
    if (n.image && typeof n.image === 'string' && n.image.startsWith('data:')) {
      const mime = mimeFromDataURI(n.image);
      let name = n.imageName || genId();
      if (!path.extname(name)) name += '.' + extFromMime(mime);
      // 避免同名覆盖
      let finalName = name;
      let i = 1;
      while (usedNames.has(finalName)) {
        finalName = name.replace(/(\.[^.]+)?$/, `_${i}${path.extname(name)}`);
        i++;
      }
      usedNames.add(finalName);
      fs.writeFileSync(path.join(swdtDir, finalName), dataURIBuffer(n.image));
      n.image = finalName; // 磁盘上仅存文件名引用
    }
  });
}

/* 打开：把 .swdt 里的图片读成 data URI 放回内存 */
function internalizeImages(root, dir) {
  const swdtDir = path.join(dir, '.swdt');
  walk(root, (n) => {
    if (n.image && typeof n.image === 'string' && !n.image.startsWith('data:') && !/^https?:/.test(n.image)) {
      try {
        const buf = fs.readFileSync(path.join(swdtDir, n.image));
        const ext = path.extname(n.image).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext === 'svg' ? 'svg+xml' : ext}`;
        n.image = `data:${mime};base64,${buf.toString('base64')}`;
      } catch (e) {
        n.image = ''; // 图片缺失则忽略
      }
    }
  });
}

/* ----------------------------- IPC ----------------------------- */

ipcMain.handle('map:open', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '打开思维导图',
    filters: [{ name: 'Free Mind Map', extensions: ['mdm', 'json'] }, { name: '全部', extensions: ['*'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  const filePath = res.filePaths[0];
  const dir = path.dirname(filePath);
  let json = fs.readFileSync(filePath, 'utf-8');
  try {
    const obj = JSON.parse(json);
    internalizeImages(obj.root, dir);
    json = JSON.stringify(obj, null, 2);
  } catch (e) {
    return { error: '文件解析失败：' + e.message };
  }
  currentFile = { filePath, dir };
  return { filePath, json };
});

ipcMain.handle('map:save', async (event, filePath, json) => {
  const dir = path.dirname(filePath);
  let obj;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    return { error: '数据格式错误：' + e.message };
  }
  externalizeImages(obj.root, dir);
  const out = JSON.stringify(obj, null, 2);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, out, 'utf-8');
  currentFile = { filePath, dir };
  return { filePath, json: out };
});

ipcMain.handle('dialog:savePath', async (event, defaultName) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '保存思维导图',
    defaultPath: defaultName || '未命名.mdm',
    filters: [{ name: 'Free Mind Map', extensions: ['mdm'] }],
  });
  if (res.canceled || !res.filePath) return null;
  let filePath = res.filePath;
  if (!path.extname(filePath)) filePath += '.mdm';
  return filePath;
});

ipcMain.handle('image:pick', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  const p = res.filePaths[0];
  const buf = fs.readFileSync(p);
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext === 'svg' ? 'svg+xml' : ext}`;
  return `data:${mime};base64,${buf.toString('base64')}`;
});

ipcMain.handle('export:pdf', async (event, filePath, svgStr) => {
  try {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;}svg{max-width:100%;}</style></head><body>${svgStr}</body></html>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const buf = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'A4',
      margins: { top: 10, bottom: 10, left: 10, right: 10 },
    });
    fs.writeFileSync(filePath, buf);
    win.destroy();
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('export:writeText', async (event, filePath, text) => {
  try { fs.writeFileSync(filePath, text, 'utf-8'); return { ok: true }; }
  catch (e) { return { error: e.message }; }
});

ipcMain.handle('export:writeBinary', async (event, filePath, dataURL) => {
  try {
    const comma = dataURL.indexOf(',');
    const body = dataURL.slice(comma + 1);
    fs.writeFileSync(filePath, Buffer.from(body, 'base64'));
    return { ok: true };
  } catch (e) { return { error: e.message }; }
});

ipcMain.on('menu:sync', (event, s) => {
  if (!s || typeof s !== 'object') return;
  if (s.structure) menuState.structure = s.structure;
  if (s.direction) menuState.direction = s.direction;
  if (s.theme) menuState.theme = s.theme;
  if (Array.isArray(s.themes)) menuState.themes = s.themes;
  rebuildMenu();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
