/**
 * i18n.js — 多语言（简体中文 / English / 日本語）
 *
 * 同时支持两种运行环境：
 *  - 渲染进程（浏览器）：挂到 window.I18n，由 <script> 引入
 *  - 主进程（Node）：module.exports 供 main.js require
 *
 * 使用：I18n.t('key') 取当前语言文案；I18n.setLang('en') 切换；I18n.getLang() 取当前语言。
 */
(function () {
  const dict = {
    zh: {
      // 语言名（菜单显示）
      'lang.zh': '简体中文', 'lang.en': 'English', 'lang.ja': '日本語',

      // 菜单
      'menu.file': '文件', 'menu.edit': '编辑', 'menu.node': '节点',
      'menu.view': '视图', 'menu.theme': '主题', 'menu.help': '帮助', 'menu.language': '语言',
      'file.new': '新建', 'file.open': '打开…', 'file.save': '保存', 'file.saveAs': '另存为…',
      'file.export': '导出', 'export.png': 'PNG 图片', 'export.svg': 'SVG 矢量图',
      'export.markdown': 'Markdown', 'export.pdf': 'PDF 文档', 'file.quit': '退出',
      'edit.undo': '撤销', 'edit.redo': '重做', 'edit.cut': '剪切', 'edit.copy': '复制',
      'edit.paste': '粘贴', 'edit.selectAll': '全选',
      'node.addChild': '添加子节点 (Tab)', 'node.addSibling': '添加同级 (Enter)',
      'node.collapse': '折叠 / 展开', 'node.delete': '删除 (Del)',
      'view.structure': '结构', 'view.direction': '方向', 'view.zoomIn': '放大',
      'view.zoomOut': '缩小', 'view.zoomReset': '重置缩放', 'view.zoomFit': '适应窗口',
      'view.inspector': '属性面板', 'view.outline': '大纲模式', 'view.search': '搜索',
      'view.present': '演示模式', 'view.reload': '重新加载', 'view.devtools': '开发者工具',
      'structure.mindmap': '思维导图', 'structure.logical': '逻辑图', 'structure.tree': '树形图',
      'structure.org': '组织结构图', 'structure.fishbone': '鱼骨图', 'structure.timeline': '时间轴',
      'direction.right': '→ 向右',
      'theme.classic': '经典蓝', 'theme.dark': '暗夜', 'theme.mint': '清新绿',
      'theme.sunset': '日落橙', 'theme.rainbow': '彩虹分支', 'theme.handdrawn': '手绘风格',
      'help.github': 'GitHub 仓库', 'help.about': '关于',
      'menu.loading': '（加载中…）',

      // 关于框
      'about.title': '关于 Free Mind Map',
      'about.message': 'Free Mind Map v0.1.0',
      'about.detail': '一个开源、免费、跨平台的思维导图软件。\n基于 Electron 构建，文件以纯文本存储。',

      // 文件对话框
      'dlg.openTitle': '打开思维导图', 'dlg.saveTitle': '保存思维导图', 'dlg.imageTitle': '选择图片',
      'dlg.filterFmm': 'Free Mind Map', 'dlg.filterAll': '全部', 'dlg.filterImage': '图片',
      'doc.untitled': '未命名',

      // 错误
      'err.parse': '文件解析失败：', 'err.data': '数据格式错误：',

      // 状态栏
      'status.ready': '就绪 · 示例导图已加载', 'status.resized': '已调整节点尺寸',
      'status.new': '已新建', 'status.open': '已打开', 'status.saved': '已保存',
      'status.exportedPNG': '已导出 PNG', 'status.exportedSVG': '已导出 SVG',
      'status.exportedMD': '已导出 Markdown', 'status.exportedPDF': '已导出 PDF',
      'status.outlineSynced': '已从大纲同步导图', 'status.outlineCopied': '大纲已复制到剪贴板',
      'status.rootNoDelete': '根节点不可删除', 'status.unsaved': '（未保存）', 'status.zoom': '缩放',

      // 警告 / 确认
      'alert.pngFail': 'PNG 导出失败：', 'alert.pdfFail': 'PDF 导出失败：', 'alert.saveFail': '保存失败：',
      'confirm.newLose': '新建将丢失未保存的更改，继续？',

      // 节点 / 文档
      'node.newNode': '新节点', 'node.fallback': '节点', 'node.center': '中心主题',
      'sample.title': 'Free Mind Map 演示',

      // 属性面板
      'insp.empty': '选中一个节点以编辑其属性',
      'insp.toggleOpen': '打开属性面板（Ctrl+I）', 'insp.toggleClose': '关闭属性面板（Ctrl+I）',
      'insp.text': '节点文本', 'insp.icon': '图标 (emoji)', 'insp.labels': '标签 (逗号分隔)',
      'insp.priority': '优先级', 'insp.priority.none': '无', 'insp.priority.high': '高',
      'insp.priority.medium': '中', 'insp.priority.low': '低', 'insp.assignee': '负责人',
      'insp.due': '截止日期', 'insp.width': '宽度 (0=自动)', 'insp.height': '高度 (0=自动)',
      'insp.link': '链接', 'insp.note': '备注', 'insp.image': '图片',
      'insp.chooseImg': '选择图片', 'insp.removeImg': '移除', 'insp.delNode': '删除该节点',

      // 右键菜单
      'ctx.addChild': '➕ 添加子节点', 'ctx.addSibling': '➕ 添加同级', 'ctx.edit': '✏️ 编辑文本',
      'ctx.addImage': '🖼 添加图片', 'ctx.expand': '⊞ 展开', 'ctx.collapse': '⊟ 折叠', 'ctx.delete': '🗑 删除',

      // 搜索
      'search.placeholder': '搜索节点文本 / 备注 / 标签…', 'search.head': '搜索',
      'search.noResult': '无匹配结果', 'search.note': '📝 含备注',

      // 大纲
      'outline.head': '大纲模式（缩进表示层级，应用后同步到导图）',
      'outline.apply': '应用', 'outline.copyMd': '复制为 Markdown',

      // 演示
      'present.prev': '‹ 上一张', 'present.next': '下一张 ›', 'present.exit': '退出 (Esc)',

      // 关闭确认
      'close.title': '未保存的更改',
      'close.msg': '当前文档有未保存的更改，是否先保存再退出？',
      'close.save': '保存', 'close.discard': '不保存', 'close.cancel': '取消',
    },

    en: {
      'lang.zh': '简体中文', 'lang.en': 'English', 'lang.ja': '日本語',

      'menu.file': 'File', 'menu.edit': 'Edit', 'menu.node': 'Node',
      'menu.view': 'View', 'menu.theme': 'Theme', 'menu.help': 'Help', 'menu.language': 'Language',
      'file.new': 'New', 'file.open': 'Open…', 'file.save': 'Save', 'file.saveAs': 'Save As…',
      'file.export': 'Export', 'export.png': 'PNG Image', 'export.svg': 'SVG Vector',
      'export.markdown': 'Markdown', 'export.pdf': 'PDF Document', 'file.quit': 'Exit',
      'edit.undo': 'Undo', 'edit.redo': 'Redo', 'edit.cut': 'Cut', 'edit.copy': 'Copy',
      'edit.paste': 'Paste', 'edit.selectAll': 'Select All',
      'node.addChild': 'Add Child (Tab)', 'node.addSibling': 'Add Sibling (Enter)',
      'node.collapse': 'Collapse / Expand', 'node.delete': 'Delete (Del)',
      'view.structure': 'Structure', 'view.direction': 'Direction', 'view.zoomIn': 'Zoom In',
      'view.zoomOut': 'Zoom Out', 'view.zoomReset': 'Reset Zoom', 'view.zoomFit': 'Fit to Window',
      'view.inspector': 'Inspector', 'view.outline': 'Outline', 'view.search': 'Search',
      'view.present': 'Presentation', 'view.reload': 'Reload', 'view.devtools': 'Developer Tools',
      'structure.mindmap': 'Mind Map', 'structure.logical': 'Logic Chart', 'structure.tree': 'Tree',
      'structure.org': 'Org Chart', 'structure.fishbone': 'Fishbone', 'structure.timeline': 'Timeline',
      'direction.right': '→ Right',
      'theme.classic': 'Classic Blue', 'theme.dark': 'Dark', 'theme.mint': 'Fresh Green',
      'theme.sunset': 'Sunset', 'theme.rainbow': 'Rainbow', 'theme.handdrawn': 'Hand-drawn',
      'help.github': 'GitHub Repo', 'help.about': 'About',
      'menu.loading': '(Loading…)',

      'about.title': 'About Free Mind Map',
      'about.message': 'Free Mind Map v0.1.0',
      'about.detail': 'An open-source, free, cross-platform mind mapping app.\nBuilt with Electron; files stored as plain text.',

      'dlg.openTitle': 'Open Mind Map', 'dlg.saveTitle': 'Save Mind Map', 'dlg.imageTitle': 'Select Image',
      'dlg.filterFmm': 'Free Mind Map', 'dlg.filterAll': 'All', 'dlg.filterImage': 'Image',
      'doc.untitled': 'Untitled',

      'err.parse': 'Failed to parse file: ', 'err.data': 'Invalid data format: ',

      'status.ready': 'Ready · sample map loaded', 'status.resized': 'Node resized',
      'status.new': 'Created', 'status.open': 'Opened', 'status.saved': 'Saved',
      'status.exportedPNG': 'PNG exported', 'status.exportedSVG': 'SVG exported',
      'status.exportedMD': 'Markdown exported', 'status.exportedPDF': 'PDF exported',
      'status.outlineSynced': 'Synced from outline', 'status.outlineCopied': 'Outline copied to clipboard',
      'status.rootNoDelete': 'Root node cannot be deleted', 'status.unsaved': '(Unsaved)', 'status.zoom': 'Zoom',

      'alert.pngFail': 'PNG export failed: ', 'alert.pdfFail': 'PDF export failed: ', 'alert.saveFail': 'Save failed: ',
      'confirm.newLose': 'Creating new will discard unsaved changes. Continue?',

      'node.newNode': 'New Node', 'node.fallback': 'Node', 'node.center': 'Central Topic',
      'sample.title': 'Free Mind Map Demo',

      'insp.empty': 'Select a node to edit its properties',
      'insp.toggleOpen': 'Open Inspector (Ctrl+I)', 'insp.toggleClose': 'Close Inspector (Ctrl+I)',
      'insp.text': 'Node Text', 'insp.icon': 'Icon (emoji)', 'insp.labels': 'Tags (comma separated)',
      'insp.priority': 'Priority', 'insp.priority.none': 'None', 'insp.priority.high': 'High',
      'insp.priority.medium': 'Medium', 'insp.priority.low': 'Low', 'insp.assignee': 'Assignee',
      'insp.due': 'Due Date', 'insp.width': 'Width (0=auto)', 'insp.height': 'Height (0=auto)',
      'insp.link': 'Link', 'insp.note': 'Note', 'insp.image': 'Image',
      'insp.chooseImg': 'Choose Image', 'insp.removeImg': 'Remove', 'insp.delNode': 'Delete this node',

      'ctx.addChild': '➕ Add Child', 'ctx.addSibling': '➕ Add Sibling', 'ctx.edit': '✏️ Edit Text',
      'ctx.addImage': '🖼 Add Image', 'ctx.expand': '⊞ Expand', 'ctx.collapse': '⊟ Collapse', 'ctx.delete': '🗑 Delete',

      'search.placeholder': 'Search node text / notes / tags…', 'search.head': 'Search',
      'search.noResult': 'No matches', 'search.note': '📝 Has note',

      'outline.head': 'Outline mode (indentation shows hierarchy; applies to map on confirm)',
      'outline.apply': 'Apply', 'outline.copyMd': 'Copy as Markdown',

      'present.prev': '‹ Previous', 'present.next': 'Next ›', 'present.exit': 'Exit (Esc)',

      'close.title': 'Unsaved Changes',
      'close.msg': 'The current document has unsaved changes. Save before quitting?',
      'close.save': 'Save', 'close.discard': "Don't Save", 'close.cancel': 'Cancel',
    },

    ja: {
      'lang.zh': '简体中文', 'lang.en': 'English', 'lang.ja': '日本語',

      'menu.file': 'ファイル', 'menu.edit': '編集', 'menu.node': 'ノード',
      'menu.view': '表示', 'menu.theme': 'テーマ', 'menu.help': 'ヘルプ', 'menu.language': '言語',
      'file.new': '新規', 'file.open': '開く…', 'file.save': '保存', 'file.saveAs': '名前を付けて保存…',
      'file.export': '書き出し', 'export.png': 'PNG 画像', 'export.svg': 'SVG ベクター',
      'export.markdown': 'Markdown', 'export.pdf': 'PDF 文書', 'file.quit': '終了',
      'edit.undo': '取り消し', 'edit.redo': 'やり直し', 'edit.cut': '切り取り', 'edit.copy': 'コピー',
      'edit.paste': '貼り付け', 'edit.selectAll': 'すべて選択',
      'node.addChild': '子ノードを追加 (Tab)', 'node.addSibling': '兄弟ノードを追加 (Enter)',
      'node.collapse': '折りたたむ / 展開', 'node.delete': '削除 (Del)',
      'view.structure': '構造', 'view.direction': '方向', 'view.zoomIn': '拡大',
      'view.zoomOut': '縮小', 'view.zoomReset': 'ズームリセット', 'view.zoomFit': 'ウィンドウに合わせる',
      'view.inspector': 'プロパティパネル', 'view.outline': 'アウトライン', 'view.search': '検索',
      'view.present': 'プレゼン', 'view.reload': '再読み込み', 'view.devtools': '開発者ツール',
      'structure.mindmap': 'マインドマップ', 'structure.logical': 'ロジックツリー', 'structure.tree': 'ツリー',
      'structure.org': '組織図', 'structure.fishbone': '魚骨図', 'structure.timeline': 'タイムライン',
      'direction.right': '→ 右',
      'theme.classic': 'クラシックブルー', 'theme.dark': 'ダーク', 'theme.mint': 'フレッシュグリーン',
      'theme.sunset': 'サンセット', 'theme.rainbow': 'レインボー', 'theme.handdrawn': '手書き',
      'help.github': 'GitHub リポジトリ', 'help.about': 'について',
      'menu.loading': '（読み込み中…）',

      'about.title': 'Free Mind Map について',
      'about.message': 'Free Mind Map v0.1.0',
      'about.detail': 'オープンソースで無料のクロスプラットフォームのマインドマップソフト。\nElectron 製。ファイルはプレーンテキストで保存。',

      'dlg.openTitle': 'マインドマップを開く', 'dlg.saveTitle': 'マインドマップを保存', 'dlg.imageTitle': '画像を選択',
      'dlg.filterFmm': 'Free Mind Map', 'dlg.filterAll': 'すべて', 'dlg.filterImage': '画像',
      'doc.untitled': '無題',

      'err.parse': 'ファイル解析失敗：', 'err.data': 'データ形式エラー：',

      'status.ready': '準備完了・サンプルマップ読み込み済み', 'status.resized': 'ノードのサイズを変更',
      'status.new': '新規作成しました', 'status.open': '開きました', 'status.saved': '保存しました',
      'status.exportedPNG': 'PNG を書き出しました', 'status.exportedSVG': 'SVG を書き出しました',
      'status.exportedMD': 'Markdown を書き出しました', 'status.exportedPDF': 'PDF を書き出しました',
      'status.outlineSynced': 'アウトラインから同期しました', 'status.outlineCopied': 'アウトラインをクリップボードにコピー',
      'status.rootNoDelete': 'ルートノードは削除できません', 'status.unsaved': '（未保存）', 'status.zoom': 'ズーム',

      'alert.pngFail': 'PNG 書き出し失敗：', 'alert.pdfFail': 'PDF 書き出し失敗：', 'alert.saveFail': '保存失敗：',
      'confirm.newLose': '新規作成すると未保存の変更が失われます。続行しますか？',

      'node.newNode': '新規ノード', 'node.fallback': 'ノード', 'node.center': '中心トピック',
      'sample.title': 'Free Mind Map デモ',

      'insp.empty': 'プロパティを編集するノードを選択',
      'insp.toggleOpen': 'プロパティパネルを開く (Ctrl+I)', 'insp.toggleClose': 'プロパティパネルを閉じる (Ctrl+I)',
      'insp.text': 'ノード文本', 'insp.icon': 'アイコン (emoji)', 'insp.labels': 'タグ (カンマ区切り)',
      'insp.priority': '優先度', 'insp.priority.none': 'なし', 'insp.priority.high': '高',
      'insp.priority.medium': '中', 'insp.priority.low': '低', 'insp.assignee': '担当者',
      'insp.due': '期限', 'insp.width': '幅 (0=自動)', 'insp.height': '高さ (0=自動)',
      'insp.link': 'リンク', 'insp.note': 'メモ', 'insp.image': '画像',
      'insp.chooseImg': '画像を選択', 'insp.removeImg': '削除', 'insp.delNode': 'このノードを削除',

      'ctx.addChild': '➕ 子ノードを追加', 'ctx.addSibling': '➕ 兄弟ノードを追加', 'ctx.edit': '✏️ テキスト編集',
      'ctx.addImage': '🖼 画像を追加', 'ctx.expand': '⊞ 展開', 'ctx.collapse': '⊟ 折りたたむ', 'ctx.delete': '🗑 削除',

      'search.placeholder': 'ノード文本 / メモ / タグを検索…', 'search.head': '検索',
      'search.noResult': '一致する結果がありません', 'search.note': '📝 メモあり',

      'outline.head': 'アウトライン mode（階層は字下げ、適用時にマップへ同期）',
      'outline.apply': '適用', 'outline.copyMd': 'Markdown としてコピー',

      'present.prev': '‹ 前へ', 'present.next': '次へ ›', 'present.exit': '終了 (Esc)',

      'close.title': '未保存の変更',
      'close.msg': '現在のドキュメントに未保存の変更があります。終了前に保存しますか？',
      'close.save': '保存', 'close.discard': '保存しない', 'close.cancel': 'キャンセル',
    },
  };

  const LANGS = [
    { key: 'zh', name: '简体中文' },
    { key: 'en', name: 'English' },
    { key: 'ja', name: '日本語' },
  ];

  let lang = 'zh';

  function t(key) {
    const d = dict[lang] || dict.zh;
    if (d && d[key] != null) return d[key];
    return (dict.zh[key] != null) ? dict.zh[key] : key;
  }
  function setLang(l) { if (dict[l]) lang = l; }
  function getLang() { return lang; }
  function list() { return LANGS; }

  const api = { t, setLang, getLang, list, dict };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.I18n = api;
})();
