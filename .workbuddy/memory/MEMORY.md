# Free Mind Map 项目长期约定

## 版本控制（重要）
- **本项目所有 git 提交 / 推送一律由用户人工操作，AI 不要执行 `git commit` / `git push` / `git add -A` 等提交类命令。**
- AI 只负责修改代码、构建、测试与本地验证；完成改动后告知用户「请手动提交」，由用户本机执行 `git push -u origin main`（沙箱也连不上 GitHub，被 502 拦截）。
- 例外：若用户在某次对话中明确说「你来提交/推送」，则按当次指令执行。

## 多语言（i18n）
- 三语：简体中文(zh) / English(en) / 日本語(ja)。字典在 `renderer/js/i18n.js`（同时 `window.I18n` 与 `module.exports`，main.js 用 `require('./renderer/js/i18n')` 复用同一文件）。
- 取文案用 `I18n.t('key')`；切语言 `I18n.setLang(lang)`，渲染进程持久化到 `localStorage['fmm.lang']` 并经由 preload `setLang`→主进程 `lang:set`（主进程重建菜单）+ 主进程 `lang:apply` 下发渲染进程 `applyI18n()`。
- 新增固定文案：在 i18n.js 三语都加 key，HTML 静态文案加 `data-i18n`/`data-i18n-ph`，动态文案用 `I18n.t(...)`。语言切换菜单在 main.js「语言」子菜单（radio）。
