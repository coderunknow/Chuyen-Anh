"""Guards for the CEFR review / vocabulary quality audit (no deletion).

The audit is an evidence document, so the tests pin three things that would make
it dishonest if they drifted: the numbers must match the real bank, the policy
must remain "nothing is deleted or relabelled", and no CEFR label may be
promoted beyond the evidence that actually supports it.
"""
import json
import subprocess
import sys
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOCAB = ROOT / 'data/vocabulary.json'
PHRASES = ROOT / 'data/phrases.json'
REPORT = ROOT / 'docs/vocabulary-cefr-review.json'
SCRIPT = ROOT / 'scripts/vocabulary_cefr_review.py'
CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
UNCLASSIFIED = 'UNCLASSIFIED'


def tags(row):
    return [tag for tag in (row.get('tags') or []) if isinstance(tag, str)]


def tag_value(row, prefix):
    for tag in tags(row):
        if tag.startswith(prefix + ':'):
            return tag.split(':', 1)[1]
    return None


def level(row):
    value = tag_value(row, 'level')
    return value.upper() if value and value.upper() in CEFR_LEVELS else UNCLASSIFIED


class VocabularyCefrReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = json.loads(VOCAB.read_text(encoding='utf-8'))
        cls.phrases = json.loads(PHRASES.read_text(encoding='utf-8'))
        cls.report = json.loads(REPORT.read_text(encoding='utf-8'))
        cls.headwords = [row for row in cls.rows if 'family:merged' not in tags(row)]
        cls.archived = [row for row in cls.headwords if 'curation:archived' in tags(row)]
        cls.active = [row for row in cls.headwords if 'curation:archived' not in tags(row)]

    def test_report_is_regenerated_by_the_committed_script(self):
        result = subprocess.run([sys.executable, str(SCRIPT), '--check'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('Checked vocabulary CEFR review', result.stdout)

    def test_totals_come_from_the_real_bank(self):
        totals = self.report['totals']
        self.assertEqual(totals['rows'], len(self.rows))
        self.assertEqual(totals['headwords'], len(self.headwords))
        self.assertEqual(totals['activeHeadwords'], len(self.active))
        self.assertEqual(totals['archivedHeadwords'], len(self.archived))
        self.assertEqual(totals['mergedFamilyForms'], len(self.rows) - len(self.headwords))
        self.assertEqual(totals['phrases'], len(self.phrases))
        self.assertEqual(totals['activeHeadwords'] + totals['archivedHeadwords'], totals['headwords'])

    def test_level_counts_match_a_direct_count_of_the_stored_tags(self):
        active = Counter(level(row) for row in self.active)
        everything = Counter(level(row) for row in self.rows)
        expected_active = {item: active.get(item, 0) for item in CEFR_LEVELS + [UNCLASSIFIED]}
        expected_all = {item: everything.get(item, 0) for item in CEFR_LEVELS + [UNCLASSIFIED]}
        self.assertEqual(self.report['before']['activeByLevel'], expected_active)
        self.assertEqual(self.report['before']['allByLevel'], expected_all)

    def test_no_row_is_deleted_relabelled_or_archived_by_the_audit(self):
        self.assertEqual(
            {key: value for key, value in self.report['after'].items() if key != 'note'},
            self.report['before']
        )
        self.assertEqual(self.report['policy']['deletion'], 'none — this audit never removes, relabels or merges a row')
        # A1/A2/B1 may be small; they must never be reduced to look better.
        for scope in ('before', 'after'):
            for item in ('A1', 'A2', 'B1'):
                self.assertIsInstance(self.report[scope]['activeByLevel'][item], int)
        self.assertEqual(self.report['after']['activeByLevel'], self.report['before']['activeByLevel'])

    def test_no_label_is_promoted_beyond_its_evidence(self):
        evidence = self.report['cefrEvidence']
        self.assertEqual(evidence['Verified'], 0, 'no official CEFR reference was retrieved, so nothing is verified')
        self.assertEqual(evidence['Source-supported'], 0, 'no dictionary level was retrieved, so nothing is source-supported')
        sources = evidence['labelSources']
        self.assertEqual(sources.get('editorial'), evidence['Inferred'])
        self.assertEqual(evidence['Inferred'] + evidence['Unknown'] + evidence['Other label source'], evidence['totalRows'])
        # An editorial label is never counted as unknown or verified.
        stored = Counter(tag_value(row, 'level-source') for row in self.rows)
        self.assertEqual(stored.get(None, 0), evidence['Unknown'])

    def test_phrases_are_judged_by_their_own_level(self):
        stored = Counter()
        for phrase in self.phrases:
            value = tag_value(phrase, 'level')
            stored[value.upper() if value and value.upper() in CEFR_LEVELS else UNCLASSIFIED] += 1
        self.assertEqual(
            self.report['before']['phraseByLevel'],
            {item: stored.get(item, 0) for item in CEFR_LEVELS + [UNCLASSIFIED]}
        )
        for case in self.report['quality']['highLevelPhrasesWithOnlyLowLevelConstituents']:
            self.assertIn(case['phraseLevel'], {'B2', 'C1', 'C2'})
            self.assertTrue(set(case['constituentLevels']) <= {'A1', 'A2', 'B1'})
            self.assertIn('never judged by its cheapest word', case['handling'])
        self.assertIn('kept', self.report['policy']['phrases'])

    def test_quality_checks_report_instead_of_repairing(self):
        quality = self.report['quality']
        active_ids = {str(row.get('id')) for row in self.active}
        for key in ('missingMeaning', 'missingPos', 'missingSources'):
            self.assertTrue(set(quality[key]) <= active_ids, key)
        for case in quality['duplicateNormalizedHeadwords']:
            self.assertIn('never merged automatically', case['handling'])
        for case in quality['multiSenseGlosses']:
            self.assertIn(str(case['id']), active_ids)
        # The report must never claim it fixed something.
        self.assertNotIn('fixed', json.dumps(self.report).lower().replace('unfixed', ''))

    def test_usefulness_mix_is_derived_from_the_bank(self):
        active = self.report['usefulness']['activeByLevel']
        advanced = active['B2'] + active['C1'] + active['C2']
        self.assertEqual(self.report['usefulness']['advancedShare'], round(advanced / len(self.active) * 1000) / 10)
        academic = len([row for row in self.active if tag_value(row, 'type') == 'academic'])
        self.assertEqual(self.report['usefulness']['academicActive'], academic)
        for phrase_type, key in (
            ('phrasal-verb', 'phrasalVerbs'), ('idiom', 'idioms'), ('collocation', 'collocations'),
            ('dependent-preposition', 'dependentPrepositions'), ('linker-phrase', 'linkerPhrases'),
            ('pattern', 'sentencePatterns')
        ):
            self.assertEqual(self.report['usefulness'][key], len([p for p in self.phrases if p.get('type') == phrase_type]), key)

    def test_limits_are_stated(self):
        limits = ' '.join(self.report['limits']).lower()
        for phrase in ('official primary source', 'editorial', 'unknown'):
            self.assertIn(phrase, limits)


if __name__ == '__main__':
    unittest.main()
