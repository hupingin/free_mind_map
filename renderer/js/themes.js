/**
 * themes.js — 主题定义（一键换肤 / 智能配色 / 彩虹分支 / 手绘风格）
 */
(function () {
  const themes = {
    classic: {
      name: '经典蓝',
      bg: '#f4f6fb',
      nodeFill: '#ffffff', nodeStroke: '#c8d2e6', nodeText: '#27324d',
      rootFill: '#3b6ef5', rootText: '#ffffff', rootStroke: '#2c54c8',
      line: '#9fb0d6', lineWidth: 2,
      selected: '#ff8a3d',
      font: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      rainbow: false, handdrawn: false,
    },
    dark: {
      name: '暗夜',
      bg: '#1e1f29', nodeFill: '#2b2d3a', nodeStroke: '#3c3f52', nodeText: '#e6e8f0',
      rootFill: '#7c5cff', rootText: '#ffffff', rootStroke: '#5e3fd6',
      line: '#5a5f7a', lineWidth: 2,
      selected: '#ffb74d',
      font: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      rainbow: false, handdrawn: false,
    },
    mint: {
      name: '清新绿',
      bg: '#eefaf3', nodeFill: '#ffffff', nodeStroke: '#bfe6cf', nodeText: '#234b39',
      rootFill: '#1fb377', rootText: '#ffffff', rootStroke: '#159b64',
      line: '#9bd9b6', lineWidth: 2,
      selected: '#ff7043',
      font: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      rainbow: false, handdrawn: false,
    },
    sunset: {
      name: '日落橙',
      bg: '#fff5ee', nodeFill: '#ffffff', nodeStroke: '#ffd6b8', nodeText: '#5a2e12',
      rootFill: '#ff7a45', rootText: '#ffffff', rootStroke: '#e85f2a',
      line: '#ffb38a', lineWidth: 2,
      selected: '#3b6ef5',
      font: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      rainbow: false, handdrawn: false,
    },
    rainbow: {
      name: '彩虹分支',
      bg: '#f7f8fc', nodeFill: '#ffffff', nodeStroke: '#d4d9ea', nodeText: '#27324d',
      rootFill: '#33384d', rootText: '#ffffff', rootStroke: '#33384d',
      line: '#cccccc', lineWidth: 2.4,
      selected: '#ff3d77',
      font: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      rainbow: true, handdrawn: false,
    },
    handdrawn: {
      name: '手绘风格',
      bg: '#fdfaf2', nodeFill: '#fffdf6', nodeStroke: '#3a3a3a', nodeText: '#2a2a2a',
      rootFill: '#2a2a2a', rootText: '#fffdf6', rootStroke: '#2a2a2a',
      line: '#3a3a3a', lineWidth: 2,
      selected: '#e8324f',
      font: '"Comic Sans MS", "Segoe Print", "PingFang SC", cursive',
      rainbow: false, handdrawn: true,
    },
  };

  const rainbowPalette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  function get(name) { return themes[name] || themes.classic; }
  function list() { return Object.keys(themes).map((k) => ({ key: k, name: themes[k].name })); }

  window.Themes = { themes, get, list, rainbowPalette };
})();
