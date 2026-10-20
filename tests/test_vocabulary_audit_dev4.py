"""Regression tests for the corrected historical dev4 evidence ledger."""
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
from learned_vocabulary import parse_table  # noqa: E402

DEV4_JSON = ROOT / "docs" / "vocabulary-audit-dev4.json"
DEV4_MD = ROOT / "docs" / "vocabulary-audit-dev4.md"
EXPECTED_VERIFIED_IDS = {str(i) for i in range(1, 129)} | {"281", "283", "341", "913"}
SOURCE_FIELDS = (
    "word", "pos", "meaning", "tags", "wordFamily", "synonyms", "antonyms",
    "collocations", "register", "connotation", "notes",
)
PLACEHOLDER_TEXT = (
    "compatible with vietnamese meaning", "cambridge adj definition", "headword verified",
    "generated url", "templated description", "verified via cambridge",
)


class VocabularyAuditDev4Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(DEV4_JSON.read_text(encoding="utf-8"))
        cls.entries = cls.doc["entries"]
        cls.by_id = {entry["id"]: entry for entry in cls.entries}

    def test_audit_has_ordered_913_rows_and_current_source_parity(self):
        self.assertEqual(self.doc["appVersion"], "v1.0.0-dev4")
        self.assertEqual(self.doc["schemaVersion"], "1.0.0")
        self.assertEqual(self.doc["total"], 913)
        self.assertEqual(len(self.entries), 913)
        self.assertEqual([entry["id"] for entry in self.entries], [str(i) for i in range(1, 914)])

        source = parse_table(ROOT / "Learned_Vocabulary_List.md")
        app = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))
        self.assertEqual(len(source), 913)
        self.assertEqual(len(app), 913)
        for source_row, app_row, audit_row in zip(source, app, self.entries):
            self.assertEqual(source_row["id"], app_row["id"])
            self.assertEqual(source_row["id"], audit_row["id"])
            for field in SOURCE_FIELDS:
                self.assertEqual(source_row[field], app_row.get(field, ""),
                                 f"source/JSON mismatch at ID {source_row['id']} field {field}")
                audit_value = audit_row.get(field, "")
                if audit_value is None and field in {"wordFamily", "register", "connotation", "notes"}:
                    audit_value = ""
                self.assertEqual(source_row[field], audit_value,
                                 f"source/dev4 ledger mismatch at ID {source_row['id']} field {field}")

    def test_summary_is_recalculated_and_dictionary_checks_are_separate(self):
        summary = self.doc["summary"]
        verified = [entry for entry in self.entries if entry["evidence"]["cambridge"]["checked"] is True]
        pending = [entry for entry in self.entries if entry["evidence"]["cambridge"]["checked"] is False]
        self.assertEqual({entry["id"] for entry in verified}, EXPECTED_VERIFIED_IDS)
        self.assertEqual(len(verified), 132)
        self.assertEqual(len(pending), 781)
        self.assertEqual(summary["automatedChecks"], 913)
        self.assertEqual(summary["dictionaryVerified"], 132)
        self.assertEqual(summary["dictionaryChecked"], 132)
        self.assertEqual(summary["manualDictionaryVerified"], 132)
        self.assertEqual(summary["pendingManualDict"], 781)
        self.assertEqual(summary["unresolved"], 781)
        self.assertEqual(summary["sourceCorrectionsAttributedToDev4"], 0)
        self.assertEqual(summary["dev5SourceCorrectionsSyncedForParity"], 16)
        self.assertNotIn("verifiedCompatAuto", summary)
        self.assertNotIn("autoChecked", summary)
        self.assertEqual(summary["dictionaryVerified"] + summary["pendingManualDict"], 913)
        self.assertIn("structural", summary["retrievalMechanism"].lower())

    def test_verified_rows_have_entry_specific_cambridge_records(self):
        verified = [entry for entry in self.entries if entry["evidence"]["cambridge"]["checked"]]
        for entry in verified:
            cam = entry["evidence"]["cambridge"]
            self.assertEqual(entry["status"], "verified-compat", f"ID {entry['id']}")
            self.assertEqual(cam["posMatch"], "compatible", f"ID {entry['id']}")
            self.assertTrue(cam["headword"], f"ID {entry['id']} missing headword")
            self.assertTrue(cam["cambridgePos"], f"ID {entry['id']} missing Cambridge POS")
            self.assertTrue(cam["definitionExcerpt"], f"ID {entry['id']} missing excerpt")
            self.assertTrue(cam["url"].startswith("https://dictionary.cambridge.org/"), f"ID {entry['id']}")
            self.assertRegex(cam["retrievedAt"], r"^\d{4}-\d{2}-\d{2}$", f"ID {entry['id']}")
            self.assertRegex(cam["notes"], r"Inspected Cambridge entry(?: directly)?", f"ID {entry['id']}")
            self.assertIn(cam["retrievedAt"], cam["notes"], f"ID {entry['id']}")
            excerpt = cam["definitionExcerpt"].strip().lower()
            self.assertGreaterEqual(len(excerpt), 3, f"ID {entry['id']} excerpt unexpectedly short")
            for placeholder in PLACEHOLDER_TEXT:
                self.assertNotIn(placeholder, excerpt, f"ID {entry['id']} has placeholder excerpt")

        # Exact corrections to the five legacy excerpts, not paraphrase strings.
        expected_excerpts = {
            "1": "a difficult or unlucky situation or event",
            "281": "the belief that something is true",
            "283": "If an event or series of events culminates in something, it ends with it, having developed until it reaches this point",
            "341": "refusing to change your opinions or behaviour",
            "913": "almost; using computer technology over the internet, and not involving people physically going somewhere",
        }
        for entry_id, excerpt in expected_excerpts.items():
            self.assertEqual(self.by_id[entry_id]["evidence"]["cambridge"]["definitionExcerpt"], excerpt)

    def test_pending_rows_are_not_miscounted_as_dictionary_verified(self):
        pending = [entry for entry in self.entries if not entry["evidence"]["cambridge"]["checked"]]
        self.assertEqual(len(pending), 781)
        for entry in pending:
            cam = entry["evidence"]["cambridge"]
            self.assertEqual(entry["status"], "pending-manual", f"ID {entry['id']}")
            self.assertEqual(cam["posMatch"], "pending-manual", f"ID {entry['id']}")
            self.assertIsNone(cam["definitionExcerpt"], f"ID {entry['id']}")
            self.assertIsNone(cam["retrievedAt"], f"ID {entry['id']}")
        menial = self.by_id["448"]["evidence"]["cambridge"]
        self.assertFalse(menial["checked"])
        self.assertIsNone(menial["headword"])
        self.assertTrue(menial["url"].endswith("/dictionary/english/menial"))
        self.assertIn("landing page", menial["notes"].lower())
        self.assertNotIn("448", {entry["id"] for entry in self.entries if entry["evidence"]["cambridge"]["checked"]})

    def test_reconciliation_preserves_history_and_supersedes_false_totals(self):
        reconciliation = self.doc["reconciliation"]
        self.assertEqual(reconciliation["reconciledOn"], "2026-10-20")
        self.assertIn("corrected historical evidence ledger", reconciliation["classification"])
        self.assertTrue(any("133 verified / 780 pending" in item for item in reconciliation["supersededClaims"]))
        self.assertTrue(any("ID 448" in item for item in reconciliation["supersededClaims"]))
        self.assertIn("16 evidence-backed dev5 source corrections", reconciliation["sourceParityNote"])
        self.assertEqual(self.doc["methodology"]["tierCounts"], {"core": 300, "extended": 313, "wordFamily": 300})
        self.assertTrue(any("781" in item for item in self.doc["methodology"]["limitations"]))

    def test_markdown_counts_rows_from_the_corrected_json(self):
        text = DEV4_MD.read_text(encoding="utf-8")
        self.assertIn("corrected evidence ledger", text.lower())
        self.assertIn("132 verified / 781 pending", text)
        self.assertIn("not dictionary verification", text)
        self.assertIn("ID 448", text)
        self.assertIn("pending", text.lower())
        self.assertIn("133 verified / 780 pending", text)  # explicitly superseded, not current
        start = text.index("## Verified entries — 132")
        end = text.index("## Legacy evidence repairs and ID 448")
        section = text[start:end]
        rows = [line for line in section.splitlines() if line.startswith("|") and not line.startswith("| ---") and not line.startswith("| ID |")]
        row_ids = [line.split("|", 2)[1].strip() for line in rows]
        self.assertEqual(len(rows), 132)
        self.assertEqual(set(row_ids), EXPECTED_VERIFIED_IDS)
        self.assertNotIn("448", row_ids)
        self.assertIn("| 913 | Virtually |", section)

    def test_dev4_generator_is_retired_and_cannot_overwrite_the_ledger(self):
        script = ROOT / "scripts" / "generate_vocab_audit_dev4.py"
        before = [hashlib.sha256(path.read_bytes()).hexdigest() for path in (DEV4_JSON, DEV4_MD)]
        result = subprocess.run([sys.executable, str(script)], cwd=ROOT, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        after = [hashlib.sha256(path.read_bytes()).hexdigest() for path in (DEV4_JSON, DEV4_MD)]
        self.assertEqual(result.returncode, 2)
        self.assertIn("retired", result.stderr.lower())
        self.assertEqual(before, after, "the retired generator must not modify historical audit files")
        source = script.read_text(encoding="utf-8")
        self.assertIn("will not write report files", source)
        self.assertNotIn("OUT_JSON.write_text", source)
        self.assertNotIn("OUT_MD.write_text", source)


if __name__ == "__main__":
    unittest.main()
