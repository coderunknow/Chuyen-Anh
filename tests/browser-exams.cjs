// Optional real-browser checks for the offline exam archive and its safety gates.
// npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
// node tests/browser-exams.cjs
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
  const screenshotDir = process.env.BROWSER_SCREENSHOT_DIR;
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
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
    const externalRequests = [];
    const localOrigin = `http://127.0.0.1:${server.address().port}`;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith(localOrigin)) externalRequests.push(request.url());
    });
    await page.goto(localOrigin);
    await page.locator('[data-view="exams"]').click();
    await page.locator('#exam-results-count').filter({ hasText: '106 bản chép' }).waitFor();
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'catalogue-desktop.png'), fullPage: true });

    assert.equal(await page.locator('#exam-list .exam-card').count(), 24, 'the catalogue paginates instead of rendering all records at once');
    assert.equal(await page.getByRole('searchbox', { name: 'Tìm địa phương, trường hoặc năm' }).count(), 1);
    for (const name of ['Năm thi', 'Tỉnh/thành', 'Dạng nguồn', 'Đơn vị']) {
      assert.equal(await page.getByRole('combobox', { name }).count(), 1, `${name} filter has an accessible name`);
    }
    assert.equal(await page.getByRole('heading', { name: 'Kho đề Chuyên Anh', level: 1 }).count(), 1);
    assert.match(await page.locator('.exam-warning').innerText(), /chưa có bản nào được cấu trúc và soát riêng theo từng câu/i);
    assert.match(await page.locator('.exam-warning').innerText(), /Audio nghe không được nhúng/i);
    assert.equal(await page.locator('[role="timer"]').count(), 0, 'the unreviewed archive exposes no exam clock');
    assert.equal(await page.locator('.exam-outline').count(), 0, 'raw headings are not promoted into a generated outline');

    await page.locator('#exam-search').fill('vinh long');
    assert.equal(await page.locator('#exam-list .exam-card').count(), 1, 'accent-insensitive search finds Vĩnh Long');
    await page.locator('#exam-year').selectOption('2026');
    await page.locator('#exam-province').selectOption('Vĩnh Long');
    assert.equal(await page.locator('#exam-list .exam-card').count(), 1, 'year and location filters combine');
    await page.locator('#exam-search').fill('');
    await page.locator('#exam-year').selectOption('all');
    await page.locator('#exam-province').selectOption('all');
    await page.locator('#exam-format').selectOption('needs-review');
    assert.equal(await page.locator('#exam-results-count').innerText().then(text => Number(text.match(/^\d+/)[0])), 22, 'the quality filter reports the 22 HTML/OCR records needing review');
    assert.equal(await page.locator('#exam-list .exam-card').count(), 22);
    await page.locator('#exam-format').selectOption('all');
    await page.locator('#exam-search').fill('vinh long');
    await page.locator('[data-exam-open="2026/vinh-long/so"]').click();
    await page.locator('#exam-practice-locked-title').waitFor();

    assert.match(await page.locator('.exam-practice-locked').innerText(), /chưa có bản chép nào được cấu trúc và soát riêng theo từng câu/i);
    assert.match(await page.locator('.exam-practice-locked').innerText(), /không phải thời lượng chính thức/i);
    assert.equal(await page.locator('#exam-start').count(), 0, 'there is no start-attempt button before per-paper review');
    assert.equal(await page.locator('#exam-duration').count(), 0, 'there is no user-selected or implied exam duration');
    assert.equal(await page.locator('input[name="exam-timer-mode"]').count(), 0, 'timed-attempt controls are gated');
    assert.equal(await page.locator('.exam-outline').count(), 0, 'no question/heading outline is offered');
    assert.equal(await page.locator('.exam-document h2, .exam-document h3, .exam-document h4').count() > 0, true, 'the preserved transcription headings remain readable in the source body');
    assert.match(await page.locator('.exam-source-metadata').innerText(), /SHA-256/);
    assert.match(await page.locator('.exam-source-metadata').innerText(), /không được dùng để chấm tự động/);
    const sourceLink = page.locator('.exam-source-metadata a');
    assert.equal(await sourceLink.getAttribute('target'), '_blank');
    assert.match(await sourceLink.getAttribute('rel'), /noopener/);
    assert.equal(await page.locator('.exam-document script, .exam-document img, .exam-document iframe, .exam-document [onerror], .exam-document [onload]').count(), 0, 'raw transcription text cannot introduce executable markup');

    for (const viewport of [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `the transcription fits ${viewport.width}px without horizontal page overflow`);
      assert.equal(await page.locator('#exam-detail-back').isVisible(), true, `the back-to-library control remains visible at ${viewport.width}px`);
      if (screenshotDir && [375, 768, 1440].includes(viewport.width)) {
        await page.screenshot({ path: path.join(screenshotDir, `detail-${viewport.width}.png`), fullPage: true });
      }
    }

    await page.locator('#exam-detail-back').click();
    await page.locator('#exam-results-count').filter({ hasText: '106 bản chép' }).waitFor();
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `the archive catalogue fits ${viewport.width}px without horizontal page overflow`);
      assert.equal(await page.locator('#exam-search').isVisible(), true, `archive search remains visible at ${viewport.width}px`);
      if (screenshotDir && [375, 1440].includes(viewport.width)) {
        await page.screenshot({ path: path.join(screenshotDir, `catalogue-${viewport.width}.png`), fullPage: true });
      }
    }

    assert.deepEqual(externalRequests, [], 'offline catalogue and transcription browsing make no network requests');
    assert.deepEqual(errors, [], 'no browser exceptions');
    console.log(`PASS: Chromium ${browser.version()} — 106-record offline catalogue; accent-insensitive search; year/location/quality filters; source hashes and limitations; raw transcription rendering; no timers, question outlines or grading for unreviewed papers; safe markup; no network requests; 320/375/768/1440px archive and detail layouts; no page errors.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
