// Reproduce the reported CEFR leakage in the real UI, before touching any code.
// Sets the persisted filter (the same store the chips write) and then reads:
//   * the numbers the study home promises (new / due / weak),
//   * the words a New-words session actually serves,
//   * the dashboard's due/weak figures.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('/home/user/Chuyen-Anh/node_modules/playwright-core');

async function launch() {
  const bundled = require('/home/user/Chuyen-Anh/node_modules/@sparticuz/chromium');
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const executablePath = await bundled.executablePath();
  return playwright.chromium.launch({ executablePath, args: bundled.args, headless: true });
}

const selection = JSON.parse(process.argv[2] || '{"version":1,"levels":["C1"],"unclassified":false}');
const sessionType = process.argv[3] || 'new';

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '../../../index.html'));
  const server = http.createServer((_q, r) => { r.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); r.end(html); });
  await new Promise(res => server.listen(0, '0.0.0.0', res));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00Z'));
  await page.goto(origin);
  await page.evaluate(sel => {
    localStorage.clear();
    localStorage.setItem('chuyen-anh.cefr.v1', JSON.stringify(sel));
  }, selection);
  await page.reload();
  await page.locator('[data-session="new"]').waitFor();

  const levelOf = async () => page.evaluate(() => {
    const vocab = JSON.parse(document.getElementById('vocabulary-data').textContent);
    window.__levelById = new Map(vocab.map(v => [v.id, (v.tags.find(t => /^level:/.test(t)) || 'level:NONE')]));
    window.__levelByWord = new Map(vocab.map(v => [v.word.toLowerCase(), (v.tags.find(t => /^level:/.test(t)) || 'level:NONE')]));
  });
  await levelOf();

  const cards = await page.evaluate(() => [...document.querySelectorAll('[data-session], .session-card')]
    .map(b => b.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean));
  const dash = await page.evaluate(() => {
    const t = document.getElementById('app').innerText;
    const m = t.match(/Từ đến hạn ôn\n?(\d+)/) || t.match(/(\d+)\nTừ đến hạn/);
    return { dueMetric: m ? m[1] : null };
  });
  console.log('SELECTION', JSON.stringify(selection));
  console.log('CARDS', JSON.stringify(cards));
  console.log('DASHBOARD_DUE', JSON.stringify(dash));
  const pool = await page.evaluate(sel => {
    // The same predicate the app uses, evaluated on the real dataset.
    const vocab = JSON.parse(document.getElementById('vocabulary-data').textContent);
    const levels = new Set((sel.levels || []).map(l => l.toUpperCase()));
    const inPool = v => {
      const t = v.tags.find(x => /^level:/.test(x));
      const lvl = t ? t.slice(6).toUpperCase() : 'UNCLASSIFIED';
      return lvl === 'UNCLASSIFIED' ? sel.unclassified === true : levels.has(lvl);
    };
    return { eligible: vocab.filter(inPool).length, total: vocab.length };
  }, selection);
  console.log('EXPECTED_POOL', JSON.stringify(pool));

  await page.locator(`[data-session="${sessionType}"]`).click();
  await page.waitForTimeout(150);
  const served = [];
  for (let turn = 0; turn < 30; turn += 1) {
    const snap = await page.evaluate(() => {
      const card = document.querySelector('.flashcard, .session-card--active, #app');
      const word = document.querySelector('.vocab-word')?.textContent?.trim() || null;
      return {
        word,
        start: !!document.querySelector('#start-quiz'),
        next: !!document.querySelector('#next-card'),
        done: !!document.querySelector('.summary')
      };
    });
    if (snap.done) break;
    if (snap.word && !served.includes(snap.word)) served.push(snap.word);
    if (snap.start) await page.locator('#start-quiz').click();
    else if (snap.next) await page.locator('#next-card').click();
    else {
      // Answer whatever the turn offers so the session can advance.
      if (await page.locator('[data-option]:enabled').count()) await page.locator('[data-option]:enabled').first().click();
      else if (await page.locator('#flip-card').count()) await page.locator('#flip-card').click();
      else if (await page.locator('#spelling-input').count()) { await page.locator('#spelling-input').fill('zzz'); await page.locator('#spelling-submit, #check-answer').first().click().catch(() => {}); }
      else break;
    }
    await page.waitForTimeout(70);
  }
  const levels = await page.evaluate(words => words.map(w => [w, window.__levelByWord.get(String(w).toLowerCase()) || 'not-a-headword']), served);
  console.log('SERVED', JSON.stringify(levels));
  console.log('LEAKED', JSON.stringify(levels.filter(([, l]) => l !== `level:${(selection.levels[0] || '')}`)));
  console.log('PAGE_ERRORS', JSON.stringify(errors));
  await browser.close(); server.close();
})().catch(error => { console.error('FAILED', error.message); process.exit(1); });
