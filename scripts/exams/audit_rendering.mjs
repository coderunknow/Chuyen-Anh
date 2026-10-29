#!/usr/bin/env node
// Structural audit of all 106 stored transcriptions through the shipped renderer.
// It does not compare text with official originals; it detects source/renderer
// hazards that can be decided from the stored bytes alone.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const check = process.argv.includes('--check');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const plan = JSON.parse(fs.readFileSync(path.join(root, 'scripts/exams/selection.json'), 'utf8'));
const keyManifest = JSON.parse(fs.readFileSync(path.join(root, 'data/exam-answer-keys.json'), 'utf8'));
const keyById = new Map(keyManifest.records.map(record => [record.id, record]));
const totals = { records: 0, rendered: 0, questions: 0, headings: 0, tables: 0, codeBlocks: 0, escapedMarkdown: 0, rawUnsafeHtml: 0, unsafeLinks: 0, imagePlaceholders: 0, unclosedFences: 0, malformedTables: 0, controlCharacters: 0, duplicateHeadingLabels: 0, renderingErrors: 0, renderedScriptTags: 0, renderedEventHandlers: 0 };
const records = [];
for (const item of plan) {
  const text = fs.readFileSync(path.join(root, 'De-chuyen-Anh-vao-10', `${item.key}.md`), 'utf8');
  const body = text.split(/^---\n[\s\S]*?\n---\n/m)[1];
  const lines = body.split('\n');
  let fence = false, unclosed = false;
  for (const line of lines) if (/^\s*```/.test(line)) fence = !fence;
  unclosed = fence;
  let rendered = { html: '', headings: [] }, error = null;
  try { rendered = app.renderExamMarkdown(body, item.key); } catch (errorInRenderer) { error = String(errorInRenderer?.message || errorInRenderer); }
  const output = rendered.html;
  const questions = app.parseExamQuestions(body, item.key);
  let malformedTables = 0, tableRules = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*\|.*\|\s*$/.test(lines[i])) continue;
    const next = lines[i + 1] || '';
    if (!/^\s*\|[\s:|-]+\|\s*$/.test(next)) { malformedTables += 1; continue; }
    tableRules += 1;
    const width = lines[i].replace(/^\||\|$/g, '').split('|').length;
    const ruleWidth = next.replace(/^\||\|$/g, '').split('|').length;
    if (width !== ruleWidth) malformedTables += 1;
    let j = i + 2;
    while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
      if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[j])) {
        const rowWidth = lines[j].replace(/^\||\|$/g, '').split('|').length;
        if (rowWidth !== width) malformedTables += 1;
      }
      j += 1;
    }
    i = j - 1;
  }
  const result = {
    id: item.key, quality: item.quality, lines: lines.length, questions: questions.length,
    keyed: keyById.get(item.key)?.answerKeys.filter(k => k.verificationStatus !== 'missing_answer' && k.verificationStatus !== 'ambiguous_review').length || 0,
    headings: rendered.headings.length, tables: tableRules, codeBlocks: Math.floor(lines.filter(line => /^\s*```/.test(line)).length / 2),
    escapedMarkdown: (body.match(/\\[\\`*_{}\[\]()#+.!|>-]/g) || []).length,
    rawUnsafeHtml: (body.match(/<(?!\/?(?:u|br)\b)[a-z][^>]*>/gi) || []).length,
    unsafeLinks: (body.match(/\]\(\s*(?:javascript|data|vbscript):/gi) || []).length,
    imagePlaceholders: (body.match(/!\[[^\]]*\]\([^)]*\)/g) || []).length,
    unclosedFences: unclosed ? 1 : 0,
    malformedTables,
    controlCharacters: (body.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g) || []).length,
    duplicateHeadingLabels: rendered.headings.length - new Set(rendered.headings.map(h => h.label)).size,
    renderingErrors: error ? 1 : 0,
    renderedScriptTags: (output.match(/<script\b|<iframe\b/gi) || []).length,
    renderedEventHandlers: (output.match(/\son\w+\s*=/gi) || []).length,
    rendererOutputBytes: Buffer.byteLength(output)
  };
  if (error) result.error = error;
  totals.records += 1;
  if (!error) totals.rendered += 1;
  for (const key of ['questions','headings','tables','codeBlocks','escapedMarkdown','rawUnsafeHtml','unsafeLinks','imagePlaceholders','unclosedFences','malformedTables','controlCharacters','duplicateHeadingLabels','renderingErrors','renderedScriptTags','renderedEventHandlers']) totals[key] += result[key];
  records.push(result);
}
const report = { schemaVersion: 1, generatedBy: 'scripts/exams/audit_rendering.mjs', scope: 'All 106 stored transcription bodies rendered through the shipped Markdown renderer; not a comparison with official originals.', totals,
  limits: ['A source checksum proves stored bytes, not fidelity to the official paper.', 'Structural rendering checks cannot prove OCR text or answer keys are correct.', 'Only a browser subset receives visual inspection; the static audit cannot detect every CSS/layout defect.'],
  records };
const md = ['# Exam rendering audit', '', report.scope, '', '| Metric | Count |', '| --- | ---: |', ...Object.entries(totals).map(([k,v]) => `| ${k} | ${v} |`), '', '## Records with flags', '', '| Paper | Questions | Unclosed fence | Raw unsafe HTML | Unsafe links | Malformed table | Renderer error |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |', ...records.filter(r => r.unclosedFences || r.rawUnsafeHtml || r.unsafeLinks || r.malformedTables || r.renderingErrors || r.renderedScriptTags || r.renderedEventHandlers).map(r => `| ${r.id} | ${r.questions} | ${r.unclosedFences} | ${r.rawUnsafeHtml} | ${r.unsafeLinks} | ${r.malformedTables} | ${r.renderingErrors} |`), '', 'The audit keeps source anomalies visible instead of rewriting the transcription. All rendered output is escaped except the explicitly supported `<u>` and `<br>` forms.'].join('\n') + '\n';
const outputs = [['docs/exam-rendering-audit.json', JSON.stringify(report, null, 2) + '\n'], ['docs/exam-rendering-audit.md', md]];
let stale = false;
for (const [rel, content] of outputs) {
  const file = path.join(root, rel);
  if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) { console.error(`Stale: ${rel}`); stale = true; } }
  else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
}
if (check && stale) process.exit(1);
console.log(`${check ? 'Checked' : 'Audited'} ${totals.records} transcriptions: ${totals.questions} questions, ${totals.renderingErrors} renderer errors, ${totals.renderedScriptTags} script tags, ${totals.renderedEventHandlers} inline handlers.`);
