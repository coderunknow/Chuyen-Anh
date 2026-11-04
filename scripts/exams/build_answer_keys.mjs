#!/usr/bin/env node
// Build-time generator for machine-readable exam answer keys, confidence/provenance
// metadata, and scoring coverage audit from the runtime parser in index.html.
// Deterministic and offline (zero network calls).
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
const vocabData = JSON.parse(fs.readFileSync(path.join(root, 'data/vocabulary.json'), 'utf8'));
const phraseData = JSON.parse(fs.readFileSync(path.join(root, 'data/phrases.json'), 'utf8'));

// Retain and validate the historical inference pin as a fail-closed input.
// The teaching bank and this pin are not evidence for an exam answer; no
// automatic inference is performed by this builder.

const SHA_RE = /^[0-9a-f]{40}$/i;
// Vocabulary entries may be single words or multi-word phrase rows stored in the
// vocabulary list (61 of them have pos: "phrase"). Phrases include patterns with
// parentheses, slashes, plus signs and ellipses ("not only ... but also",
// "lest + s + (should) v-bare"). The regex allows the real character set found
// in the bank and rejects digits, control characters and empty strings.
const ENTRY_RE = /^[A-Za-z][A-Za-z'’\-]*(?:\s*[A-Za-z'’\-\(\)\+\.\/]*\s*)*$/;

function loadInferencePin(filePath, vocabData, phraseData) {
  // 1. Missing file.
  if (!fs.existsSync(filePath)) {
    throw new Error('inference-lexicon.json is missing: validation cannot fall back '
      + 'to the live teaching bank. Restore the reviewed pin before building.');
  }

  // 2. Malformed JSON.
  let pin;
  try {
    pin = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`inference-lexicon.json is not valid JSON: ${err.message}`);
  }
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) {
    throw new Error('inference-lexicon.json must be a JSON object.');
  }

  // 3. Schema: mandatory fields present.
  for (const field of ['generatedBy', 'frozenAt', 'rule', 'counts', 'vocabulary', 'phrases']) {
    if (pin[field] === undefined || pin[field] === null) {
      throw new Error(`inference-lexicon.json is missing mandatory field: ${field}`);
    }
  }
  if (pin.generatedBy !== 'scripts/exams/freeze_inference_lexicon.mjs') {
    throw new Error(`inference-lexicon.json generatedBy is unexpected: ${pin.generatedBy}`);
  }
  if (!SHA_RE.test(String(pin.frozenAt))) {
    throw new Error(`inference-lexicon.json frozenAt is not a 40-character commit SHA: ${pin.frozenAt}`);
  }
  if (typeof pin.rule !== 'string' || pin.rule.trim() === '') {
    throw new Error('inference-lexicon.json rule must be a non-empty string.');
  }
  if (!pin.counts || typeof pin.counts !== 'object') {
    throw new Error('inference-lexicon.json counts must be an object.');
  }

  // 4. Vocabulary and phrase arrays must be present and non-empty.
  if (!Array.isArray(pin.vocabulary) || pin.vocabulary.length === 0) {
    throw new Error('inference-lexicon.json vocabulary must be a non-empty array.');
  }
  if (!Array.isArray(pin.phrases) || pin.phrases.length === 0) {
    throw new Error('inference-lexicon.json phrases must be a non-empty array.');
  }

  // 5. Declared counts must agree with actual array lengths.
  if (pin.counts.vocabulary !== pin.vocabulary.length) {
    throw new Error(`inference-lexicon.json counts.vocabulary (${pin.counts.vocabulary}) `
      + `does not match actual length (${pin.vocabulary.length})`);
  }
  if (pin.counts.phrases !== pin.phrases.length) {
    throw new Error(`inference-lexicon.json counts.phrases (${pin.counts.phrases}) `
      + `does not match actual length (${pin.phrases.length})`);
  }

  // 6–7. Entries must be well-formed, unique, and present in the current bank.
  const vocabSet = new Set();
  for (const word of pin.vocabulary) {
    if (typeof word !== 'string' || !ENTRY_RE.test(word.trim())) {
      throw new Error(`inference-lexicon.json has a malformed vocabulary entry: ${JSON.stringify(word)}`);
    }
    const key = word.trim().toLowerCase();
    if (vocabSet.has(key)) {
      throw new Error(`inference-lexicon.json has a duplicate vocabulary entry: ${key}`);
    }
    vocabSet.add(key);
  }
  const phraseSet = new Set();
  for (const phrase of pin.phrases) {
    if (typeof phrase !== 'string' || !ENTRY_RE.test(phrase.trim())) {
      throw new Error(`inference-lexicon.json has a malformed phrase entry: ${JSON.stringify(phrase)}`);
    }
    const key = phrase.trim().toLowerCase();
    if (phraseSet.has(key)) {
      throw new Error(`inference-lexicon.json has a duplicate phrase entry: ${key}`);
    }
    phraseSet.add(key);
  }

  // Entries must exist in the corresponding current bank; a stale pin is evidence
  // that no longer applies and must not silently shrink the inference evidence.
  const currentVocab = Array.isArray(vocabData)
    ? new Set(vocabData.map(r => String(r.word || '').toLowerCase()))
    : new Set(Object.values(vocabData || {}).map(r => String((r && r.word) || '').toLowerCase()));
  const missingVocab = [...vocabSet].filter(w => !currentVocab.has(w));
  if (missingVocab.length > 0) {
    throw new Error(`inference-lexicon.json has ${missingVocab.length} vocabulary entries absent `
      + `from the current bank; sample: ${missingVocab.slice(0, 5).join(', ')}`);
  }
  const currentPhrases = Array.isArray(phraseData)
    ? new Set(phraseData.map(r => String(r.phrase || '').toLowerCase()))
    : new Set(Object.values(phraseData || {}).map(r => String((r && r.phrase) || '').toLowerCase()));
  const missingPhrases = [...phraseSet].filter(p => !currentPhrases.has(p));
  if (missingPhrases.length > 0) {
    throw new Error(`inference-lexicon.json has ${missingPhrases.length} phrase entries absent `
      + `from the current bank; sample: ${missingPhrases.slice(0, 5).join(', ')}`);
  }

  return { vocabulary: vocabSet, phrases: phraseSet };
}

loadInferencePin(
  path.join(root, 'scripts/exams/inference-lexicon.json'),
  vocabData,
  phraseData
);
// The pin remains validated above for compatibility and fail-closed checks.
// It is deliberately not used to infer any answer keys.
const parsedPapers = [];

for (const item of plan) {
  const text = fs.readFileSync(path.join(root, 'De-chuyen-Anh-vao-10', `${item.key}.md`), 'utf8');
  const body = text.split(/^---\n[\s\S]*?\n---\n/m)[1];
  const contentSha256 = crypto.createHash('sha256').update(body).digest('hex');
  const questions = app.parseExamQuestions(body, item.key);
  parsedPapers.push({ item, body, contentSha256, questions });
}

// One definition of "this item can actually be scored", used both for the
// per-paper count and for the archive totals. Before this existed, `scoredCount`
// was `answerKeys.length`, so every paper claimed 100% coverage while only a
// fraction of its items had a usable key (issue #75).
function isScorableKey(question, key) {
  if (!key || key.scorable === false) return false;
  if (['invalid_key', 'missing_answer', 'incomplete_stimulus', 'ambiguous_review'].includes(key.verificationStatus)) return false;
  if (question.responseType === 'essay') return Boolean(key.rubric);
  return Array.isArray(key.candidates) && key.candidates.length > 0;
}

const records = [];
const totals = {
  papers: 0,
  questions: 0,
  scoredQuestions: 0,
  scoringCoveragePct: 100,
  byStatus: {},
  bySourceStatus: {},
  byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
  byResponseType: {},
  gradable: 0,
  provisional: 0,
  listeningItems: 0,
  listeningTranscriptFallback: 0,
  listeningIncompleteStimulus: 0,
  writingRubricScored: 0,
  htmlOcrPapersInteractive: 0,
  missingFigurePapers: 0,
  missing: 0,
  ungradeable: 0,
  ungradeableStimulus: 0,
  byUngradeableReason: {},
  ambiguous: 0
};

for (const { item, body, contentSha256, questions } of parsedPapers) {
  // A teaching lexicon, answer-letter frequency, or heuristic solver is not
  // evidence for an exam answer. Keep the historical pin fail-closed above,
  // but do not supply inferred hints; missing source keys remain ungraded.
  const answerKeys = app.extractExamAnswerKeys(body, questions, { id: item.key, source: item.source, quality: item.quality, answers: item.answers });
  const isOcr = /HTML|OCR|cần-soát/i.test(item.quality);
  const hasMissingFig = answerKeys.some(k => k.stimulusFallback === 'missing_diagram_or_figure');

  const paper = {
    id: item.key,
    year: item.year,
    province: item.province,
    quality: item.quality,
    contentSha256,
    practiceReadOnly: false,
    ocrCaution: isOcr,
    questionCount: questions.length,
    scoredCount: questions.filter((q, i) => isScorableKey(q, answerKeys[i])).length,
    responseTypes: Object.fromEntries(['choice','multiple','true-false','text','essay'].map(t => [t, questions.filter(q => q.responseType === t).length])),
    keyStatuses: Object.fromEntries([...new Set(answerKeys.map(k => k.verificationStatus))].map(s => [s, answerKeys.filter(k => k.verificationStatus === s).length])),
    sourceStatuses: Object.fromEntries([...new Set(answerKeys.map(k => k.sourceStatus))].map(s => [s, answerKeys.filter(k => k.sourceStatus === s).length])),
    confidenceCounts: Object.fromEntries(['HIGH','MEDIUM','LOW','VERY_LOW'].map(c => [c, answerKeys.filter(k => k.confidence === c).length])),
    listeningItems: questions.filter(q => q.flags.includes('listening-audio-unavailable')).length,
    writingItems: questions.filter(q => q.responseType === 'essay' || q.flags.includes('writing-rubric-required')).length,
    answerKeys
  };
  records.push(paper);

  totals.papers += 1;
  totals.questions += questions.length;
  if (isOcr) totals.htmlOcrPapersInteractive += 1;
  if (hasMissingFig) totals.missingFigurePapers += 1;

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const key = answerKeys[i];
    totals.byResponseType[q.responseType] = (totals.byResponseType[q.responseType] || 0) + 1;
    totals.byStatus[key.verificationStatus] = (totals.byStatus[key.verificationStatus] || 0) + 1;
    totals.bySourceStatus[key.sourceStatus] = (totals.bySourceStatus[key.sourceStatus] || 0) + 1;
    totals.byConfidence[key.confidence] = (totals.byConfidence[key.confidence] || 0) + 1;
    if (q.flags.includes('listening-audio-unavailable')) {
      totals.listeningItems += 1;
      if (key.stimulusFallback === 'listening_transcript_fallback') totals.listeningTranscriptFallback += 1;
      else totals.listeningIncompleteStimulus += 1;
    }
    if (q.responseType === 'essay' || q.flags.includes('writing-rubric-required')) {
      totals.writingRubricScored += 1;
    }
    // "Scorable" means the stored key can actually answer this question: a
    // non-empty candidate list is not enough (issue #75). Items without a
    // usable key or without their stimulus are counted as ungradeable.
    if (isScorableKey(q, key)) {
      totals.scoredQuestions += 1;
      totals.gradable += 1;
      if (key.verificationStatus !== 'official_verified') totals.provisional += 1;
    } else {
      totals.missing += 1;
      totals.ungradeable += 1;
      const reason = key.ungradeableReason || 'no-answer-key';
      totals.byUngradeableReason[reason] = (totals.byUngradeableReason[reason] || 0) + 1;
      if (key.stimulusFallback) totals.ungradeableStimulus += 1;
    }
    if (key.sourceStatus === 'ambiguous_source') totals.ambiguous += 1;
  }
}

totals.scoringCoveragePct = totals.questions > 0 ? Math.round((totals.scoredQuestions / totals.questions) * 10000) / 100 : 100;

const manifest = {
  schemaVersion: 1,
  scoringRuleVersion: app.EXAM_SCORING_RULE_VERSION,
  generatedBy: 'scripts/exams/build_answer_keys.mjs',
  records
};

const audit = {
  schemaVersion: 1,
  scoringRuleVersion: app.EXAM_SCORING_RULE_VERSION,
  totals,
  limits: [
    'Zero items are labeled official_verified without an official primary ministry/department source.',
    'Only items that can actually be scored from the stored material enter the denominator. Items whose key is not an option of the question, whose key is missing, or whose picture/audio stimulus is absent are reported as ungradeable with an explicit reason and excluded from the score denominator (scorable-only scoring).',
    'No answer key is inferred from the teaching bank, option frequencies, or an automatic contextual solver; missing source answers stay ungraded.',
    'Listening items without bundled MP3 use source transcript fallback (LOW confidence) when a transcript exists, or incomplete_stimulus (VERY_LOW confidence) otherwise.',
    'Open-ended writing and speaking items are scored provisionally via a 4-criterion analytical rubric (Task 30%, Coherence 25%, Lexis 25%, Grammar 20%) and never claim human-examiner equivalence.'
  ],
  papers: records.map(({ answerKeys, ...rest }) => rest)
};

const md = [
  '# Exam scoring audit',
  '',
  `Scoring rule: \`${app.EXAM_SCORING_RULE_VERSION}\`. Scorable-only denominator: items with a usable recorded-source answer or a provisional essay rubric are scored (${totals.scoredQuestions} / ${totals.questions} = ${totals.scoringCoveragePct} %). The remaining ${totals.ungradeable} items are listed as ungradeable with a reason and are never guessed, inferred or keyed by statistics. No official verification is implied where primary sources are absent.`,
  '',
  '| Metric | Count |',
  '| --- | ---: |',
  ...Object.entries(totals).filter(([, v]) => typeof v === 'number').map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Verification status counts (question denominator)',
  '',
  '| Verification Status | Questions |',
  '| --- | ---: |',
  ...Object.entries(totals.byStatus).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Granular source status counts',
  '',
  '| Source Status | Questions |',
  '| --- | ---: |',
  ...Object.entries(totals.bySourceStatus).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Confidence distribution',
  '',
  '| Confidence | Questions |',
  '| --- | ---: |',
  ...Object.entries(totals.byConfidence).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Per-paper universal scoring summary',
  '',
  '| Paper | Questions | Scored | Choice | Text | Essay | Listening | HIGH | MED | LOW | V_LOW | OCR Caution |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ...audit.papers.map(p => `| ${p.id} | ${p.questionCount} | ${p.scoredCount} | ${p.responseTypes.choice + p.responseTypes.multiple + p.responseTypes['true-false']} | ${p.responseTypes.text} | ${p.responseTypes.essay} | ${p.listeningItems} | ${p.confidenceCounts.HIGH} | ${p.confidenceCounts.MEDIUM} | ${p.confidenceCounts.LOW} | ${p.confidenceCounts.VERY_LOW} | ${p.ocrCaution ? 'yes' : 'no'} |`),
  ''
].join('\n');

const outputs = [
  ['data/exam-answer-keys.json', JSON.stringify(manifest, null, 2) + '\n'],
  ['docs/exam-scoring-audit.json', JSON.stringify(audit, null, 2) + '\n'],
  ['docs/exam-scoring-audit.md', md]
];

let stale = false;
for (const [rel, content] of outputs) {
  const file = path.join(root, rel);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
      console.error(`Stale: ${rel}`);
      stale = true;
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
if (check && stale) process.exit(1);
console.log(`${check ? 'Checked' : 'Built'} answer keys: ${totals.papers} papers, ${totals.questions} questions, ${totals.scoredQuestions}/${totals.questions} (${totals.scoringCoveragePct}%) scorable, missing=${totals.missing}.`);
