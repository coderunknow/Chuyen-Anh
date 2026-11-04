#!/usr/bin/env python3
"""CEFR trust review and vocabulary quality audit (no deletion).

This audit never removes, relabels or merges a row. It answers two questions:

1. What do the legacy level tags and the generated sense evidence classes say?
   They are separate snapshots, and neither is independently verified here.
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

    # Describe stored claims, without treating them as independently verified.
    by_source = collections.Counter(level_source(row) or 'none' for row in rows)
    legacy_summary = {
        'totalRows': len(rows),
        'labelSources': dict(sorted(by_source.items())),
        'qualification': 'stored legacy tags only; their source claims were not independently validated by this report',
    }
    senses = [sense for row in rows for sense in row.get('senses', []) if isinstance(sense, dict)]
    sense_summary = {
        'totalSenses': len(senses),
        'byClass': dict(sorted(collections.Counter(sense.get('evidence', 'missing') for sense in senses).items())),
        'needsIndependentValidation': sum(sense.get('needsIndependentValidation') is True for sense in senses),
        'qualification': 'stored generator claims, not independently verified; an unset validation flag does not imply approval',
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
        'schemaVersion': 2,
        'generatedBy': 'scripts/vocabulary_cefr_review.py',
        'policy': {
            'deletion': 'none — this audit never removes, relabels or merges a row',
            'cefr': 'legacy distribution reads `level:` tags; sense evidence reports stored sense claims separately',
            'senseLevel': 'sense arrays may split a row; this report counts their stored evidence claims without validating the mappings',
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
        'currentLegacyTagDistribution': {
            'activeByLevel': level_counts(active),
            'allByLevel': level_counts(rows),
            'phraseByLevel': {level: phrase_levels.get(level, 0) for level in CEFR_LEVELS + [UNCLASSIFIED]}
        },
        'legacyTagEvidence': legacy_summary,
        'senseEvidence': sense_summary,
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
            'The legacy tags include editorial and named reference sources; this report does not independently validate either those claims or the separate sense-level evidence.',
            'Unknown legacy level tags do not imply unknown sense levels; the app can use stored sense classifications instead.',
            'The generator uses pinned reference snapshots; they and their locators require independent audit, including source scope and POS.'
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
        '## Current legacy-tag CEFR distribution (not a before/after comparison)',
        '',
        '| Scope | A1 | A2 | B1 | B2 | C1 | C2 | Unclassified |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        '| Active headwords | ' + ' | '.join(str(report['currentLegacyTagDistribution']['activeByLevel'][level]) for level in CEFR_LEVELS + [UNCLASSIFIED]) + ' |',
        '| All rows | ' + ' | '.join(str(report['currentLegacyTagDistribution']['allByLevel'][level]) for level in CEFR_LEVELS + [UNCLASSIFIED]) + ' |',
        '| Phrases | ' + ' | '.join(str(report['currentLegacyTagDistribution']['phraseByLevel'][level]) for level in CEFR_LEVELS + [UNCLASSIFIED]) + ' |',
        '',
        '## Stored provenance claims, not independently verified',
        '',
        f"Legacy tag sources: {json.dumps(legacy_summary['labelSources'], ensure_ascii=False)}",
        f"Sense evidence classes: {json.dumps(sense_summary['byClass'], ensure_ascii=False)}",
        f"Sense records flagged for independent validation: {sense_summary['needsIndependentValidation']} of {sense_summary['totalSenses']}.",
        sense_summary['qualification'],
        '',
        '## Quality findings (reported, not deleted)',
        '',
        f"- Duplicate normalized headwords: **{len(duplicates)}** — kept, because two senses of one spelling are legitimate and IDs key learner progress.",
        f"- Rows with a multi-sense gloss (`;` or `/`): **{len(multi_sense)}** — a possible compression risk; some entries also have sense arrays, whose mappings are not independently checked here.",
        f"- Glosses that contain the headword itself: **{len(gloss_leak)}** — the app masks the answer in the prompt instead of deleting the row.",
        f"- Rows missing a meaning: **{len(empty_meaning)}**; missing a part of speech: **{len(empty_pos)}**; missing a source: **{len(no_sources)}**.",
        f"- High-level phrases whose recorded constituent words are all B1 or lower: **{len(phrase_low_word_high_phrase)}** — kept at the phrase's own level, which is the documented rule.",
        '',
        '## Usefulness for Chuyên Anh',
        '',
        f"- Advanced (B2–C2) share of active headwords by legacy tag (not the sense-filtered deck): **{usefulness['advancedShare']}%**.",
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
          f"stored sense claims={sense_summary['totalSenses']}; independent validation is not established.")


if __name__ == '__main__':
    main()
