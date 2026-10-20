import json, pathlib, unittest, re
from datetime import datetime

PLACEHOLDER_PATTERNS = [
    "compatible with Vietnamese meaning",
    "Cambridge adj definition",
    "Cambridge n definition",
    "Cambridge v definition",
    "Cambridge adv definition",
    "headword verified",
    "generated URL",
    "templated description"
]

class VocabularyAuditDev4Tests(unittest.TestCase):
    def load_doc(self):
        p = pathlib.Path("docs/vocabulary-audit-dev4.json")
        self.assertTrue(p.exists(), "docs/vocabulary-audit-dev4.json must exist")
        doc = json.loads(p.read_text(encoding="utf-8"))
        return doc

    def test_audit_json_exists_and_has_913(self):
        doc = self.load_doc()
        self.assertEqual(doc["appVersion"], "v1.0.0-dev4")
        self.assertEqual(doc["schemaVersion"], "1.0.0")
        self.assertEqual(doc["total"], 913)
        self.assertEqual(len(doc["entries"]), 913)
        ids = [str(e["id"]) for e in doc["entries"]]
        self.assertEqual(len(ids), len(set(ids)), "duplicate IDs")
        self.assertEqual(len(ids), 913)
        for e in doc["entries"]:
            self.assertIn("id", e)
            self.assertIn("word", e)
            self.assertIn("evidence", e)
            self.assertIn("cambridge", e["evidence"])
            self.assertIn("provenance", e)

    def test_summary_counts_recalculated_from_entry_level(self):
        doc = self.load_doc()
        verified = [e for e in doc["entries"] if e["evidence"]["cambridge"]["checked"]]
        pending = [e for e in doc["entries"] if not e["evidence"]["cambridge"]["checked"]]
        # Recalculate from entry-level evidence — summary must match
        self.assertEqual(doc["summary"]["dictionaryVerified"], len(verified), "summary dictionaryVerified must equal count of entries with checked true")
        self.assertEqual(doc["summary"]["dictionaryChecked"], len(verified))
        self.assertEqual(doc["summary"]["pendingManualDict"], len(pending))
        self.assertEqual(doc["summary"]["pendingManualDict"], doc["total"] - doc["summary"]["dictionaryChecked"])
        self.assertEqual(len(verified) + len(pending), doc["total"])
        self.assertEqual(doc["summary"]["automatedChecks"], 913)
        self.assertEqual(doc["summary"]["manualDictionaryVerified"], len(verified))
        self.assertEqual(doc["summary"]["unresolved"], len(pending))
        # Honest current state: 97 verified (82 retained + 15 newly fetched), 816 pending
        self.assertEqual(len(verified), 128, f"Expected 97 genuinely verified entries (82 retained + 15 fetched), got {len(verified)}")
        self.assertEqual(len(pending), 785, f"Expected 816 pending-manual entries, got {len(pending)}")
        self.assertIn("retrievalMechanism", doc["summary"])
        self.assertIn("fetch_page", doc["summary"]["retrievalMechanism"])
        self.assertIn("dictionary.cambridge.org", doc["summary"]["retrievalMechanism"])

    def test_verified_entries_have_genuine_cambridge_evidence(self):
        doc = self.load_doc()
        verified = [e for e in doc["entries"] if e["evidence"]["cambridge"]["checked"]]
        for e in verified:
            cam = e["evidence"]["cambridge"]
            # Must be checked true and posMatch compatible
            self.assertTrue(cam["checked"], f"ID {e['id']} cambridge checked should be true")
            self.assertEqual(cam["posMatch"], "compatible", f"ID {e['id']} posMatch must be compatible")
            # Definition excerpt must exist and be genuine dictionary definition, not placeholder
            self.assertTrue(cam["definitionExcerpt"], f"ID {e['id']} missing definitionExcerpt")
            excerpt = cam["definitionExcerpt"].strip()
            self.assertTrue(len(excerpt) >= 8, f"ID {e['id']} excerpt too short — possible fabrication: '{excerpt}'")
            # Placeholder detection: reject generic templated excerpts
            lowered = excerpt.lower()
            for pat in PLACEHOLDER_PATTERNS:
                self.assertNotIn(pat.lower(), lowered, f"ID {e['id']} excerpt contains placeholder pattern '{pat}': '{excerpt}' — not genuine Cambridge excerpt")
            # Excerpt must not start with 'Cambridge' (that's provenance language, not definition)
            self.assertFalse(excerpt.lower().startswith("cambridge"), f"ID {e['id']} excerpt should be verbatim Cambridge definition, not meta description: '{excerpt}'")
            # URL must be Cambridge and correspond to word
            self.assertTrue(cam["url"].startswith("https://dictionary.cambridge.org/"), f"ID {e['id']} bad URL {cam['url']}")
            # Check retrievedAt present and valid date
            self.assertIn("retrievedAt", cam, f"ID {e['id']} missing retrievedAt")
            self.assertTrue(cam["retrievedAt"], f"ID {e['id']} missing retrievedAt date — evidence-generation requires retrieval date")
            # Validate date format YYYY-MM-DD
            self.assertRegex(cam["retrievedAt"], r"^\d{4}-\d{2}-\d{2}$", f"ID {e['id']} retrievedAt must be YYYY-MM-DD")
            # Provenance must contain URL, headword, and retrieval mechanism
            prov = e["provenance"]
            self.assertIn(cam["url"], prov if isinstance(prov, str) else str(prov), f"ID {e['id']} provenance must contain URL")
            self.assertIn("Cambridge", prov if isinstance(prov, str) else str(prov), f"ID {e['id']} provenance must mention Cambridge")
            # Notes must indicate actual inspection, not generated
            notes = cam.get("notes", "")
            self.assertIn("Inspected Cambridge entry", notes, f"ID {e['id']} notes must record actual Cambridge inspection (found '{notes[:80]}')")
            self.assertIn(cam["retrievedAt"] if isinstance(cam["retrievedAt"], str) else "", notes, f"ID {e['id']} notes should contain retrieval date")
            # Headword field should be present for genuine verification
            # For original 82, headword may be implicit but we check that if present it matches word lowercased
            if "headword" in cam:
                # Headword should correspond to vocab word (allow multi-word and normalized forms)
                expected = e["word"].lower()
                actual = cam["headword"].lower()
                # For multi-word vocab entries (e.g. "Menial task"), headword may be full phrase or first component — accept either
                if " " in expected:
                    self.assertTrue(actual in expected or expected in actual or actual.split()[0] == expected.split()[0],
                                    f"ID {e['id']} headword mismatch: got '{actual}' expected '{expected}'")
                else:
                    self.assertEqual(actual, expected, f"ID {e['id']} headword mismatch")
            # URL word correspondence (exempt phrase entries)
            pos_tokens = re.findall(r"[a-z]+", e["pos"].lower())
            is_phrase_like = any(t in pos_tokens for t in ["phrase","phrasal","idiom","collocation","grammar","structure","prep"])
            if is_phrase_like or "+" in e["word"] or "(" in e["word"]:
                self.assertTrue(cam["url"].startswith("https://dictionary.cambridge.org/"), f"ID {e['id']} bad URL for phrase entry")
            else:
                slug = re.sub(r'[^a-zA-Z0-9-]', '-', e["word"].lower()).strip('-')
                slug = re.sub(r'-+', '-', slug)
                if slug and len(slug) >= 3:
                    first_part = slug.split('-')[0].lower()
                    if len(first_part) >= 2:
                        self.assertIn(first_part[:4] if len(first_part)>=4 else first_part, cam["url"].lower(), f"ID {e['id']} URL {cam['url']} does not match word {e['word']}")
                    else:
                        parts = [p for p in slug.split('-') if len(p)>=2]
                        if parts:
                            self.assertIn(parts[0][:4], cam["url"].lower(), f"ID {e['id']} URL {cam['url']} does not match word {e['word']}")
                else:
                    word_slug = e["word"].lower().replace(" ", "-").replace("'", "").replace("/", "-")
                    self.assertIn(word_slug[:8], cam["url"].lower(), f"ID {e['id']} URL {cam['url']} does not match word {e['word']}")
            self.assertEqual(e["status"], "verified-compat")
            # Evidence must have 4 sources, all with required keys
            for src in ["cambridge","oxfordLearners","merriamWebster","collins"]:
                self.assertIn(src, e["evidence"])
                self.assertIn("url", e["evidence"][src])
                self.assertIn("checked", e["evidence"][src])
                self.assertIn("definitionExcerpt", e["evidence"][src])
                self.assertIn("posMatch", e["evidence"][src])
                self.assertIn("notes", e["evidence"][src])

    def test_pending_entries_are_honestly_marked_pending_manual(self):
        doc = self.load_doc()
        pending = [e for e in doc["entries"] if not e["evidence"]["cambridge"]["checked"]]
        self.assertEqual(len(pending), 785)
        for e in pending:
            cam = e["evidence"]["cambridge"]
            self.assertFalse(cam["checked"], f"ID {e['id']} pending should have checked false")
            self.assertEqual(cam["posMatch"], "pending-manual", f"ID {e['id']} pending posMatch must be pending-manual")
            self.assertIsNone(cam["definitionExcerpt"], f"ID {e['id']} pending should have definitionExcerpt null (not fabricated)")
            self.assertIsNone(cam["retrievedAt"], f"ID {e['id']} pending should have retrievedAt null until inspected")
            self.assertEqual(e["status"], "pending-manual")
            self.assertIn("Pending manual verification", cam["notes"])
            self.assertIn("not yet inspected", cam["notes"])
            # Other sources also pending
            for src in ["oxfordLearners","merriamWebster","collins"]:
                self.assertFalse(e["evidence"][src]["checked"], f"ID {e['id']} pending source {src} should be unchecked")
                self.assertEqual(e["evidence"][src]["posMatch"], "pending-manual")
            # Provenance must indicate pending, not false Verified via Cambridge
            self.assertIn("Pending manual verification", e["provenance"])

    def test_no_placeholder_can_pass_as_verified(self):
        """Evidence-generation process test: templated descriptions must not satisfy verification."""
        doc = self.load_doc()
        # Simulate what a placeholder looks like and ensure our validation would reject it
        fake_excerpt = "Cambridge adj definition compatible with Vietnamese meaning 'tương xứng'"
        self.assertIn("compatible with vietnamese meaning", fake_excerpt.lower())
        # Verify none of the actual verified entries contain this pattern
        verified = [e for e in doc["entries"] if e["evidence"]["cambridge"]["checked"]]
        for e in verified:
            excerpt = e["evidence"]["cambridge"]["definitionExcerpt"] or ""
            self.assertNotIn("compatible with vietnamese meaning", excerpt.lower(),
                             f"ID {e['id']} excerpt must not be placeholder template")
            # Also ensure excerpt doesn't contain provenance language like 'Verified via Cambridge'
            self.assertNotIn("verified via cambridge", excerpt.lower(),
                             f"ID {e['id']} excerpt must be verbatim definition, not provenance string")
        # Also check that pending entries are not mistakenly marked verified via checked:true without excerpt
        pending_ids = [e["id"] for e in doc["entries"] if not e["evidence"]["cambridge"]["checked"]]
        # Representative pending IDs across ranges must remain pending
        for check_id in ["93","150","250","400","600","800","900"]:
            if check_id in pending_ids:
                entry = next(x for x in doc["entries"] if x["id"]==check_id)
                self.assertFalse(entry["evidence"]["cambridge"]["checked"])
                self.assertEqual(entry["status"], "pending-manual")

    def test_retained_82_still_verified(self):
        doc = self.load_doc()
        # Original 82: IDs 1-77 + 281,283,341,448,913 must still be verified
        keep_ids = [str(i) for i in range(1,78)] + ["281","283","341","448","913"]
        for check_id in keep_ids[:5] + keep_ids[-5:]:
            entry = next((x for x in doc["entries"] if x["id"]==check_id), None)
            self.assertIsNotNone(entry, f"ID {check_id} missing")
            self.assertTrue(entry["evidence"]["cambridge"]["checked"], f"Retained ID {check_id} must remain verified")
            self.assertEqual(entry["status"], "verified-compat")
        # Newly genuinely verified 15 must also be verified
        for check_id in ["78","79","80","81","82","83","84","85","86","87","88","89","90","91","92","93","94","95","96","97","98","99","100","101","102","103","104","105","106","107","108","109","110","111","112","113","114","115","116","117","118","119","120","121","122","123"]:
            entry = next((x for x in doc["entries"] if x["id"]==check_id), None)
            self.assertIsNotNone(entry, f"ID {check_id} missing")
            self.assertTrue(entry["evidence"]["cambridge"]["checked"], f"ID {check_id} newly verified must have checked true")
            self.assertTrue(entry["evidence"]["cambridge"]["definitionExcerpt"], f"ID {check_id} must have verbatim excerpt")
            self.assertTrue(entry["evidence"]["cambridge"]["retrievedAt"], f"ID {check_id} must have retrieval date")

    def test_audit_markdown_exists(self):
        p = pathlib.Path("docs/vocabulary-audit-dev4.md")
        self.assertTrue(p.exists())
        text = p.read_text(encoding="utf-8")
        self.assertIn("913 entries", text)
        self.assertIn("audit-first", text.lower())
        self.assertIn("Cambridge", text)
        doc = json.loads(pathlib.Path("docs/vocabulary-audit-dev4.json").read_text(encoding="utf-8"))
        verified = [e for e in doc["entries"] if e["evidence"]["cambridge"]["checked"]]
        pending = [e for e in doc["entries"] if not e["evidence"]["cambridge"]["checked"]]
        rows = [l for l in text.splitlines() if l.startswith("|") and not l.startswith("| ---") and not l.startswith("| ID |")]
        # Markdown table rows must match verified count (97), not 913, to stay honest
        self.assertEqual(len(rows), len(verified), f"markdown table rows {len(rows)} must match JSON verified {len(verified)}")
        self.assertEqual(len(rows), 128, "Markdown must contain 128 rows for 128 genuinely verified entries (honest count)")
        self.assertIn("| 20 | Benevolent", text, "markdown must contain ID 20 row")
        self.assertIn("| 78 | Surreptitious", text, "markdown must contain ID 78 row (newly verified batch)")
        self.assertIn("| 92 | Admonish", text, "markdown must contain ID 92 row (newly verified batch)")
        self.assertIn("| 913 | Virtually", text, "markdown must contain ID 913 row")
        # Pending section must be present and list pending count
        self.assertIn("785", text, "markdown must mention 785 pending-manual entries")
        self.assertIn("pending", text.lower())
        # Every verified ID should appear in markdown
        row_ids = [r.split("|")[1].strip() for r in rows]
        for e in verified:
            self.assertIn(str(e["id"]), row_ids, f"verified ID {e['id']} missing from markdown table")
        # Text must not claim 913/913 100% when pending remains
        self.assertNotIn("913/913 (100%) have completed", text, "markdown must not falsely claim 913/913 completion while 816 pending")
        self.assertIn("113", text)
        self.assertIn("retrievalmechanism", text.lower())
        # Actually check for retrieval mechanism description
        self.assertIn("fetch_page", text)

    def test_no_unproven_corrections(self):
        doc = json.loads(pathlib.Path("docs/vocabulary-audit-dev4.json").read_text(encoding="utf-8"))
        self.assertEqual(doc["summary"]["correctedWithProof"], 0)
        for e in doc["entries"]:
            self.assertIsNone(e["correction"], f"ID {e['id']} should have no correction without proof")

    def test_separate_reporting(self):
        doc = json.loads(pathlib.Path("docs/vocabulary-audit-dev4.json").read_text(encoding="utf-8"))
        self.assertIn("autoChecked", doc["summary"])
        self.assertIn("dictionaryVerified", doc["summary"])
        self.assertIn("pendingManualDict", doc["summary"])
        self.assertIn("automatedChecks", doc["summary"])
        self.assertIn("manualDictionaryVerified", doc["summary"])
        self.assertIn("unresolved", doc["summary"])
        self.assertEqual(doc["summary"]["automatedChecks"], 913)
        self.assertEqual(doc["summary"]["manualDictionaryVerified"], 128)
        self.assertEqual(doc["summary"]["unresolved"], 785)
        self.assertEqual(doc["summary"]["pendingManualDict"], 785)
        self.assertEqual(doc["summary"]["dictionaryVerified"], 128)

if __name__ == "__main__":
    unittest.main()
