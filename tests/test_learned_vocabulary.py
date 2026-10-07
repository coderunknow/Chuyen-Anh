"""Structural and source-evidence checks for the expanded vocabulary table."""
import json
from pathlib import Path
import re
import sys
import unicodedata
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from learned_vocabulary import escape_cell, parse_table, split_table_row  # noqa: E402
from audit_learned_vocab import recount, tokens  # noqa: E402


def normalized(word):
    return " ".join(unicodedata.normalize("NFKC", word).casefold().split())


class LearnedVocabularyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = parse_table(ROOT / "Learned_Vocabulary_List.md")
        cls.by_word = {record["word"]: record for record in cls.records}
        cls.app_data = json.loads((ROOT / "data/vocabulary.json").read_text(encoding="utf-8"))
        cls.app_by_id = {entry["id"]: entry for entry in cls.app_data}

    def test_table_is_sequential_complete_and_machine_readable(self):
        self.assertEqual(len(self.records), 913)
        self.assertEqual([record["id"] for record in self.records], [str(i) for i in range(1, 914)])
        words = [normalized(record["word"]) for record in self.records]
        self.assertEqual(len(words), len(set(words)), "Duplicate headwords")
        for record in self.records:
            with self.subTest(word=record["word"]):
                for field in ("wordFamily", "register", "connotation", "notes"):
                    self.assertIsInstance(record[field], str)
                for field in ("synonyms", "antonyms", "collocations", "tags"):
                    self.assertIsInstance(record[field], list)
                    self.assertTrue(all(isinstance(value, str) and value.strip() for value in record[field]))

    def test_source_and_app_vocabulary_match_and_legacy_fields_exist(self):
        self.assertEqual(len(self.app_data), 913)
        for record, entry in zip(self.records, self.app_data):
            with self.subTest(word=record["word"]):
                self.assertEqual(record["id"], entry["id"])
                self.assertEqual(record["word"], entry["word"])
                self.assertEqual(record["pos"], entry["pos"])
                self.assertEqual(record["meaning"], entry["meaning"])
                self.assertEqual(record["tags"], entry["tags"])
                if int(record["id"]) <= 613:
                    self.assertIn("examples", entry)
                    self.assertIn("difficulty", entry)
                    self.assertIn("createdAt", entry)
                else:
                    # No examples, difficulty score, or creation date are fabricated.
                    self.assertEqual(entry["examples"], [])
                    self.assertNotIn("difficulty", entry)
                    self.assertNotIn("createdAt", entry)

        menial = self.app_by_id["448"]
        self.assertEqual(menial["meaning"], "công việc tay chân tầm thường, ít được coi trọng")
        self.assertIn("Previous app definition (data/vocabulary.json): công việc lao dịch, tay chân vất vả, ít được coi trọng", menial["notes"])
        self.assertEqual(menial["examples"][0]["en"], "He was tired of doing menial tasks all day.")
        self.assertEqual(menial["difficulty"], 2)

    def test_legacy_dash_marker_for_id_448_migrates_to_easy_tag(self):
        # The prior source used `-`; the migration adds its `easy` tag without dropping old tags.
        source = next(record for record in self.records if record["id"] == "448")
        app_entry = self.app_by_id["448"]
        expected_tags = ["work", "daily-life", "easy"]
        self.assertEqual(source["tags"], expected_tags)
        self.assertEqual(app_entry["tags"], expected_tags)
        self.assertEqual(app_entry["difficulty"], 2)

    def test_additions_preserve_source_evidence_without_guessing_new_fields(self):
        evidence = json.loads((ROOT / "docs/vocabulary-300-evidence.json").read_text(encoding="utf-8"))
        self.assertEqual([item["id"] for item in evidence], list(range(614, 914)))
        for record, source in zip(self.records[613:], evidence):
            with self.subTest(word=source["word"]):
                self.assertEqual(record["word"], source["word"])
                self.assertIn(record["pos"], {"n", "v", "adj", "adv", "conj", "n/v", "v/n", "adj/n", "n/adj", "adj/v"})
                self.assertTrue(record["wordFamily"])
                self.assertIn("**Phân biệt:**", record["notes"])
                self.assertIn("**Nguồn:**", record["notes"])
                # Comparisons in prose are not silently reclassified as synonyms or antonyms.
                self.assertEqual(record["synonyms"], [])
                self.assertEqual(record["antonyms"], [])
                self.assertEqual(record["collocations"], [])
                self.assertEqual(record["register"], "")
                self.assertEqual(record["connotation"], "")
                path = ROOT / source["path"]
                self.assertTrue(path.resolve().is_relative_to(ROOT / "De-chuyen-Anh-vao-10"))
                text = path.read_text(encoding="utf-8")
                line = text.splitlines()[source["line"] - 1]
                self.assertIn(source["excerpt"], line)
                self.assertRegex(source["excerpt"], r"(?i)\b" + re.escape(source["form"]) + r"\b")
                self.assertIn(source["path"] + "#L" + str(source["line"]), record["notes"])
                self.assertIn("## Đề thi và phần kèm theo trong nguồn", "\n".join(text.splitlines()[:source["line"]]))

    def test_explicit_forms_and_counts(self):
        spec = json.loads((ROOT / "docs/vocabulary-300-families.json").read_text(encoding="utf-8"))
        saved = json.loads((ROOT / "docs/vocabulary-300-counts.json").read_text(encoding="utf-8"))
        evidence = json.loads((ROOT / "docs/vocabulary-300-evidence.json").read_text(encoding="utf-8"))
        self.assertEqual(saved, recount())
        self.assertEqual(saved["corpus_file_count"], spec["corpus"]["file_count"])
        self.assertEqual([(entry["id"], entry["word"]) for entry in spec["entries"]],
                         [(entry["id"], entry["word"]) for entry in evidence])
        heads = {normalized(record["word"]) for record in self.records}
        for family, count, source in zip(spec["entries"], saved["entries"], evidence):
            record = self.records[family["id"] - 1]
            with self.subTest(word=family["word"]):
                self.assertEqual(family["forms"], sorted(set(family["forms"])))
                self.assertIn(normalized(family["word"]), family["forms"])
                self.assertIn(source["form"].casefold(), family["forms"])
                self.assertIn(source["path"], count["files"])
                self.assertEqual(count["file_count"], len(count["files"]))
                self.assertEqual(set(family["forms"]) & heads, {normalized(family["word"])})
                for form in family["forms"]:
                    self.assertRegex(form, r"^[a-z]+(?:-[a-z]+)*$")
                self.assertIn("**Nguồn:**", record["notes"])

    def test_known_family_regressions(self):
        spec = json.loads((ROOT / "docs/vocabulary-300-families.json").read_text(encoding="utf-8"))
        forms = {entry["word"]: set(entry["forms"]) for entry in spec["entries"]}
        self.assertNotIn("Consequently", forms)
        self.assertIn("consequently", forms["Consequence"])
        self.assertNotIn("Biodiversity", forms)
        self.assertIn("biodiversity", forms["Diverse"])
        self.assertNotIn("superlative", forms["Superior"])
        self.assertNotIn("objection", forms["Objective"])
        self.assertNotIn("long-lived", forms["Longevity"])
        family_text = lambda word: self.by_word[word]["wordFamily"]
        self.assertNotIn("superlative", family_text("Superior"))
        self.assertNotIn("objection", family_text("Objective"))
        for word in ("Cease", "Refine", "Frustrate"):
            self.assertIn("**Nguồn:**", self.by_word[word]["notes"])

    def test_markdown_escaping_round_trips_pipes_and_backslashes(self):
        original = r"meaning with | pipe and \\ path"
        row = "| " + escape_cell(original) + " | text |"
        self.assertEqual(split_table_row(row), [original, "text"])

    def test_exact_tokens_not_prefixes(self):
        self.assertEqual(tokens("<b>relatively</b> unrelated relation relationships"),
                         {"relatively", "unrelated", "relation", "relationships"})
        self.assertNotIn("superior", tokens("superiority"))
        self.assertNotIn("renewable", tokens("non-renewable"))
        self.assertEqual(tokens("[shown](https://example.com/hidden) <i>SHOWN</i>"), {"shown"})


if __name__ == "__main__":
    unittest.main()
