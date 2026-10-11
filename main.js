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
const I18n = require('./renderer/js/i18n');

let mainWindow = null;
let currentFile = null; // { filePath, dir }
let allowClose = false; // 渲染进程确认可关闭后置位
let appDirty = false;   // 文档是否有未保存改动

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 860,
    minHeight: 600,
    backgroundColor: '#1e1f29',
    title: '未命名',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 关闭前若有未保存改动，先拦截，交由渲染进程弹出确认框
  mainWindow.on('close', (e) => {
    if (allowClose || !appDirty) return;
    e.preventDefault();
    mainWindow.webContents.send('confirm-close');
  });

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
  inspector: false,
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
      label: I18n.t('theme.' + t.key),
      type: 'radio',
      checked: menuState.theme === t.key,
      click: () => setTheme(t.key),
    }));
  }
  return [{ label: I18n.t('menu.loading'), enabled: false }];
}

// 语言切换：更新主进程语言、重建菜单，并通知渲染进程同步界面
function setLangTo(l) {
  I18n.setLang(l);
  rebuildMenu();
  if (mainWindow) mainWindow.webContents.send('lang:apply', l);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const T = (k) => I18n.t(k);
  const template = [
    {
      label: T('menu.file'),
      submenu: [
        { label: T('file.new'), accelerator: 'CmdOrCtrl+N', click: () => sendAction('new') },
        { label: T('file.open'), accelerator: 'CmdOrCtrl+O', click: () => sendAction('open') },
        { label: T('file.save'), accelerator: 'CmdOrCtrl+S', click: () => sendAction('save') },
        { label: T('file.saveAs'), accelerator: 'CmdOrCtrl+Shift+S', click: () => sendAction('saveAs') },
        { type: 'separator' },
        {
          label: T('file.export'),
          submenu: [
            { label: T('export.png'), click: () => sendAction('export-png') },
            { label: T('export.svg'), click: () => sendAction('export-svg') },
            { label: T('export.markdown'), click: () => sendAction('export-md') },
            { label: T('export.pdf'), click: () => sendAction('export-pdf') },
          ],
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { label: T('file.quit'), role: 'quit' },
      ],
    },
    {
      label: T('menu.edit'),
      submenu: [
        { role: 'undo', label: T('edit.undo') },
        { role: 'redo', label: T('edit.redo') },
        { type: 'separator' },
        { role: 'cut', label: T('edit.cut') },
        { role: 'copy', label: T('edit.copy') },
        { role: 'paste', label: T('edit.paste') },
        { role: 'selectAll', label: T('edit.selectAll') },
      ],
    },
    {
      label: T('menu.node'),
      submenu: [
        // 注意：Tab / Enter / Del 不挂加速器，避免编辑节点文本时与输入框冲突；
        // 对应键盘快捷键由渲染层在非输入态下处理（见 app.js wireKeyboard）
        { label: T('node.addChild'), click: () => sendAction('add-child') },
        { label: T('node.addSibling'), click: () => sendAction('add-sibling') },
        { label: T('node.collapse'), click: () => sendAction('collapse') },
        { type: 'separator' },
        { label: T('node.delete'), click: () => sendAction('delete') },
      ],
    },
    {
      label: T('menu.view'),
      submenu: [
        {
          label: T('view.structure'),
          submenu: STRUCTURES.map((s) => ({
            label: T('structure.' + s.value), type: 'radio', checked: menuState.structure === s.value,
            click: () => setStructure(s.value),
          })),
        },
        {
          label: T('view.direction'),
          submenu: [
            { label: T('direction.right'), type: 'radio', checked: true, click: () => setDirection('right') },
          ],
        },
        { type: 'separator' },
        { label: T('view.zoomIn'), accelerator: 'CmdOrCtrl+=', click: () => sendAction('zoom-in') },
        { label: T('view.zoomOut'), accelerator: 'CmdOrCtrl+-', click: () => sendAction('zoom-out') },
        { label: T('view.zoomReset'), accelerator: 'CmdOrCtrl+0', click: () => sendAction('zoom-reset') },
        { label: T('view.zoomFit'), accelerator: 'CmdOrCtrl+9', click: () => sendAction('zoom-fit') },
        { type: 'separator' },
        { label: T('view.inspector'), type: 'checkbox', checked: menuState.inspector, accelerator: 'CmdOrCtrl+I', click: () => sendAction('toggle-inspector') },
        { type: 'separator' },
        { label: T('view.outline'), accelerator: 'CmdOrCtrl+Shift+O', click: () => sendAction('outline') },
        { label: T('view.search'), accelerator: 'CmdOrCtrl+F', click: () => sendAction('search') },
        { label: T('view.present'), accelerator: 'F5', click: () => sendAction('present') },
        { type: 'separator' },
        { role: 'reload', label: T('view.reload') },
        { role: 'toggleDevTools', label: T('view.devtools') },
      ],
    },
    {
      label: T('menu.theme'),
      submenu: themeSubmenu(),
    },
    {
      label: T('menu.language'),
      submenu: I18n.list().map((l) => ({
        label: l.name, type: 'radio', checked: I18n.getLang() === l.key,
        click: () => setLangTo(l.key),
      })),
    },
    {
      label: T('menu.help'),
      submenu: [
        {
          label: T('help.github'),
          click: () => shell.openExternal('https://github.com/hupingin/free_mind_map'),
        },
        {
          label: T('help.about'),
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: T('about.title'),
              message: T('about.message'),
              detail: T('about.detail'),
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
    title: I18n.t('dlg.openTitle'),
    filters: [{ name: I18n.t('dlg.filterFmm'), extensions: ['mdm', 'json'] }, { name: I18n.t('dlg.filterAll'), extensions: ['*'] }],
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
    return { error: I18n.t('err.parse') + e.message };
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
    title: I18n.t('dlg.saveTitle'),
    defaultPath: defaultName || (I18n.t('doc.untitled') + '.mdm'),
    filters: [{ name: I18n.t('dlg.filterFmm'), extensions: ['mdm'] }],
  });
  if (res.canceled || !res.filePath) return null;
  let filePath = res.filePath;
  if (!path.extname(filePath)) filePath += '.mdm';
  return filePath;
});

ipcMain.handle('image:pick', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: I18n.t('dlg.imageTitle'),
    filters: [{ name: I18n.t('dlg.filterImage'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }],
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
    await new Promise((r) => setTimeout(r, 200)); // 等一帧渲染，避免空白
    const buf = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'A4',
      // 注意：margins 单位是“英寸”（不是像素）。10 会被当成 10 英寸，超过 A4 页宽(8.27in)直接报错。
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
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

ipcMain.handle('export:png', async (event, filePath, svgStr) => {
  try {
    // 解析 viewBox 得到画布尺寸，用隐藏窗口以真实 DOM 渲染后截图（避免 SVG→<img>→canvas 整张空白）
    const vb = /viewBox="([^"]+)"/.exec(svgStr);
    let w = 800, h = 600;
    if (vb) { const p = vb[1].split(/\s+/).map(Number); w = Math.ceil(p[2]) || w; h = Math.ceil(p[3]) || h; }
    const MAX = 8000;
    w = Math.min(w, MAX); h = Math.min(h, MAX);
    const win = new BrowserWindow({ show: false, width: w, height: h, webPreferences: { sandbox: false } });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;overflow:hidden;}svg{display:block;}</style></head><body style="margin:0">${svgStr}</body></html>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise((r) => setTimeout(r, 200)); // 等一帧渲染
    const image = await win.webContents.capturePage();
    if (!image || image.isEmpty()) { win.destroy(); return { error: '截图为空，未能渲染 SVG' }; }
    fs.writeFileSync(filePath, image.toPNG());
    win.destroy();
    return { ok: true };
  } catch (e) {
    return { error: e.message };
  }
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
  if (typeof s.inspector === 'boolean') menuState.inspector = s.inspector;
  rebuildMenu();
});

/* 渲染进程通知主进程更新窗口标题栏（显示正在编辑的文档名） */
ipcMain.on('title:set', (event, name) => {
  if (mainWindow) mainWindow.setTitle(name || '未命名');
});

/* 渲染进程同步文档脏标记（是否有未保存改动） */
ipcMain.on('doc:dirty', (event, v) => { appDirty = !!v; });

/* 渲染进程启动后把已保存的语言推给主进程，使菜单同步（主进程据此重建菜单） */
ipcMain.on('lang:set', (event, l) => { I18n.setLang(l); rebuildMenu(); });

/* 渲染进程确认可以关闭（保存/不保存后） */
ipcMain.on('close:allow', () => { allowClose = true; if (mainWindow) mainWindow.close(); });

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
