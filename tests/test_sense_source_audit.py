"""Reference locators must identify the claimed headword, POS and level."""
import sys
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import audit_sense_sources as audit

class SourceLocatorTests(unittest.TestCase):
    def setUp(self):
        self.index = audit.reference_index(audit.References())

    def test_valid_oxford_locator_matches_word_pos_and_level(self):
        entry = {'word': 'bank', 'pos': 'n'}
        source = {'ref': 'oxford-3000-wordlist', 'locator': 'oxford-3000.en.tsv:224: bank'}
        self.assertEqual(audit.match_source(entry, 'A1', source, self.index), 'match')
        self.assertEqual(audit.match_source(entry, 'B1', source, self.index), 'level mismatch')
        self.assertEqual(audit.match_source({**entry, 'word': 'race'}, 'A1', source, self.index), 'headword mismatch')
        self.assertEqual(audit.match_source({**entry, 'pos': 'v'}, 'A1', source, self.index), 'POS mismatch')

    def test_reference_id_must_match_file_and_locator_must_exist(self):
        entry = {'word': 'bank', 'pos': 'n'}
        source = {'ref': 'oxford-5000-expanded-wordlist', 'locator': 'oxford-3000.en.tsv:224: bank'}
        self.assertEqual(audit.match_source(entry, 'A1', source, self.index), 'source/file mismatch')
        source['ref'] = 'oxford-3000-wordlist'
        source['locator'] = 'oxford-3000.en.tsv:999999: bank'
        self.assertEqual(audit.match_source(entry, 'A1', source, self.index), 'locator not found')

    def test_cefr_j_locator_checks_word_pos_and_level(self):
        source = {'ref': 'cefrj-vocabulary-profile-1.5', 'locator': 'row 536: headword=bank'}
        self.assertEqual(audit.match_source({'word':'bank', 'pos':'n'}, 'A1', source, self.index), 'match')
        self.assertEqual(audit.match_source({'word':'bank', 'pos':'v'}, 'A1', source, self.index), 'POS mismatch')
        self.assertEqual(audit.match_source({'word':'bank', 'pos':'n'}, 'B2', source, self.index), 'level mismatch')

    def test_matching_rows_are_not_independent_review(self):
        entry = {'id':'7900', 'word':'bank', 'pos':'n', 'senses':[{'senseId':'7900-s1',
                 'cefr':'A1', 'evidence':'source_supported', 'sources':[
                     {'ref':'oxford-3000-wordlist','locator':'oxford-3000.en.tsv:224: bank'}]}]}
        results = audit.audit_entry(entry, self.index)
        self.assertEqual(results[0]['locatorAssessment'], 'matching source group(s) found')
        self.assertEqual(results[0]['independentReview'], 'not reviewed')

if __name__ == '__main__': unittest.main()
