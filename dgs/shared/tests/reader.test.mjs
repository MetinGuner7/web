import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const repo = path.resolve(process.argv[2] || path.join(import.meta.dirname, '../../..'));
const output = path.resolve(process.argv[3] || path.join(import.meta.dirname, 'output'));
mkdirSync(output, { recursive: true });
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const lessons = walk(path.join(repo, 'dgs')).filter(f => f.endsWith('.html') && readFileSync(f, 'utf8').includes('shared/reader.css'));
assert.equal(lessons.length, 62);
for (const file of lessons) {
  const relative = path.relative(repo, file).replaceAll('\\', '/');
  const original = execFileSync('git', ['show', `origin/main:${relative}`], { cwd: repo, encoding: 'utf8' });
  const current = readFileSync(file, 'utf8');
  const body = html => html.slice(html.indexOf('<body>')).replaceAll('\r\n', '\n');
  assert.equal(body(current), body(original), `${relative}: content changed`);
  assert(!current.includes('user-scalable=no'));
}
console.log('PASS: 62 lesson HTML bodies byte-identical to origin/main (line endings normalized).');

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  let file = path.resolve(repo, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(repo + path.sep)) { res.writeHead(403).end(); return; }
  if (!path.extname(file)) file = path.join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const cache = new Map();
let cases = 0;
try {
  for (const variant of [
    { name: 'phone-light', width: 390, height: 844, theme: 'light', system: 'light' },
    { name: 'phone-dark', width: 390, height: 844, theme: 'dark', system: 'light' },
    { name: 'narrow-light-system-dark', width: 320, height: 740, theme: 'light', system: 'dark' },
    { name: 'tablet-landscape', width: 1180, height: 820, theme: 'light', system: 'light' }
  ]) {
    const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height }, colorScheme: variant.system });
    // Cache external KaTeX resources across all test cases; use the exact pinned CDN files.
    await context.route('https://cdn.jsdelivr.net/**', async route => {
      const url = route.request().url();
      if (!cache.has(url)) cache.set(url, (async () => {
        const response = await context.request.get(url);
        assert(response.ok(), `CDN ${response.status()}: ${url}`);
        return { body: await response.body(), contentType: response.headers()['content-type'] };
      })());
      await route.fulfill(await cache.get(url));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const file of lessons) {
      const relative = path.relative(repo, file).replaceAll('\\', '/');
      await page.goto(`${base}/${relative}?theme=${variant.theme}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('[data-reader-generated],script').forEach(e => e.remove());
        // KaTeX replaces TeX text with accessible MathML + visual HTML. Restore
        // its original TeX annotation before checking presentation-only changes.
        clone.querySelectorAll('.katex-display').forEach(e => {
          e.replaceWith(document.createTextNode('$$' + e.querySelector('annotation').textContent + '$$'));
        });
        clone.querySelectorAll('.katex').forEach(e => {
          e.replaceWith(document.createTextNode('$' + e.querySelector('annotation').textContent + '$'));
        });
        const normalize = s => s.replace(/\s+/g, ' ').trim();
        const headings = [...document.querySelectorAll('.content-section > h2')];
        const body = getComputedStyle(document.body);
        return {
          text: normalize(clone.textContent),
          reader: document.body.classList.contains('lesson-reader'),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          background: body.backgroundColor,
          inter: document.fonts.check('16px "DGS Inter"'),
          font: body.fontFamily,
          sections: headings.length,
          wrappers: document.querySelectorAll('.reader-section-body').length,
          numbering: headings.every((h, i) => h.querySelector('.reader-section-index')?.textContent === String(i + 1).padStart(2, '0')),
          katexErrors: document.querySelectorAll('.katex-error').length,
          formulas: document.querySelectorAll('.katex').length,
          rawMath: !!document.querySelector('script[src*="katex.min.js"]'),
          controls: document.querySelectorAll('[role="tab"], .pills, .segmented-control').length
        };
      });
      const originalText = await page.evaluate(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script').forEach(e => e.remove());
        return doc.body.textContent.replace(/\s+/g, ' ').trim();
      }, readFileSync(file, 'utf8'));
      assert.equal(result.text, originalText, `${relative} DOM text changed`);
      assert(result.reader && result.inter && result.font.includes('DGS Inter'), `${relative} reader/font missing`);
      assert.equal(result.background, variant.theme === 'dark' ? 'rgb(16, 26, 40)' : 'rgb(247, 248, 250)');
      if (result.overflow) {
        await page.screenshot({ path: path.join(output, 'overflow.png'), fullPage: true });
        console.log(await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          elements: [...document.querySelectorAll('body *')]
            .filter(e => e.namespaceURI === 'http://www.w3.org/1999/xhtml' && e.scrollWidth > e.clientWidth + 1 && !e.closest('.katex'))
            .map(e => [e.tagName, e.className, e.clientWidth, e.scrollWidth, getComputedStyle(e).overflowX]),
          rects: [...document.querySelectorAll('body *')]
            .filter(e => e.namespaceURI === 'http://www.w3.org/1999/xhtml' && e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.katex'))
            .map(e => [e.tagName, e.className, e.getBoundingClientRect().right])
        })));
      }
      assert(!result.overflow, `${variant.name}: ${relative} page overflow`);
      assert.equal(result.sections, result.wrappers);
      assert(result.numbering);
      assert.equal(result.controls, 0);
      assert.equal(result.katexErrors, 0, `${relative}: math parse errors`);
      if (result.rawMath) assert(result.formulas > 0, `${relative}: KaTeX not rendered`);
      const details = page.locator('details.solution-toggle').first();
      if (await details.count()) {
        await details.locator('summary').click();
        assert(await details.evaluate(e => e.open));
        await details.locator('summary').click();
        assert(!(await details.evaluate(e => e.open)));
      }
      assert.equal(errors.length, 0, errors.join('\n'));
      cases++;
      if (['dgs/matematik/rasyonel-sayilar/index.html', 'dgs/turkce/paragraf/index.html', 'dgs/geometri/ucgenler/index.html'].includes(relative)) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `${relative.split('/')[2]}-${variant.name}.png`) });
      }
    }
    console.log(`PASS: ${variant.name}, 62 pages; content, font, theme, width, solutions, math.`);
    await context.close();
  }
  // System theme fallback and a large-text stress test.
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto(`${base}/dgs/turkce/paragraf/`);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(16, 26, 40)');
  await page.addStyleTag({ content: '.lesson-reader p, .lesson-reader .card-desc, .lesson-reader .summary-item { font-size: 24px !important; }' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await context.close();
  console.log(`PASS: ${cases} rendered lesson cases + system-theme and 150% body-text checks.`);
} finally {
  await browser.close();
  server.close();
}
