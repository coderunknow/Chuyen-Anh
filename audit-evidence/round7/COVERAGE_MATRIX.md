# Round 7 — coverage matrix for the device-settings export (Option 3)

> **Reconstructed document**, rebuilt against the committed implementation. The
> column that matters is **Evidence**: it names either a **committed test** (which
> was re-executed at the final SHA and cannot silently rot) or a **lost probe**
> (which was not re-run and must be re-derived before anyone relies on it again).
>
> The first draft of this file cited the lost probe scripts for everything, which
> overstated the weakness of the evidence *and* contained one factual error:
> row 12 claimed unknown keys are refused. They are ignored — see the committed
> test named in the row.

The user's instruction was to validate the **whole file before applying anything**
and to preserve existing settings on failure. Each row below is a clause of that
instruction with the evidence that actually exercises it.

## Format

```
{ app: 'chuyen-anh-device-settings', version: 1, exportedAt: <ISO>,
  settings: { cefr, theme, language, presentation } }
```

Device-local only. Phrase progress stays in the v1 backup and is **not**
duplicated here; the v1 backup schema is unchanged (criterion 7).

## Cases

All tests named below live in `tests/exam-scoring.test.js` and were re-run at the
final SHA: `exam-scoring` **60 pass / 0 fail**.

| # | Case | Expected | Evidence |
|---|------|----------|----------|
| 1 | Round trip: export → import on a fresh store | All four settings reapplied | **Committed test** — `export -> import round-trips and the values persist after reload` |
| 2 | Round trip survives a reload | Imported values persist | **Committed test** — same test, read back through the public loaders |
| 3 | Export carries only the four device-local settings | No phrase/progress data leaks in | **Committed test** — `export carries exactly the four device-local settings and nothing else` (asserts on the serialized payload) |
| 4 | Not an object | Refused, nothing written | **Committed test** — `a malformed, foreign or unsupported-version file is refused and changes nothing` (`not an object`, `[]`) |
| 5 | `app` field wrong | Refused | **Committed test** — same test (`foreign app id`) |
| 6 | `version` unknown (e.g. `99`) | Refused, not silently migrated | **Committed test** — same test (`unsupported version`) |
| 7 | `version` missing | Refused | **Code path only** — `payload.version !== DEVICE_SETTINGS_VERSION` refuses `undefined`; **no test asserts this exact case**. Weaker than the rows above; stated so it is not mistaken for coverage. |
| 8 | `settings` missing | Refused | **Committed test** — same test (`missing settings`) |
| 9 | `theme` missing or unsupported | Refused | **Committed test** — same test (`missing theme`, `bad theme value`) |
| 10 | `language` unsupported | Refused | **Committed test** — same test (`bad language`) |
| 11 | `cefr` malformed (bad level / not an array / missing flag) | Refused | **Committed test** — same test (three CEFR cases) |
| 12 | `presentation` malformed | Refused | **Committed test** — same test (`bad presentation`) |
| 13 | Unknown extra keys | **Ignored, not applied** — the validator returns only the four known settings | **Committed test** — `extra unknown fields are ignored, not applied` (asserts the parsed key set and that the unknown key is absent) |
| 14 | File larger than 64 KB | Refused **before** the parse, on byte length | **Committed test** — `oversized input is refused before it can be parsed` |
| 15 | Partial write (one key refused) | Reports **failure**, not `ok`; nothing written | **Committed test** — `applyDeviceSettings never reports ok after writing only part of the set` (asserts `m.size === 0`) |
| 16 | Store fails on capacity | `write-failed`, old settings still readable | **Committed test** — `a failing store reports the failure and leaves the old settings readable` |
| 17 | Dead store | `write-failed` (probe catches it first) | **Committed test** — `a dead store reports write-failed because the capacity probe caught it first` |
| 18 | Mid-commit failure that cannot roll back | `rollback-failed` — told to check, not reassured | **Committed test** — `a store that fails mid-commit and cannot roll back is reported as rollback-failed` |
| 19 | Settings never leak into the v1 backup | v1 bundle still refuses them | **Committed test** — `the v1 progress backup still refuses to carry these settings` |
| 20 | Import control reachable by keyboard | Focus lands on the control, chooser opens | **Lost probe** — `r7-import-keyboard.mjs` (19 checks) was **not re-executed**; its script is gone and has not been rewritten. Re-derive before relying on it. |
| 21 | Refusal messages exist in both languages | One message per refusal, VI and EN | **Lost probe** — `r7-toast-args.mjs` (66 literals / 0 untranslated), **not re-executed**. The mechanism is still present in the code; the measurement is not. |

## What this matrix does **not** claim

- It does not claim screen-reader support. Criterion 8 is open; see
  `accessibility/MANUAL_SCREEN_READER_CHECKLIST.md`.
- It does not claim the 64 KB cap is enforced on a stream: the file arrives
  through the browser's file chooser, so the cap is enforced on the resulting
  text (and on the `File` size in the UI) before parsing. That is the strongest
  guarantee available at this layer and is stated as such rather than as a
  streaming limit.
- Rows 20 and 21 are the only ones resting on lost probes, and they say so. The
  rest are covered by tests that run in CI on every push.
