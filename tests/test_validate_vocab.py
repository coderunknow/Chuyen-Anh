import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]

spec = importlib.util.spec_from_file_location(
    "validate_vocab", Path(__file__).parents[1] / "scripts" / "validate_vocab.py"
)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def entry(**overrides):
    value = {
        "id": "demo",
        "word": "menial task",
        "pos": "phrase",
        "meaning": "công việc tay chân",
        "examples": [{"en": "A menial task.", "vi": "Việc tay chân."}],
        "tags": ["work"],
        "wordFamily": "",
        "synonyms": [],
        "antonyms": [],
        "collocations": [],
        "register": "",
        "connotation": "",
        "notes": "",
    }
    value.update(overrides)
    return value


class VocabularyValidatorTest(unittest.TestCase):
    def test_valid_entry(self):
        self.assertEqual(validator.validate([entry(difficulty=2)]), [])

    def test_missing_vocabulary_facts_are_explicitly_empty(self):
        # The expanded fields are present, but no score is invented where none exists.
        self.assertEqual(validator.validate([entry()]), [])
        errors = "\n".join(validator.validate([entry(difficulty=None)]))
        self.assertIn("difficulty, when provided, must be a number from 0 to 5", errors)

    def test_legacy_difficulty_marker_is_not_part_of_meaning(self):
        data = [entry(id="legacy", word="legacy", meaning="nghĩa|-", examples=[], tags=[], difficulty=0)]
        errors = "\n".join(validator.validate(data))
        self.assertIn("unconverted legacy difficulty marker", errors)

    def test_duplicate_and_malformed_entry_are_reported(self):
        data = [
            entry(id="same", word="word", meaning="x", examples=[], tags=[], difficulty=1),
            entry(id="same", word="WORD", meaning="", examples="bad", tags=[], difficulty=8),
        ]
        errors = "\n".join(validator.validate(data))
        self.assertIn("duplicate id", errors)
        self.assertIn("duplicate word", errors)
        self.assertIn("missing or empty meaning", errors)
        self.assertIn("examples must be an array", errors)
        self.assertIn("difficulty, when provided, must be a number from 0 to 5", errors)

    def test_duplicate_words_follow_the_runtime_accent_normalization(self):
        # The app keys words by NFD-without-diacritics, so `résumé` collides with `resume`.
        data = [
            entry(id="1", word="resume", examples=[], tags=[]),
            entry(id="2", word="résumé", examples=[], tags=[]),
        ]
        errors = "\n".join(validator.validate(data))
        self.assertIn("duplicate word", errors)

    def test_duplicate_words_ignore_case_diacritics_whitespace_and_d_stroke(self):
        data = [
            entry(id="1", word="Menial task", examples=[], tags=[]),
            entry(id="2", word="  menial\t   TASK ", examples=[], tags=[]),
            entry(id="3", word="Đúng đắn", examples=[], tags=[]),
            entry(id="4", word="dung dan", examples=[], tags=[]),
            entry(id="5", word="Unrelated headword", examples=[], tags=[]),
        ]
        errors = validator.validate(data)
        self.assertEqual(len(errors), 2, errors)
        for message in errors:
            self.assertIn("duplicate word", message)
        self.assertEqual(validator.normalize_word(" Đúng đắn "), "dung dan")
        self.assertEqual(validator.normalize_word("Menial   TASK"), "menial task")
        self.assertEqual(validator.normalize_word("résumé"), "resume")

    def test_shipped_dataset_has_no_headword_collision_under_that_normalization(self):
        # Reported fact for this data set: 913 records, 913 distinct normalized words.
        data = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))
        keys = [validator.normalize_word(item["word"]) for item in data]
        self.assertEqual(len(keys), 913)
        self.assertEqual(len(set(keys)), 913)
        self.assertEqual(validator.validate(data), [])

    def test_expanded_metadata_types_are_enforced(self):
        errors = "\n".join(validator.validate([entry(wordFamily=None, synonyms="similar", notes=7)]))
        self.assertIn("wordFamily must be a string", errors)
        self.assertIn("synonyms must be an array of non-empty strings", errors)
        self.assertIn("notes must be a string", errors)


if __name__ == "__main__":
    unittest.main()
