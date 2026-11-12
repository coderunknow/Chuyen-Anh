# Manual screen-reader validation — exam history, corrections and Clear (round 8)

> **INCOMPLETE. This document does not close the criterion.**
> No screen reader exists in the audit environment: no AT-SPI bus, no
> `pyatspi`/`gi`, no display server, and the browser binaries cannot be downloaded
> here (`FAILURE_LEDGER.md` F1). Writing "validated with NVDA" would be fabrication,
> so the criterion stays open until a human performs these steps and records what
> actually happened.

This checklist **extends** the round-7 document
(`audit-evidence/round7/accessibility/MANUAL_SCREEN_READER_CHECKLIST.md`), which
remains the checklist for the device-settings import/export flow and remains
`INCOMPLETE` for the same reason. Round 8 changed the exam-history surface, so it
needs its own steps.

## What round 8 changed in the UI that a screen reader can perceive

| Change | Why it matters to AT |
|---|---|
| `#exam-key-correct-input` gained `maxlength="1000"` and `aria-describedby="exam-key-correct-hint"` | The limit must be announced as part of the field's description, not only enforced on save |
| New visible hint `#exam-key-correct-hint` ("Tối đa 1000 ký tự…" / "At most 1000 characters…") | It is the only place the rule is stated before the learner types |
| The correction save button is now asynchronous (`await`) | Focus and any live-region message must survive the await; a silent gap reads as "nothing happened" |
| "Xóa tất cả" (Clear all) now goes through an awaited write with a confirmation dialog | A cancelled confirm must leave the list untouched and keep focus on the button |
| Storage refusals are now two distinguishable messages (unreadable store vs. device failure) | The specific message must be the one announced |
| Per-row "Xóa" (Delete) is awaited, then the shell re-renders | Focus after re-render must not be lost to `<body>` |

## Preconditions verified automatically (necessary, not sufficient)

| Precondition | Result | Evidence |
|---|---|---|
| Correction input carries `maxlength="1000"` and `aria-describedby` | PASS | `tests/exam-persistence.test.js::r8 correction UI…` |
| Hint element exists with the limit in both languages | PASS | same test |
| Over-limit refusals have their own translated message | PASS | `exam-persistence.test.js`; `exam-scoring.test.js::rc11 english…` (all `toast()` literals translated) |
| Clear and Delete re-render only after a resolved save | PASS (code) | `bindExamHistory` handlers are `async` and `await persistExamResults` |
| Unreadable-store message is distinct and translated | PASS | `EN_UI_TRANSLATIONS` entries added this round |
| History list rows have accessible names | PASS (round 7 assertion still valid) | `static-app.test.js` |

**What none of the above proves:** that the announcement is intelligible, that focus
is where a person expects it, or that the async gap is not confusing. Only a human
with the AT running can answer that.

## Steps for the human validator

Record the screen reader and version, the browser and the OS. Untested combinations
are not evidence. Use a profile with **at least two saved attempts** and one saved
correction.

**A. The correction limit is announced before typing**
1. Open an exam, submit it, open a question that offers "Xác nhận hoặc hiệu chỉnh…".
2. Expand the disclosure and move to the correction input.
3. **Expected:** the reader announces the field's label *and* the 1,000-character
   hint as its description, once, without repeating it on every keystroke.
4. Type 1,001 characters (paste is fine). **Expected:** the field refuses input past
   1,000; no error toast, no lost focus.
5. Paste an over-limit value into a field that had the guard removed (dev tools) and
   press save. **Expected:** a single error message stating the limit and the measured
   length, announced once; the correction is not saved.

**B. Saving a correction after the async write**
1. Enter a valid correction and press "Lưu hiệu chỉnh & tính lại".
2. **Expected:** one success announcement; the question's verdict updates; focus is
   not thrown to the top of the page.
3. Repeat with storage disabled (private window with storage blocked, or dev tools
   quota exhaustion). **Expected:** the *device* failure message is announced, and the
   correction is visibly not applied.

**C. Clear and Delete**
1. Settings → Exam history. Focus "Xóa tất cả" and activate it.
2. **Expected:** the confirm dialog is announced as a dialog with its text; **Cancel**
   returns focus to the button and leaves the list intact.
3. Confirm. **Expected:** the list is announced as empty, and the "Xóa tất cả" button
   is announced as disabled.
4. With two rows present, delete one row. **Expected:** after the re-render, focus is
   on a sensible element (the list or the next row) and the deletion is announced.

**D. Two-tab reality (no AT needed for the data, AT needed for the message)**
1. Two tabs on the app. Delete an attempt in tab A. Save an attempt in tab B.
2. **Expected in tab B:** the history shown matches tab A after reload — the deleted
   row does not come back — and no stale "saved" message contradicts what is stored.

**E. `file://`**
1. Open `index.html` directly from disk and repeat A and C. Record any difference from
   the HTTP run (the file chooser and storage behaviour both differ).

## Result record

| Step | Screen reader + version | Browser / OS | Observed | Pass/Fail |
|---|---|---|---|---|
| A1–A5 | | | | |
| B1–B3 | | | | |
| C1–C4 | | | | |
| D1–D2 | | | | |
| E1 | | | | |

Status: **INCOMPLETE — awaiting a human tester.** No result above is filled in, and
none will be by this audit.
