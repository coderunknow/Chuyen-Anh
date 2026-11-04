"""v1.0.0 — sense-level CEFR migration: deterministic, validated, lossless, reversible."""
import importlib.util
import json
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from cefr_senses import References, classify_entry, validate_senses  # noqa: E402

spec = importlib.util.spec_from_file_location(
    "migrate_senses", ROOT / "scripts" / "migrate_senses.py"
)
migrate_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate_mod)

BACKUP = ROOT / "audit" / "v100" / "backup" / "data-pre-v100.tgz"
PRESERVED = ("id", "word", "pos", "meaning", "tags", "wordFamily", "synonyms",
             "antonyms", "collocations", "register", "connotation", "notes",
             "sources", "examples", "difficulty", "createdAt", "familyHead")


class MigrateSensesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.refs = References()
        with tarfile.open(BACKUP) as tar:
            member = tar.extractfile("data/vocabulary.json")
            cls.legacy = json.loads(member.read().decode("utf-8"))
        cls.migrated = migrate_mod.migrate(cls.legacy, cls.refs)

    def test_migration_adds_senses_to_every_row_without_touching_legacy_fields(self):
        self.assertEqual(len(self.migrated), len(self.legacy))
        for old, new in zip(self.legacy, self.migrated):
            self.assertEqual(new["id"], old["id"])
            for field in PRESERVED:
                self.assertEqual(new.get(field), old.get(field), f"field {field} of row {old['id']} changed")
            self.assertIn("senses", new)
            self.assertEqual(validate_senses(new), [])

    def test_migration_is_deterministic(self):
        again = migrate_mod.migrate(self.legacy, self.refs)
        self.assertEqual(json.dumps(again, ensure_ascii=False, sort_keys=True),
                         json.dumps(self.migrated, ensure_ascii=False, sort_keys=True))

    def test_migration_is_reversible_by_dropping_the_field(self):
        # The runtime falls back to the headword level tag when `senses` is
        # absent, so dropping the field restores exact legacy behaviour.
        stripped = [{k: v for k, v in entry.items() if k != "senses"} for entry in self.migrated]
        self.assertEqual(json.dumps(stripped, ensure_ascii=False, sort_keys=True),
                         json.dumps(self.legacy, ensure_ascii=False, sort_keys=True))

    def test_legacy_rows_without_level_tag_get_classified_senses_not_unclassified(self):
        untagged = [e for e in self.legacy if not any(t.startswith("level:") for t in e.get("tags", []))]
        self.assertEqual(len(untagged), 913, "the rc10 baseline had 913 untagged rows")
        for old in untagged:
            new = next(e for e in self.migrated if e["id"] == old["id"])
            for sense in new["senses"]:
                self.assertIn(sense["cefr"], ("A1", "A2", "B1", "B2", "C1", "C2"),
                              f"row {old['id']} sense left unclassified")
                self.assertIn(sense["evidence"],
                              ("source_supported", "cross_validated", "disputed", "editorial_estimate", "unresolved"))
                if sense["evidence"] == "editorial_estimate":
                    self.assertTrue(sense.get("needsIndependentValidation"),
                                    "editorial estimates must be flagged, never presented as verified")

    def test_cli_migrates_the_committed_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "migrated.json"
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "migrate_senses.py"), str(BACKUP), str(out)],
                capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(len(data), 7852)
            self.assertTrue(all(entry.get("senses") for entry in data))

    def test_classify_entry_never_invents_a_level(self):
        refs = References()
        entry = {"id": "zz", "word": "zzzqxx", "pos": "n", "meaning": "không rõ", "tags": []}
        senses = classify_entry(entry, refs)
        self.assertEqual(len(senses), 1)
        self.assertIn(senses[0]["cefr"], ("A1", "A2", "B1", "B2", "C1", "C2", "UNCLASSIFIED"))
        if senses[0]["cefr"] == "UNCLASSIFIED":
            self.assertEqual(senses[0]["evidence"], "unresolved")


if __name__ == "__main__":
    unittest.main()
