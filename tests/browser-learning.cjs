// Optional real-browser regression suite. No production or CI dependency is added.
// npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
// node tests/browser-learning.cjs
// Alternatively provide BROWSER_EXECUTABLE with playwright-core installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

async function main() {
  let executablePath = process.env.BROWSER_EXECUTABLE;
  let args = ['--no-sandbox'];
  if (!executablePath) {
    const bundled = require('@sparticuz/chromium');
    const lambdaFs = require('@sparticuz/chromium/build/lambdafs').default;
    executablePath = await bundled.executablePath();
    // This minimal Linux sandbox lacks NSS; the optional package includes it.
    await lambdaFs.inflate(path.join(path.dirname(require.resolve('@sparticuz/chromium')), '../bin/al2023.tar.br'));
    process.env.LD_LIBRARY_PATH = ['/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
    args = bundled.args;
  }
  const html = fs.readFileSync(path.join(__dirname, '../index.html'));
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath, args, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-session="new"]').waitFor();
    assert.match(await page.locator('[data-session="due"]').innerText(), /0 từ/);

    const key = name => `chuyen-anh.${name}.v1`;
    const read = name => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key(name));
    async function seed(ids) {
      await page.evaluate(ids => {
        localStorage.clear();
        localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(ids));
        localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, keyboardShortcuts: true, darkMode: false }));
      }, ids);
      await page.reload();
      await page.locator('[data-session="favorites"]').click();
    }
    async function next() {
      assert.equal(await page.evaluate(() => document.activeElement.id), 'next-card');
      await page.keyboard.press('Enter');
    }
    async function answer(id, correct) {
      await page.locator(correct ? `[data-option="${id}"]` : `[data-option]:not([data-option="${id}"])`).first().click();
    }
    async function typeAnswer(value) {
      await page.locator('#spelling-input').fill(value);
      await page.locator('#spelling-input').press('Enter');
    }
    async function history(expected) {
      const entries = await read('history');
      assert.equal(entries.length, 1);
      for (const [field, value] of Object.entries(expected)) assert.equal(entries[0][field], value, field);
    }

    // Error -> intervening word -> typed corrective retrieval -> truthful summary.
    await seed(['1', '2']);
    await answer('1', false);
    const failedProgress = (await read('progress'))['1'];
    assert.equal(failedProgress.state, 'weak');
    assert.match(await page.locator('#feedback-area').innerText(), /Đã xếp một lượt gõ lại/);
    await next();
    assert.equal(await page.locator('.prompt').innerText(), 'Meticulous');
    await answer('2', true);
    await next();
    assert.match(await page.locator('.mode-label').innerText(), /Luyện lại.*Chính tả/i);
    assert.equal(await page.locator('[role="progressbar"]').getAttribute('aria-valuenow'), '67');

    // Native Space on a focused favorite button must not reveal the answer.
    await page.locator('#favorite-card').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.reveal').count(), 0);
    await page.locator('#favorite-card').click(); // Restore favorite.
    await page.locator('#theme-button').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.prompt').evaluate(el => getComputedStyle(el).color), 'rgb(228, 240, 237)');
    if (process.env.BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.BROWSER_SCREENSHOT, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('#spelling-input').isVisible(), true);
    await typeAnswer('Adversity');
    assert.deepEqual((await read('progress'))['1'], failedProgress);
    await next();
    assert.match(await page.locator('.summary').innerText(), /50%/);
    assert.match(await page.locator('.summary').innerText(), /Luyện lại: 1 đúng · 0 chưa đúng \/ 1 lượt/);
    await history({ total: 2, correct: 1, wrong: 1, accuracy: 50 });
    await page.locator('#summary-dashboard').click();
    assert.match(await page.locator('.history').innerText(), /50%/);
    await page.reload();
    assert.deepEqual((await read('progress'))['1'], failedProgress);
    assert.equal((await read('prefs')).darkMode, true);
    assert.deepEqual((await read('favorites')).sort(), ['1', '2']);
    assert.match(await page.locator('[data-session="due"]').innerText(), /1 từ/);

    // Export and valid/invalid import preserve the post-session backup.
    await page.locator('[data-view="settings"]').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-setting').click();
    const download = await downloadPromise;
    const backup = fs.readFileSync(await download.path());
    await page.locator('#import-setting').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    await page.locator('.toast').filter({ hasText: 'Đã nhập' }).waitFor();
    const beforeBadImport = await page.evaluate(() => ({ ...localStorage }));
    await page.locator('#import-setting').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"wrong"}') });
    await page.locator('.toast').filter({ hasText: 'Import thất bại' }).waitFor();
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), beforeBadImport);

    // Last-card failure gets exactly one retry; another failure cannot loop.
    await seed(['1']);
    await answer('1', false);
    const lastFailed = (await read('progress'))['1'];
    await page.keyboard.press('r'); // Already auto-queued: no duplicate.
    await typeAnswer('wrong');
    assert.deepEqual((await read('progress'))['1'], lastFailed);
    await next();
    assert.match(await page.locator('.summary').innerText(), /Luyện lại: 0 đúng · 1 chưa đúng \/ 1 lượt/);
    await history({ total: 1, correct: 0, wrong: 1, accuracy: 0 });

    // An all-correct session ends without adding practice.
    await seed(['1']);
    await answer('1', true);
    await next();
    assert.doesNotMatch(await page.locator('.summary').innerText(), /Luyện lại:/);
    await history({ total: 1, correct: 1, wrong: 0, accuracy: 100 });

    // Optional R after a correct answer also stays practice-only.
    await seed(['1']);
    await answer('1', true);
    const correctProgress = (await read('progress'))['1'];
    await page.keyboard.press('r');
    await typeAnswer('wrong');
    assert.deepEqual((await read('progress'))['1'], correctProgress);
    await next();
    await history({ total: 1, correct: 1, wrong: 0, accuracy: 100 });

    // Multiple errors retain order; skipping practice does not add work.
    await seed(['1', '2']);
    await answer('1', false);
    await next();
    await answer('2', false);
    await next();
    await page.locator('#skip-card').click();
    assert.match(await page.locator('.prompt').innerText(), /tỉ mỉ/);
    await typeAnswer('Meticulous');
    await next();
    await typeAnswer('Adversity');
    await next();
    assert.match(await page.locator('.summary').innerText(), /Luyện lại: 2 đúng · 0 chưa đúng \/ 2 lượt/);
    await history({ total: 2, correct: 0, wrong: 2, accuracy: 0 });
    assert.deepEqual(errors, []);
    console.log(`PASS: Chromium ${browser.version()} — corrective retrieval, bounded retries, R, skips, first-pass history, persistence, import/export, keyboard focus, light/dark, mobile layout, reduced-motion setting; no page errors.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
