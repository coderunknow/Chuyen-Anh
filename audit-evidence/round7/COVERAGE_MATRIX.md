# Round 7 — coverage matrix for the device-settings export (Option 3)

> **Reconstructed document.** The original matrix was lost with the untracked
> working tree. This version was rebuilt against the committed implementation and
> re-checked by reading `index.html`; each row names the assertion that actually
> exercises it. Rows whose original probe script is gone are marked
> **reconstructed — method described, not re-executed**.

The user's instruction was to validate the **whole file before applying anything**
and to preserve existing settings on failure. This matrix is the evidence that
each clause of that instruction has a test, not just a code path.

## Format

```
{ app: 'chuyen-anh-device-settings', version: 1, exportedAt: <ISO>,
  settings: { cefr, theme, language, presentation } }
```

Device-local only. Phrase progress stays in the v1 backup and is **not**
duplicated here; the v1 backup schema is unchanged (criterion 7).

## Cases

| # | Case | Expected | Where it is asserted |
|---|------|----------|----------------------|
| 1 | Round trip: export → import on a fresh store | All four settings reapplied | 14-check UI probe; `v1`-compat check |
| 2 | Round trip survives a page reload | Imported values persist | UI probe — reload, re-read from storage |
| 3 | Not an object / not JSON | Refused, `invalid` message, **no write** | `validateDeviceSettingsPayload` |
| 4 | `app` field wrong | Refused before any field is applied | validator (app constant) |
| 5 | `version` unknown (e.g. `2`) | Refused, not silently migrated | validator (version check) |
| 6 | `version` missing | Refused | validator |
| 7 | `settings` missing or not an object | Refused | validator |
| 8 | `cefr` not a supported value | Refused | validator allow-list |
| 9 | `theme` not a supported value | Refused | validator allow-list |
| 10 | `language` not a supported value | Refused | validator allow-list |
| 11 | `presentation` malformed | Refused | validator shape check |
| 12 | Unknown extra keys inside `settings` | Refused rather than partially adopted | validator (exact key set) |
| 13 | File larger than 64 KB | Refused **before** the parse, on byte length | `99859e3` — cap checked on the string |
| 14 | Partial write (one key throws) | Reports **failure**, not `ok` | `32ad30e`; staging probe asserts `writes.has(key)` per key |
| 15 | Failure leaves existing settings intact | Previous values still readable | UI probe — snapshot before, compare after |
| 16 | No partial application | Every key is written or none is | staging probe (refuses mid-write) |
| 17 | Import control reachable by keyboard | Focus lands on the control, chooser opens | 19-check keyboard probe |
| 18 | Message clarity (VI/EN) | Each refusal has its own message, both languages | toast-argument walk, 66 literals / 0 untranslated |

## What this matrix does **not** claim

- It does not claim screen-reader support. Criterion 8 is open; see
  `accessibility/MANUAL_SCREEN_READER_CHECKLIST.md`.
- It does not claim the 64 KB cap is enforced on a stream: the file is read by
  the browser's file chooser, so the cap is enforced on the resulting string
  before parsing. That is the strongest guarantee available at this layer and is
  stated as such rather than as a streaming limit.
