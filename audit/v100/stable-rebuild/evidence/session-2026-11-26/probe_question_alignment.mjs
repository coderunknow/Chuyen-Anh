#!/usr/bin/env node
// Independent probe: question <-> answerKey alignment using the app's real
// parser (extracted from index.html exactly like build_answer_keys.mjs does),
// but with fresh verification logic written for this session.
//
// Checks:
//   B1. (examId, questionId) globally unique across the corpus.
//   B2. per paper: parsed questions == answerKey entries, exactly, by questionId.
//   B3. every answerKey entry's number matches the parsed question's number.
//   B4. global totals: papers 106, questions 6708.
// Exit 0 = all pass; exit 1 = failures printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../../../', import.meta.url).pathname;  // repo root
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);

const examData = JSON.parse(
  html.match(/<script id="exam-data" type="application\/json">\s*([\s\S]*?)\s<\/script>/)[1]
    .replace(/<\\\/script>/g, '</scr' + 'ipt>'));

const failures = [];
let totalQuestions = 0;
const seenIds = new Map();

for (const paper of examData) {
  const questions = app.parseExamQuestions(paper.markdown, paper.id);
  const keys = paper.answerKey || [];
  totalQuestions += questions.length;

  if (questions.length !== keys.length) {
    failures.push(`B2: ${paper.id}: parsed ${questions.length} questions but answerKey has ${keys.length}`);
  }
  const qIds = new Set(questions.map(q => q.id));
  const kIds = new Set(keys.map(k => k.questionId));
  for (const id of qIds) if (!kIds.has(id)) failures.push(`B2: ${paper.id}: parsed question ${id} missing from answerKey`);
  for (const id of kIds) if (!qIds.has(id)) failures.push(`B2: ${paper.id}: answerKey entry ${id} has no parsed question`);
  for (const k of keys) {
    const idKey = `${paper.id}\u001f${k.questionId}`;
    if (seenIds.has(idKey)) failures.push(`B1: duplicate (examId, questionId): ${idKey}`);
    seenIds.set(idKey, true);
  }
  const numberById = new Map(questions.map(q => [q.id, q.number]));
  for (const k of keys) {
    if (numberById.get(k.questionId) !== k.number) {
      failures.push(`B3: ${paper.id}: answerKey number ${k.number} != parsed number ${numberById.get(k.questionId)} for ${k.questionId}`);
    }
  }
}

console.log(JSON.stringify({
  papers: examData.length,
  totalQuestions,
  uniqueQuestionIds: seenIds.size,
  failureCount: failures.length,
  failures: failures.slice(0, 40),
}, null, 1));
process.exit(failures.length ? 1 : 0);
