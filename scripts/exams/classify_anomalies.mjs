#!/usr/bin/env node
// Classify the structural anomalies left in the transcribed exam archive.
//
// This script never edits a transcription: it reads the same parser the app
// uses and writes a per-case inventory so every leftover anomaly has a status,
// a handling decision and a reason. Deterministic and offline.
//
// Criteria (documented, reproducible):
//   truncated_prompt  prompt shorter than 12 characters, or ending on an
//                     ellipsis/dash/comma or a bare gap marker — the stored
//                     text visibly stops mid-sentence;
//   instruction_only  the prompt is an instruction with no question content
//                     ("Choose the letter A, B, C or D ...") and no gap of its
//                     own, i.e. the real stem was not captured;
//   shared_prompt     the identical prompt string is attached to three or more
//                     items of the same paper (a cloze/reading passage was
//                     merged into several items);
//   option_overflow   a choice/true-false/multiple item carrying more than six
//                     options (the transcription merged a table row or a
//                     matching block);
//   incomplete_option a choice/true-false/multiple item carrying exactly one
//                     option (the parser flags `incomplete-options`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const check = process.argv.includes('--check');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const TRUNCATED_TAIL = /(?:\.\.\.|…|—|-|,|_{2,}|\(|\[)\s*$/;
const INSTRUCTION_ONLY = /^(?:choose|select|read|listen|write|fill|complete|match|identify|decide|look|answer|supply|give|for questions|part\b|section\b)/i;
const CHOICE_LIKE = new Set(['choice', 'true-false', 'multiple']);

function excerpt(text, limit = 90) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

const cases = [];
const totals = { papers: 0, questions: 0, truncated_prompt: 0, instruction_only: 0, shared_prompt: 0, option_overflow: 0, incomplete_option: 0 };

for (const record of records) {
  const questions = app.parseExamQuestions(record.markdown, record.id);
  const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
  const promptCounts = new Map();
  for (const question of questions) promptCounts.set(question.prompt, (promptCounts.get(question.prompt) || 0) + 1);
  totals.papers += 1;
  totals.questions += questions.length;
  questions.forEach((question, index) => {
    const key = keys[index] || null;
    const prompt = String(question.prompt || '');
    const reasons = [];
    const trimmed = prompt.trim();
    if (trimmed.length < 12 || TRUNCATED_TAIL.test(trimmed)) reasons.push('truncated_prompt');
    if (INSTRUCTION_ONLY.test(trimmed) && !/[?]/.test(trimmed) && !/_{2,}/.test(trimmed)) reasons.push('instruction_only');
    if ((promptCounts.get(question.prompt) || 0) >= 3) reasons.push('shared_prompt');
    if (CHOICE_LIKE.has(question.responseType) && (question.options || []).length > 6) reasons.push('option_overflow');
    if (question.flags?.includes('incomplete-options')) reasons.push('incomplete_option');
    if (!reasons.length) return;
    for (const reason of reasons) totals[reason] += 1;
    // A structural defect decides the handling: if an item has more than one
    // anomaly, the one that makes it ungradable is the primary one.
    const primary = reasons.find(reason => reason === 'option_overflow' || reason === 'incomplete_option') || reasons[0];
    const scorable = key ? key.scorable !== false : false;
    const handling = reason => {
      if (reason === 'option_overflow' || reason === 'incomplete_option') {
        return {
          status: 'handled_in_app',
          action: 'reported ungradable (structural-defect)',
          reason: 'The stored option set is not a real question, so the item is excluded from scoring. Options and any stored answer are kept unchanged for review.'
        };
      }
      return {
        status: reason === 'instruction_only' || reason === 'shared_prompt' ? 'needs_review' : 'kept_as_recorded',
        action: 'no data change',
        reason: 'The transcription records only this text. Rewriting it would invent content (or borrow another paper\'s wording), so the item is kept exactly as stored, listed for review, and scored only through its stored key and confidence label.'
      };
    };
    cases.push({
      paper: record.id,
      questionId: question.id,
      number: question.number,
      section: question.section || '',
      responseType: question.responseType,
      anomaly: primary,
      anomalies: reasons,
      promptLength: prompt.length,
      promptExcerpt: excerpt(prompt),
      options: (question.options || []).length,
      verificationStatus: key?.verificationStatus || 'missing',
      scorable,
      ...handling(primary)
    });
  });
}

const byAnomaly = Object.fromEntries(Object.keys(totals).filter(key => !['papers', 'questions'].includes(key)).map(key => [
  key, cases.filter(item => item.anomalies.includes(key))
]));
const papersByAnomaly = Object.fromEntries(Object.entries(byAnomaly).map(([key, list]) => [
  key, [...new Set(list.map(item => item.paper))].length
]));

const report = {
  schemaVersion: 1,
  generatedBy: 'scripts/exams/classify_anomalies.mjs',
  criteria: {
    truncated_prompt: 'prompt shorter than 12 characters, or ending on an ellipsis/dash/comma or a bare gap marker',
    instruction_only: 'prompt is an instruction with no question content and no gap of its own',
    shared_prompt: 'identical prompt attached to three or more items of the same paper',
    option_overflow: 'choice/true-false/multiple item carrying more than six options',
    incomplete_option: 'choice/true-false/multiple item flagged incomplete-options (a single option)'
  },
  totals: {
    ...totals,
    papersWithAnomalies: new Set(cases.map(item => item.paper)).size,
    questionsWithAnomalies: new Set(cases.map(item => `${item.paper}#${item.questionId}`)).size,
    papersByAnomaly
  },
  byStatus: Object.fromEntries([...new Set(cases.map(item => item.status))].map(status => [
    status, cases.filter(item => item.status === status).length
  ])),
  cases
};

const lines = [
  '# Exam anomaly classification',
  '',
  'Generated by `scripts/exams/classify_anomalies.mjs` (run with `--check` to verify).',
  'No transcription is edited by this script: each leftover anomaly is listed with a status, a handling decision and a reason.',
  '',
  '| Metric | Count |',
  '| --- | ---: |',
  ...Object.entries(report.totals).filter(([, value]) => typeof value === 'number').map(([key, value]) => `| ${key} | ${value} |`),
  '',
  '## Criteria',
  '',
  ...Object.entries(report.criteria).map(([key, value]) => `- **${key}** — ${value}`),
  '',
  '## Handling',
  '',
  ...Object.entries(report.byStatus).map(([key, value]) => `- **${key}** — ${value} cases`),
  '',
  '- `option_overflow` / `incomplete_option` are excluded from scoring in the app (structural defect), with the stored options and answer kept unchanged.',
  '- `truncated_prompt` / `instruction_only` / `shared_prompt` are kept exactly as transcribed: the archive holds no more text for them, and rewriting or borrowing another paper\'s wording would invent content.',
  '',
  '## Per-case inventory',
  '',
  '| Paper | Q | Type | Anomaly | Options | Prompt chars | Key status | Scorable | Status |',
  '| --- | ---: | --- | --- | ---: | ---: | --- | --- | --- |',
  ...cases.map(item => `| ${item.paper} | ${item.number} | ${item.responseType} | ${item.anomalies.join(', ')} | ${item.options} | ${item.promptLength} | ${item.verificationStatus} | ${item.scorable ? 'yes' : 'no'} | ${item.status} |`),
  ''
];

const outputs = [
  ['docs/exam-anomaly-classification.json', JSON.stringify(report, null, 2) + '\n'],
  ['docs/exam-anomaly-classification.md', lines.join('\n')]
];

let stale = false;
for (const [relative, content] of outputs) {
  const file = path.join(root, relative);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
      console.error(`Stale: ${relative}`);
      stale = true;
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
if (check && stale) process.exit(1);
console.log(`${check ? 'Checked' : 'Classified'} anomalies: ${report.totals.questionsWithAnomalies} questions in ${report.totals.papersWithAnomalies} papers ` +
  `(truncated_prompt=${report.totals.truncated_prompt}, instruction_only=${report.totals.instruction_only}, ` +
  `shared_prompt=${report.totals.shared_prompt}, option_overflow=${report.totals.option_overflow}, ` +
  `incomplete_option=${report.totals.incomplete_option}).`);
