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
        # summary consistency: pipeline-independent (no fragile hard-coded count)
        self.assertEqual(doc["summary"]["verifiedCompatAuto"], 913)
        # dictionaryChecked must equal actual verified length, and pending = total - checked
        verified = [e for e in doc["entries"] if e["evidence"]["cambridge"]["checked"]]
        pending = [e for e in doc["entries"] if not e["evidence"]["cambridge"]["checked"]]
        self.assertEqual(doc["summary"]["dictionaryChecked"], len(verified))
        self.assertEqual(doc["summary"]["dictionaryVerified"], len(verified))
        self.assertEqual(doc["summary"]["pendingManualDict"], len(pending))
        self.assertEqual(doc["summary"]["pendingManualDict"], doc["total"] - doc["summary"]["dictionaryChecked"])
        self.assertEqual(len(verified) + len(pending), doc["total"])
        # must not claim all 913 dictionary-verified when only subset has evidence
        self.assertGreaterEqual(len(verified), 52, "at least initial 52 must be verified")
        self.assertLess(len(verified), 913, "must not claim all 913 dictionary-verified via auto-checks alone")
        self.assertGreater(len(pending), 0, "pending must exist until full audit completes")
        # unique IDs
        ids = [str(e["id"]) for e in doc["entries"]]
        self.assertEqual(len(ids), len(set(ids)), "duplicate IDs")
        self.assertEqual(len(ids), 913)
        # verified entries must have genuine evidence
        for e in verified:
            cam = e["evidence"]["cambridge"]
            self.assertTrue(cam["definitionExcerpt"], f"ID {e['id']} missing definitionExcerpt")
            self.assertTrue(len(cam["definitionExcerpt"].strip()) >= 5, f"ID {e['id']} excerpt too short — possible fabrication")
            self.assertTrue(cam["url"].startswith("https://dictionary.cambridge.org/"), f"ID {e['id']} bad URL")
            # URL should correspond to word (normalized)
            word_slug = e["word"].lower().replace(" ", "-").replace("'", "").replace("/", "-")
            self.assertIn(word_slug[:8], cam["url"].lower(), f"ID {e['id']} URL {cam['url']} does not match word {e['word']}")
            self.assertEqual(cam["posMatch"], "compatible")
            prov = e["provenance"]
            if isinstance(prov, dict):
                self.assertIn("sourceMd", prov)
            else:
                self.assertIn("Verified via Cambridge", prov)
                self.assertIn(cam["url"], prov, f"ID {e['id']} provenance must contain URL")
                # provenance should indicate verification (no fabricated excerpt required in string, but must reference Cambridge)
                self.assertIn("Cambridge", prov if isinstance(prov, str) else "")
            self.assertEqual(e["status"], "verified-compat")
            # no malformed evidence
            for src in ["cambridge","oxfordLearners","merriamWebster","collins"]:
                self.assertIn(src, e["evidence"])
                self.assertIn("url", e["evidence"][src])
                self.assertIn("checked", e["evidence"][src])
        # pending entries must have URL and pending status and not be marked verified
        for e in pending[:10]:  # spot-check first 10 pending
            cam = e["evidence"]["cambridge"]
            self.assertTrue(cam["url"].startswith("https://dictionary.cambridge.org/"))
            self.assertEqual(cam["posMatch"], "pending-manual")
            self.assertIsNone(cam["definitionExcerpt"], f"ID {e['id']} pending should not have definitionExcerpt")
            self.assertIn("pending", cam["notes"].lower())
            self.assertEqual(e["status"], "pending-manual")
            self.assertIsNone(e["correction"], f"ID {e['id']} pending must not have correction")
        # all entries must have exactly 4 evidence sources
        for e in doc["entries"]:
            self.assertEqual(set(e["evidence"].keys()), {"cambridge","oxfordLearners","merriamWebster","collins"})
            for src in e["evidence"]:
                ev = e["evidence"][src]
                self.assertIn("url", ev); self.assertIn("checked", ev); self.assertIn("definitionExcerpt", ev); self.assertIn("posMatch", ev); self.assertIn("notes", ev)

    def test_audit_markdown_exists(self):
        p = pathlib.Path("docs/vocabulary-audit-dev4.md")
        self.assertTrue(p.exists())
        text = p.read_text(encoding="utf-8")
        self.assertIn("913 entries", text)
        self.assertIn("audit-first", text.lower())
        self.assertIn("Cambridge", text)
        # markdown/JSON consistency: table rows must match JSON verified count
        doc = json.loads(pathlib.Path("docs/vocabulary-audit-dev4.json").read_text(encoding="utf-8"))
        verified = [e for e in doc["entries"] if e["evidence"]["cambridge"]["checked"]]
        rows = [l for l in text.splitlines() if l.startswith("|") and not l.startswith("| ---") and not l.startswith("| ID |")]
        self.assertEqual(len(rows), len(verified), f"markdown table rows {len(rows)} must match JSON verified {len(verified)}")
        # ID 20 must be present (previous bug: 51 rows for 52 verified)
        self.assertIn("| 20 | Benevolent", text, "markdown must contain ID 20 row")
        # every verified ID should appear in markdown
        row_ids = [r.split("|")[1].strip() for r in rows]
        for e in verified:
            self.assertIn(str(e["id"]), row_ids, f"verified ID {e['id']} missing from markdown table")

    def test_no_unproven_corrections(self):
        doc = json.loads(pathlib.Path("docs/vocabulary-audit-dev4.json").read_text(encoding="utf-8"))
        self.assertEqual(doc["summary"]["correctedWithProof"], 0)
        for e in doc["entries"]:
            self.assertIsNone(e["correction"], f"ID {e['id']} should have no correction without proof")

if __name__ == "__main__":
    unittest.main()
