import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "validate_vocab", Path(__file__).parents[1] / "scripts" / "validate_vocab.py"
)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class VocabularyValidatorTest(unittest.TestCase):
    def test_valid_entry(self):
        data = [{
            "id": "demo",
            "word": "menial task",
            "pos": "phrase",
            "meaning": "công việc tay chân",
            "examples": [{"en": "A menial task.", "vi": "Việc tay chân."}],
            "tags": ["work"],
            "difficulty": 2,
        }]
        self.assertEqual(validator.validate(data), [])

    def test_duplicate_and_malformed_entry_are_reported(self):
        data = [
            {"id": "same", "word": "word", "pos": "n", "meaning": "x", "examples": [], "tags": [], "difficulty": 1},
            {"id": "same", "word": "WORD", "pos": "n", "meaning": "", "examples": "bad", "tags": [], "difficulty": 8},
        ]
        errors = "\n".join(validator.validate(data))
        self.assertIn("duplicate id", errors)
        self.assertIn("duplicate word", errors)
        self.assertIn("missing or empty meaning", errors)
        self.assertIn("examples must be an array", errors)
        self.assertIn("difficulty must be a number from 0 to 5", errors)


if __name__ == "__main__":
    unittest.main()
