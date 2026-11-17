// Independent exam-data audit (fresh code): re-parses every paper with the
// production parser, recomputes coverage/exemption/confidence numbers, and
// re-derives every SHA-256 binding in the curated manifest against the
// re-parsed prompts and canonically joined options.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const examData = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const curatedDoc = JSON.parse(await readFile(new URL('../data/exam-curated-keys.json', import.meta.url), 'utf8'));
const curated = curatedDoc.entries;

const sha = value => createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const canonicalOptions = q => (q?.options || []).map(o => `${o.id}:${o.label}:${o.text}`).join('|');

let total = 0, scorable = 0, exempt = 0, noKey = 0;
const exemptByCategory = {}, sourceStatuses = {}, confidence = {};
const noKeySample = [];
let hashOk = 0;
const hashMismatches = [];

const curatedByPaper = new Map();
for (const entry of curated) {
  if (!curatedByPaper.has(entry.examId)) curatedByPaper.set(entry.examId, new Map());
  curatedByPaper.get(entry.examId).set(entry.questionId, entry);
}

for (const record of examData) {
  const body = (record.markdown || '').split(/^---\n[\s\S]*?\n---\n/m)[1] || record.markdown || '';
  const questions = app.parseExamQuestions(body, record.id);
  const qById = new Map(questions.map(q => [q.id, q]));
  const embeddedKeys = new Map((record.answerKey || []).map(k => [k.questionId, k]));
  const curatedMap = curatedByPaper.get(record.id) || new Map();

  for (const q of questions) {
    total += 1;
    const key = embeddedKeys.get(q.id) || curatedMap.get(q.id);
    if (!key) { noKey += 1; if (noKeySample.length < 10) noKeySample.push(`${record.id}/${q.id}`); continue; }
    if (key.exempt || key.scorable === false) {
      exempt += 1;
      const cat = key.exemptionCategory || 'uncategorised';
      exemptByCategory[cat] = (exemptByCategory[cat] || 0) + 1;
      const reason = key.ungradeableReason || '-';
      const rk = `${cat} / ${reason}`;
      exemptByCategory[rk] = (exemptByCategory[rk] || 0) + 1;
    } else {
      scorable += 1;
      sourceStatuses[key.sourceStatus || 'unknown'] = (sourceStatuses[key.sourceStatus || 'unknown'] || 0) + 1;
      confidence[key.confidence || 'unknown'] = (confidence[key.confidence || 'unknown'] || 0) + 1;
    }
  }

  // Independent hash re-derivation for every curated entry of this paper.
  // An entry counts as passing only when it carries at least one hash and
  // every supplied hash matches.
  for (const [qid, entry] of curatedMap) {
    const q = qById.get(qid);
    if (!q) { hashMismatches.push(`${record.id}/${qid}: question not re-parsed`); continue; }
    const hasHash = entry.promptSha256 !== undefined || entry.optionsSha256 !== undefined;
    let entryOk = true;
    if (entry.promptSha256 !== undefined && sha(q.prompt) !== entry.promptSha256) {
      hashMismatches.push(`${record.id}/${qid}: promptSha256`);
      entryOk = false;
    }
    if (entry.optionsSha256 !== undefined && sha(canonicalOptions(q)) !== entry.optionsSha256) {
      hashMismatches.push(`${record.id}/${qid}: optionsSha256`);
      entryOk = false;
    }
    if (hasHash && entryOk) hashOk += 1;
  }
}

const verdictOk = hashMismatches.length === 0 && noKey === 0;
console.log(JSON.stringify({
  papers: examData.length, total, scorable, exempt, noKey,
  scorablePct: +(100 * scorable / total).toFixed(2),
  nonExemptCoveragePct: +(100 * scorable / (scorable + noKey)).toFixed(2),
  exemptByCategory, sourceStatuses, confidence,
  curatedHashChecked: hashOk,
  curatedHashMismatches: hashMismatches.length,
  hashMismatchSample: hashMismatches.slice(0, 8),
  noKeySample,
  verdictOk
}, null, 2));
// Exit non-zero so CI or a release gate can act on a failed audit.
process.exitCode = verdictOk ? 0 : 1;
