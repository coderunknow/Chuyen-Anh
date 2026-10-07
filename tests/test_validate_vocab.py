import importlib.util
import unittest
from pathlib import Path

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

    def test_expanded_metadata_types_are_enforced(self):
        errors = "\n".join(validator.validate([entry(wordFamily=None, synonyms="similar", notes=7)]))
        self.assertIn("wordFamily must be a string", errors)
        self.assertIn("synonyms must be an array of non-empty strings", errors)
        self.assertIn("notes must be a string", errors)


if __name__ == "__main__":
    unittest.main()
