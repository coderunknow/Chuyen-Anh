import json, pathlib, unittest

class VocabularyAuditDev4Tests(unittest.TestCase):
    def test_audit_json_exists_and_has_913(self):
        p = pathlib.Path("docs/vocabulary-audit-dev4.json")
        self.assertTrue(p.exists(), "docs/vocabulary-audit-dev4.json must exist")
        doc = json.loads(p.read_text(encoding="utf-8"))
        self.assertEqual(doc["appVersion"], "v1.0.0-dev4")
        self.assertEqual(doc["schemaVersion"], "1.0.0")
        self.assertEqual(doc["total"], 913)
        self.assertEqual(len(doc["entries"]), 913)
        # per-ID evidence slots
        for e in doc["entries"]:
            self.assertIn("id", e)
            self.assertIn("word", e)
            self.assertIn("evidence", e)
            self.assertIn("cambridge", e["evidence"])
            self.assertIn("oxfordLearners", e["evidence"])
            self.assertIn("merriamWebster", e["evidence"])
            self.assertIn("url", e["evidence"]["cambridge"])
            # each entry must have provenance
            self.assertIn("provenance", e)
        # summary
        self.assertEqual(doc["summary"]["verifiedCompatAuto"], 913)
        self.assertEqual(doc["summary"]["dictionaryChecked"], 6)
        self.assertEqual(doc["summary"]["pendingManualDict"], 907)

    def test_audit_markdown_exists(self):
        p = pathlib.Path("docs/vocabulary-audit-dev4.md")
        self.assertTrue(p.exists())
        text = p.read_text(encoding="utf-8")
        self.assertIn("913 entries", text)
        self.assertIn("audit-first", text.lower())
        self.assertIn("Cambridge", text)

    def test_no_unproven_corrections(self):
        doc = json.loads(pathlib.Path("docs/vocabulary-audit-dev4.json").read_text(encoding="utf-8"))
        self.assertEqual(doc["summary"]["correctedWithProof"], 0)
        for e in doc["entries"]:
            self.assertIsNone(e["correction"], f"ID {e['id']} should have no correction without proof")

if __name__ == "__main__":
    unittest.main()
