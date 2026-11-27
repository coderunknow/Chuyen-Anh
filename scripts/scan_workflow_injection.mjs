#!/usr/bin/env node
// Security scan: GitHub Actions script injection.
//
// `${{ … }}` interpolated straight into a `run:` block lets workflow inputs,
// branch names, PR titles or commit messages execute as shell. The safe
// patterns are `env:` indirection or an `if:` expression (never shell).
//
// Approach: when the optional `yaml` parser is available the scan walks the
// PARSED document — each job's `steps[].run` value (block scalars, inline
// scalars, comments after the header and `|2`-style indicators all handled by
// the parser) — and inspects EVERY `${{ expression }}` in that script text.
// An expression is allowlisted only when it interpolates `matrix.<key>` and
// that key's values are scalar literals WITHOUT expressions, defined in the
// SAME job's strategy. Without the parser the scan falls back to a
// conservative line scan that still inspects the FULL run body: the header
// line, the whole indented block-scalar body (`|`, `>`, chomping and explicit
// indent indicators, blank lines and comments included), quoted and plain
// inline continuations, and alias-valued `run:` steps (which cannot be
// resolved safely, so they are flagged). The same allowlist rule is applied
// through a strict line scan of the enclosing job's `strategy: matrix:` block;
// it only recognises single-line plain/quoted scalars, single-line flow
// sequences and block sequences of plain scalars — anything else (flow maps,
// multi-line flow collections, include/exclude, expressions) is NOT
// allowlisted, so the fallback can never allow more than the parsed walk.
//
// Negative controls (in the failure ledger and tests/workflow-injection-scan.test.mjs):
// injecting `github.head_ref` (inline form) and `github.event.pull_request.title`
// (block form) must both be detected; the clean tree passes with AND without
// the parser.
//
// Exit 1 when an unallowlisted injection-shaped expression is found.
import { readFile, readdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const WORKFLOW_DIR = join(REPO, '.github', 'workflows');

// Resolved at call time (not import time) so tests can force either path.
function resolveYamlParse() {
  try { return createRequire(import.meta.url)('yaml').parse; } catch { return null; }
}

// Returns true when the value is a scalar literal with no expression in it.
const isLiteralValue = (value) =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value)
    ? !/\$\{\{/.test(String(value ?? ''))
    : false;

// Collect, per job, the matrix keys whose values are ALL scalar literals
// without expressions. `${{ matrix.<key> }}` for such a key is safe by
// construction (no attacker-controlled text can enter the matrix), and the
// exception is local to the consuming job.
function literalMatrixKeys(job) {
  const keys = new Set();
  const matrix = job?.strategy?.matrix;
  if (!matrix || typeof matrix !== 'object') return keys;
  for (const [key, value] of Object.entries(matrix)) {
    const values = Array.isArray(value) ? value : [value];
    if (values.every(isLiteralValue) && values.length > 0) keys.add(key);
  }
  return keys;
}

// Every `${{ … }}` expression in the script text; a line passes only when ALL
// of its expressions are allowlisted.
const EXPRESSION = /\$\{\{\s*([^}]+?)\s*\}\}/g;
function unsafeExpressions(script, allow) {
  const unsafe = [];
  for (const match of script.matchAll(EXPRESSION)) {
    const expression = match[1];
    const matrixLiteral = /^matrix\.([\w-]+)$/.test(expression) && allow.has(expression.slice('matrix.'.length));
    if (!matrixLiteral) unsafe.push({ expression, index: match.index, text: match[0] });
  }
  return unsafe;
}

// ---------------------------------------------------------------------------
// No-parser fallback: a conservative line scan that still sees block bodies.
// ---------------------------------------------------------------------------

const indentOf = (line) => line.length - line.trimStart().length;
const isBlank = (line) => line.trim() === '';
const isComment = (line) => line.trimStart().startsWith('#');

// Top-level `jobs:` block: the ranges of the keys directly under it. When the
// structure cannot be recognised, an empty list is returned and nothing is
// allowlisted (conservative).
function findJobRanges(lines) {
  let jobsIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^jobs:\s*(#.*)?$/.test(lines[i])) { jobsIndex = i; break; }
  }
  if (jobsIndex < 0) return [];
  let j = jobsIndex + 1;
  while (j < lines.length && (isBlank(lines[j]) || isComment(lines[j]))) j += 1;
  if (j >= lines.length) return [];
  const jobIndent = indentOf(lines[j]);
  if (jobIndent === 0) return [];
  const ranges = [];
  let current = null;
  for (let i = j; i < lines.length; i += 1) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const indent = indentOf(line);
    if (indent < jobIndent) break; // left the jobs block
    if (indent === jobIndent && /^\s*[\w.-]+:\s*(#.*)?$/.test(line)) {
      if (current) current.end = i;
      current = { name: line.split(':')[0].trim(), start: i, end: lines.length };
      ranges.push(current);
    }
  }
  return ranges;
}

// A plain scalar literal: no expressions, no collection punctuation, no
// anchors/aliases/tags. Optionally one layer of balanced quotes.
function isPlainScalarLiteral(raw) {
  let value = raw.trim();
  if (!value) return false;
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.length > 1 && value[value.length - 1] === quote) {
    value = value.slice(1, -1);
    if (value.includes(quote)) return false; // escaped quote: not recognised
  }
  if (/\$\{\{/.test(value)) return false;
  if (/[\[\]{},]/.test(value)) return false;
  if (/^[&*!]/.test(value)) return false;
  return true;
}

// A `key: value` scalar with any trailing comment removed (plain scalars only;
// quoted values are passed through untouched).
function scalarValuePart(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) return trimmed;
  return trimmed.replace(/\s+#.*$/, '').trim();
}

// Collect the items of a block sequence that starts at `startIndex + 1`
// (items may sit at `itemIndent` or deeper). Returns null when anything in it
// is not a plain scalar — the caller then does not allowlist the key.
function collectBlockSeqItems(lines, startIndex, itemIndent, endIndex) {
  const items = [];
  for (let i = startIndex + 1; i < endIndex; i += 1) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) continue;
    const indent = indentOf(line);
    if (indent < itemIndent) break;
    const item = /^(\s*)-\s+(.*)$/.exec(line);
    if (!item || item[1].length !== itemIndent) {
      if (items.length) break;
      return null;
    }
    const value = scalarValuePart(item[2]);
    if (!value || value.includes(': ') || !isPlainScalarLiteral(value)) return null;
    items.push(value);
  }
  return items;
}

// The same allowlist rule as `literalMatrixKeys`, derived from a strict line
// scan of the job's `strategy: matrix:` block. Only single-line plain/quoted
// scalars, single-line flow sequences and block sequences of plain scalars
// count as literal; everything else keeps the key unallowlisted.
function fallbackLiteralMatrixKeys(lines, job) {
  const keys = new Set();
  for (let s = job.start + 1; s < job.end; s += 1) {
    const strategyMatch = /^(\s*)strategy:\s*(#.*)?$/.exec(lines[s]);
    if (!strategyMatch || isBlank(lines[s]) || isComment(lines[s])) continue;
    const strategyIndent = strategyMatch[1].length;
    for (let i = s + 1; i < job.end; i += 1) {
      const line = lines[i];
      if (isBlank(line) || isComment(line)) continue;
      const indent = indentOf(line);
      if (indent <= strategyIndent) break; // left the strategy block
      const matrixMatch = indent === strategyIndent + 2 ? /^\s*matrix:\s*(#.*)?$/.exec(line) : null;
      if (!matrixMatch) continue;
      for (let k = i + 1; k < job.end; k += 1) {
        const keyLine = lines[k];
        if (isBlank(keyLine) || isComment(keyLine)) continue;
        const keyIndent = indentOf(keyLine);
        if (keyIndent <= indent) break; // left the matrix block
        if (keyIndent !== indent + 2) continue; // nested continuation
        const keyMatch = /^\s*([\w.-]+):\s*(.*)$/.exec(keyLine);
        if (!keyMatch) continue;
        const key = keyMatch[1];
        if (key === 'include' || key === 'exclude') continue;
        const raw = keyMatch[2].trim();
        if (!raw) {
          // Block sequence below the key (items at the key's indent or deeper).
          const items = collectBlockSeqItems(lines, k, indent + 2, job.end);
          if (items && items.length) keys.add(key);
          continue;
        }
        if (/\$\{\{/.test(raw)) continue;
        if (raw.startsWith('[')) {
          if (!/^\[[^\[\]{}]*\]$/.test(raw)) continue; // multi-line or nested flow
          const items = raw.slice(1, -1).split(',').map((item) => scalarValuePart(item)).filter(Boolean);
          if (!items.length || !items.every(isPlainScalarLiteral)) continue;
          keys.add(key);
          continue;
        }
        if (isPlainScalarLiteral(scalarValuePart(raw))) keys.add(key);
      }
      break; // only the first matrix block of this strategy is recognised
    }
    break; // only the first strategy block of this job is recognised
  }
  return keys;
}

// Scan one file without a parser: every `run:` key's FULL script text (header,
// block-scalar body, inline continuations) is inspected.
function fallbackScanFile(text, file) {
  const lines = text.split('\n');
  const findings = [];
  const jobs = findJobRanges(lines);
  const jobOf = (index) => jobs.find(job => index > job.start && index < job.end) || null;
  for (let i = 0; i < lines.length; i += 1) {
    const runMatch = /^(\s*)((?:-\s+)?)run:(\s*)(.*)$/.exec(lines[i]);
    if (!runMatch) continue;
    const keyColumn = runMatch[1].length + runMatch[2].length;
    const value = runMatch[4].trim().replace(/^(?:[&!][^\s]+\s+)*/, ''); // strip anchors/tags
    if (!value) continue; // null run (e.g. `defaults: run:`) — no script
    const job = jobOf(i);
    const allow = job ? fallbackLiteralMatrixKeys(lines, job) : new Set();
    if (value.startsWith('*')) {
      findings.push({
        file, line: i + 1, expression: value,
        note: 'no YAML parser: an alias-valued run: cannot be resolved — inline the script or add the parser'
      });
      continue;
    }
    // `|`/`>` with optional indentation indicator (before or after) and chomping.
    const block = /^([|>])(?:([1-9])[+-]?|[+-](?:[1-9])?)?(?:\s+#.*)?$/.test(value);
    // Collect the script text: the block-scalar body, or the inline value with
    // its continuation lines (blank/comment lines included — a YAML comment
    // between the header and a block body, or a folded continuation, is still
    // part of what the parser would hand to `run`).
    const bodyLines = [];
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j];
      if (isBlank(line)) { bodyLines.push(''); j += 1; continue; }
      if (isComment(line) || indentOf(line) > keyColumn) { bodyLines.push(line); j += 1; continue; }
      break;
    }
    const baseLine = i + 1;
    const script = (block ? bodyLines : [value, ...bodyLines]).join('\n');
    for (const unsafe of unsafeExpressions(script, allow)) {
      const offset = script.slice(0, unsafe.index).split('\n').length - 1;
      findings.push({
        file, line: baseLine + offset, expression: unsafe.expression,
        note: 'no YAML parser: flagged conservatively (full run-body scan)'
      });
    }
    i = j - 1; // the body has been consumed
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Scan entry point
// ---------------------------------------------------------------------------

export async function scanWorkflows({ dir = WORKFLOW_DIR, yamlParse = resolveYamlParse() } = {}) {
  const files = (await readdir(dir)).filter(name => name.endsWith('.yml') || name.endsWith('.yaml')).sort();
  const findings = [];

  for (const file of files) {
    const text = await readFile(join(dir, file), 'utf8');
    if (!yamlParse) {
      findings.push(...fallbackScanFile(text, file));
      continue;
    }
    let doc;
    try { doc = yamlParse(text); } catch (error) {
      findings.push({ file, line: 0, expression: `<unparseable YAML: ${error.message}>`, note: 'fix the workflow file' });
      continue;
    }
    for (const [jobName, job] of Object.entries(doc?.jobs || {})) {
      const allow = literalMatrixKeys(job);
      const steps = Array.isArray(job?.steps) ? job.steps : [];
      for (const step of steps) {
        if (step == null || typeof step !== 'object') continue;
        const run = step.run;
        if (typeof run !== 'string') continue;
        for (const unsafe of unsafeExpressions(run, allow)) {
          findings.push({
            file, job: jobName, step: step.name || '(unnamed)',
            expression: unsafe.expression,
            note: 'not a literal-valued matrix key of this job: interpolation into a run block is script injection'
          });
        }
      }
    }
  }

  return {
    scanned: files.length,
    workflows: files,
    yamlParser: yamlParse ? 'available (parsed walk)' : 'missing (conservative full-run-body fallback)',
    injectionShapedExpressions: findings.length,
    findings
  };
}

async function main() {
  const report = await scanWorkflows();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.injectionShapedExpressions ? 1 : 0);
}

if (process.argv[1] && (() => {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})()) {
  await main();
}
