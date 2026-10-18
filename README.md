# Free Mind Map 🧠

> 一个开源、免费、跨平台的思维导图软件。基于 **Electron** 构建，文件以**纯文本**存储，图片资源外置于 `<文件名>.swdt` 文件夹。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/hupingin/free_mind_map)

---

## ✨ 功能特性

### 一、核心创作与可视化
- ✅ **多种结构**：思维导图（平衡左右）、逻辑图（左/右）、树形图、组织结构图
- 🧪 **鱼骨图 / 时间轴**：实验性布局，已可用
- ✅ 结构可在同一张图内统一切换
- ✅ **节点内容**：文本、图片（存于 `<文件名>.swdt`）、链接、备注、标签、图标（emoji）、优先级、负责人、截止日期
- ✅ **主题**：一键换肤（经典蓝 / 暗夜 / 清新绿 / 日落橙）、**彩虹分支**、**手绘风格**

### 二、组织与效率工具
- ✅ **大纲 ↔ 导图互转**：大纲模式编辑，一键同步回导图
- ✅ **搜索与过滤**：全局搜索（文本 / 备注 / 标签 / 负责人），点击定位并居中
- ✅ **演示模式**：以一级分支自动生成幻灯片，方向键翻页

### 三、导出与分享
- ✅ **PNG / SVG / Markdown / PDF** 导出
- 📌 安全分享（密码保护 / 限时加密 / 只读链接）：规划中

### 🚧 规划中（Roadmap）
以下功能已在架构层面预留，欢迎参与共建：
- 🤖 **AI 辅助**：一句话 / 文档 / 链接生成导图；内容扩写、总结、批量润色翻译
- 👥 **实时协作**：多人编辑、评论、历史版本回滚
- 📋 **任务管理 + 甘特图**：节点已支持优先级 / 负责人 / 截止日期，进度视图建设中
- ☁️ **多端云同步**：网页 / 桌面 / 移动端

---

## 🚀 快速开始

### 环境要求
- Node.js ≥ 18
- npm

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/hupingin/free_mind_map.git
cd free_mind_map

# 安装依赖（含 Electron）
npm install

# 启动开发版
npm start
```

### 打包分发

```bash
npm run dist   # 使用 electron-builder，输出到 dist/
```

---

## ⌨️ 快捷键

| 操作 | 快捷键 |
| --- | --- |
| 新建 / 打开 / 保存 | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` |
| 添加子节点 / 同级节点 | `Tab` / `Enter` |
| 删除节点 | `Delete` |
| 重命名（内联编辑） | `F2` 或双击节点 |
| 搜索 | `Ctrl+F` |
| 大纲模式 | `Ctrl+Shift+O` |
| 演示模式 | `F5` |
| 缩放 | `Ctrl +/-/0`，或工具栏；画布上滚轮缩放、拖拽平移 |

---

## 📁 文件格式

思维导图保存为扩展名 **`.mdm`** 的 **UTF-8 纯文本 JSON**，例如：

```json
{
  "format": "free-mind-map",
  "version": 1,
  "meta": { "title": "示例", "theme": "classic", "structure": "mindmap" },
  "root": {
    "id": "n1", "text": "中心主题", "children": [
      { "id": "n2", "text": "分支", "labels": ["重点"], "children": [] }
    ]
  }
}
```

- **图片**不会内嵌进文本，而是保存在与 `.mdm` **同目录**的 **`<文件名>.swdt`** 文件夹中，节点仅记录文件名引用。这样既保证文件是纯文本、便于 Git 版本管理，又避免单文件过大。

---

## 🏗 项目结构

```
free_mind_map/
├── main.js              # Electron 主进程：窗口、菜单、受控文件 API、图片外部化
├── preload.js           # 主进程 ↔ 渲染进程的安全桥接（contextIsolation）
├── package.json
├── renderer/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── themes.js    # 主题定义（换肤 / 彩虹 / 手绘）
│       ├── model.js     # 数据模型与 .mdm 文本序列化 / 树操作
│       ├── layout.js    # 多结构自动布局引擎（6 种结构）
│       ├── render.js    # SVG 渲染、选择、平移缩放、导出
│       └── app.js       # UI 控制器：工具栏 / 检查器 / 搜索 / 大纲 / 演示 / 文件
└── <文件名>.swdt/       # 附属文件夹（用户数据，已被 .gitignore 忽略）
```

### 设计要点
- **渲染进程不直接 `require('fs')`**：所有文件读写经 `preload` 暴露的 `window.mm` 调用主进程，保证 `contextIsolation` 安全。
- **保存时图片外部化、打开时图片内联**：内存中图片为 `data:` URI（便于渲染与导出），落盘时由 `main.js` 写入 `<文件名>.swdt` 并替换为文件名引用。

---

## 🤝 贡献

欢迎提 Issue / PR！尤其是以下方向：
- AI 生成接入（本地模型或可选 API）
- 实时协作（CRDT / WebSocket）
- 甘特图 / 任务进度视图
- 更多结构（目录图、矩阵图等）与主题

---

## 📄 许可证

[MIT](LICENSE) © hupingin
