#!/usr/bin/env python3
"""Flag potentially unsafe sense mappings; absence of a flag is not verification.

The reference lists do not translate Vietnamese glosses and headword-level
agreement is not evidence of agreement for an individual sense. This report is a
review queue, not an automated judgement about the correct mapping.
"""
from __future__ import annotations
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from cefr_senses import References, _pos_variants  # noqa: E402


def pos_level(row: dict, pos: str) -> str | None:
    levels = {row.get('pos_levels', {}).get(key) for key in _pos_variants(pos)} - {None}
    return next(iter(levels)) if len(levels) == 1 else None


def entry_issues(entry: dict, oxford_rows: dict) -> list[str]:
    senses = entry.get('senses', [])
    issues = set()
    if len(senses) > 1:
        issues.add('multi-sense mapping requires independent verification')
        meanings = [s.get('meaning', '').strip() for s in senses]
        if len(set(meanings)) < len(meanings):
            issues.add('duplicate gloss across senses')
        if any(s.get('evidence') == 'cross_validated' for s in senses):
            issues.add('sense cross-validation has unverified scope')
    for sense in senses:
        for source in sense.get('sources', []):
            if source.get('locator', '').startswith('docs/sense-gloss-mappings.json:'):
                issues.add('editorial gloss mapping requires independent verification')
            match = re.match(r'^(oxford-(?:3000|5000-expanded)\.en\.tsv):(\d+):', source.get('locator', ''))
            if not match:
                continue
            row = oxford_rows.get((match.group(1), int(match.group(2))))
            if row is None:
                issues.add('Oxford source locator not found')
                continue
            level = pos_level(row, entry.get('pos', ''))
            if level and level != sense.get('cefr'):
                issues.add('Oxford POS-specific level mismatch')
    return sorted(issues)


def main() -> None:
    refs = References()
    lookup = {(row['file'], row['line']): row for rows in refs.oxford.values() for row in rows}
    data = json.loads((ROOT / 'data/vocabulary.json').read_text(encoding='utf-8'))
    flagged = []
    for entry in data:
        issues = entry_issues(entry, lookup)
        fallback = sorted(name for name, vote in refs.votes_for(entry.get('word', ''), entry.get('pos', '')).items() if vote.get('pos_match') is False)
        if fallback:
            issues.append('reference vote uses unmatched POS; review scope')
            issues.sort()
        if issues:
            flagged.append({'id': entry['id'], 'word': entry['word'], 'pos': entry['pos'],
                            'meaning': entry['meaning'], 'issues': issues,
                            'unmatchedPosVoteSources': fallback, 'senses': entry['senses']})
    counts = Counter(issue for row in flagged for issue in row['issues'])
    payload = {'scope': 'heuristic review queue; unflagged entries are not verified',
               'entriesInspected': len(data), 'entriesFlagged': len(flagged),
               'issueCounts': dict(sorted(counts.items())), 'entries': flagged}
    print(json.dumps(payload, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
