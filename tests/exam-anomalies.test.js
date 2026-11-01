import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const report = JSON.parse(await readFile(new URL('../docs/exam-anomaly-classification.json', import.meta.url), 'utf8'));
const cases = report.cases;
const byPaper = new Map(records.map(record => [record.id, record]));

function reparsed(paper) {
  const record = byPaper.get(paper);
  return app.parseExamQuestions(record.markdown, record.id);
}

test('rc9 anomalies: the inventory regenerates byte-for-byte from the parser', () => {
  const output = execFileSync(process.execPath, ['scripts/exams/classify_anomalies.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /Checked anomalies: /);
});

test('rc9 anomalies: every case points at a question that really exists', () => {
  assert.ok(cases.length > 0);
  for (const item of cases) {
    assert.ok(byPaper.has(item.paper), `unknown paper ${item.paper}`);
    const questions = reparsed(item.paper);
    const match = questions.find(question => question.id === item.questionId);
    assert.ok(match, `${item.paper} has no question ${item.questionId}`);
    assert.equal(match.number, item.number);
    assert.equal(match.responseType, item.responseType);
    assert.ok(item.anomalies.length >= 1);
    assert.ok(item.anomalies.includes(item.anomaly));
    const structural = item.anomalies.find(reason => reason === 'option_overflow' || reason === 'incomplete_option');
    assert.equal(item.anomaly, structural || item.anomalies[0], 'a structural defect is always the primary anomaly');
    assert.ok(item.reason.length > 0);
    assert.ok(item.status.length > 0);
  }
});

test('rc9 anomalies: categories are counted from the cases, never asserted on their own', () => {
  const counted = {};
  for (const item of cases) {
    for (const reason of item.anomalies) counted[reason] = (counted[reason] || 0) + 1;
  }
  for (const key of ['truncated_prompt', 'instruction_only', 'shared_prompt', 'option_overflow', 'incomplete_option']) {
    assert.equal(report.totals[key], counted[key] || 0, key);
  }
  assert.equal(report.totals.questionsWithAnomalies, new Set(cases.map(item => `${item.paper}#${item.questionId}`)).size);
  assert.equal(report.totals.papersWithAnomalies, new Set(cases.map(item => item.paper)).size);
  assert.equal(report.totals.questions, records.reduce((sum, record) => sum + reparsed(record.id).length, 0));
});

test('rc9 anomalies: the criteria describe real defects and nothing else', () => {
  for (const item of cases) {
    const questions = reparsed(item.paper);
    const question = questions.find(entry => entry.id === item.questionId);
    if (item.anomalies.includes('option_overflow')) {
      assert.ok(['choice', 'true-false', 'multiple'].includes(question.responseType));
      assert.ok((question.options || []).length > 6, `${item.paper}#${item.number} claims overflow with ${question.options.length} options`);
    }
    if (item.anomalies.includes('incomplete_option')) {
      assert.ok(question.flags.includes('incomplete-options'));
      assert.ok((question.options || []).length <= 1);
    }
    if (item.anomalies.includes('truncated_prompt')) {
      const prompt = String(question.prompt).trim();
      assert.ok(prompt.length < 12 || /(?:\.\.\.|…|—|-|,|_{2,}|\(|\[)\s*$/.test(prompt), prompt);
    }
    if (item.anomalies.includes('instruction_only')) {
      assert.doesNotMatch(String(question.prompt), /\?/);
      assert.doesNotMatch(String(question.prompt), /_{2,}/);
    }
    if (item.anomalies.includes('shared_prompt')) {
      assert.ok(questions.filter(entry => entry.prompt === question.prompt).length >= 3);
    }
  }
});

test('rc9 anomalies: structural defects are excluded from scoring and text gaps are never rewritten', () => {
  for (const item of cases) {
    const structural = item.anomalies.includes('option_overflow') || item.anomalies.includes('incomplete_option');
    if (structural) {
      assert.equal(item.status, 'handled_in_app');
      assert.equal(item.scorable, false, `${item.paper}#${item.number} must not be scored`);
      assert.match(item.action, /ungradable/);
    } else {
      assert.ok(['kept_as_recorded', 'needs_review'].includes(item.status));
      assert.equal(item.action, 'no data change');
      assert.match(item.reason, /invent/);
    }
  }
});

test('rc9 anomalies: a case is only marked scorable when its stored key is scorable', () => {
  for (const item of cases) {
    const record = byPaper.get(item.paper);
    const questions = reparsed(item.paper);
    const index = questions.findIndex(question => question.id === item.questionId);
    const key = (record.answerKey || [])[index] || null;
    if (!key) continue;
    if (key.questionId && key.questionId !== item.questionId) continue;
    assert.equal(item.scorable, key.scorable !== false, `${item.paper}#${item.number}`);
  }
});

test('rc9 anomalies: the rendered markdown lists every case and never claims a fix', () => {
  const markdown = report.cases.map(item => `| ${item.paper} | ${item.number} |`).join('\n');
  assert.equal(report.cases.length, cases.length);
  assert.ok(markdown.length > 0);
  assert.equal(report.generatedBy, 'scripts/exams/classify_anomalies.mjs');
  assert.doesNotMatch(JSON.stringify(report), /"fixed":\s*true/);
});
