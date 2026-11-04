#!/usr/bin/env python3
"""Heuristic source-locator review queue, not independent evidence verification.

Matches source snapshot row, normalized headword, POS and selected level for
source-supported/cross-validated senses. The checker does not establish source
identity, publisher independence, translation correctness or sense equivalence.
"""
from __future__ import annotations
import argparse
from collections import Counter
import json
from pathlib import Path
import re
from cefr_senses import References, _pos_variants, normalize_word

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'audit/v100/evidence/source-locator-review.json'
FILE_REF = {'oxford-3000-wordlist': 'oxford-3000.en.tsv',
            'oxford-5000-expanded-wordlist': 'oxford-5000-expanded.en.tsv'}
PROFILE_REF = {'cefrj-vocabulary-profile-1.5': 'cefrj',
               'octanove-vocabulary-profile-c1c2-1.0': 'octanove'}


def reference_index(refs):
    tables = {}
    for ref, attr in PROFILE_REF.items():
        tables[ref] = {r['line']: (word, r) for word, rows in getattr(refs, attr).items() for r in rows}
    tables['oxford'] = {(r['file'], r['line']): (word, r) for word, rows in refs.oxford.items() for r in rows}
    return tables


def match_source(entry, level, source, index):
    ref, locator = source.get('ref'), source.get('locator', '')
    if not isinstance(locator, str):
        return 'malformed locator'
    if ref in FILE_REF:
        match = re.match(r'^(oxford-[^:]+):(\d+):', locator)
        if not match:
            return 'malformed locator'
        if match.group(1) != FILE_REF[ref]:
            return 'source/file mismatch'
        found = index['oxford'].get((match.group(1), int(match.group(2))))
    elif ref in PROFILE_REF:
        match = re.match(r'^row (\d+)(?:\b|$)', locator)
        if not match:
            return 'malformed locator'
        found = index[ref].get(int(match.group(1)))
    else:
        return 'not a CEFR reference'
    if not found:
        return 'locator not found'
    word, row = found
    if word != normalize_word(entry.get('word', '')):
        return 'headword mismatch'
    keys = set(_pos_variants(entry.get('pos', '')))
    if ref in FILE_REF:
        if not row['pos'] or not keys.intersection(row['pos'].split(',')):
            return 'POS mismatch'
        levels = {row['pos_levels'][p] for p in keys if p in row['pos_levels']} or set(row['levels'])
    else:
        if row['pos'] not in keys:
            return 'POS mismatch'
        levels = {row['level']}
    return 'match' if level in levels else 'level mismatch'


def audit_entry(entry, index):
    results = []
    for sense in entry.get('senses', []):
        if not isinstance(sense, dict):
            continue
        claims = []
        groups = set()
        for source in sense.get('sources', []):
            if not isinstance(source, dict):
                continue
            ref = source.get('ref')
            result = match_source(entry, sense.get('cefr'), source, index)
            claims.append({'ref': ref, 'locator': source.get('locator'), 'result': result})
            if result == 'match':
                groups.add('oxford-university-press' if ref in FILE_REF else 'open-language-profiles')
        evidence = sense.get('evidence')
        needed = 2 if evidence == 'cross_validated' else 1
        assessment = ('matching source group(s) found' if len(groups) >= needed else 'insufficient matching source groups') if evidence in {'cross_validated', 'source_supported'} else 'not assessed for this evidence class'
        results.append({'entryId': entry.get('id'), 'word': entry.get('word'), 'pos': entry.get('pos'),
                        'senseId': sense.get('senseId'), 'cefr': sense.get('cefr'), 'evidence': evidence,
                        'locatorAssessment': assessment, 'independentReview': 'not reviewed', 'sourceChecks': claims})
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    index = reference_index(References())
    data = json.loads((ROOT / 'data/vocabulary.json').read_text(encoding='utf-8'))
    records = [record for entry in data for record in audit_entry(entry, index)]
    counts = Counter(record['locatorAssessment'] for record in records)
    report = {'scope': 'automated locator triage only; no record is independently verified',
              'entries': len(data), 'senses': len(records), 'byLocatorAssessment': dict(sorted(counts.items())),
              'records': records}
    serialized = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != serialized:
            raise SystemExit('source locator review is stale')
    else:
        OUT.write_text(serialized, encoding='utf-8')
    print(json.dumps({'entries': len(data), 'senses': len(records), 'byLocatorAssessment': report['byLocatorAssessment']}))

if __name__ == '__main__': main()
