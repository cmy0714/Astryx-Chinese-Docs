/* Astryx 文档站 —— 纯静态，数据来自 astryx CLI 的 JSON 输出 */
(() => {
  'use strict';

  /* ---------------- 工具 ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  /* 轻量语法高亮：单次扫描，避免占位符被二次替换 */
  const TOKEN_RE =
    /(\/\/[^\n]*)|(&#39;[^&\n]*?&#39;|&quot;[^&\n]*?&quot;|`[^`]*`)|(&lt;\/?)([A-Z][\w.]*)|\b(import|from|export|default|const|let|var|function|return|if|else|for|while|type|interface|extends|implements|new|class|async|await|true|false|null|undefined|void|as)\b|\b(\d+(?:\.\d+)?)\b/g;

  function highlight(code) {
    return esc(code).replace(TOKEN_RE, (m, com, str, tagOpen, tagName, kw, num) => {
      if (com) return `<span class="tok-com">${com}</span>`;
      if (str) return `<span class="tok-str">${str}</span>`;
      if (tagName) return `${tagOpen}<span class="tok-tag">${tagName}</span>`;
      if (kw) return `<span class="tok-key">${kw}</span>`;
      if (num) return `<span class="tok-num">${num}</span>`;
      return m;
    });
  }

  function codeBlock(code, lang = 'tsx', title = '') {
    const id = 'c' + Math.random().toString(36).slice(2, 8);
    const lines = String(code).split('\n').length;
    const long = lines > 26;
    return `<div class="code-wrap${long ? ' collapsible' : ''}">
      <div class="code-head">
        <span>${title || ''}</span>
        <span style="display:flex;align-items:center;gap:10px">
          <span class="lang">${lang}</span>
          <button class="copy" data-copy="${id}">复制</button>
        </span>
      </div>
      <pre><code id="${id}">${highlight(code)}</code></pre>
      ${long ? `<button class="expand" data-expand="${id}" data-label="展开全部 ${lines} 行">展开全部 ${lines} 行</button>` : ''}
    </div>`;
  }

  /* 类型列：把 'a' | 'b' 里的枚举值渲染成代码片段，便于扫读 */
  const typeHtml = (t) => esc(t).replace(/'([^']+)'/g, '<code>$1</code>');

  function table(headers, rows, cls = '') {    return `<div class="table-wrap"><table class="${cls}">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
  }

  /* ---------------- 数据 ---------------- */
  const CAT_ORDER = [
    ['Action', '操作'],
    ['Form Controls', '表单'],
    ['Layout', '布局'],
    ['Navigation', '导航'],
    ['Overlay', '浮层'],
    ['Content', '内容'],
    ['Container', '容器'],
    ['Table & List', '表格与列表'],
    ['Feedback & Status', '反馈与状态'],
    ['Chat', '对话'],
    ['Utility', '工具'],
    ['其他', '其他'],
  ];
  const CAT_LABEL = Object.fromEntries(CAT_ORDER);

  let DATA = null;
  let PREVIEWS = null;
  let ZH = {};
  const byName = new Map();

  /* 中文优先，缺翻译时回退英文并标注 */
  const zhOf = (name) => (ZH[name] && ZH[name].desc) || '';
  const zhPractice = (name, i) => {
    const arr = ZH[name] && ZH[name].practices;
    return (arr && arr[i]) || '';
  };
  const zhProp = (name, prop) => {
    const m = ZH[name] && ZH[name].props;
    return (m && m[prop]) || '';
  };
  /* 组件中文名；英文名作为代码标识保留 */
  const zhName = (name) => (ZH[name] && ZH[name].name) || '';
  const navLabel = (c) => zhName(c.name) || c.displayName;
  const descHtml = (c, withOrig = true) => {
    const zh = zhOf(c.name);
    if (!zh) {
      return `<p class="lead">${esc(c.description)} <span class="pill" title="尚未翻译">EN</span></p>`;
    }
    return `<p class="lead">${zh}</p>${
      withOrig && c.description ? `<p class="orig">原文：${esc(c.description)}</p>` : ''
    }`;
  };

  /* ---------------- 侧边栏 ---------------- */
  const GUIDES = [
    ['#/', '概览'],
    ['#/install', '安装'],
    ['#/theme', '主题'],
    ['#/tokens', '设计 Token'],
  ];

  function renderSidebar(filter = '') {
    const q = filter.trim().toLowerCase();
    const match = (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.displayName.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.keywords || []).some((k) => k.toLowerCase().includes(q)) ||
      (c.description || '').toLowerCase().includes(q);

    const parts = [];

    if (!q) {
      parts.push(`<div class="nav-section">
        <div class="nav-title">指南</div>
        ${GUIDES.map(([href, label]) => `<a class="nav-item" href="${href}" data-nav="${href}">${label}</a>`).join('')}
      </div>`);
    }

    const groups = new Map();
    for (const c of DATA.components) {
      if (!match(c)) continue;
      if (!groups.has(c.category)) groups.set(c.category, []);
      groups.get(c.category).push(c);
    }

    const order = CAT_ORDER.map(([k]) => k).filter((k) => groups.has(k));
    for (const k of groups.keys()) if (!order.includes(k)) order.push(k);

    parts.push(`<div class="nav-section"><div class="nav-title">组件 · ${DATA.components.length}</div></div>`);
    for (const cat of order) {
      const list = groups.get(cat).sort((a, b) => a.displayName.localeCompare(b.displayName));
      parts.push(`<div class="nav-group" data-cat="${cat}">
        <div class="nav-group-title"><span class="chev">▾</span>${CAT_LABEL[cat] || cat}<span class="count">${list.length}</span></div>
        <div class="nav-items">
          ${list.map((c) => `<a class="nav-item" href="#/c/${c.name}" data-nav="#/c/${c.name}" title="${esc(c.displayName)}">${esc(navLabel(c))}</a>`).join('')}
        </div>
      </div>`);
    }

    $('#side').innerHTML = parts.join('');

    // 折叠
    $$('.nav-group-title').forEach((t) =>
      t.addEventListener('click', () => t.parentElement.classList.toggle('collapsed')),
    );
    markActive();
  }

  function markActive() {
    const hash = location.hash || '#/';
    $$('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.nav === hash));
    const active = $('.nav-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function zhCoverage() {
    let d = 0,
      p = 0,
      a = 0,
      pT = 0,
      aT = 0;
    for (const c of DATA.components) {
      const z = ZH[c.name] || {};
      const ps = z.practices || [];
      const pr = z.props || {};
      if (z.desc) d += 1;
      p += c.practices.filter((_, i) => ps[i]).length;
      pT += c.practices.length;
      a += c.props.filter((x) => pr[x.name]).length;
      aT += c.props.length;
    }
    return { d, dT: DATA.components.length, p, pT, a, aT };
  }

  function coverageBlock() {
    const cv = zhCoverage();
    const row = (label, v, t) => {
      const pct = t ? Math.round((v / t) * 100) : 100;
      return `<div class="cov-row">
        <span class="cov-label">${label}</span>
        <span class="cov-bar"><i style="width:${pct}%"></i></span>
        <span class="cov-num">${v}/${t} · ${pct}%</span>
      </div>`;
    };
    return `<div class="cov">
      <div class="cov-title">中文翻译进度</div>
      ${row('组件说明', cv.d, cv.dT)}
      ${row('使用建议', cv.p, cv.pT)}
      ${row('API 说明', cv.a, cv.aT)}
    </div>`;
  }

  /* ---------------- 页面：概览 ---------------- */
  function pageHome() {
    const featured = ['Button', 'Card', 'Table', 'Dialog', 'TextInput', 'AppShell', 'Badge', 'Tabs', 'Toast'];
    const tiles = featured
      .map((n) => byName.get(n))
      .filter(Boolean)
      .map(
        (c) => `<a class="tile" href="#/c/${c.name}">
          <div class="t-name">${esc(navLabel(c))} <span class="t-en">${esc(c.displayName)}</span></div>
          <div class="t-desc">${esc(zhOf(c.name) || c.description).slice(0, 90)}</div>
        </a>`,
      )
      .join('');

    return `
      <div class="crumb">文档 <span>/</span> 概览</div>
      <h1>Astryx 组件文档</h1>
      <p class="lead">Meta 开源的 React 设计系统，内含 ${DATA.components.length} 个组件与 Hook。本页由 <code>astryx</code> CLI 导出的
        组件元数据生成，API 与官方实现保持一致。</p>

      <div class="pill-row">
        <span class="pill accent">v${DATA.version}</span>
        <span class="pill">MIT</span>
        <span class="pill">React 19+</span>
        <span class="pill">Beta</span>
        ${Object.entries(DATA.categories)
          .filter(([k, n]) => n >= 5 && k !== '其他')
          .slice(0, 5)
          .map(([k, n]) => `<span class="pill">${CAT_LABEL[k] || k} ${n}</span>`)
          .join('')}
      </div>

      ${coverageBlock()}

      <h2 id="quick-start">快速开始</h2>
      ${codeBlock(
        `import {Button} from '@astryxdesign/core/Button';

export function Demo() {
  return <Button variant="primary" label="保存修改" />;
}`,
        'tsx',
        '一个最小的用法',
      )}

      <h2 id="how-to-read">怎么读这份文档</h2><ul>
        <li><b>左侧导航</b>按用途分组，共 ${new Set(DATA.components.map((c) => c.category)).size} 个分类；点击分类标题可折叠。</li>
        <li><b>Ctrl K</b> 搜索组件名、关键词或用途描述，中英文都能命中。</li>
        <li>每个组件页固定包含：导入路径、可运行示例、使用建议（Do / Don't）、组件结构、完整 API 表、主题变量、无障碍要求。</li>
        <li>API 表里的类型是<b>直接从 TypeScript 定义抽取</b>的，不是手写摘要。</li>
      </ul>

      <h2 id="principles">三条设计原则</h2>
      <ul>
        <li><b>引导优于约束</b> —— 组件给你能力，而不是用护栏跟你对抗；设计意见放在文档和示例里。</li>
        <li><b>强约定且成文</b> —— 所有组件共享同一套命名、prop 与组合规则，学会几个就能预测其余。</li>
        <li><b>人和 AI 共用一套</b> —— API、文档、CLI 一起设计，同一份参考同时服务人和 agent。</li>
      </ul>

      <h2 id="featured">常用组件</h2>
      <div class="grid">${tiles}</div>

      <h2 id="resources">相关链接</h2>
      <ul>
        <li><a href="https://astryx.atmeta.com/storybook/" target="_blank" rel="noreferrer">Storybook ↗</a>：交互式组件浏览器</li>
        <li><a href="https://astryx.atmeta.com/sandbox/" target="_blank" rel="noreferrer">Sandbox ↗</a>：在线试跑</li>
        <li><a href="https://github.com/meta/astryx" target="_blank" rel="noreferrer">GitHub 仓库 ↗</a>：源码与 issue</li>
      </ul>
    `;
  }

  /* ---------------- 页面：安装 ---------------- */
  function pageInstall() {
    return `
      <div class="crumb">文档 <span>/</span> 安装</div>
      <h1>安装与接入</h1>
      <p class="lead">Astryx 发的是<b>预编译 CSS + JS</b>，消费方不需要打包器插件、PostCSS 或 Babel 配置。装好依赖、引对三层样式、包上 Provider 就能用。</p>

      <h2 id="install">1. 安装依赖</h2>
      ${codeBlock(
        `# 运行依赖
npm i @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex

# 开发依赖（文档查询、页面模板、codemod）
npm i -D @astryxdesign/cli`,
        'bash',
        'npm',
      )}
      <ul>
        <li>peer 要求：<code>react</code> / <code>react-dom</code> <b>≥ 19</b>，<code>@stylexjs/stylex</code> ^0.19.0。</li>
        <li>React 18 及以下用不了，这是硬门槛，不是配置问题。</li>
        <li>依赖请写精确版本，<code>0.x</code> 小版本也可能 breaking。</li>
      </ul>

      <h2 id="css">2. 引入三层样式（顺序固定）</h2>
      ${codeBlock(
        `@import '@astryxdesign/core/reset.css';            /* @layer reset        */
@import '@astryxdesign/core/astryx.css';           /* @layer astryx-base  */
@import '@astryxdesign/theme-neutral/theme.css';   /* @layer astryx-theme */`,
        'css',
        'globals.css',
      )}
      <p>顺序错了会破坏 CSS 层叠，典型症状是"主题覆盖不生效"或"reset 把组件样式压掉"。</p>

      <h2 id="provider">3. Provider</h2>
      ${codeBlock(
        `import Link from 'next/link';
import {Theme} from '@astryxdesign/core/theme';
import {LinkProvider} from '@astryxdesign/core/Link';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';

export function Providers({children}) {
  return (
    <Theme theme={neutralTheme}>
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}`,
        'tsx',
        'Providers.tsx',
      )}
      <ul>
        <li><code>Theme</code> 收的是<b>主题对象</b>，不是字符串；<code>mode</code> 才能切换明暗。</li>
        <li><code>LinkProvider</code> 让所有链接走框架路由，否则每次跳转都整页刷新。</li>
        <li>非 Next 项目去掉 <code>'use client'</code> 与 <code>next/link</code>，换你框架的 Link。</li>
      </ul>

      <h2 id="tailwind">4. Tailwind 项目</h2>
      ${codeBlock(
        `@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/preflight.css' layer(base);
@import '@astryxdesign/core/reset.css';
@import '@astryxdesign/core/astryx.css';
@import '@astryxdesign/theme-neutral/theme.css';
@import '@astryxdesign/core/tailwind-theme.css';
@import 'tailwindcss/utilities.css' layer(utilities);`,
        'css',
        'globals.css',
      )}
      <p>桥接后可以直接写 <code>bg-surface</code>、<code>text-primary</code>、<code>rounded-lg</code>、<code>p-4</code>（= <code>--spacing-4</code> = 16px）。<code>@layer</code> 声明行必须在 Tailwind 引入之前。</p>

      <h2 id="no-build">5. 无构建（原型 / CDN）</h2>
      ${codeBlock(`npx @astryxdesign/cli template --cdn   # 生成 cdn.template.html，版本已钉死`, 'bash')}
      <p>React 19 没有 UMD 构建，CDN 方案必须走 ESM + import map，<code>window.React</code> 那条路已经不存在了。</p>

      <h2 id="checklist">接入清单</h2>
      <ul>
        <li>React ≥ 19</li>
        <li><code>core</code> + <code>theme-*</code> + <code>@stylexjs/stylex</code> 装好，版本精确</li>
        <li>三层 CSS 按顺序引入</li>
        <li><code>Theme</code> + <code>LinkProvider</code> 就位</li>
        <li><code>astryx init</code> 把组件索引写进 <code>AGENTS.md</code> / <code>CLAUDE.md</code></li>
        <li><code>tsc --noEmit</code> 与构建通过</li>
      </ul>
    `;
  }

  /* ---------------- 页面：主题 ---------------- */
  function pageTheme() {
    const themes = ['neutral', 'butter', 'chocolate', 'matcha', 'stone', 'gothic', 'y2k'];
    return `
      <div class="crumb">文档 <span>/</span> 主题</div>
      <h1>主题</h1>
      <p class="lead">主题本质是<b>一组 CSS 自定义属性覆盖</b>。不需要 fork 组件源码，也不需要包裹组件——定义一次，整个子树生效。</p>

      <h2 id="preset">预置主题</h2>
      <p>官方提供 7 套主题，各自独立发包：</p>
      <div class="pill-row">${themes.map((t) => `<span class="pill">@astryxdesign/theme-${t}</span>`).join('')}</div>
      ${codeBlock(
        `@import '@astryxdesign/theme-matcha/theme.css';

import {matchaTheme} from '@astryxdesign/theme-matcha/built';
<Theme theme={matchaTheme} mode="system"><App /></Theme>`,
        'tsx',
        '换主题只需要换这一处',
      )}

      <h2 id="custom">自定义主题</h2>
      ${codeBlock(
        `import {Theme, defineTheme} from '@astryxdesign/core/theme';

const ocean = defineTheme({
  name: 'ocean',
  tokens: {'--color-accent': ['#0077B6', '#48CAE4']},   // [浅色, 深色]
  components: {card: {base: {borderWidth: '2px'}}},      // 组件级覆盖
});

export const App = () => (
  <Theme theme={ocean} mode="system">{children}</Theme>
);`,
        'tsx',
        'defineTheme',
      )}
      <ul>
        <li><code>tokens</code> 的值是二元组时，第一项给浅色、第二项给深色，自动跟随 <code>color-scheme</code>。</li>
        <li><code>components</code> 按组件 target 类名作用域覆盖，比全局 CSS 安全。</li>
        <li>生产环境构建主题 CSS：<code>astryx theme build</code>。</li>
      </ul>

      <h2 id="dark">深色模式</h2>
      ${codeBlock(
        `// 根 Theme 会把 data-theme 同步到 <html>
<Theme theme={neutralTheme} mode="system">
  <App />
</Theme>

// SSR / RSC：在服务端就把属性写上，避免首屏闪一下
<html lang="zh-CN" data-theme="dark">`,
        'tsx',
        '两件事',
      )}
      <ul>
        <li><code>mode="system"</code> 跟随操作系统；<code>"light"</code> / <code>"dark"</code> 强制指定。</li>
        <li>只有 <code>data-astryx-theme</code> 时只作用于样式范围，<b>切不了明暗</b>——必须是主题对象 + <code>mode</code>。</li>
      </ul>

      <h2 id="override">覆盖样式的三条路</h2>
      ${table(
        ['场景', '做法', '说明'],
        [
          `<tr><td class="prop">局部微调</td><td>传 <code>className</code></td><td class="desc">Tailwind / CSS Modules / 普通 CSS 都行，Astryx 不锁定样式方案</td></tr>`,
          `<tr><td class="prop">品牌级定制</td><td><code>defineTheme</code> 的 <code>components</code></td><td class="desc">按 target 类名作用域覆盖，随主题走</td></tr>`,
          `<tr><td class="prop">深度改造</td><td><code>astryx swizzle &lt;Name&gt;</code></td><td class="desc">把组件源码 eject 到项目里自己维护</td></tr>`,
        ],
      )}
    `;
  }

  /* ---------------- 页面：Token ---------------- */
  function pageTokens() {
    const fams = [
      ['color', '--color-text-primary', '语义色：文本、背景、边框、状态'],
      ['spacing', '--spacing-4', '间距阶梯，spacing-4 = 16px'],
      ['radius', '--radius-element', '圆角：inner / element / container'],
      ['shadow', '--shadow-med', '阴影：low / med / high'],
      ['typography', '--font-family-body', '字体族与字重'],
      ['textSize', '--text-size-base', '字号阶梯'],
      ['border', '--color-border', '边框颜色与宽度'],
      ['focus', '--focus-outline-offset', '焦点环'],
      ['motion', '--duration-fast', '时长与缓动'],
    ];
    return `
      <div class="crumb">文档 <span>/</span> 设计 Token</div>
      <h1>设计 Token</h1>
      <p class="lead">组件里所有颜色、间距、圆角、阴影都来自 token。业务代码直接用 <code>var(--…)</code>，不要写死色值和像素值——这是主题能整体生效的前提。</p>

      <h2 id="families">Token 家族</h2>
      ${table(
        ['家族', '示例变量', '用途'],
        fams.map(
          ([f, ex, d]) =>
            `<tr><td class="prop">${f}</td><td class="type">${ex}</td><td class="desc">${d}</td></tr>`,
        ),
      )}

      <h2 id="semantic">常用语义色</h2>
      ${table(
        ['变量', '含义'],
        [
          ['--color-text-primary', '主文本'],
          ['--color-text-secondary', '次要文本、说明'],
          ['--color-background-body', '页面底色'],
          ['--color-background-surface', '卡片 / 面板底色'],
          ['--color-border', '分割线、边框'],
          ['--color-accent', '强调色（neutral 主题下是近黑）'],
        ].map(([v, d]) => `<tr><td class="prop">${v}</td><td class="desc">${d}</td></tr>`),
      )}

      <h2 id="usage">用法</h2>
      ${codeBlock(
        `.panel {
  padding: var(--spacing-4);
  background: var(--color-background-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-container);
  box-shadow: var(--shadow-low);
  color: var(--color-text-primary);
}`,
        'css',
        '纯 CSS 使用 token',
      )}

      <h2 id="rules">三条硬规则</h2>
      <ul>
        <li><b>不写 <code>#hex</code></b>：深色模式会失效，品牌换色也要全项目搜替换。</li>
        <li><b>不写魔法数字</b>：<code>13px</code>、<code>7px</code> 这种，间距一律走 <code>--spacing-*</code>。</li>
        <li><b>不覆盖组件内部结构</b>：要改外观先走 <code>defineTheme</code>，再退到 <code>className</code>。</li>
      </ul>
    `;
  }

  /* ---------------- 页面：组件 ---------------- */
  function pageComponent(name) {
    const c = byName.get(name);
    if (!c) {
      return `<div class="crumb">文档</div><h1>未找到组件</h1><p>没有名为 <code>${esc(name)}</code> 的组件。用 <b>Ctrl K</b> 搜一下。</p>`;
    }

    const imp = `import {${c.name}} from '${c.importPath || `@astryxdesign/core/${c.group}`}';`;

    /* ---- 渲染预览（构建时由 react-dom/server 生成） ---- */
    const pv = (PREVIEWS && PREVIEWS[c.name]) || null;
    const showcase = pv && pv.showcase
      ? `<div class="preview"><div class="live-root" data-live="s" data-key="${esc(c.name)}">${pv.showcase.html}</div></div>
         <details class="pv-code"><summary>查看展示代码</summary>${codeBlock(pv.showcase.code, 'tsx', c.name + 'Showcase')}</details>`
      : '';

    let variantGroups = '';
    if (pv && pv.variants.length) {
      const byProp = new Map();
      for (const v of pv.variants) {
        if (!byProp.has(v.prop)) byProp.set(v.prop, []);
        byProp.get(v.prop).push(v);
      }
      variantGroups = [...byProp.entries()]
        .map(
          ([prop, items]) => `<h3><code>${prop}</code> 的取值</h3>
            <div class="vgrid">
              ${items
                .map(
                  (it) => `<div class="vcell">
                    <div class="vrender"><div class="live-root" data-live="v" data-key="${esc(
                      `${c.name}|${it.prop}|${it.value}`,
                    )}">${it.html}</div></div>
                    <div class="vlabel">${prop}="${esc(it.value)}"</div>
                  </div>`,
                )
                .join('')}
            </div>`,
        )
        .join('');
    }

    const previewSection = showcase
      ? `<h2 id="preview">外观</h2>${showcase}`
      : `<h2 id="preview">外观</h2><p style="color:var(--color-text-secondary)">该组件没有可独立渲染的外观（多为 Provider、Hook 或纯逻辑工具），请看下方 API。</p>`;

    const variantSection = variantGroups ? `<h2 id="variants">参数效果</h2>${variantGroups}` : '';

    const props = c.props.length
      ? table(
          ['属性', '类型', '必填', '默认值', '说明'],
          c.props.map(
            (p) => `<tr>
              <td class="prop">${p.name}</td>
              <td class="type">${typeHtml(p.type)}</td>
              <td>${p.required ? '<span class="req">必填</span>' : ''}</td>
              <td class="type">${p.default ? esc(p.default) : '—'}</td>
              <td class="desc">${esc(zhProp(c.name, p.name) || p.description)}${
                zhProp(c.name, p.name) ? '' : ' <span class="pill">EN</span>'
              }</td>
            </tr>`,
          ),
        )
      : `<p>该组件未提供 props 表。</p>`;

    const ex = c.examples.length
      ? c.examples
          .map(
            (e, i) =>
              `<h3>${esc(e.label)}</h3>${codeBlock(e.code, 'tsx', `示例 ${i + 1}`)}`,
          )
          .join('')
      : `<p style="color:var(--color-text-secondary)">官方未给这个组件单独提供示例代码，效果见上方「外观」。</p>`;

    const good = c.practices.map((p, i) => ({ ...p, i })).filter((p) => p.ok);
    const bad = c.practices.map((p, i) => ({ ...p, i })).filter((p) => !p.ok);
    const li = (p) => {
      const z = zhPractice(c.name, p.i);
      return `<li>${esc(z || p.text)}${z ? '' : ' <span class="pill">EN</span>'}</li>`;
    };
    const dodont =
      good.length || bad.length
        ? `<div class="dodont">
            <div class="dd do"><h4>推荐</h4><ul>${good.map(li).join('') || '<li>—</li>'}</ul></div>
            <div class="dd dont"><h4>避免</h4><ul>${bad.map(li).join('') || '<li>—</li>'}</ul></div>
          </div>`
        : '';

    const anatomy = c.anatomy.length
      ? table(
          ['元素', '必需', '说明'],
          c.anatomy.map(
            (a) =>
              `<tr><td class="prop">${esc(a.element)}</td><td>${a.required ? '是' : ''}</td><td class="desc">${esc(a.description)}</td></tr>`,
          ),
        )
      : '';

    const vars = c.theming.vars.length
      ? table(
          ['CSS 变量', '默认值', '说明'],
          c.theming.vars.map(
            (v) =>
              `<tr><td class="prop">${esc(v.name)}${v.private ? ' <span class="pill">私有</span>' : ''}</td><td class="type">${esc(v.default || '—')}</td><td class="desc">${esc(v.description || '')}</td></tr>`,
          ),
        )
      : '';

    const a11y = c.a11y.length
      ? table(
          ['检查项', '规范', '要求', '状态', '说明'],
          c.a11y.map(
            (a) =>
              `<tr><td class="prop">${esc(a.name)}</td><td class="type">${esc(a.criterion || '')}</td><td>${esc(a.requirement || '')}</td><td class="desc">${esc((a.states || []).join('、'))}</td><td class="desc">${esc(a.description || '')}</td></tr>`,
          ),
        )
      : '';

    return `
      <div class="crumb">组件 <span>/</span> ${CAT_LABEL[c.category] || c.category} <span>/</span> ${esc(navLabel(c))}</div>
      <h1>${esc(navLabel(c))}<span class="en-tag">${esc(c.displayName)}</span></h1>
      ${descHtml(c)}
      <div class="pill-row">
        <span class="pill accent">${CAT_LABEL[c.category] || c.category}</span>
        <span class="pill">${c.name}</span>
        ${c.keywords.slice(0, 4).map((k) => `<span class="pill">${esc(k)}</span>`).join('')}
      </div>

      <h2 id="import">导入</h2>
      ${codeBlock(imp, 'ts', '按子路径导入，不要从根入口一把梭')}

      ${previewSection}
      ${variantSection}

      <h2 id="examples">示例代码</h2>
      ${ex}

      ${dodont ? `<h2 id="practices">使用建议</h2>${dodont}` : ''}

      ${anatomy ? `<h2 id="anatomy">组件结构</h2>${anatomy}` : ''}

      <h2 id="api">API</h2>
      <p style="color:var(--color-text-secondary);font-size:13px">共 ${c.props.length} 个 prop，类型直接取自 TypeScript 定义。</p>
      ${props}

      ${vars ? `<h2 id="theming">主题变量</h2>${vars}` : ''}
      ${a11y ? `<h2 id="a11y">无障碍</h2>${a11y}` : ''}
    `;
  }

  /* ---------------- 路由与 TOC ---------------- */
  const PAGES = {
    '/': pageHome,
    '/install': pageInstall,
    '/theme': pageTheme,
    '/tokens': pageTokens,
  };

  function route() {
    const hash = location.hash || '#/';
    const path = hash.slice(1);

    let html;
    if (path.startsWith('/c/')) {
      html = pageComponent(decodeURIComponent(path.slice(3)));
    } else {
      html = (PAGES[path] || pageHome)();
    }

    $('#main').innerHTML = html;
    mountLive($('#main'));
    markActive();
    buildTOC();
    bindCopy();
    window.scrollTo({ top: 0 });
  }

  /* 把预览从静态 HTML 升级为真正挂载的 React 组件（可交互） */
  function mountLive(root) {
    if (!window.AX) return;
    try {
      window.AX.mountAll(root);
    } catch (e) {
      console.warn('live mount failed', e);
    }
  }

  function buildTOC() {
    const hs = $$('#main h2');
    const toc = $('#toc');
    if (!hs.length) {
      toc.innerHTML = '';
      return;
    }
    toc.innerHTML =
      `<div class="toc-title">本页内容</div>` +
      hs.map((h) => `<a href="#${location.hash.slice(1)}" data-toc="${h.id}">${h.textContent}</a>`).join('');

    $$('#toc a').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById(a.dataset.toc)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        $$('#toc a').forEach((x) => x.classList.toggle('active', x === a));
      }),
    );

    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            $$('#toc a').forEach((x) => x.classList.toggle('active', x.dataset.toc === en.target.id));
          }
        }
      },
      { rootMargin: '-72px 0px -70% 0px' },
    );
    hs.forEach((h) => io.observe(h));
  }

  function bindCopy() {
    $$('.copy').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const code = document.getElementById(btn.dataset.copy)?.innerText || '';
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = '已复制';
          btn.classList.add('done');
          setTimeout(() => {
            btn.textContent = '复制';
            btn.classList.remove('done');
          }, 1400);
        } catch {
          btn.textContent = '失败';
        }
      }),
    );

    $$('.expand').forEach((btn) =>
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.code-wrap');
        const open = wrap.classList.toggle('open');
        btn.textContent = open ? '收起' : btn.dataset.label;
      }),
    );
  }

  /* ---------------- 搜索 ---------------- */
  let sel = 0;
  let results = [];

  function search(q) {
    const s = q.trim().toLowerCase();
    if (!s) return DATA.components.slice(0, 8);
    const score = (c) => {
      const n = c.name.toLowerCase();
      const d = c.displayName.toLowerCase();
      const zh = (zhName(c.name) || '').toLowerCase();
      let v = 0;
      if (n === s || d === s || zh === s) v += 100;
      if (n.startsWith(s) || d.startsWith(s) || zh.startsWith(s)) v += 50;
      if (n.includes(s) || d.includes(s) || zh.includes(s)) v += 30;
      if ((c.keywords || []).some((k) => k.toLowerCase().includes(s))) v += 20;
      if ((CAT_LABEL[c.category] || c.category).includes(s)) v += 15;
      if ((c.description || '').toLowerCase().includes(s)) v += 8;
      if ((zhOf(c.name) || '').includes(s)) v += 8;
      return v;
    };
    return DATA.components
      .map((c) => [score(c), c])
      .filter(([v]) => v > 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 12)
      .map(([, c]) => c);
  }

  function renderResults() {
    const box = $('#searchResults');
    if (!results.length) {
      box.innerHTML = `<div class="palette-empty">没有匹配的组件</div>`;
      return;
    }
    box.innerHTML = results
      .map(
        (c, i) => `<div class="palette-item${i === sel ? ' sel' : ''}" data-name="${c.name}">
          <span class="p-name">${esc(navLabel(c))}</span>
          <span class="p-en">${esc(c.displayName)}</span>
          <span class="p-cat">${CAT_LABEL[c.category] || c.category}</span>
        </div>`,
      )
      .join('');
    $$('.palette-item', box).forEach((el) =>
      el.addEventListener('click', () => {
        location.hash = `#/c/${el.dataset.name}`;
        closeModal();
      }),
    );
  }

  function openModal() {
    $('#modal').classList.add('open');
    const input = $('#searchInput');
    input.value = '';
    results = search('');
    sel = 0;
    renderResults();
    setTimeout(() => input.focus(), 10);
  }
  function closeModal() {
    $('#modal').classList.remove('open');
  }

  /* ---------------- 主题切换 ---------------- */
  function initTheme() {
    const forced = new URLSearchParams(location.search).get('mode');
    const saved = localStorage.getItem('astryx-doc-theme');
    const dark = forced
      ? forced === 'dark'
      : saved
        ? saved === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(dark ? 'dark' : 'light');
    $('#themeBtn').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('astryx-doc-theme', next);
    });
  }
  function applyTheme(mode) {
    document.documentElement.dataset.theme = mode;
    $('#themeBtn') && ($('#themeBtn').textContent = mode === 'dark' ? '浅色' : '深色');
  }

  /* ---------------- 启动 ---------------- */
  function bindGlobal() {
    $('#searchBtn').addEventListener('click', openModal);

    const langBtn = $('#langBtn');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        const on = document.body.classList.toggle('show-orig');
        langBtn.textContent = on ? '隐藏原文' : '原文对照';
        localStorage.setItem('astryx-doc-orig', on ? '1' : '0');
      });
      if (localStorage.getItem('astryx-doc-orig') === '1') {
        document.body.classList.add('show-orig');
        langBtn.textContent = '隐藏原文';
      }
    }
    $('#modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') closeModal();
    });

    const input = $('#searchInput');
    input.addEventListener('input', () => {
      results = search(input.value);
      sel = 0;
      renderResults();
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        $('#modal').classList.contains('open') ? closeModal() : openModal();
        return;
      }
      if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        openModal();
        return;
      }
      if (!$('#modal').classList.contains('open')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        sel = Math.min(sel + 1, results.length - 1);
        renderResults();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        sel = Math.max(sel - 1, 0);
        renderResults();
      }
      if (e.key === 'Enter' && results[sel]) {
        location.hash = `#/c/${results[sel].name}`;
        closeModal();
      }
    });

    const sideBtn = $('#sidebarBtn');
    sideBtn.addEventListener('click', () => $('#side').classList.toggle('open'));
    $('#main').addEventListener('click', () => $('#side').classList.remove('open'));

    window.addEventListener('hashchange', route);
  }

  async function boot() {
    const res = await fetch('./data.json');
    DATA = await res.json();
    for (const c of DATA.components) byName.set(c.name, c);

    PREVIEWS = await fetch('./previews.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    ZH = await fetch('./zh.json')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));

    if (!DATA.version) {
      const meta = await fetch('./meta.json').then((r) => r.json()).catch(() => null);
      DATA.version = (meta && meta.version) || '0.7.11';
    }
    renderSidebar();
    initTheme();
    bindGlobal();

    const mobile = window.matchMedia('(max-width: 900px)');
    const toggleSideBtn = () => ($('#sidebarBtn').style.display = mobile.matches ? '' : 'none');
    toggleSideBtn();
    mobile.addEventListener('change', toggleSideBtn);

    route();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
