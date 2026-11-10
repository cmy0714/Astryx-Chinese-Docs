/**
 * 用无头 Chrome 检查 live 预览是否真的挂载成功：
 * 统计 data-live 节点数、data-mounted 节点数，并抓取页面脚本错误。
 */
import { spawnSync } from 'node:child_process';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const page = process.argv[2] || 'http://127.0.0.1:8125/index.html#/c/DateInput';

const r = spawnSync(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--virtual-time-budget=20000',
    '--run-all-compositor-stages-before-draw',
    '--dump-dom',
    page,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

const dom = (r.stdout || '') + (r.stderr || '');
if (!dom || dom.length < 200) {
  console.error('未取到 DOM，长度', dom.length);
  process.exit(2);
}

const count = (re) => (dom.match(re) || []).length;
const live = count(/data-live="/g);
const mounted = count(/data-mounted="1"/g);
const astryxRoots = count(/class="[^"]*astryx-/g);

console.log('页面:', page);
console.log('data-live 节点:', live);
console.log('已挂载节点:', mounted);
console.log('含 astryx- 类名的元素:', astryxRoots);

// 交互组件是否真的进入 DOM：日期输入页应出现 combobox 或 calendar 相关结构
if (page.includes('DateInput')) {
  console.log('含 combobox:', /role="combobox"/.test(dom));
}
process.exit(mounted > 0 ? 0 : 1);
