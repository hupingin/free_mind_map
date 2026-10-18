/**
 * swdt-smoke.js — 验证 <项目名>.swdt 重命名的端到端测试（用 electron 桩模块驱动 main.js）
 * 场景：① 保存外部化到 mydoc.swdt  ② 打开内联读回  ③ 旧版 .swdt 兼容回退
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const T = path.join(ROOT, 'tmp_swdt_test');
fs.rmSync(T, { recursive: true, force: true });
fs.mkdirSync(path.join(T, 'app', 'renderer', 'js'), { recursive: true });
fs.mkdirSync(path.join(T, 'app', 'node_modules', 'electron'), { recursive: true });

// 拷贝被测代码
fs.copyFileSync(path.join(ROOT, 'main.js'), path.join(T, 'app', 'main.js'));
fs.copyFileSync(path.join(ROOT, 'renderer', 'js', 'i18n.js'), path.join(T, 'app', 'renderer', 'js', 'i18n.js'));
fs.writeFileSync(path.join(T, 'app', 'package.json'), JSON.stringify({ name: 'fmm-test', main: 'main.js' }));

// electron 桩：捕获 ipcMain.handle 注册的处理器
let handlers;
fs.writeFileSync(path.join(T, 'app', 'node_modules', 'electron', 'index.js'), `
const handlers = {};
module.exports = {
  app: { whenReady: () => new Promise(() => {}), on() {}, getPath: () => '${T.replace(/\\/g, '/')}/userdata' },
  BrowserWindow: function () { this.webContents = { on() {}, send() {} }; },
  Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
  dialog: { showOpenDialog: async () => global.__openRes, showSaveDialog: async () => ({ canceled: true }), showMessageBox: async () => {} },
  ipcMain: { handle: (n, f) => { handlers[n] = f; }, on() {} },
  shell: { openExternal() {} },
  nativeImage: {},
};
module.exports.handlers = handlers;
`);
fs.writeFileSync(path.join(T, 'app', 'node_modules', 'electron', 'package.json'), JSON.stringify({ name: 'electron', main: 'index.js' }));

process.chdir(path.join(T, 'app'));
global.__openRes = { canceled: true, filePaths: [] };
handlers = require(path.join(T, 'app', 'node_modules', 'electron')).handlers;
require(path.join(T, 'app', 'main.js'));

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let failed = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!cond) failed++;
}

(async () => {
  // ① 保存：图片外部化到 mydoc.swdt
  const docPath = path.join(T, 'docs', 'mydoc.mdm');
  const saveRes = await handlers['map:save'](null, docPath, JSON.stringify({
    meta: {}, root: { id: 'r', text: 'root', image: PNG_1PX, children: [] },
  }));
  check('保存无错误: ' + (saveRes.error || 'ok'), !saveRes.error);
  const swdtDir = path.join(T, 'docs', 'mydoc.swdt');
  const files = fs.existsSync(swdtDir) ? fs.readdirSync(swdtDir) : [];
  check('存在 mydoc.swdt 目录', fs.existsSync(swdtDir));
  check('图片已写入 mydoc.swdt (' + files.join(',') + ')', files.length === 1 && files[0].endsWith('.png'));
  check('不产生旧版 .swdt 目录', !fs.existsSync(path.join(T, 'docs', '.swdt')));
  const saved = JSON.parse(fs.readFileSync(docPath, 'utf-8'));
  check('节点只保留文件名引用', saved.root.image === files[0]);

  // ② 打开：从 mydoc.swdt 内联回 data URI
  global.__openRes = { canceled: false, filePaths: [docPath] };
  const openRes = await handlers['map:open'](null);
  check('打开无错误: ' + (openRes.error || 'ok'), !openRes.error);
  check('图片读回为 data URI', openRes.json && JSON.parse(openRes.json).root.image.startsWith('data:image/png'));

  // ③ 旧版兼容：只有 .swdt 时能读
  const legacyDir = path.join(T, 'legacy');
  fs.mkdirSync(path.join(legacyDir, '.swdt'), { recursive: true });
  fs.writeFileSync(path.join(legacyDir, '.swdt', 'old.png'), Buffer.from(PNG_1PX.split(',')[1], 'base64'));
  const legacyDoc = path.join(legacyDir, 'olddoc.mdm');
  fs.writeFileSync(legacyDoc, JSON.stringify({ meta: {}, root: { id: 'r', text: 'x', image: 'old.png', children: [] } }));
  global.__openRes = { canceled: false, filePaths: [legacyDoc] };
  const legacyRes = await handlers['map:open'](null);
  check('旧版 .swdt 兼容读取', legacyRes.json && JSON.parse(legacyRes.json).root.image.startsWith('data:image/png'));

  console.log(failed ? ('RESULT: ' + failed + ' FAILED') : 'RESULT: ALL PASS');
  process.exit(failed ? 1 : 0);
})();
