#!/usr/bin/env python3
"""CEFR trust review and vocabulary quality audit (no deletion).

This audit never removes, relabels or merges a row. It answers two questions:

1. How much can a CEFR label be trusted? Every label in the bank is an editorial
   decision (`level-source:editorial`); none is backed by a dictionary level
   retrieval or an official CEFR source. The audit therefore reports four
   evidence classes (Verified / Source-supported / Inferred / Unknown) and never
   promotes an inferred label to a verified one.
2. Where is the vocabulary data weak for a Chuyên Anh learner? Sense compression,
   missing fields, duplicate headwords, answer leakage in the gloss, and phrases
   whose value is independent of the CEFR level of their constituent words.

The output is deterministic and checkable with `--check`.
"""
import argparse
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOCAB = ROOT / 'data/vocabulary.json'
PHRASES = ROOT / 'data/phrases.json'
CURATION = ROOT / 'docs/vocabulary-curation.json'
OUT_JSON = ROOT / 'docs/vocabulary-cefr-review.json'
OUT_MD = ROOT / 'docs/vocabulary-cefr-review.md'

CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
UNCLASSIFIED = 'UNCLASSIFIED'


def tags_of(row):
    return [tag for tag in (row.get('tags') or []) if isinstance(tag, str)]


def tag_value(row, prefix):
    for tag in tags_of(row):
        if tag.startswith(prefix + ':'):
            return tag.split(':', 1)[1]
    return None


def level_of(row):
    value = tag_value(row, 'level')
    return value.upper() if value and value.upper() in CEFR_LEVELS else UNCLASSIFIED


def level_source(row):
    return tag_value(row, 'level-source') or None


def is_merged(row):
    return 'family:merged' in tags_of(row)


def normalized(word):
    return re.sub(r'[^a-z0-9 ]+', ' ', str(word or '').lower()).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()

    rows = json.loads(VOCAB.read_text(encoding='utf-8'))
    phrases = json.loads(PHRASES.read_text(encoding='utf-8'))
    curation = json.loads(CURATION.read_text(encoding='utf-8'))
    # The archive marker is the tag the app itself reads (isArchivedEntry), so the
    # audit and the runtime can never disagree about which rows are out of scope.
    archived_ids = {str(row.get('id')) for row in rows if 'curation:archived' in tags_of(row)}

    headwords = [row for row in rows if not is_merged(row)]
    merged = [row for row in rows if is_merged(row)]
    active = [row for row in headwords if row.get('id') not in archived_ids]
    archived = [row for row in headwords if row.get('id') in archived_ids]

    def level_counts(items):
        counts = collections.Counter(level_of(row) for row in items)
        return {level: counts.get(level, 0) for level in CEFR_LEVELS + [UNCLASSIFIED]}

    # ---- evidence classes -------------------------------------------------
    evidence = collections.Counter()
    by_source = collections.Counter()
    for row in rows:
        level = level_of(row)
        source = level_source(row)
        by_source[source or 'none'] += 1
        if level == UNCLASSIFIED:
            evidence['Unknown'] += 1
        elif source == 'editorial':
            evidence['Inferred'] += 1
        elif source in {'dictionary', 'official', 'cefr'}:
            evidence['Source-supported'] += 1
        else:
            evidence['Unclassified-source'] += 1
    evidence_summary = {
        'Verified': evidence.get('Verified', 0),
        'Source-supported': evidence.get('Source-supported', 0),
        'Inferred': evidence.get('Inferred', 0),
        'Unknown': evidence.get('Unknown', 0),
        'Other label source': evidence.get('Unclassified-source', 0),
        'totalRows': len(rows),
        'labelSources': dict(by_source),
    }

    # ---- sense-level quality checks (report only) -------------------------
    seen_words = collections.defaultdict(list)
    for row in active:
        seen_words[normalized(row.get('word'))].append(str(row.get('id')))

    duplicates = [
        {'word': word, 'ids': ids, 'handling': 'kept — one headword may legitimately carry two senses; ids are never merged automatically'}
        for word, ids in sorted(seen_words.items()) if len(ids) > 1
    ]

    empty_meaning, empty_pos, no_sources = [], [], []
    multi_sense, gloss_leak = [], []
    for row in active:
        meaning = str(row.get('meaning') or '').strip()
        pos = str(row.get('pos') or '').strip()
        word = str(row.get('word') or '').strip()
        if not meaning:
            empty_meaning.append(str(row.get('id')))
        if not pos:
            empty_pos.append(str(row.get('id')))
        if not (row.get('sources') or []):
            no_sources.append(str(row.get('id')))
        if re.search(r';|/', meaning):
            multi_sense.append({'id': str(row.get('id')), 'word': word, 'meaning': meaning[:120]})
        if word and meaning and normalized(word) and normalized(word) in normalized(meaning):
            gloss_leak.append({'id': str(row.get('id')), 'word': word, 'meaning': meaning[:120]})

    # ---- phrase value is independent of constituent CEFR ------------------
    word_levels = {}
    for row in headwords:
        word_levels.setdefault(str(row.get('word') or '').lower(), level_of(row))
    phrase_levels = collections.Counter()
    phrase_low_word_high_phrase = []
    for phrase in phrases:
        level = tag_value(phrase, 'level')
        level = level.upper() if level and level.upper() in CEFR_LEVELS else UNCLASSIFIED
        phrase_levels[level] += 1
        words = re.findall(r"[a-z][a-z'-]*", str(phrase.get('phrase') or '').lower())
        levels = [word_levels[word] for word in words if word in word_levels and word_levels[word] != UNCLASSIFIED]
        if levels and level != UNCLASSIFIED and level in {'B2', 'C1', 'C2'} and all(item in {'A1', 'A2', 'B1'} for item in levels):
            phrase_low_word_high_phrase.append({
                'id': phrase.get('id'), 'phrase': phrase.get('phrase'), 'phraseLevel': level,
                'constituentLevels': sorted(set(levels)),
                'handling': 'kept at its own level — the phrase is never judged by its cheapest word'
            })

    # ---- exam usefulness mix ---------------------------------------------
    def type_mix(items):
        counts = collections.Counter(tag_value(row, 'type') or 'none' for row in items)
        return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))

    usefulness = {
        'activeByLevel': level_counts(active),
        'activeByType': type_mix(active),
        'advancedShare': None,
        'academicActive': len([row for row in active if tag_value(row, 'type') == 'academic']),
        'wordFormationActive': len([row for row in active if tag_value(row, 'type') == 'word-formation']),
        'confusableActive': len([row for row in active if tag_value(row, 'type') == 'confusable']),
        'linkerActive': len([row for row in active if tag_value(row, 'type') == 'linker']),
        'phrasalVerbs': len([phrase for phrase in phrases if phrase.get('type') == 'phrasal-verb']),
        'idioms': len([phrase for phrase in phrases if phrase.get('type') == 'idiom']),
        'collocations': len([phrase for phrase in phrases if phrase.get('type') == 'collocation']),
        'dependentPrepositions': len([phrase for phrase in phrases if phrase.get('type') == 'dependent-preposition']),
        'linkerPhrases': len([phrase for phrase in phrases if phrase.get('type') == 'linker-phrase']),
        'sentencePatterns': len([phrase for phrase in phrases if phrase.get('type') == 'pattern'])
    }
    advanced = usefulness['activeByLevel']['B2'] + usefulness['activeByLevel']['C1'] + usefulness['activeByLevel']['C2']
    usefulness['advancedShare'] = round(advanced / max(1, len(active)) * 1000) / 10

    report = {
        'schemaVersion': 1,
        'generatedBy': 'scripts/vocabulary_cefr_review.py',
        'policy': {
            'deletion': 'none — this audit never removes, relabels or merges a row',
            'cefr': 'a level is read from the stored `level:` tag only; no level is inferred, invented or inflated',
            'senseLevel': 'a row is one headword with one stored gloss; where the gloss lists several senses the row is reported for review, never split or deleted',
            'phrases': 'a phrase is kept at its own stored level and is never judged by the level of its cheapest constituent word'
        },
        'totals': {
            'rows': len(rows),
            'headwords': len(headwords),
            'mergedFamilyForms': len(merged),
            'activeHeadwords': len(active),
            'archivedHeadwords': len(archived),
            'phrases': len(phrases)
        },
        'before': {
            'activeByLevel': level_counts(active),
            'allByLevel': level_counts(rows),
            'phraseByLevel': {level: phrase_levels.get(level, 0) for level in CEFR_LEVELS + [UNCLASSIFIED]}
        },
        'after': {
            'note': 'unchanged by design: the CEFR study filter is a view, not a migration',
            'activeByLevel': level_counts(active),
            'allByLevel': level_counts(rows),
            'phraseByLevel': {level: phrase_levels.get(level, 0) for level in CEFR_LEVELS + [UNCLASSIFIED]}
        },
        'cefrEvidence': evidence_summary,
        'quality': {
            'duplicateNormalizedHeadwords': duplicates,
            'missingMeaning': empty_meaning,
            'missingPos': empty_pos,
            'missingSources': no_sources,
            'multiSenseGlosses': multi_sense,
            'glossContainsHeadword': gloss_leak,
            'highLevelPhrasesWithOnlyLowLevelConstituents': phrase_low_word_high_phrase
        },
        'usefulness': usefulness,
        'limits': [
            '0/106 papers are checked against an official primary source, so "exam-attested" means "appears in the reposted transcription", not official inclusion.',
            'Every CEFR label is editorial (level-source:editorial). No dictionary or CEFR reference page was fetched offline; the audit therefore cannot promote any label to Verified or Source-supported.',
            'Rows without a level tag stay Unknown/Unclassified; assigning them a level would be an invention.'
        ]
    }

    md = [
        '# Vocabulary CEFR review and quality audit',
        '',
        'Generated by `scripts/vocabulary_cefr_review.py` (`--check` verifies the file is current).',
        '',
        '**Policy:** this audit removes nothing. CEFR is a study filter, not a deletion rule.',
        '',
        '## Inventory',
        '',
        '| Metric | Count |',
        '| --- | ---: |',
        *[f'| {key} | {value} |' for key, value in report['totals'].items()],
        '',
        '## CEFR distribution (unchanged before/after)',
        '',
        '| Scope | A1 | A2 | B1 | B2 | C1 | C2 | Unclassified |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        '| Active headwords | ' + ' | '.join(str(report['before']['activeByLevel'][level]) for level in CEFR_LEVELS + [UNCLASSIFIED]) + ' |',
        '| All rows | ' + ' | '.join(str(report['before']['allByLevel'][level]) for level in CEFR_LEVELS + [UNCLASSIFIED]) + ' |',
        '| Phrases | ' + ' | '.join(str(report['before']['phraseByLevel'][level]) for level in CEFR_LEVELS + [UNCLASSIFIED]) + ' |',
        '',
        '## How far a label can be trusted',
        '',
        '| Evidence class | Rows |',
        '| --- | ---: |',
        f"| Verified (official CEFR reference) | {evidence_summary['Verified']} |",
        f"| Source-supported (dictionary level retrieved) | {evidence_summary['Source-supported']} |",
        f"| Inferred (editorial judgement) | {evidence_summary['Inferred']} |",
        f"| Unknown (no level tag) | {evidence_summary['Unknown']} |",
        '',
        f"Label sources: {json.dumps(evidence_summary['labelSources'], ensure_ascii=False)}",
        '',
        'No inferred label is promoted in this PR, and no label is changed to make the distribution look better.',
        '',
        '## Quality findings (reported, not deleted)',
        '',
        f"- Duplicate normalized headwords: **{len(duplicates)}** — kept, because two senses of one spelling are legitimate and IDs key learner progress.",
        f"- Rows with a multi-sense gloss (`;` or `/`): **{len(multi_sense)}** — a compression risk for flashcard grading; reported, not split.",
        f"- Glosses that contain the headword itself: **{len(gloss_leak)}** — the app masks the answer in the prompt instead of deleting the row.",
        f"- Rows missing a meaning: **{len(empty_meaning)}**; missing a part of speech: **{len(empty_pos)}**; missing a source: **{len(no_sources)}**.",
        f"- High-level phrases whose recorded constituent words are all B1 or lower: **{len(phrase_low_word_high_phrase)}** — kept at the phrase's own level, which is the documented rule.",
        '',
        '## Usefulness for Chuyên Anh',
        '',
        f"- Advanced (B2–C2) share of active headwords: **{usefulness['advancedShare']}%**.",
        f"- Academic type: {usefulness['academicActive']} · word formation: {usefulness['wordFormationActive']} · confusables: {usefulness['confusableActive']} · linkers: {usefulness['linkerActive']}.",
        f"- Phrase bank: {usefulness['phrasalVerbs']} phrasal verbs · {usefulness['idioms']} idioms · {usefulness['collocations']} collocations · {usefulness['dependentPrepositions']} dependent prepositions · {usefulness['linkerPhrases']} linker phrases · {usefulness['sentencePatterns']} patterns.",
        '',
        '## Limits',
        '',
        *[f'- {limit}' for limit in report['limits']],
        ''
    ]

    outputs = [(OUT_JSON, json.dumps(report, ensure_ascii=False, indent=2) + '\n'), (OUT_MD, '\n'.join(md))]
    stale = False
    for path, content in outputs:
        if args.check:
            if not path.exists() or path.read_text(encoding='utf-8') != content:
                print(f'Stale: {path.relative_to(ROOT)}')
                stale = True
        else:
            path.write_text(content, encoding='utf-8')
    if args.check and stale:
        raise SystemExit(1)
    print(f"{'Checked' if args.check else 'Wrote'} vocabulary CEFR review: {len(rows)} rows, "
          f"{len(active)} active headwords ({usefulness['advancedShare']}% B2+), "
          f"evidence inferred={evidence_summary['Inferred']} unknown={evidence_summary['Unknown']}.")


if __name__ == '__main__':
    main()
