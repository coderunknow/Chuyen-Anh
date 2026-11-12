# Manual screen-reader validation — device-settings import/export

> **Acceptance criterion 8 is INCOMPLETE and this document does not close it.**
> No screen reader could be installed or run in the audit environment: there is
> no AT-SPI bus, no `pyatspi`/`gi`, no display server, and the Debian package
> mirror is unreachable. Simulating a screen reader would be fabrication, so the
> criterion stays open until a human performs the steps below and records what
> actually happened.

## What was verified automatically (and what that is worth)

Automated checks prove the *preconditions* a screen reader depends on. They do
**not** prove the experience.

| Precondition | Result | Why it matters to a screen reader |
|---|---|---|
| Import control is focusable and in tab order | PASS — keyboard probe 19/19 | An unreachable control is unreachable by AT too |
| The control has an accessible name | PASS — static-app suite | A nameless button is announced as "button" |
| No operable control carries `aria-disabled="true"` | PASS — `r7-chip-state` (rewritten, see H9) | Otherwise AT announces "unavailable" for something usable |
| Every message exists in both VI and EN | PASS — 66 toast literals, 0 untranslated | A refusal announced in the wrong language is not a clear message |
| Live regions are used for the result message | PASS — static-app suite | Without it the outcome is never announced |
| axe-core: 0 violations | PASS — browser-exams suite | Catches structural ARIA errors, not spoken quality |
| Contrast ≥ 4.5:1 (measured 6.84 / 8.32) | PASS | Low-vision users, not strictly AT |

## Why a human is still required

A screen reader reports the **announcement**, not the DOM. Whether "Đã nhập cài
đặt" is intelligible when spoken, whether the role is announced correctly,
whether the focus order matches the visual order in practice, and whether the
file chooser is reachable at all are all questions only a person with the AT
running can answer.

## Steps for the human validator

Record the screen reader and version, the browser, and the OS. Untested
combinations are not evidence.

**A. Reach the controls**
1. Load `index.html` (both `file://` and over HTTP — they differ in what the file
   chooser permits).
2. Tab from the top of the page. Reach "Xuất cài đặt" (export) and "Nhập cài
   đặt" (import) **without using the mouse**.
3. For each: note the announced name, role, and state. *Failure looks like:*
   silence, "button" with no name, or the control never receiving focus.

**B. Export**
4. Activate export. Confirm the download is announced or that the success message
   is spoken.
5. Re-read the announced message. Is it understandable when spoken, not just when
   read?

**C. Import — success**
6. Activate import. Confirm the file chooser opens **and that it is announced**.
   This is the step most likely to fail with AT: a native chooser moving focus out
   of the document can leave the user with no announcement.
7. Choose a valid file. Confirm the success message is spoken.
8. Reload. Confirm the settings still hold (persistence is automatic; the
   question here is whether the *reloaded state* is announced).

**D. Import — refusal (the important path)**
9. Repeat with: a non-JSON file; a JSON file with `version: 2`; a file with a
   `theme` value that does not exist; a file just over 64 KB.
10. For each: confirm the **refusal** is spoken, that it names the problem, and
    that the previous settings are unchanged.
11. *Failure looks like:* silence, a generic "error", or a message spoken after
    focus has already moved away.

**E. Record**
12. Write down, per step, what was announced. "Worked" is not a record; the
    announcement text is.

## Sign-off

| Field | Value |
|---|---|
| Screen reader + version | *to be filled by the validator* |
| Browser + OS | |
| Date | |
| Steps passed / failed | |
| Notes on unintelligible or missing announcements | |

Until this table is filled by a person, criterion 8 is unmet, and this project
should not claim screen-reader support.
