"""Source, evidence-accounting, and release-gate tests for the dev5 audit."""
from datetime import date, datetime
import json
import pathlib
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
from learned_vocabulary import parse_table  # noqa: E402
from vocabulary_families import audit_view  # noqa: E402

REPORT_JSON = ROOT / "docs" / "vocabulary-audit-dev5.json"
REPORT_MD = ROOT / "docs" / "vocabulary-audit-dev5.md"
SCHEMA_PATH = ROOT / "docs" / "vocabulary-audit-dev5.schema.json"
SOURCE_FIELDS = (
    "word", "pos", "meaning", "tags", "wordFamily", "synonyms", "antonyms",
    "collocations", "register", "connotation", "notes",
)
DIRECT_REVALIDATED = {"1", "281", "283", "341", "913"}
NONEXACT_PENDING = {"448", "456", "579"}
EXPECTED_CORRECTIONS = {"153", "232", "256", "271", "274", "341", "357", "456", "459", "460", "565", "579", "582", "584", "591", "617"}
PLACEHOLDER_EXCERPTS = (
    "compatible with vietnamese meaning", "verified via cambridge", "generated url",
    "headword verified", "templated description", "definition compatible",
)


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class VocabularyAuditDev5Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = load_json(REPORT_JSON)
        cls.entries = cls.doc["entries"]
        cls.by_id = {entry["id"]: entry for entry in cls.entries}
        cls.schema = load_json(SCHEMA_PATH)

    def test_versioned_schema_and_report_metadata(self):
        self.assertEqual(self.schema["$schema"], "https://json-schema.org/draft/2020-12/schema")
        self.assertEqual(self.schema["properties"]["schemaVersion"]["const"], "2.0.0")
        self.assertEqual(self.schema["properties"]["appVersion"]["const"], "v1.0.0-dev5")
        self.assertEqual(self.schema["properties"]["total"]["const"], 913)
        self.assertEqual(self.doc["schemaVersion"], "2.0.0")
        self.assertEqual(self.doc["appVersion"], "v1.0.0-dev5")
        self.assertEqual(self.doc["total"], 913)
        self.assertEqual(self.doc["methodology"]["reviewDate"], "2026-10-20")
        generated_at = datetime.fromisoformat(self.doc["generatedAt"].replace("Z", "+00:00"))
        self.assertEqual(generated_at.date().isoformat(), "2026-10-20")
        self.assertEqual(self.schema["properties"]["entries"]["minItems"], 913)
        self.assertEqual(self.schema["properties"]["entries"]["maxItems"], 913)
        self.assertFalse(self.schema["additionalProperties"])

    def test_all_913_ids_are_ordered_and_source_json_audit_match(self):
        expected_ids = [str(i) for i in range(1, 914)]
        self.assertEqual([entry["id"] for entry in self.entries], expected_ids)
        self.assertEqual(len(self.by_id), 913)
        source = parse_table(ROOT / "Learned_Vocabulary_List.md")
        app = load_json(ROOT / "data" / "vocabulary.json")
        # beta7 appends new headwords after ID 913; the dev5 audit covers the
        # legacy prefix and must never see an appended row inside it.
        self.assertGreaterEqual(len(source), 913)
        self.assertEqual(len(app), len(source))
        self.assertFalse([row for row in source[913:] if int(row["id"]) <= 913])
        source, app = source[:913], app[:913]
        source_by_id = {row["id"]: row for row in source}
        app_by_id = {row["id"]: row for row in app}
        self.assertEqual(list(source_by_id), expected_ids)
        self.assertEqual(list(app_by_id), expected_ids)
        for entry_id in expected_ids:
            source_row = source_by_id[entry_id]
            app_row = app_by_id[entry_id]
            audit_row = self.by_id[entry_id]
            for field in SOURCE_FIELDS:
                # Family bookkeeping post-dates this frozen ledger and is not
                # dictionary evidence; comparing it away keeps the record intact.
                expected = audit_view(field, source_row[field])
                self.assertEqual(expected, audit_view(field, app_row.get(field, "")), f"source/JSON {entry_id}.{field}")
                self.assertEqual(expected, audit_row["source"][field], f"source/report {entry_id}.{field}")
            self.assertEqual(audit_row["appMetadata"]["examples"], app_row.get("examples", []), entry_id)
            self.assertEqual(audit_row["appMetadata"]["difficulty"], app_row.get("difficulty"), entry_id)
            self.assertEqual(audit_row["appMetadata"]["createdAt"], app_row.get("createdAt"), entry_id)
            number = int(entry_id)
            tier = "core" if number <= 300 else "extended" if number <= 613 else "word-family"
            self.assertEqual(audit_row["tier"], tier, entry_id)

    def test_report_separates_source_coverage_structural_checks_and_dictionary_evidence(self):
        summary = self.doc["summary"]
        statuses = [entry["dictionaryVerification"]["status"] for entry in self.entries]
        self.assertEqual(statuses.count("verified"), 145)
        self.assertEqual(statuses.count("pending-manual"), 768)
        self.assertEqual(summary["sourceRowsReviewed"], 913)
        self.assertEqual(summary["sourceRowsUnreviewed"], 0)
        self.assertEqual(summary["automatedStructuralChecks"], 913)
        self.assertEqual(summary["dictionaryVerified"], 145)
        self.assertEqual(summary["dictionaryVerifiedCarriedForwardFromDev4"], 127)
        self.assertEqual(summary["legacyExactHeadwordsDirectlyRevalidatedInDev5"], 5)
        self.assertEqual(summary["newExactHeadwordsDirectlyVerifiedInDev5"], 13)
        self.assertEqual(summary["exactHeadwordsDirectlyCheckedInDev5"], 18)
        self.assertEqual(summary["dictionaryPending"], 768)
        self.assertEqual(summary["dictionaryPendingWithTargetedNonExactEvidence"], 3)
        self.assertEqual(summary["dictionaryPendingNotTargetedThisPass"], 765)
        self.assertEqual(summary["uniqueDeepReviewIds"], 21)
        self.assertEqual(summary["targetedConcernsReviewed"], 16)
        self.assertEqual(summary["evidenceBackedSourceCorrections"], 16)
        self.assertEqual(summary["sourceCorrectionsWithExactHeadwordDictionaryEvidence"], 14)
        self.assertEqual(summary["sourceCorrectionsWithGrammarOrComponentEvidenceOnly"], 2)
        self.assertEqual(summary["legacyEvidenceCorrections"], 6)
        self.assertEqual(summary["unresolvedTargetedConcerns"], 0)
        self.assertIs(summary["claimsAll913DictionaryVerified"], False)
        self.assertEqual(summary["dictionaryVerified"], summary["dictionaryVerifiedCarriedForwardFromDev4"] + summary["exactHeadwordsDirectlyCheckedInDev5"])
        self.assertEqual(summary["dictionaryPending"], summary["dictionaryPendingNotTargetedThisPass"] + summary["dictionaryPendingWithTargetedNonExactEvidence"])
        self.assertTrue(self.doc["sourceReview"]["completedBeforeDictionaryResearch"])
        self.assertEqual(self.doc["sourceReview"]["sourceRowsReadInNumericOrder"], 913)
        comparison = self.doc["sourceReview"]["comparisonBeforeSourceEdits"]
        self.assertEqual(comparison["sourceJsonFieldDifferences"], 0)
        self.assertEqual(comparison["sourceDev4AuditFieldDifferences"], 0)
        self.assertEqual(self.doc["methodology"]["tierCounts"], {"core": 300, "extended": 313, "word-family": 300})
        self.assertTrue(any("does not claim 913/913" in item for item in self.doc["methodology"]["limitations"]))

    def test_verified_status_requires_complete_dictionary_evidence_and_honest_basis(self):
        verified = [entry for entry in self.entries if entry["dictionaryVerification"]["status"] == "verified"]
        self.assertEqual(len(verified), 145)
        carried = set()
        direct = set()
        for entry in verified:
            ev = entry["dictionaryVerification"]
            self.assertTrue(ev["url"].startswith("https://dictionary.cambridge.org/"), entry["id"])
            self.assertTrue(ev["headword"], entry["id"])
            self.assertTrue(ev["partOfSpeech"], entry["id"])
            self.assertTrue(ev["definitionExcerpt"], entry["id"])
            date.fromisoformat(ev["retrievedAt"])
            self.assertIn("Cambridge", ev["notes"], entry["id"])
            self.assertIn(ev["evidenceBasis"], {
                "dev4-evidence-carried-forward-not-rechecked-in-dev5",
                "dev5-direct-revalidation", "dev5-direct-new-check",
            })
            text = ev["definitionExcerpt"].lower()
            for placeholder in PLACEHOLDER_EXCERPTS:
                self.assertNotIn(placeholder, text, f"ID {entry['id']} placeholder {placeholder}")
            if ev["evidenceBasis"] == "dev4-evidence-carried-forward-not-rechecked-in-dev5":
                self.assertFalse(ev["revalidatedInDev5"], entry["id"])
                carried.add(entry["id"])
            else:
                self.assertTrue(ev["revalidatedInDev5"], entry["id"])
                self.assertEqual(ev["retrievedAt"], "2026-10-20", entry["id"])
                direct.add(entry["id"])
        self.assertEqual(len(carried), 127)
        self.assertEqual(len(direct), 18)
        self.assertEqual(direct & DIRECT_REVALIDATED, DIRECT_REVALIDATED)
        self.assertEqual({self.by_id[i]["dictionaryVerification"]["evidenceBasis"] for i in DIRECT_REVALIDATED}, {"dev5-direct-revalidation"})
        self.assertEqual(sum(self.by_id[i]["dictionaryVerification"]["evidenceBasis"] == "dev5-direct-new-check" for i in direct), 13)
        self.assertEqual(self.by_id["271"]["dictionaryVerification"]["definitionExcerpt"], "fat")
        self.assertEqual(self.by_id["459"]["dictionaryVerification"]["headword"], "check out")
        self.assertEqual(self.by_id["565"]["dictionaryVerification"]["headword"], "AI slop")

    def test_pending_rows_have_no_exact_headword_claim_and_targeted_rows_have_disclosed_limits(self):
        pending = [entry for entry in self.entries if entry["dictionaryVerification"]["status"] == "pending-manual"]
        self.assertEqual(len(pending), 768)
        actual_targeted_pending = set()
        for entry in pending:
            ev = entry["dictionaryVerification"]
            self.assertIsNone(ev["url"], entry["id"])
            self.assertIsNone(ev["headword"], entry["id"])
            self.assertIsNone(ev["partOfSpeech"], entry["id"])
            self.assertIsNone(ev["definitionExcerpt"], entry["id"])
            self.assertIsNone(ev["retrievedAt"], entry["id"])
            self.assertFalse(ev["revalidatedInDev5"], entry["id"])
            if entry["id"] in NONEXACT_PENDING:
                actual_targeted_pending.add(entry["id"])
                self.assertTrue(ev.get("candidateUrl") is None or ev["candidateUrl"].startswith("https://dictionary.cambridge.org/"))
            else:
                self.assertEqual(ev["evidenceBasis"], "generated-candidate-url-only-not-evidence", entry["id"])
        self.assertEqual(actual_targeted_pending, NONEXACT_PENDING)
        self.assertEqual(sum(bool(entry["supplementalEvidence"]) for entry in pending), 2)
        self.assertEqual(len(self.by_id["456"]["supplementalEvidence"]), 2)
        self.assertEqual(len(self.by_id["579"]["supplementalEvidence"]), 2)
        urls_456 = {item["url"] for item in self.by_id["456"]["supplementalEvidence"]}
        self.assertEqual(urls_456, {
            "https://dictionary.cambridge.org/grammar/british-grammar/suggest",
            "https://dictionary.cambridge.org/dictionary/english/insist",
        })
        urls_579 = {item["url"] for item in self.by_id["579"]["supplementalEvidence"]}
        self.assertEqual(urls_579, {
            "https://dictionary.cambridge.org/us/dictionary/learner-english/burning",
            "https://dictionary.cambridge.org/dictionary/english/social-conscience",
        })
        self.assertEqual(self.by_id["448"]["dictionaryVerification"]["status"], "pending-manual")
        self.assertTrue(self.by_id["448"]["dictionaryVerification"]["candidateUrl"].endswith("/menial-task"))
        self.assertIn("generic dictionary landing page", self.by_id["448"]["dictionaryVerification"]["notes"])
        self.assertEqual(self.by_id["456"]["dictionaryVerification"]["status"], "pending-manual")
        self.assertEqual(self.by_id["579"]["dictionaryVerification"]["status"], "pending-manual")

    def test_corrections_and_targeted_reviews_match_current_source_and_evidence(self):
        source_by_id = {row["id"]: row for row in parse_table(ROOT / "Learned_Vocabulary_List.md")}
        for entry_id, url in {
            "456": "https://dictionary.cambridge.org/grammar/british-grammar/suggest",
            "459": "https://dictionary.cambridge.org/dictionary/english/check-out",
            "579": "https://dictionary.cambridge.org/us/dictionary/learner-english/burning",
            "584": "https://dictionary.cambridge.org/dictionary/english/streaky-bacon",
        }.items():
            self.assertIn(url, source_by_id[entry_id]["notes"], f"ID {entry_id} source note should preserve its evidence URL")
        corrections = self.doc["corrections"]
        reviews = self.doc["targetedReviews"]
        self.assertEqual({item["id"] for item in corrections}, EXPECTED_CORRECTIONS)
        self.assertEqual({item["id"] for item in reviews}, EXPECTED_CORRECTIONS)
        self.assertEqual(len(corrections), 16)
        self.assertEqual(len(reviews), 16)
        review_by_id = {item["id"]: item for item in reviews}
        for correction in corrections:
            entry_id = correction["id"]
            self.assertEqual(correction["word"], source_by_id[entry_id]["word"])
            self.assertTrue(correction["evidence"], entry_id)
            self.assertEqual(correction["dictionaryStatus"], self.by_id[entry_id]["dictionaryVerification"]["status"])
            changed_fields = []
            for change in correction["changes"]:
                self.assertIn(change["field"], SOURCE_FIELDS)
                self.assertNotEqual(change["before"], change["after"], f"{entry_id}.{change['field']}")
                self.assertEqual(change["after"], source_by_id[entry_id][change["field"]], f"{entry_id}.{change['field']}")
                changed_fields.append(change["field"])
            review = review_by_id[entry_id]
            self.assertTrue(review["reviewed"])
            self.assertTrue(review["sourceCorrection"])
            self.assertEqual(review["changedFields"], changed_fields)
            self.assertEqual(review["dictionaryVerification"], correction["dictionaryStatus"])
            self.assertTrue(review["disposition"])
        repair_ids = {repair["id"] for repair in self.doc["legacyEvidenceRepairs"]}
        self.assertEqual(repair_ids, DIRECT_REVALIDATED | {"448"})
        self.assertEqual(len(self.doc["legacyEvidenceRepairs"]), 6)
        repair_448 = next(repair for repair in self.doc["legacyEvidenceRepairs"] if repair["id"] == "448")
        self.assertEqual(repair_448["dictionaryStatus"], "pending-manual")
        self.assertTrue(repair_448["attemptedExactHeadwordUrl"].endswith("/menial-task"))
        self.assertIn("separate", repair_448["reason"])

    def test_markdown_tables_and_limits_agree_with_machine_report(self):
        text = REPORT_MD.read_text(encoding="utf-8")
        self.assertIn("913 / 913", text)
        self.assertIn("145 verified", text)
        self.assertIn("127 dev4 records carried forward", text)
        self.assertIn("18 directly checked in dev5", text)
        self.assertIn("768 / 913", text)
        self.assertIn("765", text)
        self.assertIn("No 913/913 dictionary-completion claim is made", text)
        self.assertIn("ID 448", text)
        self.assertIn("ID 456", text)
        self.assertIn("ID 579", text)
        self.assertIn("When we suggest an action to someone", text)
        self.assertIn("a very strong need to do something", text)
        self.assertIn("New recruits tend to end up with the most menial tasks", text)
        self.assertIn("\n\n## Method and limitations", text)

        start = text.index("## Targeted review dispositions (16 suspected source rows)")
        end = text.index("### Source corrections")
        review_section = text[start:end]
        review_rows = [line for line in review_section.splitlines() if line.startswith("|") and not line.startswith("| ---") and not line.startswith("| ID |")]
        self.assertEqual(len(review_rows), 16)
        start = text.index("## Direct Cambridge evidence rechecked in dev5")
        end = text.index("## Legacy evidence repair")
        evidence_section = text[start:end]
        evidence_rows = [line for line in evidence_section.splitlines() if line.startswith("|") and not line.startswith("| ---") and not line.startswith("| ID |")]
        self.assertEqual(len(evidence_rows), 18)
        self.assertNotIn("| 448 |", evidence_section)
        self.assertIn("exact `/menial-task` URL returned a generic dictionary landing page", text)

    def test_dev5_generator_check_is_deterministic_and_read_only(self):
        before = [path.read_bytes() for path in (REPORT_JSON, REPORT_MD)]
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "generate_vocab_audit_dev5.py"), "--check"],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
        )
        after = [path.read_bytes() for path in (REPORT_JSON, REPORT_MD)]
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("is current", result.stdout)
        self.assertEqual(before, after, "--check must not write report files")


if __name__ == "__main__":
    unittest.main()
