/**
 * 把组件 showcase 与参数变体打包成浏览器可运行的 bundle（live.js），
 * 让文档里的预览真正可交互（日期选择器、下拉、弹窗都能点开）。
 *
 * 输入：data.json（组件元数据）、previews.json（showcase 源码）
 * 输出：live.js（IIFE，暴露 window.AX）
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const previews = JSON.parse(fs.readFileSync('previews.json', 'utf8'));

const SRC = path.resolve('.live-src');
fs.rmSync(SRC, { recursive: true, force: true });
fs.mkdirSync(SRC, { recursive: true });

const QUOTED = /'([^']+)'/g;
const enumValues = (type) => {
  if (!type || !type.includes('|')) return null;
  const vals = [...type.matchAll(QUOTED)].map((m) => m[1]);
  const rest = type.replace(/'[^']*'/g, '').replace(/\|/g, '').replace(/\s/g, '');
  if (!vals.length || rest.length) return null;
  return vals;
};

function baseValue(p) {
  const t = p.type || '';
  const vals = enumValues(t);
  if (vals) return `'${vals[0]}'`;
  if (/^string$/.test(t)) return `'示例'`;
  if (/^number$/.test(t)) return '2';
  if (/^boolean$/.test(t)) return 'true';
  if (/ReactNode/.test(t)) return `'内容'`;
  return null;
}

function makeCode(importPath, compName, assignments) {
  const attrs = assignments.map(([k, v]) => `${k}={${v}}`).join(' ');
  return `import {${compName}} from '${importPath}';\nexport default function P() {\n  return <${compName} ${attrs} />;\n}\n`;
}

const FACET = new Set(['variant', 'color', 'tone', 'status', 'appearance', 'type', 'size']);

const showcaseImports = [];
const variantImports = [];
const showcaseMap = [];
const variantMap = [];
let seq = 0;

for (const c of data.components) {
  const importPath = c.importPath || `@astryxdesign/core/${c.group}`;
  const pv = previews[c.name];

  // showcase
  if (pv && pv.showcase && pv.showcase.code) {
    const file = `s${seq++}.tsx`;
    fs.writeFileSync(path.join(SRC, file), pv.showcase.code, 'utf8');
    const id = `S${seq}`;
    showcaseImports.push(`import ${id} from './${file}';`);
    showcaseMap.push(`  ${JSON.stringify(c.name)}: ${id},`);
  }

  // 参数变体
  const req = c.props.filter((p) => p.required);
  const base = [];
  let ok = true;
  for (const p of req) {
    if (p.name === 'children') {
      ok = false;
      break;
    }
    const b = baseValue(p);
    if (!b) {
      ok = false;
      break;
    }
    base.push([p.name, b]);
  }
  if (!ok || req.length > 3) continue;

  const hasLabel = c.props.some((p) => p.name === 'label' && /(string|ReactNode)/.test(p.type));
  const labelProp = hasLabel ? c.props.find((p) => p.name === 'label') : null;
  const enumProps = c.props.filter((p) => !p.required && enumValues(p.type)).slice(0, 6);

  for (const p of enumProps) {
    for (const v of enumValues(p.type).slice(0, 14)) {
      const assignments = [...base, [p.name, `'${v}'`]];
      if (labelProp && FACET.has(p.name)) {
        const i = assignments.findIndex(([k]) => k === 'label');
        if (i >= 0) assignments[i] = ['label', `'${v}'`];
        else assignments.push(['label', `'${v}'`]);
      }
      const code = makeCode(importPath, c.name, assignments);
      const file = `v${seq++}.tsx`;
      fs.writeFileSync(path.join(SRC, file), code, 'utf8');
      const id = `V${seq}`;
      variantImports.push(`import ${id} from './${file}';`);
      variantMap.push(`  ${JSON.stringify(`${c.name}|${p.name}|${v}`)}: ${id},`);
    }
  }
}

const entry = `import React from 'react';
import {createRoot} from 'react-dom/client';
${showcaseImports.join('\n')}
${variantImports.join('\n')}

const SHOWCASE = {
${showcaseMap.join('\n')}
};
const VARIANTS = {
${variantMap.join('\n')}
};

const roots = new WeakMap();

function mountOne(el, Comp) {
  if (!Comp) return false;
  let root = roots.get(el);
  if (!root) {
    root = createRoot(el);
    roots.set(el, root);
  }
  // 不套 Theme：文档站已在 <html> 上加载了同一套 token CSS，
  // 组件直接用全局 CSS 变量即可；同时避免每个预览根 Theme
  // 把 data-theme / data-astryx-theme 写到 <html> 覆盖文档站主题。
  root.render(React.createElement(Comp));
  return true;
}

window.AX = {
  has: (kind, key) => (kind === 's' ? !!SHOWCASE[key] : !!VARIANTS[key]),
  mount(el, kind, key) {
    return mountOne(el, kind === 's' ? SHOWCASE[key] : VARIANTS[key]);
  },
  mountAll(root = document) {
    let n = 0;
    root.querySelectorAll('[data-live]').forEach((el) => {
      const ok = window.AX.mount(el, el.dataset.live, el.dataset.key);
      if (ok) {
        el.dataset.mounted = '1';
        n += 1;
      }
    });
    return n;
  },
  remountAll() {
    document.querySelectorAll('[data-live]').forEach((el) => {
      window.AX.mount(el, el.dataset.live, el.dataset.key);
    });
  },
};

/* 清掉旧版本遗留的全局主题属性（预览曾经写过 <html>） */
document.documentElement.removeAttribute('data-astryx-theme');
`;

fs.writeFileSync(path.join(SRC, 'entry.tsx'), entry, 'utf8');

const result = await esbuild.build({
  entryPoints: [path.join(SRC, 'entry.tsx')],
  bundle: true,
  format: 'iife',
  outfile: 'live.js',
  jsx: 'automatic',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  logLevel: 'error',
  absWorkingDir: process.cwd(),
});

const size = fs.statSync('live.js').size;
console.log('showcase 组件:', showcaseMap.length, '变体组件:', variantMap.length);
console.log('live.js:', (size / 1024 / 1024).toFixed(2) + 'MB');
console.log('esbuild warnings:', result.warnings.length);
fs.rmSync(SRC, { recursive: true, force: true });
