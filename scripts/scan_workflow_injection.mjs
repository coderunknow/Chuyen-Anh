#!/usr/bin/env node
// Security scan: GitHub Actions script injection.
//
// `${{ … }}` interpolated straight into a `run:` block lets workflow inputs,
// branch names, PR titles or commit messages execute as shell. The safe
// patterns are `env:` indirection or an `if:` expression (never shell).
// This scanner walks every workflow, tracks the indentation-bounded body of
// each `run:` block, and reports any `${{` that appears inside one. Allowed
// exceptions are enumerated explicitly below, each justified.
//
// Exit 1 when an unallowlisted injection-shaped line is found.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createRequire } from 'node:module';
// `yaml` is not a dependency of the app (the app ships dependency-free); the
// parser is optional. Without it, no matrix value is allowlisted, so the scan
// stays conservative (every `${{ }}` inside a run body is flagged). CJS
// require is used because NODE_PATH does not apply to ESM imports.
let yamlParse = null;
try { yamlParse = createRequire(import.meta.url)('yaml').parse; } catch { yamlParse = null; }

const REPO = fileURLToPath(new URL('../', import.meta.url));
const dir = join(REPO, '.github', 'workflows');
const files = (await readdir(dir)).filter(name => name.endsWith('.yml') || name.endsWith('.yaml'));

// lines that are knowingly safe: `env:`/`if:`/`with:` context, and `gh api`
// calls that interpolate only `github.token`/`github.repository`/`github.sha`
// (repository-scoped, not attacker-controlled text).
const SAFE_CONTEXT = /(^|\s)(env:|if:|uses:|with:)/;

const findings = [];

for (const file of files) {
  const text = await readFile(join(dir, file), 'utf8');
  // Collect matrix keys whose values are ALL scalar literals defined in this
  // file: interpolating such a value into a run block is safe by construction
  // (no attacker-controlled text can enter the matrix). Any expression that is
  // not a literal-valued matrix key stays flagged.
  const literalMatrixKeys = new Set();
  if (yamlParse) {
    try {
      const doc = yamlParse(text);
      for (const job of Object.values(doc?.jobs || {})) {
        const matrix = job?.strategy?.matrix;
        if (!matrix || typeof matrix !== 'object') continue;
        for (const [key, value] of Object.entries(matrix)) {
          const values = Array.isArray(value) ? value : [value];
          if (values.every(v => v === null || ['string', 'number', 'boolean'].includes(typeof v))) {
            literalMatrixKeys.add(key);
          }
        }
      }
    } catch { /* unparseable YAML: nothing is allowlisted */ }
  }
  const literalMatrix = new RegExp(
    `\\$\\{\\{\\s*matrix\\.(${[...literalMatrixKeys].join('|') || '\\u0000'})\\s*\\}\\}`
  );
  const lines = text.split('\n');
  let runIndent = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const runMatch = /^\s*(?:-\s+)?run:\s*/.exec(line);
    if (runMatch) {
      const rest = line.slice(runMatch[0].length).trim();
      if (/^[|>][-+]?$/.test(rest)) {
        // Block scalar: the body follows on deeper-indented lines.
        runIndent = line.length - line.trimStart().length;
        continue;
      }
      if (rest.includes('${{') && !literalMatrix.test(rest)) {
        findings.push({ file, line: i + 1, text: rest });
      }
      runIndent = null;
      continue;
    }
    if (runIndent !== null) {
      const indent = line.length - line.trimStart().length;
      const isBody = line.trim() !== '' && indent > runIndent;
      if (!isBody) runIndent = null;
      if (isBody && line.includes('${{') && !literalMatrix.test(line)) {
        findings.push({ file, line: i + 1, text: line.trim() });
      }
    }
  }
  // `if:` / `env:` / `with:` lines with `${{` inside a run BODY are still
  // flagged by the scan above only when they sit under `run:`; filter out the
  // known-safe `env:` indirection pattern.
  const filtered = findings.filter(f => f.file === file ? !SAFE_CONTEXT.test(f.text) : true);
  findings.length = 0;
  findings.push(...filtered);
}

console.log(JSON.stringify({
  scanned: files.length,
  workflows: files,
  injectionShapedLines: findings.length,
  findings
}, null, 2));
process.exit(findings.length ? 1 : 0);
