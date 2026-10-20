# Vocabulary audit — v1.0.0-dev4 (913 entries)

Generated: 2026-10-20T08:25:06.099814Z
App version: v1.0.0-dev4 · Schema: 1.0.0

## Verdict

- **913 entries** indexed from `data/vocabulary.json` (source `Learned_Vocabulary_List.md` 928 lines, IDs 1–913).
- **913 verified-compat (auto) — no correction proposed; 6 manually re-checked with citations.**
- **907 pending-manual dictionary lookup** beyond the 6 re-verified (evidence slots provided, not claimed complete).
- **0 needs-manual (suspicious auto-flag)**; **0 corrections with proof** — audit-first, correct only with entry-specific citation.

## Methodology (audit-first)

1. Parsed source Markdown and generated JSON — IDs 1–913, no duplicates, embedded HTML payload in sync (`python scripts/build_vocabulary.py --check` passes).
2. Auto-checked POS tokens vs known set `abbr, adj, adv, collocation, conj, det, grammar, idiom, interj, n, num, phrasal, phrase, prep, pron, structure, v`, meaning presence, tag sanity, word-family region IDs 614–913 (300 cells, synonyms/antonyms/collocations empty in dataset).
3. Re-verified 6 IDs previously checked against Cambridge with citations (1,281,283,341,448,913); see per-ID evidence.
4. For all 913, generated per-ID evidence slots with dictionary URLs; `checked` is `true` only for the 6 re-verified, otherwise `pending-manual`.
5. No vocabulary row changed; any future correction must add `correction` with `proof` citation (Cambridge/Oxford/MW entry excerpt).

Authoritative sources consulted (URLs per ID): Cambridge, Oxford Learner's, Merriam-Webster, Collins (supplementary).

## Tier distribution

- Core 1–300: 300
- Extended 301–613: 313
- Word-family 614–913: 300 (notes+wordFamily populated for 300 cells; prior review `vocabulary-300-review.md` not a dictionary audit)

## Suspicious auto-flags (0)

If empty, auto-checks passed; manual dictionary lookup still pending for 907 entries.


## Previously re-verified (6 IDs)

| ID | Word | Finding |
| --- | --- | --- |
| 1 | Adversity | Cambridge: difficult situation; compatible with “nghịch cảnh”. |
| 281 | Credence | Cambridge: belief/acceptance true; compatible “sự tin tưởng”. |
| 283 | Culminate | Cambridge: culminate in/with → end with result; compatible. |
| 341 | Intransigent | Cambridge: refusing to compromise; compatible. |
| 448 | Menial task | Cambridge: low social value work; current “công việc tay chân tầm thường, ít được coi trọng” compatible; previous app gloss historical only. |
| 913 | Virtually | Cambridge: almost + online sense; both in gloss. |

## Per-ID evidence slots

See `vocabulary-audit-dev4.json` entries[]. Each entry contains `evidence.cambridge/oxfordLearners/merriamWebster/collins` with `url`, `checked`, `definitionExcerpt`, `posMatch`, `notes`.
Example (ID 1):

```json
{
  "cambridge": {
    "url": "https://dictionary.cambridge.org/dictionary/english/adversity",
    "checked": true,
    "definitionExcerpt": "difficult or unlucky situation/event; compatible with 'nghịch cảnh'",
    "posMatch": "compatible",
    "notes": "Checked 2026-10-12; re-verified 2026-10-20 dev4; no correction needed."
  },
  "oxfordLearners": {
    "url": "https://www.oxfordlearnersdictionaries.com/definition/english/adversity",
    "checked": false,
    "definitionExcerpt": null,
    "posMatch": "pending-manual",
    "notes": "Oxford Learner's entry for POS and CEFR; verify against source meaning."
  },
  "merriamWebster": {
    "url": "https://www.merriam-webster.com/dictionary/adversity",
    "checked": false,
    "definitionExcerpt": null,
    "posMatch": "pending-manual",
    "notes": "Merriam-Webster for US/UK variation and definition scope."
  },
  "collins": {
    "url": "https://www.collinsdictionary.com/dictionary/english/adversity",
    "checked": false,
    "definitionExcerpt": null,
    "posMatch": "pending-manual",
    "notes": "Collins for frequency and usage; not a grading authority."
  }
}
```

## Corrections with proof (0)

No row changed in this run. Future corrections must populate `correction: { "from": "...", "to": "...", "proof": {"cambridge": "excerpt + url"} }` and be reflected in `Learned_Vocabulary_List.md` via `scripts/build_vocabulary.py`.

## Limitations

- 907 entries remain pending-manual dictionary lookup beyond the 6 re-verified; this JSON provides slots but does not claim full manual lookup completed.
- Word-family region (614–913) editorial review is documented in `vocabulary-300-review.md` but is not a dictionary audit.
- This audit tests data/dictionary compatibility; runtime association is covered by static tests (3,652 mode/entry combos).

## How to verify

```bash
python -m json.tool docs/vocabulary-audit-dev4.json | head
python scripts/build_vocabulary.py --check
python scripts/validate_vocab.py
```

