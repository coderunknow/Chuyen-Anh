#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const CURATED_PATH = path.join(ROOT, 'data/exam-curated-keys.json');
const ANSWER_KEYS_PATH = path.join(ROOT, 'data/exam-answer-keys.json');
const AUDIT_PATH = path.join(ROOT, 'docs/exam-scoring-audit.json');

const ALLOWED_EXEMPTION_CATEGORIES = new Set([
  'missing_stimulus',
  'open_ended_writing_or_speaking',
  'structural_transcription_defect',
]);
const ALLOWED_UNGRADEABLE_REASONS = new Set([
  'ocr-structural-defect',
  'stimulus-incomplete',
  'incomplete-options',
  'essay-open-ended-exempt',
  'option-overflow',
  'key-not-an-option',
]);
const ALLOWED_CURATED_CONFIDENCE = new Set(['MEDIUM', 'LOW']);

/**
 * Compute the lowercase hex SHA-256 digest of a string.
 * @param {string} value
 * @returns {string}
 */
function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

/**
 * Serialize a parsed exam question's options into a deterministic canonical string.
 * @param {{ options?: Array<{ id: string, label: string, text: string }> }} question
 * @returns {string}
 */
function canonicalOptionsString(question) {
  return (question?.options || []).map((o) => `${o.id}:${o.label}:${o.text}`).join('|');
}

/**
 * Load the standalone application's parser and grading functions from index.html in an isolated VM.
 * @param {string} html
 * @returns {{ parseExamQuestions: Function, extractExamAnswerKeys: Function, gradeExamQuestion: Function }}
 */
function loadAppRuntime(html) {
  const match = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Missing #app-script in index.html');
  let code = match[1].replace(/\bexport\s+(const|let|var|function|async\s+function)/g, '$1');
  code += '\nglobalThis.__examExports = { parseExamQuestions, extractExamAnswerKeys, gradeExamQuestion };';
  const context = {
    globalThis: null,
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Map,
    Set,
    WeakMap,
    Math,
    Date,
    JSON,
    RegExp,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Symbol,
    Error,
    TypeError,
    RangeError,
    Uint8Array,
    Int32Array,
    Float64Array,
    Promise,
    setTimeout,
    clearTimeout,
  };
  context.globalThis = context;
  vm.runInNewContext(code, context, { filename: 'index.html#app-script' });
  return context.__examExports;
}

/**
 * Extract and parse a JSON `<script id="...">` payload from index.html.
 * @param {string} html
 * @param {string} id
 * @returns {any}
 */
function extractJsonScript(html, id) {
  const re = new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`);
  const match = html.match(re);
  if (!match) throw new Error(`Missing #${id} in index.html`);
  return JSON.parse(match[1]);
}

/**
 * Verify every curated exam key and formal exemption against SHA-256 prompt/option pins,
 * runtime self-grading, data/exam-answer-keys.json, index.html #exam-data, and docs/exam-scoring-audit.json.
 */
export function verifyCuratedKeys({
  indexPath = INDEX_PATH,
  curatedPath = CURATED_PATH,
  answerKeysPath = ANSWER_KEYS_PATH,
  auditPath = AUDIT_PATH,
} = {}) {
  const errors = [];
  const html = fs.readFileSync(indexPath, 'utf8');
  const curatedDoc = JSON.parse(fs.readFileSync(curatedPath, 'utf8'));
  const answerKeysDoc = JSON.parse(fs.readFileSync(answerKeysPath, 'utf8'));
  const auditDoc = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const { parseExamQuestions, gradeExamQuestion } = loadAppRuntime(html);
  const examRecords = extractJsonScript(html, 'exam-data');

  if (curatedDoc.schemaVersion !== 1) {
    errors.push(`curated schemaVersion must be 1, got ${curatedDoc.schemaVersion}`);
  }
  if (!Array.isArray(curatedDoc.entries) || curatedDoc.entries.length === 0) {
    errors.push('curated entries must be a non-empty array');
  }

  const parsedQuestionsByExam = new Map();
  const embeddedByExam = new Map();
  for (const exam of examRecords || []) {
    const questions = parseExamQuestions(exam.markdown || '', exam.id);
    const qMap = new Map(questions.map((q) => [q.id, q]));
    parsedQuestionsByExam.set(exam.id, qMap);
    const eMap = new Map((exam.answerKey || []).map((k) => [k.questionId, k]));
    embeddedByExam.set(exam.id, eMap);
  }

  const builtByExam = new Map();
  for (const entry of answerKeysDoc.records || []) {
    const kMap = new Map((entry.answerKeys || []).map((k) => [k.questionId, k]));
    builtByExam.set(entry.id, kMap);
  }

  const seenCurated = new Set();
  let scorableCurated = 0;
  let exemptCurated = 0;

  for (const item of curatedDoc.entries || []) {
    const compound = `${item.examId}::${item.questionId}`;
    if (seenCurated.has(compound)) {
      errors.push(`Duplicate curated entry: ${compound}`);
      continue;
    }
    seenCurated.add(compound);

    const qMap = parsedQuestionsByExam.get(item.examId);
    if (!qMap) {
      errors.push(`${compound}: examId not found in #exam-data`);
      continue;
    }
    const question = qMap.get(item.questionId);
    if (!question) {
      errors.push(`${compound}: questionId not found in parsed exam questions`);
      continue;
    }

    const expectedPromptSha = sha256Text(question.prompt);
    const expectedOptionsSha = sha256Text(canonicalOptionsString(question));
    if (item.promptSha256 !== expectedPromptSha) {
      errors.push(`${compound}: promptSha256 mismatch (expected ${expectedPromptSha}, got ${item.promptSha256})`);
    }
    if (item.optionsSha256 !== expectedOptionsSha) {
      errors.push(`${compound}: optionsSha256 mismatch (expected ${expectedOptionsSha}, got ${item.optionsSha256})`);
    }
    if (typeof item.reasoning !== 'string' || item.reasoning.trim().length < 15) {
      errors.push(`${compound}: reasoning must be at least 15 characters`);
    }

    const builtKey = builtByExam.get(item.examId)?.get(item.questionId);
    const embeddedKey = embeddedByExam.get(item.examId)?.get(item.questionId);
    if (!builtKey) {
      errors.push(`${compound}: missing from data/exam-answer-keys.json`);
      continue;
    }
    if (!embeddedKey) {
      errors.push(`${compound}: missing from index.html #exam-data answerKeys`);
      continue;
    }

    if (item.exempt === true) {
      exemptCurated += 1;
      if (item.scorable !== false) {
        errors.push(`${compound}: exempt entry must set scorable=false`);
      }
      if (!ALLOWED_EXEMPTION_CATEGORIES.has(item.exemptionCategory)) {
        errors.push(`${compound}: invalid exemptionCategory '${item.exemptionCategory}'`);
      }
      if (!ALLOWED_UNGRADEABLE_REASONS.has(item.ungradeableReason)) {
        errors.push(`${compound}: invalid ungradeableReason '${item.ungradeableReason}'`);
      }
      if (Array.isArray(item.candidates) && item.candidates.length > 0) {
        errors.push(`${compound}: exempt entry must have empty candidates`);
      }
      if (builtKey.scorable !== false || builtKey.exemptionCategory !== item.exemptionCategory) {
        errors.push(`${compound}: built key exemptionCategory mismatch`);
      }
      if (embeddedKey.scorable !== false || embeddedKey.exemptionCategory !== item.exemptionCategory) {
        errors.push(`${compound}: embedded key exemptionCategory mismatch`);
      }
      const probeInput = question.responseType === 'choice' || question.responseType === 'true-false'
        ? question.options?.[0]?.id || 'A'
        : 'Sample learner essay response with multiple words for advisory rubric verification.';
      const grade = gradeExamQuestion(question, probeInput, builtKey);
      if (grade.scorable !== false || grade.result !== 'ungraded' || grade.earnedCredit !== 0) {
        errors.push(`${compound}: exempt entry graded as scorable/credit (${grade.result}, ${grade.earnedCredit})`);
      }
    } else {
      scorableCurated += 1;
      if (item.scorable !== true || item.exempt !== false) {
        errors.push(`${compound}: scorable entry must set scorable=true and exempt=false`);
      }
      if (!Array.isArray(item.candidates) || item.candidates.length === 0) {
        errors.push(`${compound}: scorable entry must have non-empty candidates`);
      }
      if (item.confidence && !ALLOWED_CURATED_CONFIDENCE.has(item.confidence)) {
        errors.push(`${compound}: invalid confidence '${item.confidence}'`);
      }
      if (builtKey.scorable !== true || builtKey.verificationStatus !== 'curated_verified') {
        errors.push(`${compound}: built key did not apply scorable curated override`);
      }
      if (embeddedKey.scorable !== true || embeddedKey.verificationStatus !== 'curated_verified') {
        errors.push(`${compound}: embedded key in index.html out of sync with curated override`);
      }
      const allAcceptable = [
        ...(item.candidates || []),
        ...(item.acceptedAlternatives || []),
      ];
      for (const candidate of allAcceptable) {
        let learnerInput = candidate;
        if (question.responseType === 'choice' || question.responseType === 'true-false') {
          const byId = (question.options || []).find((o) => o.id === candidate);
          const byLabel = (question.options || []).find(
            (o) => String(o.label || '').trim().toUpperCase() === String(candidate || '').trim().toUpperCase()
          );
          const opt = byId || byLabel;
          if (!opt) {
            errors.push(`${compound}: choice candidate '${candidate}' does not match any parsed option`);
            continue;
          }
          learnerInput = opt.id;
        }
        const grade = gradeExamQuestion(question, learnerInput, builtKey);
        if (grade.result !== 'correct' || grade.earnedCredit !== 1) {
          errors.push(
            `${compound}: candidate '${candidate}' failed runtime self-grade (got result=${grade.result}, credit=${grade.earnedCredit})`
          );
        }
      }
    }
  }

  let totalQuestions = 0;
  let totalScorable = 0;
  let totalExempt = 0;
  for (const [examId, qMap] of parsedQuestionsByExam.entries()) {
    const kMap = builtByExam.get(examId);
    const eMap = embeddedByExam.get(examId);
    if (!kMap) {
      errors.push(`${examId}: missing exam entry in data/exam-answer-keys.json`);
      continue;
    }
    if (!eMap) {
      errors.push(`${examId}: missing embedded answerKeys in index.html #exam-data`);
      continue;
    }
    for (const qId of qMap.keys()) {
      totalQuestions += 1;
      const key = kMap.get(qId);
      const emb = eMap.get(qId);
      if (!key) {
        errors.push(`${examId}::${qId}: missing key in data/exam-answer-keys.json`);
        continue;
      }
      if (!emb) {
        errors.push(`${examId}::${qId}: missing key in index.html #exam-data`);
        continue;
      }
      if (key.verificationStatus === 'missing' || key.ungradeableReason === 'no-source-answer') {
        errors.push(`${examId}::${qId}: unresolved missing key remains`);
      }
      if (key.verificationStatus === 'inferred_unverified') {
        errors.push(`${examId}::${qId}: forbidden inferred_unverified status present`);
      }
      if (key.scorable) {
        totalScorable += 1;
      } else if (key.exempt === true) {
        totalExempt += 1;
        if (!ALLOWED_EXEMPTION_CATEGORIES.has(key.exemptionCategory)) {
          errors.push(`${examId}::${qId}: non-scorable key missing valid exemptionCategory (got '${key.exemptionCategory}')`);
        }
      } else {
        errors.push(`${examId}::${qId}: non-scorable key is not formally exempt`);
      }
    }
  }

  if (auditDoc.totals?.missing !== 0) {
    errors.push(`docs/exam-scoring-audit.json totals.missing must be 0, got ${auditDoc.totals?.missing}`);
  }
  if (auditDoc.totals?.nonExemptCoveragePct !== 100) {
    errors.push(`docs/exam-scoring-audit.json nonExemptCoveragePct must be 100, got ${auditDoc.totals?.nonExemptCoveragePct}`);
  }
  if (auditDoc.totals?.scoredQuestions !== totalScorable || auditDoc.totals?.exemptQuestions !== totalExempt) {
    errors.push('docs/exam-scoring-audit.json totals out of sync with data/exam-answer-keys.json');
  }

  const nonExemptQuestions = totalQuestions - totalExempt;
  const nonExemptCoveragePct =
    nonExemptQuestions > 0 ? Math.round((totalScorable / nonExemptQuestions) * 10000) / 100 : 100;

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      curatedEntries: seenCurated.size,
      scorableCurated,
      exemptCurated,
      totalQuestions,
      totalScorable,
      totalExempt,
      nonExemptCoveragePct,
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = verifyCuratedKeys();
  if (!res.ok) {
    console.error(`verify_curated_keys FAILED (${res.errors.length} errors):`);
    for (const err of res.errors.slice(0, 30)) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(
    `verify_curated_keys OK: curated=${res.summary.curatedEntries} ` +
      `(scorable=${res.summary.scorableCurated}, exempt=${res.summary.exemptCurated}); ` +
      `archive=${res.summary.totalScorable}/${res.summary.totalQuestions} scorable, ` +
      `${res.summary.totalExempt} exempt, nonExemptCoveragePct=${res.summary.nonExemptCoveragePct}%`
  );
}
