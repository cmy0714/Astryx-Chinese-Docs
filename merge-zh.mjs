/**
 * 把 zh-batch-*.json 合并进 zh.json（深合并，后写的覆盖先写的）。
 * 批次文件结构：{ "Button": { "desc": "...", "practices": ["...", "..."], "props": { "label": "..." } } }
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = '.';
const TARGET = path.join(DIR, 'zh.json');

const zh = fs.existsSync(TARGET) ? JSON.parse(fs.readFileSync(TARGET, 'utf8')) : {};
const batches = fs
  .readdirSync(DIR)
  .filter((f) => /^zh-batch-\d+\.json$/.test(f))
  .sort();

let added = 0;
for (const f of batches) {
  const batch = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  for (const [name, entry] of Object.entries(batch)) {
    zh[name] = zh[name] || {};
    if (entry.name) zh[name].name = entry.name;
    if (entry.desc) zh[name].desc = entry.desc;
    if (entry.practices) zh[name].practices = entry.practices;
    if (entry.props) zh[name].props = { ...(zh[name].props || {}), ...entry.props };
    added += 1;
  }
}

fs.writeFileSync(TARGET, JSON.stringify(zh, null, 2), 'utf8');
console.log(`合并 ${batches.length} 个批次，${Object.keys(zh).length} 个组件有中文条目`);
