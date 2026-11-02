// rc10 — the P3/P4 audit layer, built from facts the repository can prove.
//
// For every existing vocabulary row and every existing phrase this writes one
// disposition record. What each record may and may not claim:
//
//   * `machine_assessed` — the row was checked by deterministic rules against the
//     dataset, the exam archive and the source registry. This is NOT manual
//     verification and is never counted as such. The gate that requires a
//     completed per-entry dictionary review stays OPEN for these rows.
//   * `inspected_*` — a human-readable reference lookup was read for that row
//     (see audit/rc10/evidence/manual-verifications.jsonl). Only these count
//     toward the "every entry individually reviewed" gate.
//
// Every record carries: stored level, level-source, exam-occurrence evidence,
// duplicate verdict, structural problems, and the exact reason for its status.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
const auditDir = path.join(root, 'audit/rc10');
const evidenceDir = path.join(auditDir, 'evidence');

const readJsonl = file => (fs.existsSync(file)
  ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  : []);

const manual = new Map(readJsonl(path.join(evidenceDir, 'manual-verifications.jsonl')).map(row => [`${row.kind}:${row.id}`, row]));
// Reference lanes. `attested` holds the per-entry primary lookups made through the
// reference pipeline (tools/oxford-attest.mjs); `join` holds, for every row, which
// lanes cover it. Neither can change data by itself — only build-audit reads them.
const attested = new Map(readJsonl(path.join(evidenceDir, 'reference-attestations.jsonl')).map(row => [`${row.kind}:${row.id}`, row]));
const join = new Map(readJsonl(path.join(evidenceDir, 'reference-join.jsonl')).map(row => [`${row.kind}:${row.id}`, row]));
const blocks = new Set(readJsonl(path.join(evidenceDir, 'correction-blocks.jsonl')).map(row => row.id));
const STUDY_SCOPE = new Set(['B1', 'B2', 'C1', 'C2']);
const examVocab = new Map(readJsonl(path.join(evidenceDir, 'exam-occurrences-vocabulary.jsonl')).map(row => [row.id, row]));
const examPhrase = new Map(readJsonl(path.join(evidenceDir, 'exam-occurrences-phrases.jsonl')).map(row => [row.id, row]));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const vocabulary = JSON.parse(html.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const phrases = JSON.parse(html.match(/<script id="phrase-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const tagValue = (row, prefix) => (row.tags || []).map(tag => tag.split(':')).find(([key]) => key === prefix)?.[1];
const levelOf = row => {
  const value = tagValue(row, 'level');
  return value ? value.toUpperCase() : 'UNCLASSIFIED';
};

// ---- duplicate detection ---------------------------------------------------
// Distinct lemmas are not duplicates: `take`, `take up` and `take into account`
// are three different entries, and a homonym in another part of speech is kept.
const normalize = value => String(value).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
const wordKey = row => `${normalize(row.word)}|${String(row.pos || '').toLowerCase()}`;
const seenWord = new Map();
for (const row of vocabulary) {
  const key = wordKey(row);
  if (!seenWord.has(key)) seenWord.set(key, []);
  seenWord.get(key).push(row.id);
}
const phraseIds = new Map();
for (const row of phrases) {
  const key = normalize(row.phrase);
  if (!phraseIds.has(key)) phraseIds.set(key, []);
  phraseIds.get(key).push(row.id);
}

// ---- structural checks -----------------------------------------------------
const vocabById = new Map(vocabulary.map(row => [row.id, row]));
const rows = [];

for (const row of vocabulary) {
  const level = levelOf(row);
  const source = tagValue(row, 'level-source') || 'none';
  const evidence = examVocab.get(row.id);
  const duplicates = (seenWord.get(wordKey(row)) || []).filter(id => id !== row.id);
  const problems = [];
  if (!row.meaning || !String(row.meaning).trim()) problems.push('missing Vietnamese gloss');
  if (!row.pos || !String(row.pos).trim()) problems.push('missing part of speech');
  if (!row.word || !String(row.word).trim()) problems.push('missing headword');
  if (level === 'UNCLASSIFIED') problems.push('no CEFR level tag');
  if (source === 'editorial') problems.push('level is editorial, not dictionary-attested');
  if (row.familyHead && !vocabById.has(String(row.familyHead))) problems.push(`family head ${row.familyHead} does not exist`);
  if (duplicates.length) problems.push(`same headword+POS as id ${duplicates.join(', ')}`);
  const manualRecord = manual.get(`vocabulary:${row.id}`);
  const attestation = attested.get(`vocabulary:${row.id}`);
  const lanes = join.get(`vocabulary:${row.id}`) || null;
  const disposition = manualRecord
    ? (manualRecord.decision.startsWith('correct') ? 'inspected_corrected' : manualRecord.decision === 'unclassify' ? 'inspected_unclassified' : 'inspected_accepted')
    : attestation
      ? (attestation.decision === 'accept' ? 'inspected_accepted'
        : blocks.has(row.id) ? 'inspected_correction_blocked'
        : !STUDY_SCOPE.has(attestation.newLevel) ? 'inspected_below_scope'
        : attestation.ledgerFrozen ? 'inspected_pending_ledger'
        : 'inspected_corrected')
      : 'machine_assessed';
  rows.push({
    kind: 'vocabulary',
    id: row.id,
    item: row.word,
    pos: row.pos || '',
    storedLevel: level,
    levelSource: source,
    levelEvidenceStatus: manualRecord ? manualRecord.evidenceStatus
      : attestation ? attestation.evidenceStatus
      : lanes && lanes.agreeing.length ? 'corroborated_by_reference_lane'
      : (level === 'UNCLASSIFIED' ? 'unclassified' : 'editorial_only'),
    referenceLanes: lanes ? { available: Object.keys(lanes.lanes), agreeing: lanes.agreeing, disagreeing: lanes.disagreeing, disposition: lanes.disposition } : null,
    examOccurrenceCount: evidence?.examOccurrenceCount || 0,
    examPapers: evidence?.papersWithOccurrence || 0,
    examEvidenceClass: (evidence?.examOccurrenceCount || 0) > 0 ? 'archive_transcription_repost' : 'none',
    archived: (row.tags || []).includes('curation:archived'),
    familyHead: row.familyHead || null,
    duplicateOf: duplicates,
    problems,
    referenceAttestation: attestation ? {
      reference: attestation.reference,
      url: attestation.url,
      entryUrl: attestation.entryUrl,
      locator: attestation.locator,
      retrieved: attestation.retrieved,
      excerpt: attestation.excerpt,
      referenceLabel: attestation.referenceLabel,
      decision: attestation.decision,
      newLevel: attestation.newLevel,
      ledgerFrozen: attestation.ledgerFrozen,
      reasoning: attestation.reasoning
    } : null,
    manualVerification: manualRecord ? {
      reference: manualRecord.reference,
      url: manualRecord.url,
      retrieved: manualRecord.retrieved,
      sense: manualRecord.sense,
      referenceLabel: manualRecord.referenceLabel,
      evidenceStatus: manualRecord.evidenceStatus,
      decision: manualRecord.decision,
      applied: manualRecord.decision === 'correct',
      newLevel: manualRecord.newLevel || null,
      reasoning: manualRecord.reasoning
    } : null,
    disposition,
    dispositionReason: manualRecord
      ? 'individual reference lookup recorded in audit/rc10/evidence/manual-verifications.jsonl'
      : attestation
        ? `primary attestation in audit/rc10/evidence/reference-attestations.jsonl (${attestation.locator})`
        : lanes && lanes.agreeing.length
          ? `reference lane(s) ${lanes.agreeing.join(', ')} agree with the stored label; corroboration, not attestation`
          : `machine_assessed: ${problems.length ? problems.join('; ') : 'no structural problem found'}; no primary attestation yet`
  });
}

for (const row of phrases) {
  const level = levelOf(row);
  const evidence = examPhrase.get(row.id);
  const duplicates = (phraseIds.get(normalize(row.phrase)) || []).filter(id => id !== row.id);
  const problems = [];
  if (!row.meaning || !String(row.meaning).trim()) problems.push('missing Vietnamese gloss');
  if (!row.phrase || !String(row.phrase).trim()) problems.push('missing phrase');
  if (!row.type) problems.push('missing phrase type');
  if (level === 'UNCLASSIFIED') problems.push('no CEFR level tag');
  if (tagValue(row, 'level-source') === 'editorial' || !tagValue(row, 'level-source')) problems.push('level is editorial, not dictionary-attested');
  if (duplicates.length) problems.push(`duplicate phrase text as id ${duplicates.join(', ')}`);
  const words = String(row.phrase).split(/\s+/).length;
  const isPhrasalVerb = row.type === 'phrasal-verb';
  if (isPhrasalVerb && words < 2) problems.push('phrasal verb with a single token');
  const manualRecord = manual.get(`phrase:${row.id}`);
  // Phrases have no primary-attestation lane yet (a phrase level needs a phrase
  // reference, not a headword one), so these stay empty for now.
  const attestation = attested.get(`phrase:${row.id}`);
  const lanes = join.get(`phrase:${row.id}`) || null;
  rows.push({
    kind: 'phrase',
    id: row.id,
    item: row.phrase,
    type: row.type || '',
    storedLevel: level,
    levelSource: tagValue(row, 'level-source') || 'none',
    levelEvidenceStatus: manualRecord ? manualRecord.evidenceStatus
      : attestation ? attestation.evidenceStatus
      : lanes && lanes.agreeing.length ? 'corroborated_by_reference_lane'
      : (level === 'UNCLASSIFIED' ? 'unclassified' : 'editorial_only'),
    referenceLanes: lanes ? { available: Object.keys(lanes.lanes), agreeing: lanes.agreeing, disagreeing: lanes.disagreeing, disposition: lanes.disposition } : null,
    examOccurrenceCount: evidence?.examOccurrenceCount || 0,
    examPapers: evidence?.papersWithOccurrence || 0,
    examEvidenceClass: (evidence?.examOccurrenceCount || 0) > 0 ? 'archive_transcription_repost' : 'none',
    duplicateOf: duplicates,
    problems,
    manualVerification: manualRecord || null,
    disposition: manualRecord
      ? (manualRecord.decision.startsWith('correct') ? 'inspected_corrected' : 'inspected_accepted')
      : 'machine_assessed',
    dispositionReason: manualRecord
      ? 'individual reference lookup recorded in audit/rc10/evidence/manual-verifications.jsonl'
      : attestation
        ? `primary attestation in audit/rc10/evidence/reference-attestations.jsonl (${attestation.locator})`
        : lanes && lanes.agreeing.length
          ? `reference lane(s) ${lanes.agreeing.join(', ')} agree with the stored label; corroboration, not attestation`
          : `machine_assessed: ${problems.length ? problems.join('; ') : 'no structural problem found'}; no primary attestation yet`
  });
}

fs.writeFileSync(path.join(evidenceDir, 'p3-p4-audit.jsonl'), rows.map(row => JSON.stringify(row)).join('\n') + '\n');

const count = (list, key) => list.reduce((acc, row) => { acc[row[key]] = (acc[row[key]] || 0) + 1; return acc; }, {});
const byKind = kind => rows.filter(row => row.kind === kind);
const summary = {
  generatedAt: new Date().toISOString(),
  vocabulary: {
    rows: byKind('vocabulary').length,
    disposition: count(byKind('vocabulary'), 'disposition'),
    byLevel: count(byKind('vocabulary'), 'storedLevel'),
    withExamOccurrence: byKind('vocabulary').filter(row => row.examOccurrenceCount > 0).length,
    withoutExamOccurrence: byKind('vocabulary').filter(row => row.examOccurrenceCount === 0).length,
    rowsWithProblems: byKind('vocabulary').filter(row => row.problems.length).length,
    duplicateRows: byKind('vocabulary').filter(row => row.duplicateOf.length).length,
    editorialLevels: byKind('vocabulary').filter(row => row.levelSource === 'editorial').length
  },
  phrases: {
    rows: byKind('phrase').length,
    disposition: count(byKind('phrase'), 'disposition'),
    byLevel: count(byKind('phrase'), 'storedLevel'),
    withExamOccurrence: byKind('phrase').filter(row => row.examOccurrenceCount > 0).length,
    withoutExamOccurrence: byKind('phrase').filter(row => row.examOccurrenceCount === 0).length,
    rowsWithProblems: byKind('phrase').filter(row => row.problems.length).length,
    duplicateRows: byKind('phrase').filter(row => row.duplicateOf.length).length,
    phrasalVerbs: byKind('phrase').filter(row => row.type === 'phrasal-verb').length
  },
  gateP3: {
    requirement: 'every existing vocabulary row has an individual reference lookup and final disposition',
    verifiedIndividually: byKind('vocabulary').filter(row => row.disposition.startsWith('inspected_')).length,
    outstanding: byKind('vocabulary').filter(row => row.disposition === 'machine_assessed').length,
    status: 'FAIL'
  },
  gateP4: {
    requirement: 'every existing phrase row has an individual reference lookup and final disposition',
    verifiedIndividually: byKind('phrase').filter(row => row.disposition.startsWith('inspected_')).length,
    outstanding: byKind('phrase').filter(row => row.disposition === 'machine_assessed').length,
    status: 'FAIL'
  }
};
fs.writeFileSync(path.join(evidenceDir, 'p3-p4-audit-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
