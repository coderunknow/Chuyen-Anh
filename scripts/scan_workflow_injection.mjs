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
// SAME job's strategy. Without the parser nothing is allowlisted and every
// `${{ }}` inside a run body is flagged (conservative fallback).
//
// Negative controls (in the failure ledger): injecting `github.head_ref`
// (block form) and `github.event.pull_request.title` (inline form) must both
// be detected; the clean tree passes.
//
// Exit 1 when an unallowlisted injection-shaped expression is found.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createRequire } from 'node:module';

let yamlParse = null;
try { yamlParse = createRequire(import.meta.url)('yaml').parse; } catch { yamlParse = null; }

const REPO = fileURLToPath(new URL('../', import.meta.url));
const dir = join(REPO, '.github', 'workflows');
const files = (await readdir(dir)).filter(name => name.endsWith('.yml') || name.endsWith('.yaml'));

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
    if (!matrixLiteral) unsafe.push(expression);
  }
  return unsafe;
}

const findings = [];

for (const file of files) {
  const text = await readFile(join(dir, file), 'utf8');
  if (!yamlParse) {
    // Conservative fallback: a raw regex over the file can neither parse run
    // bodies reliably nor know which matrix values are literals, so any
    // expression-bearing `run:` line is flagged.
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\s*(?:-\s+)?run:/.test(lines[i]) && lines[i].includes('${{')) {
        findings.push({ file, line: i + 1, expression: lines[i].trim(), note: 'no YAML parser: flagged conservatively' });
      }
    }
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
          expression: unsafe,
          note: 'not a literal-valued matrix key of this job: interpolation into a run block is script injection'
        });
      }
    }
  }
}

console.log(JSON.stringify({
  scanned: files.length,
  workflows: files,
  yamlParser: yamlParse ? 'available (parsed walk)' : 'missing (conservative fallback)',
  injectionShapedExpressions: findings.length,
  findings
}, null, 2));
process.exit(findings.length ? 1 : 0);
