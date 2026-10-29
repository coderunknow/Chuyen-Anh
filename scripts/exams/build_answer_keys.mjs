#!/usr/bin/env node
// Build-time only. Regenerates machine-readable answer-key candidates and the
// scoring audit from the exact runtime parser in index.html. No network calls.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const check = process.argv.includes('--check');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const plan = JSON.parse(fs.readFileSync(path.join(root, 'scripts/exams/selection.json'), 'utf8'));
const records = [];
const totals = { papers: 0, questions: 0, byStatus: {}, byResponseType: {}, gradable: 0, provisional: 0, listeningUnscorable: 0, writingUnscorable: 0, htmlOcrReadOnly: 0, missing: 0, ambiguous: 0 };
for (const item of plan) {
  const text = fs.readFileSync(path.join(root, 'De-chuyen-Anh-vao-10', `${item.key}.md`), 'utf8');
  const body = text.split(/^---\n[\s\S]*?\n---\n/m)[1];
  const contentSha256 = crypto.createHash('sha256').update(body).digest('hex');
  const questions = app.parseExamQuestions(body, item.key);
  const answerKeys = app.extractExamAnswerKeys(body, questions, { id: item.key, source: item.source });
  const readOnly = /HTML|OCR|cần-soát/i.test(item.quality);
  const paper = { id: item.key, year: item.year, province: item.province, quality: item.quality, contentSha256,
    practiceReadOnly: readOnly, questionCount: questions.length,
    responseTypes: Object.fromEntries(['choice','multiple','true-false','text','essay'].map(t => [t, questions.filter(q => q.responseType === t).length])),
    keyStatuses: Object.fromEntries([...new Set(answerKeys.map(k => k.verificationStatus))].map(s => [s, answerKeys.filter(k => k.verificationStatus === s).length])),
    listeningItems: questions.filter(q => q.flags.includes('listening-audio-unavailable')).length,
    writingItems: questions.filter(q => q.responseType === 'essay' || q.flags.includes('writing-rubric-required')).length,
    answerKeys };
  records.push(paper);
  totals.papers += 1; totals.questions += questions.length;
  if (readOnly) totals.htmlOcrReadOnly += 1;
  for (const q of questions) {
    totals.byResponseType[q.responseType] = (totals.byResponseType[q.responseType] || 0) + 1;
    const key = answerKeys.find(k => k.questionId === q.id);
    totals.byStatus[key.verificationStatus] = (totals.byStatus[key.verificationStatus] || 0) + 1;
    if (q.flags.includes('listening-audio-unavailable')) totals.listeningUnscorable += 1;
    if (q.responseType === 'essay' || q.flags.includes('writing-rubric-required')) totals.writingUnscorable += 1;
    const gradable = !readOnly && !q.flags.includes('listening-audio-unavailable') && q.responseType !== 'essay' && !q.flags.includes('writing-rubric-required') && !['missing_answer','ambiguous_review'].includes(key.verificationStatus);
    if (gradable) { totals.gradable += 1; if (['source_transcription_unverified','inferred_unverified'].includes(key.verificationStatus)) totals.provisional += 1; }
    if (key.verificationStatus === 'missing_answer') totals.missing += 1;
    if (key.verificationStatus === 'ambiguous_review') totals.ambiguous += 1;
  }
}
const manifest = { schemaVersion: 1, scoringRuleVersion: app.EXAM_SCORING_RULE_VERSION, generatedBy: 'scripts/exams/build_answer_keys.mjs', records };
const audit = { schemaVersion: 1, scoringRuleVersion: app.EXAM_SCORING_RULE_VERSION, totals,
  limits: ['No answer is upgraded to official_verified by extraction.', 'Listening items without audio and unrestricted writing are not automatically gradable.', 'HTML/OCR records remain read-only for practice.', 'Question counts are extracted items, not a claim of complete official-paper coverage.'],
  papers: records.map(({ answerKeys, ...rest }) => rest) };
const md = ['# Exam scoring audit', '', `Scoring rule: \`${app.EXAM_SCORING_RULE_VERSION}\`. Generated from the runtime parser; no official verification is implied.`, '', '| Metric | Count |', '| --- | ---: |', ...Object.entries(totals).filter(([,v]) => typeof v === 'number').map(([k,v]) => `| ${k} | ${v} |`), '', '## Key status counts (question denominator)', '', '| Status | Questions |', '| --- | ---: |', ...Object.entries(totals.byStatus).map(([k,v]) => `| ${k} | ${v} |`), '', '## Per-paper extraction', '', '| Paper | Questions | Choice | Text | Essay | Listening | Read-only |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |', ...audit.papers.map(p => `| ${p.id} | ${p.questionCount} | ${p.responseTypes.choice + p.responseTypes.multiple + p.responseTypes['true-false']} | ${p.responseTypes.text} | ${p.responseTypes.essay} | ${p.listeningItems} | ${p.practiceReadOnly ? 'yes' : 'no'} |`), ''].join('\n');
const outputs = [ ['data/exam-answer-keys.json', JSON.stringify(manifest, null, 2) + '\n'], ['docs/exam-scoring-audit.json', JSON.stringify(audit, null, 2) + '\n'], ['docs/exam-scoring-audit.md', md] ];
let stale = false;
for (const [rel, content] of outputs) {
  const file = path.join(root, rel);
  if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) { console.error(`Stale: ${rel}`); stale = true; } }
  else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
}
if (check && stale) process.exit(1);
console.log(`${check ? 'Checked' : 'Built'} answer keys: ${totals.papers} papers, ${totals.questions} extracted questions, ${totals.gradable} gradable candidates (${totals.provisional} provisional).`);
