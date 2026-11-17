# Reproduction commands (session workspace = /home/z/my-project)

Baseline (branch `build/v100-stable-rebuild`, base `948f6f9`):

```bash
# D-SR1 baseline failure (on untouched main):
git stash && node --test tests/exam-persistence.test.js   # expect 1 failure (locked vs unserialized)
# D-SR1 mutation controls:
node scripts/mutation_ds1.mjs

# D-SR2 baseline scrub behaviour (on the fixed tree; on main the secrets pass through unchanged):
node scripts/rt_scrub_baseline.mjs
node --test tests/telemetry-api.test.js                   # 18 tests incl. secret-redaction test

# Independent exam audit (fresh code, production parser):
node scripts/independent_exam_audit.mjs

# Independent vocabulary sample audit:
node scripts/independent_vocab_audit.mjs

# Supabase old vs hardened ingest behaviour against the real SQL (in-memory Postgres):
node scripts/pglite_rate_limit_evidence.mjs

# Read-only live probes (no POST — a POST writes to production):
curl -i -X OPTIONS https://chuyen-anh-telemetry.vercel.app/api/telemetry \
  -H 'Origin: https://coderunknow.github.io' \
  -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type'
curl -i https://chuyen-anh-telemetry.vercel.app/api/telemetry

# Gates (fail-closed without `gh`; CI re-evaluates at the PR head):
python3 scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh
python3 scripts/app_release_gate.py --repo coderunknow/Chuyen-Anh

# Performance (requires playwright-core + @sparticuz/chromium per HANDOFF §6.3):
BROWSER_EXECUTABLE=/tmp/chromium node tests/speed-benchmark.cjs
```
