/**
 * model.js — 数据模型与纯文本文件格式
 *
 * 文件格式（.mdm）：UTF-8 文本，内容为 JSON。
 * 节点中的图片在「内存」里以 data URI 存储；保存时由主进程外部化到同目录的 .swdt 文件夹，
 * 节点仅保留文件名引用。详情见 main.js 的 externalizeImages / internalizeImages。
 */

(function () {
  let _seq = 0;
  function uid() {
    _seq++;
    return 'n' + Date.now().toString(36) + '_' + _seq.toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }

  function createNode(text) {
    return {
      id: uid(),
      text: text || '新节点',
      note: '',
      link: '',
      labels: [],
      icon: '',
      priority: '', // high | medium | low
      assignee: '',
      due: '',
      image: '', // 内存中为 data URI；磁盘上为 .swdt 下的文件名
      imageName: '',
      collapsed: false,
      children: [],
    };
  }

  function createMap(title) {
    const now = new Date().toISOString();
    return {
      format: 'free-mind-map',
      version: 1,
      meta: {
        title: title || '未命名思维导图',
        theme: 'classic',
        structure: 'mindmap', // mindmap | logical | tree | org | fishbone | timeline
        direction: 'right', // logical 结构可用
        created: now,
        updated: now,
      },
      root: createNode(title || '中心主题'),
    };
  }

  function serialize(map) {
    map.meta.updated = new Date().toISOString();
    return JSON.stringify(map, null, 2);
  }

  function deserialize(json) {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;
    if (!obj.root) throw new Error('缺少 root 节点');
    obj.meta = obj.meta || {};
    obj.meta.theme = obj.meta.theme || 'classic';
    obj.meta.structure = obj.meta.structure || 'mindmap';
    obj.meta.direction = obj.meta.direction || 'right';
    return obj;
  }

  /* ----------------------- 树操作 ----------------------- */

  function find(map, id) {
    let found = null;
    (function walk(n, parent) {
      if (found) return;
      if (n.id === id) { found = { node: n, parent }; return; }
      (n.children || []).forEach((c) => walk(c, n));
    })(map.root, null);
    return found;
  }

  function traverse(node, fn, depth) {
    fn(node, depth || 0);
    (node.children || []).forEach((c) => traverse(c, fn, (depth || 0) + 1));
  }

  function addChild(map, parentId, text) {
    const r = find(map, parentId);
    if (!r) return null;
    const node = createNode(text);
    r.node.collapsed = false;
    r.node.children.push(node);
    return node;
  }

  function addSibling(map, nodeId, text) {
    const r = find(map, nodeId);
    if (!r) return null;
    if (!r.parent) return addChild(map, map.root.id, text);
    const node = createNode(text);
    const idx = r.parent.children.indexOf(r.node);
    r.parent.children.splice(idx + 1, 0, node);
    return node;
  }

  function deleteNode(map, nodeId) {
    const r = find(map, nodeId);
    if (!r || !r.parent) return false; // 不能删除根
    const idx = r.parent.children.indexOf(r.node);
    r.parent.children.splice(idx, 1);
    return true;
  }

  function moveNode(map, nodeId, newParentId, index) {
    const r = find(map, nodeId);
    const p = find(map, newParentId);
    if (!r || !p || r.node === p.node) return false;
    // 防止把节点移动到自己的后代里
    let invalid = false;
    traverse(p.node, (n) => { if (n.id === nodeId) invalid = true; });
    if (invalid) return false;
    const oldParent = r.parent;
    const oldIdx = oldParent.children.indexOf(r.node);
    oldParent.children.splice(oldIdx, 1);
    const arr = p.node.children;
    if (typeof index === 'number' && index >= 0 && index <= arr.length) arr.splice(index, 0, r.node);
    else arr.push(r.node);
    return true;
  }

  window.Model = {
    uid, createNode, createMap, serialize, deserialize,
    find, traverse, addChild, addSibling, deleteNode, moveNode,
  };
})();
