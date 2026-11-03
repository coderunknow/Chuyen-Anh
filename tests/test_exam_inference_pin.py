"""rc10: exam answer-key inference must not drift when the teaching bank grows.

`scripts/exams/build_answer_keys.mjs` scores options against the phrase bank and
the vocabulary list when a paper has no key of its own. rc10 grew that bank by
2,000 words and 314 phrases, and the enlarged bank silently turned eight
previously unkeyed items into "scorable" answers — one of them wrong
(`2022/bac-kan/so` q33, inferred "A. way" where the paper's own gloss reads
"get/fall/settle into a routine" = "C. routine").

The fix is a reviewed pin (`scripts/exams/inference-lexicon.json`): inference uses
only the rows that existed when the keys were last reviewed. These tests hold the
three properties that make the pin trustworthy rather than decorative:

1. the pin exists and names its revision and counts;
2. every pinned row still exists in the current bank (a deleted or renamed row
   would otherwise leave a stale pin that silently shrinks the evidence);
3. the rc10 additions are genuinely outside the pin, so the boundary is doing
   something — and the builder actually reads it.
"""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIN = ROOT / "scripts" / "exams" / "inference-lexicon.json"
BUILDER = ROOT / "scripts" / "exams" / "build_answer_keys.mjs"
VOCABULARY = ROOT / "data" / "vocabulary.json"
PHRASES = ROOT / "data" / "phrases.json"


class InferencePinTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.pin = json.loads(PIN.read_text(encoding="utf-8"))
        cls.vocabulary = json.loads(VOCABULARY.read_text(encoding="utf-8"))
        cls.phrases = json.loads(PHRASES.read_text(encoding="utf-8"))

    def test_the_pin_names_what_it_froze(self) -> None:
        self.assertEqual(self.pin["generatedBy"], "scripts/exams/freeze_inference_lexicon.mjs")
        self.assertTrue(self.pin["frozenAt"])
        self.assertIn("human", self.pin["rule"].lower(),
                      "the pin must say that extending it is a human decision")
        self.assertEqual(self.pin["counts"]["vocabulary"], len(self.pin["vocabulary"]))
        self.assertEqual(self.pin["counts"]["phrases"], len(self.pin["phrases"]))

    def test_every_pinned_row_still_exists(self) -> None:
        words = {str(row["word"]).lower() for row in self.vocabulary}
        phrases = {str(row["phrase"]).lower() for row in self.phrases}
        missing_words = [word for word in self.pin["vocabulary"] if word not in words]
        missing_phrases = [phrase for phrase in self.pin["phrases"] if phrase not in phrases]
        self.assertEqual(missing_words, [], "a pinned word no longer exists in the bank")
        self.assertEqual(missing_phrases, [], "a pinned phrase no longer exists in the bank")

    def test_the_pin_is_a_real_boundary_and_the_builder_honours_it(self) -> None:
        pinned_words = set(self.pin["vocabulary"])
        pinned_phrases = set(self.pin["phrases"])
        words = {str(row["word"]).lower() for row in self.vocabulary}
        phrases = {str(row["phrase"]).lower() for row in self.phrases}
        # rc10 added rows outside the pin; if this ever reads 0 the pin has been
        # regenerated to the current bank, which is a reviewed decision that must
        # come with a diff of data/exam-answer-keys.json.
        self.assertGreater(len(words - pinned_words), 0)
        self.assertGreater(len(phrases - pinned_phrases), 0)
        source = BUILDER.read_text(encoding="utf-8")
        self.assertIn("inference-lexicon.json", source,
                      "the builder must read the pin instead of the live bank")
        self.assertRegex(source, r"pinnedVocabulary|inferencePin")
        # The pin must never be larger than the bank it froze: a pin row that does
        # not exist would be silently ignored evidence.
        self.assertLessEqual(len(pinned_words), len(words))
        self.assertLessEqual(len(pinned_phrases), len(phrases))

    def test_the_pin_is_normalised_the_way_the_builder_compares(self) -> None:
        for word in self.pin["vocabulary"]:
            self.assertEqual(word, word.strip().lower())
        for phrase in self.pin["phrases"]:
            self.assertEqual(phrase, re.sub(r"\s+", " ", phrase.strip().lower()))


if __name__ == "__main__":
    unittest.main()
