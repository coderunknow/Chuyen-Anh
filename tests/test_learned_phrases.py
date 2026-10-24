"""Schema, provenance and reproducibility checks for the beta7 phrase bank.

The phrase bank is a second data set with its own IDs and its own storage key. It
must never be counted towards the vocabulary target and must never collide with a
vocabulary headword, so the checks here mirror the vocabulary tests but stay in a
separate module.
"""
import copy
import json
import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from phrase_bank import COLUMNS, PHRASE_ID_RE, TYPES, parse_table, phrase_key  # noqa: E402
import validate_phrases  # noqa: E402
from vocab_sources import word_key  # noqa: E402

PHRASES_JSON = ROOT / "data" / "phrases.json"
PHRASES_MD = ROOT / "Learned_Phrase_List.md"
VOCAB_JSON = ROOT / "data" / "vocabulary.json"
EXPECTED_TYPES = {
    "phrasal-verb", "idiom", "collocation", "dependent-preposition",
    "linker-phrase", "pattern", "fixed-expression",
}


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class LearnedPhrasesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = parse_table(PHRASES_MD)
        cls.data = load_json(PHRASES_JSON)
        cls.vocabulary = load_json(VOCAB_JSON)
        cls.by_id = {entry["id"]: entry for entry in cls.data}

    def test_table_and_json_are_the_same_ordered_document(self):
        self.assertEqual(len(self.records), len(self.data))
        self.assertGreaterEqual(len(self.data), 600)
        self.assertEqual([record["id"] for record in self.records], [entry["id"] for entry in self.data])
        ids = [entry["id"] for entry in self.data]
        self.assertEqual(len(ids), len(set(ids)), "duplicate phrase IDs")
        self.assertEqual(ids, [f"P{number:03d}" for number in range(1, len(ids) + 1)])
        for record in self.records:
            self.assertTrue(PHRASE_ID_RE.fullmatch(record["id"]))
        self.assertEqual(COLUMNS, ("ID", "PHRASE", "TYPE", "MEANING", "USAGE", "PATTERN", "TAGS", "SOURCES"))

    def test_every_phrase_is_a_multi_word_entry_with_a_known_type(self):
        for entry in self.data:
            with self.subTest(phrase=entry["phrase"]):
                self.assertGreaterEqual(len(entry["phrase"].split()), 2)
                self.assertIn(entry["type"], TYPES)
                self.assertIn(entry["type"], EXPECTED_TYPES)
                self.assertTrue(entry["meaning"].strip())
                self.assertTrue(entry["pattern"].strip())
                self.assertIsInstance(entry["usage"], str)

    def test_no_phrase_repeats_another_or_a_vocabulary_headword(self):
        keys = [phrase_key(entry["phrase"]) for entry in self.data]
        self.assertEqual(len(keys), len(set(keys)), "case/punctuation-folded duplicate phrase")
        headwords = {word_key(entry["word"]) for entry in self.vocabulary}
        collisions = [entry["phrase"] for entry in self.data if word_key(entry["phrase"]) in headwords]
        self.assertEqual(collisions, [])

    def test_tags_use_known_namespaces_and_cover_level_and_source(self):
        for entry in self.data:
            with self.subTest(phrase=entry["phrase"]):
                tags = entry["tags"]
                self.assertTrue(tags)
                namespaces = {tag.split(":", 1)[0] for tag in tags}
                self.assertIn("level", namespaces)
                self.assertIn("source", namespaces)
                for namespace in namespaces:
                    self.assertIn(namespace, {"level", "level-source", "topic", "skill", "source", "type"})
                self.assertIn(entry["type"], {tag.split(":", 1)[1] for tag in tags if tag.startswith("type:")})

    def test_every_phrase_carries_structured_provenance(self):
        for entry in self.data:
            with self.subTest(phrase=entry["phrase"]):
                self.assertTrue(entry["sources"], "a phrase without a source must not ship")
                for source in entry["sources"]:
                    self.assertEqual(set(source) - {"ref", "locator", "supports", "url"}, set())
                    self.assertTrue(source["ref"].strip())
                    self.assertTrue(source["supports"].strip())
                    if "url" in source:
                        self.assertTrue(source["url"].startswith("https://"))

    def test_shipped_bank_passes_the_independent_validator(self):
        self.assertEqual(validate_phrases.validate(self.data, self.vocabulary), [])

    def test_validator_rejects_duplicates_single_words_and_missing_sources(self):
        # Fail-first: each mutation must be caught, not silently accepted.
        base = self.data[0]
        cases = {
            "duplicate id": [{**base}, {**copy.deepcopy(base)}],
            "folded duplicate": [
                {**copy.deepcopy(base), "id": "P998", "phrase": "put off"},
                {**copy.deepcopy(base), "id": "P999", "phrase": "  Put   OFF "},
            ],
            "single word": [{**copy.deepcopy(base), "phrase": "whereas"}],
            "missing sources": [{**copy.deepcopy(base), "sources": []}],
            "unknown type": [{**copy.deepcopy(base), "type": "slang"}],
        }
        for label, rows in cases.items():
            with self.subTest(case=label):
                errors = "\n".join(validate_phrases.validate(rows, self.vocabulary))
                self.assertTrue(errors.strip(), f"{label} must be reported")
        duplicate_errors = "\n".join(validate_phrases.validate(cases["folded duplicate"], self.vocabulary))
        self.assertIn("duplicate phrase", duplicate_errors)
        self.assertEqual(phrase_key("Put  OFF"), phrase_key("put off"))
        self.assertIn("single words belong in the vocabulary table",
                      "\n".join(validate_phrases.validate(cases["single word"], self.vocabulary)))

    def test_phrases_are_not_counted_as_vocabulary(self):
        vocabulary_words = {word_key(entry["word"]) for entry in self.vocabulary}
        for entry in self.data:
            self.assertNotIn(word_key(entry["phrase"]), vocabulary_words)
        # The vocabulary target stands on its own: 3,215 headwords without the bank.
        self.assertGreaterEqual(len(self.vocabulary), 3000)
        self.assertEqual(len({word_key(entry["word"]) for entry in self.vocabulary}), len(self.vocabulary))

    def test_build_and_embed_checks_are_reproducible_and_read_only(self):
        for script, expected in (
            ("build_phrases.py", "Phrase data matches"),
            ("embed_phrases.py", "Standalone HTML embeds all"),
        ):
            with self.subTest(script=script):
                output_before = (PHRASES_JSON.read_bytes(), PHRASES_MD.read_bytes())
                result = subprocess.run(
                    [sys.executable, str(SCRIPTS / script), "--check"],
                    cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(expected, result.stdout)
                self.assertEqual(output_before, (PHRASES_JSON.read_bytes(), PHRASES_MD.read_bytes()),
                                 f"{script} --check must not rewrite its outputs")

    def test_embedded_html_matches_the_phrase_json(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        blocks = re.findall(r'<script id="phrase-data" type="application/json">([\s\S]*?)</script>', html)
        self.assertEqual(len(blocks), 1, "exactly one embedded phrase block")
        self.assertNotIn("</script", blocks[0], "phrase text cannot terminate its JSON script block")
        self.assertEqual(json.loads(blocks[0]), self.data)
        # The phrase block must follow the vocabulary block the app loads first.
        self.assertLess(html.index('id="vocabulary-data"'), html.index('id="phrase-data"'))
        self.assertLess(html.index('id="phrase-data"'), html.index('id="app-script"'))


if __name__ == "__main__":
    unittest.main()
