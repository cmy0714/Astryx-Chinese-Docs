/**
 * 中文覆盖度报告：按组件列出 描述 / 使用建议 / API 说明 的完成情况与缺口。
 * 用法：node zh-status.mjs [--todo]   --todo 只列未完成的组件
 */
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const zh = JSON.parse(fs.readFileSync('zh.json', 'utf8'));
const onlyTodo = process.argv.includes('--todo');

let dDone = 0, pDone = 0, apiDone = 0;
let pTotal = 0, apiTotal = 0;
const rows = [];

for (const c of data.components) {
  const z = zh[c.name] || {};
  const hasD = !!z.desc;
  const ps = z.practices || [];
  const pr = z.props || {};
  const pHave = c.practices.filter((_, i) => ps[i]).length;
  const apiHave = c.props.filter((p) => pr[p.name]).length;

  if (hasD) dDone += 1;
  pDone += pHave;
  pTotal += c.practices.length;
  apiDone += apiHave;
  apiTotal += c.props.length;

  const complete = hasD && pHave === c.practices.length && apiHave === c.props.length;
  if (!onlyTodo || !complete) {
    rows.push({
      name: c.name,
      desc: hasD ? '✓' : '—',
      prac: `${pHave}/${c.practices.length}`,
      api: `${apiHave}/${c.props.length}`,
      complete,
    });
  }
}

if (onlyTodo) {
  const todo = rows.filter((r) => !r.complete);
  console.log(`未完成组件 ${todo.length} 个（共 ${data.components.length}）：`);
  console.log(todo.map((r) => `${r.name}(desc ${r.desc} prac ${r.prac} api ${r.api})`).join('\n'));
} else {
  console.log('组件          desc  practices  api');
  for (const r of rows) {
    console.log(`${r.name.padEnd(26)} ${r.desc.padEnd(4)} ${r.prac.padEnd(10)} ${r.api}`);
  }
}

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '100.0');
console.log(
  `\n覆盖度：描述 ${dDone}/${data.components.length}（${pct(dDone, data.components.length)}%）· ` +
    `使用建议 ${pDone}/${pTotal}（${pct(pDone, pTotal)}%）· ` +
    `API 说明 ${apiDone}/${apiTotal}（${pct(apiDone, apiTotal)}%）`,
);
