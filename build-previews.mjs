/**
 * 构建预览：用 react-dom/server 把每个组件的展示代码渲染成静态 HTML。
 * 产出 previews.json = { 组件名: { showcase: {code, html}, variants: [{prop, value, snippet, html}] } }
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const CLI =
  'C:/Users/Administrator/AppData/Roaming/npm/node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs';
const TMP = path.resolve('.preview-tmp');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

function run(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return (r.stdout || '').replace(/^\uFEFF/, '');
}

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
let seq = 0;

async function renderSource(code, tag) {
  seq += 1;
  const file = path.join(TMP, `m${seq}-${tag}.mjs`);
  const { code: js } = await esbuild.transform(code, {
    loader: 'tsx',
    jsx: 'automatic',
    format: 'esm',
    target: 'node20',
  });
  fs.writeFileSync(file, js, 'utf8');
  const mod = await import(pathToFileURL(file).href);
  const Comp = mod.default;
  if (typeof Comp !== 'function') throw new Error('no default component export');
  return renderToStaticMarkup(React.createElement(Comp));
}

/* ---------- 由 props 表推导「可枚举的参数」 ---------- */
const QUOTED = /'([^']+)'/g;

function enumValues(type) {
  if (!type || !type.includes('|')) return null;
  const vals = [...type.matchAll(QUOTED)].map((m) => m[1]);
  // 只接受「全部是字符串字面量」的联合类型
  const rest = type.replace(/'[^']*'/g, '').replace(/\|/g, '').replace(/\s/g, '');
  if (!vals.length || rest.length) return null;
  return vals;
}

function baseValue(p) {
  const t = p.type || '';
  const vals = enumValues(t);
  if (vals) return { kind: 'lit', v: `'${vals[0]}'` };
  if (/^string$/.test(t)) return { kind: 'lit', v: `'示例'` };
  if (/^number$/.test(t)) return { kind: 'lit', v: '2' };
  if (/^boolean$/.test(t)) return { kind: 'lit', v: 'true' };
  if (/ReactNode/.test(t)) return { kind: 'lit', v: `'内容'` };
  return null; // 复杂类型，放弃自动变体
}

function makeCode(importPath, compName, assignments) {
  const attrs = assignments
    .map(([k, v]) => (/^[A-Za-z_$][\w$]*$/.test(k) ? `${k}={${v}}` : `${k}={${v}}`))
    .join(' ');
  return `import {${compName}} from '${importPath}';\nexport default function P() {\n  return <${compName} ${attrs} />;\n}\n`;
}

const out = {};
let ok = 0;
let fail = 0;

for (const c of data.components) {
  const importPath = c.importPath || `@astryxdesign/core/${c.group}`;
  const rec = { showcase: null, variants: [], note: null };

  /* 1. 官方 showcase（保证是可运行代码） */
  const showcaseRaw = run(['component', c.name, '--showcase'])
    .replace(/^package:.*\n/, '')
    .trim();
  if (showcaseRaw && /export default/.test(showcaseRaw)) {
    try {
      rec.showcase = { code: showcaseRaw, html: await renderSource(showcaseRaw, `sc-${c.name}`) };
    } catch (e) {
      rec.note = `showcase 渲染失败：${String(e.message).slice(0, 120)}`;
    }
  }

  /* 2. 参数效果：只对「必填参数都好构造」的组件生成 */
  const req = c.props.filter((p) => p.required);
  const base = [];
  let constructible = true;
  for (const p of req) {
    // children 无法自动构造，硬塞字符串只会渲染出空控件
    if (p.name === 'children') {
      constructible = false;
      break;
    }
    const b = baseValue(p);
    if (!b) {
      constructible = false;
      break;
    }
    base.push([p.name, b.v]);
  }

  if (constructible && req.length <= 3) {
    const enumProps = c.props.filter((p) => !p.required && enumValues(p.type)).slice(0, 6);
    const hasLabel = c.props.some((p) => p.name === 'label' && /(string|ReactNode)/.test(p.type));
    const labelProp = hasLabel ? c.props.find((p) => p.name === 'label') : null;
    // 这些参数直接决定外观，用它当文案才能一眼看出差别
    const FACET = new Set(['variant', 'color', 'tone', 'status', 'appearance', 'type', 'size']);

    for (const p of enumProps) {
      for (const v of enumValues(p.type).slice(0, 14)) {
        const assignments = [...base, [p.name, `'${v}'`]];
        // 用值当作 label，格子自带说明；label 为必填时替换掉占位值
        if (labelProp && FACET.has(p.name)) {
          const i = assignments.findIndex(([k]) => k === 'label');
          if (i >= 0) assignments[i] = ['label', `'${v}'`];
          else assignments.push(['label', `'${v}'`]);
        }
        const code = makeCode(importPath, c.name, assignments);
        try {
          rec.variants.push({
            prop: p.name,
            value: v,
            html: await renderSource(code, `v-${c.name}-${p.name}-${v}`),
          });
        } catch {
          /* 单个变体失败就跳过 */
        }
      }
    }
  }

  if (rec.showcase || rec.variants.length) ok += 1;
  else fail += 1;
  out[c.name] = rec;
  process.stdout.write(`  ${ok + fail}/${data.components.length} ${c.name}${rec.showcase ? '' : ' (无 showcase)'}\n`);
}

fs.writeFileSync('previews.json', JSON.stringify(out), 'utf8');
console.log(
  `\n完成：${ok} 个组件有预览，${fail} 个没有。previews.json = ${(fs.statSync('previews.json').size / 1024 / 1024).toFixed(2)}MB`,
);
fs.rmSync(TMP, { recursive: true, force: true });
