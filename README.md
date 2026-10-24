# Free Mind Map 🧠

> 一个开源、免费、跨平台的思维导图软件。基于 **Electron** 构建，文件以 **UTF-8 纯文本 JSON** 存储（`.mdm`），图片资源外置于同名的 `<文件名>.swdt` 文件夹。

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

---

## ✨ 功能特性

### 一、核心创作与可视化

- ✅ **6 种结构**，可在同一张图内随时切换：
  - 思维导图（中心主题，分支统一向右）
  - 逻辑图（向右分支）
  - 树形图 / 组织结构图（自上而下）
  - 鱼骨图 / 时间轴（实验性布局，已可用）
- ✅ **丰富的节点内容**：文本、图标（emoji）、标签、优先级（高/中/低）、负责人、截止日期、链接、备注、图片，并可手动设定节点宽高
- ✅ **6 套主题**：经典蓝 / 暗夜 / 清新绿 / 日落橙 / 彩虹分支 / 手绘风格，一键换肤，演示与属性面板随主题联动
- ✅ **折叠 / 展开**：节点带折叠按钮，可局部收起子树，折叠状态随文件保存

### 二、组织与效率工具

- ✅ **属性面板（Ctrl+I）**：右侧抽屉，集中编辑选中节点的全部属性，内置图片选择器、自定义尺寸与删除
- ✅ **右键菜单**：添加子节点 / 同级、编辑文本、添加图片、折叠/展开、删除
- ✅ **大纲 ↔ 导图互转**：缩进文本编辑大纲，一键「应用」同步回导图；可「复制为 Markdown」
- ✅ **全局搜索（Ctrl+F）**：匹配文本 / 备注 / 标签 / 负责人，点击结果自动定位并居中
- ✅ **演示模式（F5）**：以一级分支自动生成幻灯片，方向键/按钮翻页
- ✅ **节点排序**：选中节点后用 `↑` / `↓` 与相邻兄弟互换位置

### 三、多语言

- ✅ **简体中文 / English / 日本語** 三语界面，通过菜单「语言」切换，选择持久化到公共配置文件

### 四、导出与分享

- ✅ **PNG / SVG / Markdown / PDF** 导出（PNG、PDF 由隐藏窗口真实渲染，保证大图不空白）
- 🚧 安全分享（密码保护 / 限时加密 / 只读链接）：规划中

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
npm run dist          # electron-builder，输出到 dist/
npm run dist:portable # 便携版 exe
npm run dist:nsis     # 安装版
```

### 运行测试

```bash
npm test   # 渲染管线冒烟测试：6 种结构布局 / SVG 导出 / 序列化往返 / 折叠 / 图片渲染
```

---

## ⌨️ 快捷键

| 操作                    | 快捷键                                             |
| --------------------- | ----------------------------------------------- |
| 新建 / 打开 / 保存 / 另存为    | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` |
| 添加子节点 / 同级节点          | `Tab` / `Enter`                                 |
| 删除节点                  | `Delete` / `Backspace`                          |
| 上移 / 下移节点（与兄弟互换）      | `↑` / `↓`                                       |
| 编辑文本                  | `F2` 或单击节点                                      |
| 搜索                    | `Ctrl+F`                                        |
| 大纲模式                  | `Ctrl+Shift+O`                                  |
| 演示模式                  | `F5`                                            |
| 属性面板                  | `Ctrl+I`                                        |
| 放大 / 缩小 / 重置缩放 / 适应窗口 | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` / `Ctrl+9`       |
| 关闭面板 / 退出演示           | `Esc`                                           |
| 画布缩放 / 平移             | 滚轮缩放、空白处拖拽平移                                    |

---

## 📁 文件格式

思维导图保存为扩展名 **`.mdm`** 的 **UTF-8 纯文本 JSON**，例如：

```json
{
  "format": "free-mind-map",
  "version": 1,
  "meta": {
    "title": "示例",
    "theme": "classic",
    "structure": "mindmap",
    "direction": "right",
    "created": "2026-01-01T00:00:00.000Z",
    "updated": "2026-01-01T00:00:00.000Z"
  },
  "root": {
    "id": "n1",
    "text": "中心主题",
    "icon": "🧠",
    "labels": ["重点"],
    "priority": "high",
    "assignee": "张三",
    "due": "2026-02-01",
    "link": "https://example.com",
    "note": "补充说明",
    "collapsed": false,
    "children": [
      { "id": "n2", "text": "分支", "labels": ["重点"], "children": [] }
    ]
  }
}
```

- **图片**不会内嵌进文本，而是保存在与 `.mdm` **同目录**的 **`<文件名>.swdt`** 文件夹中，节点仅记录文件名引用。这样既保证文件是纯文本、便于 Git 版本管理，又避免单文件过大。
- 内存中图片以 `data:` URI 形式存在（便于渲染与导出），落盘时由主进程写入 `.swdt` 并替换为文件名引用，打开时再读回。

---

## 🏗 项目结构

```
free_mind_map/
├── main.js              # Electron 主进程：窗口、菜单、受控文件 API、图片外部化、配置持久化
├── preload.js           # 主进程 ↔ 渲染进程的安全桥接（contextIsolation）
├── package.json
├── renderer/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── i18n.js      # 多语言（zh / en / ja），同时供主进程 require 与渲染进程 window 使用
│       ├── themes.js    # 6 套主题定义（换肤 / 彩虹 / 手绘）
│       ├── model.js     # 数据模型与 .mdm 文本序列化 / 树操作
│       ├── layout.js    # 多结构自动布局引擎（6 种结构）
│       ├── render.js    # SVG 渲染、选择、平移缩放、节点缩放、导出
│       └── app.js       # UI 控制器：工具栏 / 属性面板 / 搜索 / 大纲 / 演示 / 文件 / 菜单桥接
├── test/
│   ├── render-smoke.js  # 渲染管线冒烟测试（npm test）
│   └── swdt-smoke.js    # .swdt 图片外部化测试
├── tools/
│   └── make_icon.py     # 图标生成脚本
└── <文件名>.swdt/       # 附属文件夹（用户数据，已被 .gitignore 忽略）
```

### 设计要点

- **渲染进程不直接 `require('fs')`**：所有文件读写经 `preload` 暴露的 `window.mm` 调用主进程，保证 `contextIsolation` 安全。
- **保存时图片外部化、打开时图片内联**：内存中图片为 `data:` URI（便于渲染与导出），落盘时由 `main.js` 写入 `<文件名>.swdt` 并替换为文件名引用。
- **主题 / 语言持久化**：界面语言与主题写入 `userData/config.json`，下次启动自动恢复，菜单状态与主进程同步。
- **未保存保护**：有改动时窗口标题显示 `*`，关闭前弹出「保存 / 不保存 / 取消」确认框。

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
