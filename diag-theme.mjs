/**
 * 诊断：挂载预览后，<html> 上的主题属性是否被预览里的 Theme 覆盖。
 */
import { spawnSync } from 'node:child_process';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const page = process.argv[2] || 'http://127.0.0.1:8125/index.html#/c/Button';

const r = spawnSync(
  CHROME,
  ['--headless=new', '--disable-gpu', '--virtual-time-budget=20000', '--dump-dom', page],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

const dom = r.stdout || '';
const htmlTag = (dom.match(/<html[^>]*>/i) || ['(未找到 <html>)'])[0];
console.log('页面:', page);
console.log('<html> 标签:');
console.log('  ' + htmlTag);

const rootTheme = dom.match(/data-astryx-theme="([^"]*)"/g) || [];
console.log('data-astryx-theme 出现次数:', rootTheme.length);
const themeAttr = (dom.match(/data-theme="([^"]*)"/g) || []).slice(0, 5);
console.log('data-theme 出现（前 5）:', themeAttr.join(' '));
