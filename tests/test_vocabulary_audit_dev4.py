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
        # summary: 52 manually verified via Cambridge on 2026-10-20, 861 pending-manual
        self.assertEqual(doc["summary"]["verifiedCompatAuto"], 913)
        self.assertEqual(doc["summary"]["dictionaryChecked"], 52)
        self.assertEqual(doc["summary"]["dictionaryVerified"], 52)
        self.assertEqual(doc["summary"]["pendingManualDict"], 861)
        self.assertEqual(doc["summary"]["pendingManualDict"], doc["total"] - doc["summary"]["dictionaryChecked"])
        # verified entries must have evidence
        verified = [e for e in doc["entries"] if e["evidence"]["cambridge"]["checked"]]
        self.assertEqual(len(verified), 52)
        for e in verified:
            cam = e["evidence"]["cambridge"]
            self.assertTrue(cam["definitionExcerpt"], f"ID {e['id']} missing definitionExcerpt")
            self.assertTrue(cam["url"].startswith("https://dictionary.cambridge.org/"), f"ID {e['id']} bad URL")
            self.assertEqual(cam["posMatch"], "compatible")
            prov = e["provenance"]
            # provenance may be dict (ID 1 legacy) or string with Verified
            if isinstance(prov, dict):
                self.assertIn("sourceMd", prov)
            else:
                self.assertIn("Verified via Cambridge", prov)
            self.assertEqual(e["status"], "verified-compat")
        # pending entries must have URL and pending status
        pending = [e for e in doc["entries"] if not e["evidence"]["cambridge"]["checked"]]
        self.assertEqual(len(pending), 861)
        for e in pending[:5]:  # spot-check first 5 pending
            cam = e["evidence"]["cambridge"]
            self.assertTrue(cam["url"].startswith("https://dictionary.cambridge.org/"))
            self.assertEqual(cam["posMatch"], "pending-manual")
            self.assertIn("pending", cam["notes"].lower())
            self.assertEqual(e["status"], "pending-manual")

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
