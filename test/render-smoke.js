/**
 * Free Mind Map — 渲染管线冒烟测试
 *
 * 纯 Node 运行（无需 Electron / 显示器）：用最小 SVG DOM 垫片加载真实的
 * model.js / layout.js / themes.js / render.js，验证：
 *   1) 六种结构布局均无 NaN / 缺失坐标
 *   2) draw() 能正常生成 SVG 节点
 *   3) getSVGString() 能导出合法 SVG 字符串
 *   4) 模型序列化 / 反序列化往返一致
 *
 * 运行：npm test
 */
const path = require('path');
const fs = require('fs');

/* ---------- 最小 SVG DOM 垫片 ---------- */
function makeEl(tag) {
  const el = { tag, attrs: {}, children: [], textContent: '', style: {}, _listeners: {}, parentNode: null };
  el.setAttribute = (k, v) => { el.attrs[k] = String(v); };
  el.getAttribute = (k) => (k in el.attrs ? el.attrs[k] : null);
  el.removeAttribute = (k) => { delete el.attrs[k]; };
  el.appendChild = (c) => { c.parentNode = el; el.children.push(c); return c; };
  el.removeChild = (c) => { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; };
  el.insertBefore = (c, ref) => { const i = ref ? el.children.indexOf(ref) : 0; el.children.splice(i < 0 ? 0 : i, 0, c); c.parentNode = el; return c; };
  el.firstChild = el.children.length ? el.children[0] : null;
  Object.defineProperty(el, 'childNodes', { get() { return el.children; } });
  el.addEventListener = (t, fn) => { (el._listeners[t] = el._listeners[t] || []).push(fn); };
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 800 });
  el.matches = (sel) => {
    if (sel.startsWith('.')) return (el.attrs.class || '').split(/\s+/).includes(sel.slice(1));
    const m = sel.match(/^(\w+)\[([\w-]+)\]$/);
    if (m) return el.tag === m[1] && (m[2] in el.attrs);
    return el.tag === sel;
  };
  const walk = (node, fn) => node.children.forEach((c) => { fn(c); walk(c, fn); });
  el.querySelectorAll = (sel) => { const out = []; walk(el, (c) => { if (c.matches(sel)) out.push(c); }); out.forEach = Array.prototype.forEach.bind(out); return out; };
  el.querySelector = (sel) => { let r = null; walk(el, (c) => { if (!r && c.matches(sel)) r = c; }); return r; };
  el.cloneNode = (deep) => {
    const c = makeEl(tag);
    c.attrs = Object.assign({}, el.attrs);
    c.textContent = el.textContent;
    if (deep) el.children.forEach((ch) => c.appendChild(ch.cloneNode(true)));
    return c;
  };
  return el;
}

global.window = global;
global.document = { createElementNS: (ns, tag) => makeEl(tag), getElementById: () => null };
global.window.addEventListener = () => {};
global.XMLSerializer = function () {};
global.XMLSerializer.prototype.serializeToString = function (node) {
  let s = `<${node.tag}`;
  for (const k in node.attrs) s += ` ${k}="${node.attrs[k]}"`;
  s += '>';
  if (node.textContent) s += node.textContent;
  node.children.forEach((c) => { s += new global.XMLSerializer().serializeToString(c); });
  s += `</${node.tag}>`;
  return s;
};

/* ---------- 加载真实模块 ---------- */
require(path.join(__dirname, '..', 'renderer', 'js', 'model.js'));
require(path.join(__dirname, '..', 'renderer', 'js', 'layout.js'));
require(path.join(__dirname, '..', 'renderer', 'js', 'themes.js'));
require(path.join(__dirname, '..', 'renderer', 'js', 'render.js'));

const R = { errors: [] };
function safe(label, fn) { try { return fn(); } catch (e) { R.errors.push(label + ': ' + e.message); return null; } }

let onEditCalls = [];
safe('init', () => window.Render.init(makeEl('svg'), { onEdit: (id) => onEditCalls.push(id) }));

const m = safe('createMap', () => window.Model.createMap('中心主题'));
safe('addChild', () => {
  const a = window.Model.addChild(m, m.root.id, '分支A很长很长很长很长很长很长很长很长很长很长很长');
  window.Model.addChild(m, a.id, 'A1');
  window.Model.addChild(m, a.id, 'A2');
  const b = window.Model.addChild(m, m.root.id, '分支B');
  window.Model.addChild(m, b.id, 'B1');
  window.Model.addChild(m, b.id, 'B2');
  window.Model.addChild(m, b.id, 'B3');
  return true;
});

const structs = ['mindmap', 'logical', 'tree', 'org', 'fishbone', 'timeline'];
const layoutResults = {};
structs.forEach((s) => safe('layout:' + s, () => {
  m.meta.structure = s;
  if (s === 'logical') m.meta.direction = 'right';
  const res = window.Layout.layout(m);
  let bad = 0, nan = 0;
  window.Model.traverse(m.root, (n) => {
    if (typeof n._x !== 'number' || typeof n._y !== 'number') bad++;
    if (Number.isNaN(n._x) || Number.isNaN(n._y)) nan++;
  });
  layoutResults[s] = { bad, nan, ok: bad === 0 && nan === 0 };
}));

let viewportChildren = 0, svgLen = 0, svgValid = false;
safe('render', () => {
  window.Render.setTheme(window.Themes.get('rainbow'));
  window.Render.setMap(m);
  window.Render.setStructure('mindmap');
  m.meta.structure = 'mindmap';
  window.Render.draw();
  viewportChildren = window.Render.getState().viewport.childNodes.length;
  const svgStr = window.Render.getSVGString();
  svgLen = svgStr.length;
  svgValid = svgStr.includes('<svg') && svgStr.includes('class="node"');
});

let serializeOk = false;
safe('serialize', () => {
  const json = window.Model.serialize(m);
  const m2 = window.Model.deserialize(json);
  let c1 = 0, c2 = 0;
  window.Model.traverse(m.root, () => c1++);
  window.Model.traverse(m2.root, () => c2++);
  serializeOk = c1 === c2 && c2 > 0;
});

/* 验证双击修复前提：选中后节点 <g> 元素身份不变（不被整树重绘重建），且挂上 selected 类 */
let selectPersist = false;
safe('select-persist', () => {
  const vp = window.Render.getState().viewport;
  const groups = vp.querySelectorAll('.node');
  if (!groups.length) return;
  const before = groups[0];
  const id = before.getAttribute('data-id');
  window.Render.select(id);
  const after = vp.querySelectorAll('.node')[0];
  selectPersist = (before === after) && (after.getAttribute('class').indexOf('selected') >= 0);
});

/* 验证"单击即编辑"：节点 click 触发 onEdit 回调（app 层据此打开内联编辑框） */
let clickEditTriggered = false;
safe('click-to-edit', () => {
  const vp = window.Render.getState().viewport;
  const groups = vp.querySelectorAll('.node');
  if (!groups.length) return;
  const g = groups[0];
  const listeners = g._listeners.click || [];
  if (!listeners.length) return;
  const before = onEditCalls.length;
  listeners.forEach((fn) => fn({ stopPropagation() {} }));
  clickEditTriggered = onEditCalls.length === before + 1;
});

/* 验证手动缩放：设置节点 width/height 后，布局尊重该尺寸（_w 等于设定值，_h 至少设定值） */
let userWidthOk = false;
safe('user-width', () => {
  const someNode = m.root.children && m.root.children[0];
  if (!someNode) return;
  someNode.width = 300;
  someNode.height = 80;
  window.Layout.layout(m);
  userWidthOk = (someNode._w === 300) && (someNode._h >= 80);
});

const allLayoutsOk = Object.values(layoutResults).every((r) => r.ok);
const ok = R.errors.length === 0 && allLayoutsOk && viewportChildren > 0 && svgValid && serializeOk && selectPersist && clickEditTriggered && userWidthOk;

const summary = {
  ok,
  errors: R.errors,
  layouts: layoutResults,
  render: { viewportChildren, svgLen, svgValid },
  serializeRoundtrip: serializeOk,
  selectPersist,
  clickEditTriggered,
  userWidthOk,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(ok ? 0 : 1);
