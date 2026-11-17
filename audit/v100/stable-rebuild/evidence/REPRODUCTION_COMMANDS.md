# Reproduction commands

Every command below works from a clean checkout of
`build/v100-stable-rebuild`: clone the repository, check out the branch, and
run the commands from the checkout root. The audit scripts read only paths
inside the checkout (`../index.html`, `../api/telemetry.js`, … relative to
`scripts/`), so no session workspace is required.

## Baseline (commit `948f6f9`) — use a separate worktree

`git stash` cannot recover the baseline on a checkout of the candidate: the
candidate fixes are committed, not stashed. The baseline is reproduced in a
**separate worktree pinned to the base commit**; candidate checks stay in the
candidate worktree.

```bash
# In the candidate worktree — do not touch it:
git fetch origin
git worktree add /tmp/baseline-948f6f9 948f6f9

# Baseline reproduction (D-SR1), in the baseline worktree:
cd /tmp/baseline-948f6f9
node --test tests/exam-persistence.test.js   # expect exactly 1 failure:
#   "a locked write reports the mode it obtained" — Node 24 ships Web Locks,
#   the old test hard-coded `unserialized`, so the honest app failed it.

# Candidate checks stay in the candidate worktree:
cd /path/to/candidate-checkout
node --test tests/exam-persistence.test.js   # expect 0 failures
git worktree remove /tmp/baseline-948f6f9    # when finished
```

## Audit and mutation scripts (all tracked at these paths)

```bash
# D-SR1 mutation controls (mutants must be caught, honest contexts must pass):
node scripts/mutation_ds1.mjs

# D-SR2/round-2 scrub behaviour demonstration, shipped client + server functions:
node scripts/rt_scrub_baseline.mjs
node --test tests/telemetry-api.test.js

# Review-round scrubber mutation controls (8 mutants; all must be killed):
node scripts/mutation_cr_scrub.mjs

# Independent exam audit (fresh code, production parser):
node scripts/independent_exam_audit.mjs

# Independent vocabulary sample audit:
node scripts/independent_vocab_audit.mjs

# Supabase old vs hardened ingest behaviour against the real SQL (in-memory
# Postgres). Needs @electric-sql/pglite, installed outside the repo:
#   npm install --prefix /tmp/pw --no-save --package-lock=false @electric-sql/pglite
node scripts/pglite_rate_limit_evidence.mjs
```

## Live probes (read-only)

```bash
# No POST: a POST writes to production. Only preflight/GET here:
curl -i -X OPTIONS https://chuyen-anh-telemetry.vercel.app/api/telemetry \
  -H 'Origin: https://coderunknow.github.io' \
  -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type'
curl -i https://chuyen-anh-telemetry.vercel.app/api/telemetry
```

## Gates and performance

```bash
# Gates (fail-closed without `gh`; CI re-evaluates at the PR head):
python3 scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh
python3 scripts/app_release_gate.py --repo coderunknow/Chuyen-Anh

# Performance (requires playwright-core + @sparticuz/chromium per HANDOFF §6.3):
BROWSER_EXECUTABLE=/tmp/chromium node tests/speed-benchmark.cjs
```
