import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const { scanWorkflows } = await import(new URL('../scripts/scan_workflow_injection.mjs', import.meta.url));

// The parser is optional in production (dependency-free CI), so the parsed
// path is only exercised when `yaml` resolves; the fallback path is always
// exercised by forcing `yamlParse: null`.
function resolveYamlParse() {
  try { return createRequire(new URL('../scripts/scan_workflow_injection.mjs', import.meta.url))('yaml').parse; }
  catch { return null; }
}
const yamlParse = resolveYamlParse();

async function fixtureDir(files) {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-injection-scan-'));
  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(dir, name), text);
  }
  return dir;
}

const BLOCK_POISON = `name: Poisoned block
on: push
jobs:
  leak:
    runs-on: ubuntu-latest
    steps:
      - name: Example
        run: |
          echo "\${{ github.event.pull_request.title }}"
`;

const INLINE_POISON = `name: Poisoned inline
on: push
jobs:
  leak:
    runs-on: ubuntu-latest
    steps:
      - name: Inline
        run: echo "building \${{ github.head_ref }}"
`;

test('fallback: a multiline run block body is scanned, so a poisoned body is a finding', async () => {
  const dir = await fixtureDir({ 'poisoned.yml': BLOCK_POISON });
  try {
    const report = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(report.yamlParser, 'missing (conservative full-run-body fallback)');
    assert.equal(report.injectionShapedExpressions, 1, JSON.stringify(report.findings));
    assert.equal(report.findings[0].expression, 'github.event.pull_request.title');
    assert.equal(report.findings[0].line, 8);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fallback: an inline run expression is a finding', async () => {
  const dir = await fixtureDir({ 'poisoned.yml': INLINE_POISON });
  try {
    const report = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(report.injectionShapedExpressions, 1, JSON.stringify(report.findings));
    assert.equal(report.findings[0].expression, 'github.head_ref');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fallback: the whole block body is scanned across blank lines, comments, folded and explicit-indent indicators', async () => {
  const dir = await fixtureDir({
    'folded.yml': `name: Folded
on: push
jobs:
  leak:
    steps:
      - name: Folded scalar
        run: >-
          echo "\${{ github.event.pull_request.title }}"
`,
    'explicit.yml': `name: Explicit indent
on: push
jobs:
  leak:
    steps:
      - name: Indent indicator
        run: |2
            echo "\${{ github.head_ref }}"
`,
    'preamble.yml': `name: Preamble
on: push
jobs:
  leak:
    steps:
      - name: Comments and blanks before the body
        run: |
          # a YAML comment between header and body

          echo "\${{ github.event.pull_request.title }}"
`
  });
  try {
    const report = await scanWorkflows({ dir, yamlParse: null });
    const files = new Set(report.findings.map(finding => finding.file));
    assert.deepEqual([...files].sort(), ['explicit.yml', 'folded.yml', 'preamble.yml'], JSON.stringify(report.findings));
    assert.equal(report.injectionShapedExpressions, 3);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fallback: a literal-valued matrix key stays allowlisted in block and inline runs', async () => {
  const dir = await fixtureDir({
    'clean.yml': `name: Clean matrix
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]
        part: [1, 2, 3, 4, 5]
    steps:
      - name: Install
        run: npx --yes playwright install --with-deps \${{ matrix.browser }}
      - name: Point the suites
        run: |
          node -e "console.log('\${{ matrix.browser }}')"
          echo "ENGINE=\${{ matrix.browser }}" >> "$GITHUB_ENV"
`
  });
  try {
    const report = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(report.injectionShapedExpressions, 0, JSON.stringify(report.findings));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fallback: a matrix key whose values carry expressions is NOT allowlisted, and include/exclude never is', async () => {
  const dir = await fixtureDir({
    'expr-matrix.yml': `name: Expression matrix
on: push
jobs:
  build:
    strategy:
      matrix:
        browser: [\${{ inputs.browser }}]
        include:
          - extra: value
    steps:
      - run: echo "\${{ matrix.browser }}"
`,
    'include-only.yml': `name: Include matrix
on: push
jobs:
  build:
    strategy:
      matrix:
        include:
          - browser: chromium
    steps:
      - run: echo "\${{ matrix.browser }}"
`
  });
  try {
    const report = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(report.injectionShapedExpressions, 2, JSON.stringify(report.findings));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// CR-SR6 review round (CodeRabbit #4718454999): GitHub adds a combination for
// an include entry that cannot fully merge with the base values, so an
// expression-bearing include field puts attacker text into a key the base
// matrix proved literal. The whole per-job allowlist must be dropped.
test('an expression-bearing include entry disables the literal-matrix allowlist (parsed and fallback)', async () => {
  const poison = `name: Include bypass
on: push
jobs:
  build:
    strategy:
      matrix:
        browser: [chromium]
        include:
          - browser: \${{ github.event.pull_request.title }}
    steps:
      - run: echo "browser=\${{ matrix.browser }}"
`;
  const dir = await fixtureDir({ 'include-bypass.yml': poison });
  try {
    const fallback = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(fallback.injectionShapedExpressions, 1, JSON.stringify(fallback.findings));
    assert.equal(fallback.findings[0].expression.trim(), 'matrix.browser');
    if (yamlParse) {
      const parsed = await scanWorkflows({ dir, yamlParse });
      assert.equal(parsed.injectionShapedExpressions, 1, JSON.stringify(parsed.findings));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// A literal-only include/exclude keeps merging safe: the allowlist stays.
test('a literal-only include entry keeps the allowlist intact', async () => {
  const literal = `name: Literal include
on: push
jobs:
  build:
    strategy:
      matrix:
        browser: [chromium]
        include:
          - experimental: true
    steps:
      - run: echo "browser=\${{ matrix.browser }}"
`;
  const dir = await fixtureDir({ 'literal-include.yml': literal });
  try {
    const fallback = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(fallback.injectionShapedExpressions, 0, JSON.stringify(fallback.findings));
    if (yamlParse) {
      const parsed = await scanWorkflows({ dir, yamlParse });
      assert.equal(parsed.injectionShapedExpressions, 0, JSON.stringify(parsed.findings));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// CR-SR6 review round (CodeRabbit #4718455017): `[^}]+?` stopped at the lone
// `}` inside `'{0}'`, so `${{ format('{0}', github.head_ref) }}` was never
// matched at all. The scanner must read the expression up to the real `}}`.
test('an expression containing a closing brace inside a string literal is a finding (parsed and fallback)', async () => {
  const format = `name: Format expression
on: push
jobs:
  build:
    steps:
      - run: echo "\${{ format('{0}', github.head_ref) }}"
`;
  const dir = await fixtureDir({ 'format.yml': format });
  try {
    const fallback = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(fallback.injectionShapedExpressions, 1, JSON.stringify(fallback.findings));
    assert.ok(fallback.findings[0].expression.includes('format('), JSON.stringify(fallback.findings));
    assert.ok(fallback.findings[0].expression.includes('github.head_ref'), JSON.stringify(fallback.findings));
    if (yamlParse) {
      const parsed = await scanWorkflows({ dir, yamlParse });
      assert.equal(parsed.injectionShapedExpressions, 1, JSON.stringify(parsed.findings));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

// CR-SR6 review round (CodeRabbit #4718455024): quoted mapping keys are valid
// YAML; the fallback missed the whole script instead of flagging it.
test('a quoted run: key is scanned by the fallback like the parsed walk', async () => {
  const quoted = `name: Quoted run key
on: push
jobs:
  build:
    steps:
      - "run": echo "\${{ github.head_ref }}"
      - 'run': |
          echo "\${{ github.event.pull_request.title }}"
`;
  const dir = await fixtureDir({ 'quoted.yml': quoted });
  try {
    const fallback = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(fallback.injectionShapedExpressions, 2, JSON.stringify(fallback.findings));
    if (yamlParse) {
      const parsed = await scanWorkflows({ dir, yamlParse });
      assert.equal(parsed.injectionShapedExpressions, 2, JSON.stringify(parsed.findings));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fallback: expressions outside run scripts (env, if, name, with) are not findings', async () => {
  const dir = await fixtureDir({
    'safe-contexts.yml': `name: Safe contexts
on:
  push:
    branches: [main]
jobs:
  build:
    name: build (\${{ matrix.browser }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium]
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          persist-credentials: false
        if: \${{ github.event_name == 'push' }}
        env:
          TOKEN: \${{ github.token }}
        run: echo done
`
  });
  try {
    const report = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(report.injectionShapedExpressions, 0, JSON.stringify(report.findings));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fallback: an alias-valued run cannot be resolved and is flagged', async () => {
  const dir = await fixtureDir({
    'alias.yml': `name: Alias run
on: push
jobs:
  build:
    steps:
      - run: *shared-script
`
  });
  try {
    const report = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(report.injectionShapedExpressions, 1, JSON.stringify(report.findings));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('fallback: the repository workflows pass without a parser (clean tree, no false positives)', async () => {
  const report = await scanWorkflows({ dir: join(REPO, '.github', 'workflows'), yamlParse: null });
  assert.equal(report.scanned > 0, true, 'the repository ships workflows to scan');
  assert.deepEqual(report.findings, [], JSON.stringify(report.findings));
});

test('fallback: the scanner never allowlists more than the parsed walk would', async () => {
  // A poisoned run body inside a job whose matrix looks literal to a naive
  // line scan but is a flow MAP — the fallback must keep it flagged.
  const dir = await fixtureDir({
    'flow-map.yml': `name: Flow map matrix
on: push
jobs:
  build:
    strategy:
      matrix:
        entry: [{browser: chromium}]
    steps:
      - run: echo "\${{ matrix.entry }}"
`
  });
  try {
    const report = await scanWorkflows({ dir, yamlParse: null });
    assert.equal(report.injectionShapedExpressions, 1, JSON.stringify(report.findings));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

(yamlParse ? test : test.skip)('parsed walk: the repository workflows pass and a poisoned fixture is a finding', async () => {
  const clean = await scanWorkflows({ dir: join(REPO, '.github', 'workflows'), yamlParse });
  assert.equal(clean.yamlParser, 'available (parsed walk)');
  assert.deepEqual(clean.findings, [], JSON.stringify(clean.findings));

  const dir = await fixtureDir({ 'poisoned.yml': BLOCK_POISON });
  try {
    const report = await scanWorkflows({ dir, yamlParse });
    assert.equal(report.injectionShapedExpressions, 1, JSON.stringify(report.findings));
    assert.equal(report.findings[0].job, 'leak');
    assert.equal(report.findings[0].step, 'Example');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
