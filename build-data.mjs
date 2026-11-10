// 从 astryx CLI 抽出文档站数据（不经过 PowerShell 重定向，避免 UTF-16 问题）
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const OUT = 'data.json';
const CHUNK = 40;

const CLI_ENTRY =
  'C:/Users/Administrator/AppData/Roaming/npm/node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs';

function run(args) {
  const r = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    shell: false,
  });
  if (r.error) throw new Error(`spawn failed: ${r.error.message}`);
  const out = (r.stdout || '').replace(/^\uFEFF/, '');
  if (!out.trim()) throw new Error(`empty stdout for ${args.join(' ')}\nstderr: ${r.stderr}`);
  return out;
}

const listRaw = run(['component', '--list', '--json']);
const list = JSON.parse(listRaw);
const groups = list.data.components; // { 分组名: [{name, package}] }
const flat = Object.entries(groups).flatMap(([group, items]) => items.map((i) => ({ ...i, group })));
console.log('list type:', list.type, 'groups:', Object.keys(groups).length, 'components:', flat.length);

const names = flat.map((r) => r.name);
const details = [];
for (let i = 0; i < names.length; i += CHUNK) {
  const chunk = names.slice(i, i + CHUNK);
  const raw = run(['component', ...chunk, '--json']);
  const j = JSON.parse(raw);
  const arr = Array.isArray(j.data) ? j.data : j.data.results || [j.data];
  details.push(
    ...arr.map((x) => {
      const r = x.result ?? x;
      return r && r.data && r.data.name ? r.data : r;
    }),
  );
  if (i === 0) console.log('resultSampleKeys:', Object.keys(arr[0]).join(','), '| inner:', Object.keys(arr[0].result || {}).join(','));
  process.stdout.write(`  fetched ${Math.min(i + CHUNK, names.length)}/${names.length}\n`);
}

console.log('detail count:', details.length);
console.log('detail keys:', Object.keys(details[0]).join(','));

const cut = (s, n) => {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, n) + '\n// … 省略' : t;
};

const slim = details.map((d) => {
  // 复合组件的 props 挂在 components[0] 下，顶层 props 为空
  const c0 = (d.components && d.components[0]) || {};
  const rawProps = d.props && d.props.length ? d.props : c0.props || [];
  const usage = d.usage || c0.usage || {};
  return {
    name: d.name,
    displayName: d.displayName || d.name,
    category: d.category || '其他',
    group: d.group || d.name,
    keywords: d.keywords || [],
    importPath: d.import ? d.import : null,
    description: usage.description || c0.description || '',
    practices: (usage.bestPractices || [])
      .slice(0, 8)
      .map((p) => ({ ok: p.guidance === true, text: p.description })),
    a11y: (usage.accessibility || []).slice(0, 6).map((a) => ({
      name: a.name,
      criterion: a.criterion,
      requirement: a.requirement,
      states: a.states || [],
      description: a.description,
    })),
    anatomy: (d.anatomy || []).map((a) => ({
      element: a.element,
      required: a.required,
      description: a.description,
    })),
    props: rawProps.map((p) => ({
      name: p.name,
      type: p.type,
      required: !!p.required,
      default: p.default ?? null,
      description: p.description || '',
    })),
    examples: ((d.examples || []).slice(0, 3)).map((e) => ({
      label: e.label || '示例',
      code: cut(e.code || '', 3500),
    })),
    theming: {
      targets: ((d.theming && d.theming.targets) || []).map((t) => ({
        className: t.className,
        props: t.visualProps || [],
      })),
      vars: ((d.theming && d.theming.vars) || []).map((v) => ({
        name: v.name,
        description: v.description,
        default: v.default,
        private: !!v.private,
      })),
    },
  };
});

// 分类按规模排序，便于侧边导航
const catCount = {};
for (const c of slim) catCount[c.category] = (catCount[c.category] || 0) + 1;

const payload = {
  generatedAt: new Date().toISOString(),
  package: list.package || '@astryxdesign/core',
  version: (list.meta && list.meta.version) || null,
  categories: catCount,
  components: slim,
};
fs.writeFileSync(OUT, JSON.stringify(payload), 'utf8');
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + 'MB');
console.log('categories:', JSON.stringify(catCount));
