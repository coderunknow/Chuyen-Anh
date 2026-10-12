# Vocabulary audit status — 2026-10-12

## Coverage and conclusions

- The complete 913-row Markdown source was reviewed entry by entry for headword, POS, Vietnamese gloss, and the relationship between source and application record. IDs remain 1–913, with no duplicate source headwords or IDs.
- The source, generated `data/vocabulary.json`, and the embedded `index.html` payload agree for all 913 records. All populated source-managed fields were inventoried: 300 word-family cells and their notes for IDs 614–913, the historical note for ID 448, and tags on 148 records. Synonyms, antonyms, collocations, register, and connotation are empty in this dataset. No specific incorrect lexical value was established during this pass, so no vocabulary row was changed.
- A runtime property test checks 3,652 generated mode/entry combinations (four requested learning modes for each of 913 entries) and confirms that prompts, answers, correct options, and available cloze examples stay attached to the same record. This tests application/data association; it is not a substitute for dictionary research.

## Reported changing-meaning symptom

The affected record is **ID 448, `Menial task`**. The primary meaning in the canonical Markdown, generated JSON, and embedded HTML is the same selected wording: `công việc tay chân tầm thường, ít được coi trọng`. The `NOTES` field intentionally preserves the prior app gloss, `công việc lao dịch, tay chân vất vả, ít được coi trọng`, as required by `DESIGN_LOG.md` entries #7 and #18. `renderFeedback()` displayed the primary gloss and `vocabularyMetadataHtml()` displayed that historical gloss under a generic notes heading, so the answer screen showed two similar-but-different Vietnamese formulations without a clear historical label. The vocabulary data was synchronized; no runtime mutation or entry mix-up was found. The renderer now labels that preserved value as an old app definition, explicitly not the current meaning. The ID 448 meaning and note themselves were not changed.

## External dictionary checks actually performed

The following Cambridge Dictionary entries were opened or searched directly during this pass. Their recorded glosses were not established as incorrect:

| ID | Headword | Reference | Finding |
| ---: | --- | --- | --- |
| 1 | Adversity | [Cambridge Dictionary](https://dictionary.cambridge.org/dictionary/english/adversity) | The definition is a difficult or unlucky situation/event; the Vietnamese gloss is compatible. |
| 281 | Credence | [Cambridge Dictionary](https://dictionary.cambridge.org/dictionary/english/credence) | The definition is belief/acceptance that something is true; the recorded `sự tin tưởng` gloss is compatible. |
| 283 | Culminate | [Cambridge Dictionary](https://dictionary.cambridge.org/dictionary/english/culminate) | `Culminate in/with` means to end with a result; the recorded usage note is compatible. |
| 341 | Intransigent | [Cambridge Dictionary](https://dictionary.cambridge.org/dictionary/english/intransigent) | The core gloss, refusing to compromise/change, is present; no source correction was made. |
| 448 | Menial task | [Cambridge Dictionary](https://dictionary.cambridge.org/dictionary/english/menial) | The entry describes menial work as low in social value; the selected current gloss is compatible. The explicitly retained previous-app wording remains historical metadata only. |
| 913 | Virtually | [Cambridge Dictionary](https://dictionary.cambridge.org/dictionary/english/virtually) | Cambridge includes both “almost” and online/computer-mediated senses; both senses are represented in the gloss. |

## Explicit limitation — full dictionary audit remains incomplete

Only the six entries above received individual dictionary-reference checks in this pass. The remaining **907 of 913 entries have not been individually verified against an external dictionary here**. The existing [`vocabulary-300-review.md`](vocabulary-300-review.md) documents a prior editorial/source review of IDs 614–913, but explicitly does not claim a dictionary lookup for every entry; it is not counted as completing this requirement. Accordingly, this report does **not** claim that all 913 entries passed the requested authoritative-dictionary audit. No vocabulary correction is being proposed without entry-specific evidence.

The review could not establish a competing, evidence-backed value requiring a user decision. The 907 unchecked entries remain a dictionary-verification limitation, not a claim that they are error-free.
