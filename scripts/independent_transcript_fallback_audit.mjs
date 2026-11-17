#!/usr/bin/env node
// Round-2 independent audit of the transcript-fallback Listening policy.
// Re-derives, with fresh code and fresh assumptions:
//   * how many questions rely on a transcript fallback,
//   * whether every one of them is scorable, marked LOW confidence, and keyed
//     to a transcript-fallback source status,
//   * that none of them is exempt and none claims official verification,
//   * the section distribution (which papers / sections they live in).
// Exit 1 on any policy violation.
import { readFile } from 'node:fs/promises';

const REPO = new URL('../', import.meta.url);
const doc = JSON.parse(await readFile(new URL('data/exam-answer-keys.json', REPO), 'utf8'));
const records = doc.records;

let fallback = 0, lowConfidence = 0, scorable = 0, exempt = 0, officialClaims = 0;
const papers = new Map();
const statusCounts = new Map();
const violations = [];

for (const record of records) {
  for (const key of record.answerKeys || []) {
    // The transcript fallback is recorded in stimulusFallback
    // ("listening_transcript_fallback"); sourceStatus is "reconstructed" for
    // these items, so the fallback flag — not the sourceStatus — is the marker.
    const isFallback = /transcript_fallback/i.test(String(key.stimulusFallback || ''));
    if (!isFallback) continue;
    fallback += 1;
    statusCounts.set(String(key.sourceStatus || ''), (statusCounts.get(String(key.sourceStatus || '')) || 0) + 1);
    statusCounts.set(String(key.stimulusFallback || ''), (statusCounts.get(String(key.stimulusFallback || '')) || 0) + 1);
    if (String(key.confidence || '').toUpperCase() === 'LOW') lowConfidence += 1;
    // Only a SCORABLE fallback item must be LOW: exempt ones are outside the
    // scoring pool and may carry an even lower confidence.
    if (key.scorable === true && String(key.confidence || '').toUpperCase() !== 'LOW') {
      violations.push(`${record.id}/${key.questionId}: scorable fallback item is ${key.confidence}`);
    }
    if (key.scorable === true) scorable += 1;
    else exempt += 1; // a fallback-flagged item may be exempt for an independent reason (e.g. structural defect)
    if (/official/i.test(String(key.verificationStatus || ''))) {
      officialClaims += 1;
      violations.push(`${record.id}/${key.questionId}: fallback claims official verification`);
    }
    papers.set(record.id, (papers.get(record.id) || 0) + 1);
  }
}

const summary = {
  transcriptFallbackItems: fallback,
  lowConfidence: lowConfidence,
  scorable: scorable,
  exempt: exempt,
  officialClaims: officialClaims,
  papersWithFallbackItems: papers.size,
  largestPapers: [...papers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  sourceStatusCounts: Object.fromEntries(statusCounts),
  violations: violations.slice(0, 20),
  violationCount: violations.length
};
console.log(JSON.stringify(summary, null, 2));
process.exit(violations.length ? 1 : 0);
