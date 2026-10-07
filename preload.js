/**
 * preload.js
 * 在渲染进程与主进程之间建立受控桥接（contextIsolation: true）。
 * 渲染进程通过 window.mm 访问有限的文件能力，无法直接 require('fs')。
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mm', {
  /* 打开 .mdm 文件，返回 { filePath, json }（图片已内联为 data URI） */
  openFile: () => ipcRenderer.invoke('map:open'),

  /* 保存到指定路径，返回 { filePath, json }（json 中图片引用已外部化） */
  saveFile: (filePath, json) => ipcRenderer.invoke('map:save', filePath, json),

  /* 弹出"另存为"对话框，返回最终路径或 null */
  savePath: (defaultName) => ipcRenderer.invoke('dialog:savePath', defaultName),

  /* 选择本地图片，返回 data URI 或 null */
  pickImage: () => ipcRenderer.invoke('image:pick'),

  /* 导出 PDF：由 SVG 字符串渲染后打印 */
  exportPDF: (filePath, svgStr) => ipcRenderer.invoke('export:pdf', filePath, svgStr),

  /* 写入文本 / 二进制文件 */
  writeText: (filePath, text) => ipcRenderer.invoke('export:writeText', filePath, text),
  writeBinary: (filePath, dataURL) => ipcRenderer.invoke('export:writeBinary', filePath, dataURL),

  /* 监听来自菜单的动作（new/open/save/...） */
  onAction: (callback) => {
    ipcRenderer.on('action', (event, action) => callback(action));
  },
});
