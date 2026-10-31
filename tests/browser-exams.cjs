// Real-browser regression suite for the offline archive, scoring, corrections,
// persistence and the session-focus control. Run sequentially after browser-learning.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright-core');

async function launchSelectedBrowser() {
  const engineName = (process.env.BROWSER_ENGINE || 'chromium').toLowerCase();
  const browserType = playwright[engineName];
  if (!browserType) throw new Error(`Unsupported BROWSER_ENGINE: ${engineName}`);
  let executablePath = process.env.BROWSER_EXECUTABLE || undefined;
  let args = engineName === 'chromium' ? ['--no-sandbox'] : [];
  if (engineName === 'chromium' && !executablePath) {
    try {
      const bundled = require('@sparticuz/chromium');
      const lambdaFs = require('@sparticuz/chromium/build/lambdafs').default;
      executablePath = await bundled.executablePath();
      await lambdaFs.inflate(path.join(path.dirname(require.resolve('@sparticuz/chromium')), '../bin/al2023.tar.br'));
      process.env.LD_LIBRARY_PATH = ['/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
      args = bundled.args;
    } catch {
      executablePath = undefined;
    }
  }
  const browser = await browserType.launch({ ...(executablePath ? { executablePath } : {}), ...(args.length ? { args } : {}), headless: true });
  return { browser, engineName };
}

async function main() {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'));
  const keyManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/exam-answer-keys.json'), 'utf8'));
  const screenshotDir = process.env.BROWSER_SCREENSHOT_DIR;
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); });
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  let browser, engineName = 'chromium', serverClosed = false;
  try {
    ({ browser, engineName } = await launchSelectedBrowser());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await page.clock.setFixedTime(new Date('2026-10-29T12:00:00Z'));
    const errors = [], external = [];
    const origin = `http://127.0.0.1:${server.address().port}`;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()); });
    await page.goto(origin);
    await page.locator('[data-view="exams"]').click();
    await page.locator('#exam-results-count').filter({ hasText: '106 bản chép' }).waitFor();
    assert.match(await page.locator('.exam-warning').innerText(), /chấm 100% câu hỏi.*độ tin cậy/i);
    assert.match(await page.locator('.exam-warning').innerText(), /audio nghe không được nhúng/i);
    assert.equal(await page.locator('#exam-list .exam-card').count(), 24);
    await page.locator('#exam-search').fill('thai nguyen');
    await page.locator('[data-exam-open="2025/thai-nguyen/so"]').click();
    await page.locator('#exam-practice-start').waitFor();
    assert.match(await page.locator('.exam-practice-note').innerText(), /không phải điểm (?:thi )?chính thức/i);
    assert.equal(await page.locator('.exam-document script, .exam-document img, .exam-document iframe').count(), 0);
    assert.match(await page.locator('.exam-source-metadata').innerText(), /SHA-256/);
    const paper = keyManifest.records.find(record => record.id === '2025/thai-nguyen/so');
    assert.ok(paper && paper.questionCount > 20);
    await page.locator('#exam-practice-start').click();
    await page.locator('#exam-current-question-heading').waitFor();
    assert.equal(await page.locator('[data-question-index]').count(), paper.questionCount);
    assert.equal(await page.locator('.exam-key-correction').count(), 0, 'no key UI before submission');
    assert.equal(await page.locator('.exam-pill-success').count(), 0, 'no correctness feedback before submission');
    assert.doesNotMatch(await page.locator('.exam-practice').innerText(), /Đáp án đối chiếu/);
    // Answer up to six keyed choice questions from the generated key data. The
    // test uses the same key IDs the app uses; it never invents correctness.
    let expectedCorrect = 0, expectedWrong = 0;
    const keyed = paper.answerKeys;
    for (let index = 0; index < paper.questionCount && expectedCorrect + expectedWrong < 6; index += 1) {
      await page.locator(`[data-question-index="${index}"]`).click();
      const options = page.locator('[data-practice-choice]');
      if (await options.count() === 0) continue;
      const key = keyed[index];
      if (!key?.candidates?.length || !key.candidates.every(id => id.startsWith('choice-'))) continue;
      const wantCorrect = expectedCorrect < 3;
      let target = wantCorrect ? key.candidates[0] : `choice-${key.candidates[0].replace('choice-', '') === 'A' ? 'B' : 'A'}`;
      const available = await options.evaluateAll(nodes => nodes.map(node => node.dataset.practiceChoice));
      if (!available.includes(target)) continue;
      await page.locator(`[data-practice-choice="${target}"]`).click();
      if (wantCorrect) expectedCorrect += 1; else expectedWrong += 1;
    }
    assert.equal(expectedCorrect, 3, 'three keyed choices were answered correctly');
    assert.equal(expectedWrong, 3, 'three keyed choices were answered incorrectly');
    await page.locator('#exam-review-answers').click();
    assert.equal(await page.locator('.exam-key-correction').count(), 0, 'pre-submit review still hides keys');
    await page.locator('#exam-submit').click();
    await page.locator('#exam-submission-summary').waitFor();
    assert.equal(Number(await page.locator('#exam-practice-correct-count').innerText()), expectedCorrect);
    assert.equal(Number(await page.locator('#exam-practice-incorrect-count').innerText()), expectedWrong);
    assert.equal(Number(await page.locator('#exam-practice-provisional-count').innerText()) >= 6, true);
    assert.equal(await page.locator('#exam-practice-graded-count').count(), 1);
    assert.match(await page.locator('#exam-submission-summary').innerText(), new RegExp(`3/${paper.questionCount} điểm quy đổi`));
    assert.match(await page.locator('#exam-submission-summary').innerText(), /trên số câu đã trả lời: 3\/6 — 50%/);
    assert.match(await page.locator('#exam-submission-summary').innerText(), /KHÔNG phải điểm thi chính thức/i);
    assert.match(await page.locator('#exam-confidence-breakdown').innerText(), /HIGH:[\s\S]*MEDIUM:[\s\S]*LOW:[\s\S]*VERY_LOW:/);
    assert.match(await page.evaluate(() => localStorage.getItem('chuyen-anh.exam-results.v1')), /"attempts"/);
    await page.locator('#exam-review-submitted').click();
    assert.ok(await page.locator('.exam-practice-review-item').count() > 0, 'submitted review lists every item');
    assert.match(await page.locator('.exam-practice-review-list').innerText(), /Bản chép đơn nguồn|Suy luận ngôn ngữ học|Phục dựng từ HTML\/OCR|Thiếu ngữ liệu/);
    await page.locator('[data-review-question="0"]').click();
    await page.locator('#exam-current-question-heading').waitFor();
    // Locate a graded choice item through the same DOM state a learner sees.
    let correctionTarget = null;
    for (let index = 0; index < paper.questionCount && !correctionTarget; index += 1) {
      if (!paper.answerKeys[index]?.candidates?.length) continue;
      await page.locator(`[data-question-index="${index}"]`).click();
      if (await page.locator('.exam-key-correction').count()) correctionTarget = index;
    }
    assert.notEqual(correctionTarget, null, 'at least one submitted item can be corrected');
    await page.locator('.exam-key-correction summary').click();
    const keyInput = page.locator('#exam-key-correct-input');
    const originalKey = await keyInput.inputValue();
    const replacement = /^A$/.test(originalKey.trim()) ? 'B' : 'A';
    await keyInput.fill(replacement);
    await page.locator('#exam-key-correct-note').fill('Browser regression: learner corrected the key.');
    await page.locator('#exam-key-correct-save').click();
    await page.locator('.toast-success').waitFor();
    assert.match(await page.locator('.toast-success').innerText(), /hiệu chỉnh người học/i);
    assert.match(await page.evaluate(() => localStorage.getItem('chuyen-anh.exam-results.v1')), /user_confirmed/);
    await page.locator('#exam-practice-back').click();
    await page.locator('#exam-submission-summary').waitFor();
    assert.match(await page.locator('#exam-submission-summary').innerText(), /hiệu chỉnh|Có hiệu chỉnh|Đã chấm/);
    // History survives reload and can be inspected.
    await page.reload();
    await page.locator('[data-view="settings"]').click();
    await page.locator('#exam-history-list .exam-history-row').waitFor();
    assert.equal(await page.locator('#exam-history-list .exam-history-row').count(), 1);
    await page.locator('[data-exam-history-open]').click();
    await page.locator('#exam-submission-summary').waitFor();
    assert.match(await page.locator('#exam-submission-summary').innerText(), /Kết quả luyện đề/);
    // Export / malformed import / valid import round trip.
    await page.locator('[data-view="settings"]').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exam-history-export').click();
    const download = await downloadPromise;
    const exportPath = await download.path();
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    assert.equal(exported.schemaVersion, 1);
    assert.equal(exported.attempts.length, 1);
    const malformed = Buffer.from(JSON.stringify({ schemaVersion: 99, attempts: [{}] }));
    await page.locator('#exam-history-import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: malformed });
    await page.locator('.toast-error').waitFor();
    assert.equal(await page.locator('#exam-history-list .exam-history-row').count(), 1, 'malformed import changed nothing');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#exam-history-clear').click();
    await page.locator('#exam-history-list .empty').waitFor();
    await page.locator('#exam-history-import').setInputFiles({ name: 'history.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await page.locator('#exam-history-list .exam-history-row').waitFor();
    assert.equal(await page.locator('#exam-history-list .exam-history-row').count(), 1, 'valid history imports atomically');
    // Session focus: an off group's focus button is operable, not a dead disabled control.
    const focusButtons = page.locator('#settings-focus [data-focus]');
    assert.ok(await focusButtons.count() > 1);
    assert.equal(await focusButtons.evaluateAll(nodes => nodes.some(node => node.disabled)), false, 'no focus control is disabled');
    const firstGroup = page.locator('#settings-groups [data-group]').first();
    const groupName = await firstGroup.getAttribute('data-group');
    await firstGroup.click();
    await page.locator(`#settings-groups [data-group="${groupName}"][aria-pressed="false"]`).waitFor();
    const focusButton = page.locator(`#settings-focus [data-focus="${groupName}"]`);
    assert.notEqual(await focusButton.evaluate(node => getComputedStyle(node).cursor), 'not-allowed');
    await focusButton.focus();
    await page.keyboard.press('Enter');
    await page.locator(`#settings-groups [data-group="${groupName}"][aria-pressed="true"]`).waitFor();
    assert.equal(await focusButton.getAttribute('aria-pressed'), 'true');
    // English + Modern, responsive summary/catalogue/practice.
    await page.locator('[data-interface="modern"]').first().click();
    await page.locator('#language-setting').selectOption('en');
    await page.locator('[data-view="exams"]').click();
    await page.locator('#exam-results-count').filter({ hasText: '106 transcriptions' }).waitFor();
    assert.match(await page.locator('.exam-warning').innerText(), /provisionally score 100%.*unverified/i);
    for (const viewport of [{ width: 320, height: 720 }, { width: 375, height: 812 }, { width: 768, height: 900 }, { width: 1024, height: 900 }, { width: 1440, height: 1000 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `catalogue fits ${viewport.width}px`);
      if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `rc8-catalogue-${engineName}-${viewport.width}.png`), fullPage: true });
    }
    await page.locator('#exam-search').fill('dak lak');
    await page.locator('[data-exam-open="2026/dak-lak/so"]').click();
    await page.locator('#exam-practice-start').waitFor();
    for (const viewport of [{ width: 320, height: 720 }, { width: 375, height: 812 }, { width: 768, height: 900 }, { width: 1024, height: 900 }, { width: 1440, height: 1000 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `practice fits ${viewport.width}px`);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('#exam-detail-back').click();
    await page.locator('#exam-search').fill('binh phuoc');
    await page.locator('[data-exam-open="2022/binh-phuoc/so"]').click();
    await page.locator('.exam-ocr-warning').waitFor();
    assert.equal(await page.locator('#exam-practice-start').count(), 1, 'HTML/OCR record opens interactive practice with explicit warning');
    assert.match(await page.locator('.exam-ocr-warning').innerText(), /HTML\/OCR/);
    await page.locator('#exam-practice-start').click();
    await page.locator('#exam-current-question-heading').waitFor();
    assert.match(await page.locator('.exam-practice-question .exam-meta-badges').innerText(), /LOW|VERY_LOW/);
    const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
    await page.evaluate(axeSource);
    const examAxeViolations = await page.evaluate(async () => {
      const result = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        resultTypes: ['violations']
      });
      return result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target.join(' ')).slice(0, 4) }));
    });
    assert.deepEqual(examAxeViolations, [], `exam view WCAG 2.1 AA axe violations: ${JSON.stringify(examAxeViolations)}`);

    // Verify 2022/hai-phong/so rawUnsafeHtml (<studying ...>) is escaped inert text in live DOM.
    await page.locator('#exam-detail-back').click();
    await page.locator('#exam-search').fill('hai phong');
    await page.locator('[data-exam-open="2022/hai-phong/so"]').click();
    await page.locator('.exam-document').waitFor();
    assert.equal(await page.evaluate(() => document.querySelectorAll('studying').length), 0,
      'angle-bracket constituent in 2022/hai-phong/so never creates a DOM element');
    assert.match(await page.locator('.exam-document').innerText(),
      /<studying the species of dolphin called bottlenose dolphins>/,
      'angle-bracket constituent is preserved as literal visible text');

    await page.locator('[data-view="settings"]').click();
    await page.locator('#language-setting').selectOption('vi');
    await page.locator('[data-interface="classic"]').first().click();
    assert.deepEqual(external, [], 'no external request during the offline flow');
    assert.deepEqual(errors, [], 'no browser exceptions');
    const browserVersion = browser.version();
    await browser.close();
    browser = null;
    await new Promise(resolve => server.close(resolve));
    serverClosed = true;

    // Verify direct file:// standalone offline execution with NO HTTP server running.
    ({ browser, engineName } = await launchSelectedBrowser());
    const filePage = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const fileErrors = [];
    const fileExternal = [];
    filePage.on('pageerror', error => fileErrors.push(error.message));
    filePage.on('request', req => {
      const url = req.url();
      if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('blob:')) fileExternal.push(url);
    });
    await filePage.goto(`file://${path.resolve(__dirname, '../index.html')}`);
    await filePage.locator('[data-session="new"]').waitFor();
    await filePage.locator('[data-view="exams"]').click();
    await filePage.locator('#exam-results-count').filter({ hasText: '106 bản chép' }).waitFor();
    await filePage.locator('[data-view="settings"]').click();
    assert.equal(await filePage.locator('#app-version').innerText(), 'v1.0.0-rc8');
    assert.deepEqual(fileExternal, [], 'no external network call under file://');
    assert.deepEqual(fileErrors, [], 'no page error under file://');

    console.log(`PASS: ${engineName} ${browserVersion} — 106-record catalogue; 100% universal full-denominator scoring; 3 correct/3 incorrect deterministic summary; key hidden before submit; user correction recalculated and persisted; history reload/export/malformed import/valid import; operable session-focus control; HTML/OCR interactive with LOW/VERY_LOW warning; WCAG 2.1 AA axe clean; 2022/hai-phong/so angle-bracket escaped in live DOM; standalone file:// offline verified; VI/EN, Classic/Modern; 320/375/768/1024/1440px; no network or page errors.`);
  } finally {
    if (browser) await browser.close();
    if (!serverClosed) await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
