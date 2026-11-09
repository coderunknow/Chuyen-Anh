import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * Every item curated as `open_ended_writing_or_speaking` promises advisory
 * 4-criterion rubric feedback when the learner answers it.
 *
 * `2022/ha-noi/so` Q51 is a 250-word academic essay prompt whose wording the
 * protected parser does not classify as `essay`, so it is typed `text` even
 * though the curated exemption says `open_ended_writing_or_speaking`. The
 * runtime keyed the rubric on `responseType === 'essay'` alone, so that item
 * returned `ungraded` with no rubric at all — the exemption strip and the
 * readiness documentation both claimed feedback that never appeared.
 *
 * These assertions are driven by the shipped archive and keys, not by a
 * fixture, so any future exemption whose question type is not `essay` is
 * covered the moment it is added.
 */

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const SAMPLE_ESSAY = [
  'Self-study is important for secondary school students because it teaches them how to learn without a teacher.',
  'In my experience, preparing for the entrance exam required me to plan my own revision every evening.',
  'Students who study alone learn to notice their own mistakes and to look for evidence before they accept a claim.',
  'However, self-study only works when the school gives clear goals and when families provide a quiet place to work.',
  'Therefore, teachers should guide independent study instead of simply assigning more homework.'
].join(' ');

function openEndedItems() {
  const items = [];
  for (const record of records) {
    const questions = app.parseExamQuestions(record.markdown, record.id);
    const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
    for (const question of questions) {
      const key = keys.find(entry => entry.questionId === question.id);
      if (key?.exemptionCategory === 'open_ended_writing_or_speaking') {
        items.push({ record, question, key });
      }
    }
  }
  return items;
}

test('open-ended exemptions exist and most are typed essay', () => {
  const items = openEndedItems();
  assert.ok(items.length > 100, `expected the curated open-ended exemptions, found ${items.length}`);
  const types = new Set(items.map(item => item.question.responseType));
  assert.ok(types.has('essay'), 'essays must still be present');
});

test('an open-ended exemption keeps its 4-criterion rubric whatever the question type is', () => {
  const missing = [];
  for (const { record, question, key } of openEndedItems()) {
    const verification = app.getQuestionVerification(question, key);
    if (!verification.rubric || !Array.isArray(verification.rubric.criteria) || verification.rubric.criteria.length !== 4) {
      missing.push(`${record.id} ${question.id} (responseType=${question.responseType})`);
    }
    assert.equal(verification.scorable, false, `${record.id} ${question.id} must stay outside the score denominator`);
  }
  assert.deepEqual(missing, [], 'these curated open-ended items cannot produce advisory rubric feedback');
});

test('answering an open-ended exemption returns advisory rubric feedback and no credit', () => {
  const broken = [];
  for (const { record, question, key } of openEndedItems()) {
    const grade = app.gradeExamQuestion(question, SAMPLE_ESSAY, key);
    const ok = grade.result === 'ungraded'
      && grade.reason === 'essay-open-ended-exempt'
      && grade.earnedCredit === 0
      && grade.advisoryRubricEvaluation
      && Array.isArray(grade.advisoryRubricEvaluation.criteriaScores)
      && grade.advisoryRubricEvaluation.criteriaScores.length === 4
      && typeof grade.essayVerdict === 'string';
    if (!ok) {
      broken.push(`${record.id} ${question.id} (responseType=${question.responseType}) -> `
        + `result=${grade.result} reason=${grade.reason} credit=${grade.earnedCredit} `
        + `rubric=${grade.advisoryRubricEvaluation ? 'present' : 'absent'}`);
    }
  }
  assert.deepEqual(broken, [], 'an exempt open-ended answer must still receive advisory feedback');
});

test('the text-typed essay is the documented 2022/ha-noi/so Q51 case', () => {
  const item = openEndedItems().find(entry => entry.question.id === 'q-51-9c5133cba3668e8e');
  assert.ok(item, 'the known item must be in the archive');
  assert.equal(item.question.responseType, 'text');
  const grade = app.gradeExamQuestion(item.question, SAMPLE_ESSAY, item.key);
  assert.equal(grade.result, 'ungraded');
  assert.equal(grade.earnedCredit, 0);
  assert.ok(grade.advisoryRubricEvaluation, 'the exempt essay must not lose its rubric');
  assert.equal(grade.advisoryRubricEvaluation.criteriaScores.length, 4);
});

test('the essay gate never captures a scorable objective item', () => {
  // The exemption-based gate must be a widening for one curated case, not a hole:
  // an objective item that has a usable key must stay scorable and must never be
  // handed a rubric, whatever its response type.
  const overreached = [];
  let checked = 0;
  for (const record of records) {
    const questions = app.parseExamQuestions(record.markdown, record.id);
    const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
    for (const question of questions) {
      const key = keys.find(entry => entry.questionId === question.id);
      if (!key || key.scorable === false || question.responseType === 'essay') continue;
      checked += 1;
      const verification = app.getQuestionVerification(question, key);
      if (verification.scorable !== true || verification.rubric || verification.exemptionCategory) {
        overreached.push(`${record.id} ${question.id} (${question.responseType}) -> scorable=${verification.scorable} `
          + `rubric=${verification.rubric ? 'present' : 'absent'} category=${verification.exemptionCategory}`);
      }
    }
  }
  assert.ok(checked > 5000, `expected the scorable items to be inspected, checked ${checked}`);
  assert.deepEqual(overreached, [], 'a scorable objective item was treated as an exempt essay');
});
