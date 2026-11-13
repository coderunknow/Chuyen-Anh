# Application audit probes — Round 9

Independent probes written for this round, run against the extracted
`<script type="module" id="app-script">` from `index.html` and the real embedded
data. They are deliberately *not* copies of the repository's own assertions: the
point was to try to break the app, not to re-run its tests.

Every probe below reports a real result. None of them are sketches.

| Probe | What it tried to break | Result |
|---|---|---|
| CEFR inheritance | A word inheriting another sense's level, a phrase inheriting a constituent word's level, a sense with an impossible level | **0 violations** across 8,852 entries / 8,928 senses; 0 unclassified senses; 0 unclassified phrases in 1,094 |
| Duplicate sense ids | Two senses sharing an id within or across entries | **0** |
| Exam bookkeeping | `questionCount` / `scoredCount` / `exemptCount` in `data/exam-answer-keys.json` disagreeing with what `scoreExamSession` computes from the paper itself | **0 mismatches** across 106 papers, 6,708 questions, 5,155 scorable, 1,553 exempt |
| Exempt items | An exempt (essay / missing stimulus / OCR) item being counted in the denominator or marked wrong | **0** |
| Over-credit | Any item earning more than 1.0, or `earnedPoints > denominator` | **0** |
| All-correct ceiling | Answering every scorable item correctly and still not scoring 100 % | **0** |
| Content integrity | `contentSha256` not matching the `markdown` it claims to protect | **106/106 match** |
| Asset digest *formatting* | An asset with a malformed SHA-256, or two assets sharing one | **0** (186 assets, all 64-hex, all distinct) |
| Import XSS | A crafted backup smuggling `<img onerror>` / `<script>` through import into `innerHTML` | **Escaped**; `escapeHtml` covers `& < > " '` and every render path found interpolates through it |
| Tombstone resurrection | A stale tab merging a deleted attempt back in | **Not resurrected** |
| Clear-then-merge | A stale tab re-adding records after a Clear | **Not re-added**; `generation` incremented |
| Deploy-gate bypass | A crafted `DEPLOY_HOLD` enabling a deploy: empty, comment-only, whitespace, `../../etc/passwd`, `v1.0.0; rm -rf /`, backticks, newline injection, a 5,000-character tag, a Unicode line separator | **All held.** Only a well-formed tag whose release is genuinely published opens the gate; a missing marker deploys (correct), an unreadable one holds (correct) |
| Dirty-read after delete | A delete reported successful while a stale overwrite landed between write and read-back | Handled by the `generation` bump (round 8, PR #85) — verified still present |

## Probe sources

The probes live in `/tmp` in the audit sandbox and are reproduced verbatim in the
logs beside this file where their output matters. They depend on nothing in the
repository except `index.html` and `data/exam-answer-keys.json`, so they can be
re-run by extracting the module exactly as `tests/exam-persistence.test.js` does:

```js
const html = fs.readFileSync('index.html', 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
```

## What these probes do NOT establish

- They do not validate the *pedagogical* correctness of any CEFR level against a
  dictionary. They only prove the app never invents, inherits or borrows one.
- **The asset digests were not verified against the asset bytes.** They are
  well-formed and unique, and the *paper* `contentSha256` was recomputed from the
  embedded markdown (106/106 match), but the 186 PDF/source assets are external
  downloads this sandbox cannot reach, so no digest was recomputed over their
  contents. Any wording that called asset integrity "verified" was wrong and has
  been narrowed to the check actually performed (CodeRabbit, PR #86).
- They do not exercise the real browsers. Cross-engine behaviour is the browser
  matrix's job, and it is measured in CI, not here.
- A zero-violation result is evidence about this dataset. It is not a proof that
  the dataset is correct; `docs/vocabulary-cefr-review.*` records what is and is
  not independently validated (the validator prints "independent validation is
  not established", which this round did not change and must not be read as
  established).
