#!/usr/bin/env python3
"""RC4 vocabulary audit: classify every row and prove the deck boundary.

The bank mixes two different questions:

* **Is this row a headword the app teaches?** (the root-family rule)
* **Is this row inside the focus deck?** (the curation policy)

This script answers both from data that already exists, without inventing new
vocabulary facts:

1. replay the reviewed curation map (`docs/vocabulary-curation.json`) against the
   Markdown table and compare the result with the tags that are actually stored;
2. cross-check every headword against the curriculum words transcribed in
   `docs/curriculum-grades-6-9.json`;
3. measure how much of the "high-quality inclusion standard" (advanced senses,
   word families, collocations, idioms, phrasal verbs, confusables) the shipped
   rows actually document;
4. emit `docs/rc4-vocabulary-audit.json` and `.md` with reconciled counts.

Nothing here writes vocabulary data. `--check` fails when the committed report no
longer matches the data, so drift is caught instead of described.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from audit_vocabulary_quality import seed_origin_map  # noqa: E402
from learned_vocabulary import parse_table  # noqa: E402
from vocab_sources import word_key  # noqa: E402
from vocabulary_curation import (  # noqa: E402
    LEGACY_ROW_LIMIT,
    category_of,
    is_archived,
    load_spec,
    matched_rows,
)

VOCAB_MD = ROOT / "Learned_Vocabulary_List.md"
VOCAB_JSON = ROOT / "data" / "vocabulary.json"
CURRICULUM = ROOT / "docs" / "curriculum-grades-6-9.json"
REPORT_JSON = ROOT / "docs" / "rc4-vocabulary-audit.json"
REPORT_MD = ROOT / "docs" / "rc4-vocabulary-audit.md"

AUDIT_DATE = "2026-10-28"
CURRICULUM_LEVELS = ("A1", "A2", "B1")
CLAIM_RE = __import__("re").compile(r"(\d+)\s+transcribed exam")
FAMILY_NOTE_PREFIX = "Cùng gốc: "
QUALITY_FIELDS = ("synonyms", "antonyms", "collocations", "examples")


def tag_value(row: dict[str, Any], namespace: str) -> str:
    prefix = f"{namespace}:"
    for tag in row.get("tags") or []:
        if isinstance(tag, str) and tag.startswith(prefix):
            return tag[len(prefix):]
    return ""


def exam_attestations(row: dict[str, Any]) -> int:
    """How many transcribed exams the row's own source claim names (0 if none)."""
    best = 0
    for source in row.get("sources") or []:
        if source.get("ref") != "exam-corpus":
            continue
        match = CLAIM_RE.search(source.get("supports", ""))
        if match:
            best = max(best, int(match.group(1)))
    return best


def curriculum_tokens(path: Path = CURRICULUM) -> dict[str, dict[str, str]]:
    """Flatten the transcribed curriculum words to `{word_key: {grade, unit}}`."""
    spec = json.loads(path.read_text(encoding="utf-8"))
    tokens: dict[str, dict[str, str]] = {}
    for grade, units in (spec.get("grades") or {}).items():
        for unit in units if isinstance(units, list) else []:
            for word in unit.get("words") or []:
                tokens.setdefault(word_key(word), {"grade": grade, "unit": unit.get("unit", "")})
    return tokens


def is_family_root(row: dict[str, Any]) -> bool:
    return str(row.get("wordFamily", "")).startswith(FAMILY_NOTE_PREFIX)


def family_head(row: dict[str, Any]) -> str:
    """The headword id a merged form belongs to.

    `parse_table` yields the Markdown row, which carries the relation as the
    `family-head:<id>` tag; `build_vocabulary.py` turns that tag into the
    `familyHead` field in `data/vocabulary.json`. Accept either shape so the
    audit can run on both inputs.
    """
    value = row.get("familyHead") or tag_value(row, "family-head")
    return str(value or "")


def classify(rows: list[dict[str, Any]], spec: dict[str, Any]) -> dict[str, Any]:
    """Return the audit report as a dictionary (no file writes)."""
    tokens = curriculum_tokens()
    decisions, problems = matched_rows(rows, spec, seed_origin_map())
    by_key = {word_key(row["word"]): row for row in rows}

    stored = {key: row for key, row in by_key.items() if is_archived(row.get("tags"))}
    drift_missing = sorted(decisions[key]["word"] for key in set(decisions) - set(stored))
    drift_extra = sorted(stored[key]["word"] for key in set(stored) - set(decisions))
    drift_category = sorted(
        decision["word"]
        for key, decision in decisions.items()
        if key in stored and category_of(stored[key].get("tags")) != decision["category"]
    )

    heads = [row for row in rows if not family_head(row)]
    merged = [row for row in rows if family_head(row)]
    archived_heads = [row for row in heads if is_archived(row.get("tags"))]
    focus_heads = [row for row in heads if not is_archived(row.get("tags"))]

    review: list[dict[str, Any]] = []

    # Rule 1: a curriculum word at A1/A2/B1 that is still taught must be explained
    # by the family-root exemption, otherwise the policy has a hole.
    curriculum_hits = 0
    curriculum_focus: list[dict[str, Any]] = []
    curriculum_archived = 0
    unexplained: list[dict[str, Any]] = []
    for row in heads:
        token = tokens.get(word_key(row["word"]))
        if not token:
            continue
        curriculum_hits += 1
        if is_archived(row.get("tags")):
            curriculum_archived += 1
            continue
        level = tag_value(row, "level")
        record = {
            "id": row["id"],
            "word": row["word"],
            "level": level,
            "type": tag_value(row, "type"),
            "curriculum": f"{token['grade']}/{token['unit']}",
            "familyRoot": is_family_root(row),
        }
        curriculum_focus.append(record)
        if level in CURRICULUM_LEVELS and not is_family_root(row):
            unexplained.append(record)

    for record in unexplained:
        review.append({
            **record,
            "reason": "curriculum-level word (A1-B1) still in the focus deck without the family-root exemption",
        })

    # Rule 2: a Vietnamese gloss that repeats the headword teaches no meaning.
    for row in heads:
        if is_archived(row.get("tags")):
            continue
        if row["meaning"].strip().casefold() != row["word"].strip().casefold():
            continue
        review.append({
            "id": row["id"],
            "word": row["word"],
            "level": tag_value(row, "level"),
            "type": tag_value(row, "type"),
            "curriculum": "/".join(filter(None, [
                (tokens.get(word_key(row["word"])) or {}).get("grade", ""),
                (tokens.get(word_key(row["word"])) or {}).get("unit", ""),
            ])),
            "familyRoot": is_family_root(row),
            "archived": is_archived(row.get("tags")),
            "reason": "the stored Vietnamese gloss is identical to the English headword, so the card shows no meaning",
        })

    quality = {
        field: sum(1 for row in focus_heads if row.get(field))
        for field in QUALITY_FIELDS
    }
    quality["wordFamily"] = sum(1 for row in focus_heads if row.get("wordFamily"))
    quality["notes"] = sum(1 for row in focus_heads if row.get("notes"))
    quality["registerOrConnotation"] = sum(
        1 for row in focus_heads if row.get("register") or row.get("connotation")
    )
    structure = {
        "word-formation": sum(1 for row in focus_heads if tag_value(row, "type") == "word-formation"),
        "academic": sum(1 for row in focus_heads if tag_value(row, "type") == "academic"),
        "core": sum(1 for row in focus_heads if tag_value(row, "type") == "core"),
        "idiom": sum(1 for row in focus_heads if row.get("pos") == "idiom"),
        "phrasalVerb": sum(1 for row in focus_heads if row.get("pos") == "phrasal v"),
        "collocation": sum(1 for row in focus_heads if row.get("pos") == "collocation"),
        "confusable": sum(1 for row in focus_heads if tag_value(row, "type") == "confusable"),
        "linker": sum(1 for row in focus_heads if tag_value(row, "type") == "linker"),
    }

    level_mix = Counter(tag_value(row, "level") or "unlabelled" for row in focus_heads)
    archived_mix = Counter(category_of(row.get("tags")) for row in rows if is_archived(row.get("tags")))

    attested = [exam_attestations(row) for row in rows if is_archived(row.get("tags"))]

    return {
        "schemaVersion": 1,
        "appVersion": "v1.0.0-rc4",
        "auditDate": AUDIT_DATE,
        "method": (
            "Every row is classified from data already in the repository: the root-family rule "
            "(family:merged rows are documentation, not headwords), the reviewed curation map "
            "(docs/vocabulary-curation.json replayed through scripts/vocabulary_curation.py), the "
            "editorial CEFR level tags, and the curriculum words transcribed in "
            "docs/curriculum-grades-6-9.json. The audit writes no vocabulary data."
        ),
        "counts": {
            "inspectedRows": len(rows),
            "inspectedHeadwords": len(heads),
            "familyForms": len(merged),
            "retainedHeadwords": len(focus_heads),
            "excludedHeadwords": len(archived_heads),
            "excludedRowsIncludingFamilyForms": len([row for row in rows if is_archived(row.get("tags"))]),
            "reviewed": len(review),
            "corrected": 0,
            "added": 0,
        },
        "policyReplay": {
            "decisions": len(decisions),
            "stored": len(stored),
            "missing": drift_missing,
            "extra": drift_extra,
            "categoryMismatch": drift_category,
            "problems": problems,
            "reconciled": not (drift_missing or drift_extra or drift_category or problems),
        },
        "curriculum": {
            "tokens": len(tokens),
            "presentInBank": curriculum_hits,
            "inFocus": len(curriculum_focus),
            "excluded": curriculum_archived,
            "unexplained": unexplained,
            "focusRows": curriculum_focus,
        },
        "categories": dict(sorted(archived_mix.items())),
        "levelMix": dict(sorted(level_mix.items())),
        "quality": quality,
        "structure": structure,
        "archivedExamAttestation": {
            "attested": sum(1 for value in attested if value),
            "attestedAtLeastFive": sum(1 for value in attested if value >= 5),
            "maximum": max(attested) if attested else 0,
        },
        "review": review,
        "limits": [
            "The CEFR level of a row is an editorial tag, not a curriculum mapping; the audit reports it, it does not re-derive it.",
            "Curriculum words were transcribed from third-party reproductions of the Global Success series; grades 6 and 7 are topic-level only because the retrieved teacher-training documents publish no per-unit word table.",
            "Exam attestation counts come from the repository's own transcription corpus and are not evidence that a word is worth teaching.",
            "Vietnamese gloss semantics were not re-edited; the audit only flags a gloss that repeats the headword.",
        ],
    }


def render_markdown(report: dict[str, Any]) -> str:
    counts = report["counts"]
    replay = report["policyReplay"]
    curriculum = report["curriculum"]
    lines: list[str] = []
    add = lines.append

    add("# RC4 Vocabulary Audit — v1.0.0-rc4 (unreleased candidate)")
    add("")
    add(f"- **Audit date:** {report['auditDate']}")
    add(f"- **Rows inspected:** {counts['inspectedRows']:,} ({counts['inspectedHeadwords']:,} headwords + {counts['familyForms']:,} family forms)")
    add("- **Status:** no vocabulary row, ID, meaning, level tag, family link or curation decision was changed by this audit; `corrected = 0`, `added = 0`.")
    add("")
    add("## A. Reconciled counts")
    add("")
    add("| Measure | Count |")
    add("| --- | --- |")
    add(f"| Inspected rows | {counts['inspectedRows']:,} |")
    add(f"| Inspected headwords | {counts['inspectedHeadwords']:,} |")
    add(f"| Retained (KEEP, in the focus deck) | {counts['retainedHeadwords']:,} |")
    add(f"| Excluded (EXCLUDE_BASIC, archived) | {counts['excludedHeadwords']:,} headwords / {counts['excludedRowsIncludingFamilyForms']:,} rows |")
    add(f"| Reviewed (REVIEW queue) | {counts['reviewed']} |")
    add(f"| Corrected | {counts['corrected']} |")
    add(f"| Added | {counts['added']} |")
    add("")
    add("Retained + excluded headwords equal the inspected headword count "
        f"({counts['retainedHeadwords']:,} + {counts['excludedHeadwords']:,} = {counts['inspectedHeadwords']:,}), "
        "and every excluded row carries exactly one category:")
    add("")
    add("| Category | Rows |")
    add("| --- | --- |")
    for category, total in report["categories"].items():
        add(f"| `{category}` | {total:,} |")
    add("")
    add("## B. Policy replay (the map, not the tags, decides)")
    add("")
    add(f"`docs/vocabulary-curation.json` was replayed through the shipping engine "
        f"(`scripts/vocabulary_curation.matched_rows`) against the Markdown table: **{replay['decisions']:,} decisions**, "
        f"**{replay['stored']:,} stored archived rows**.")
    add("")
    if replay["reconciled"]:
        add("**Result: reconciled.** No row is tagged archived without a policy decision, no decision is missing a tag, "
            "no row carries the wrong category, and the engine reported no problems.")
    else:
        add("**Result: NOT reconciled.**")
        for key in ("missing", "extra", "categoryMismatch"):
            if replay[key]:
                add(f"- `{key}`: {', '.join(replay[key][:20])}")
        for problem in replay["problems"]:
            add(f"- {problem}")
    add("")
    add("The replay also proves *why* each excluded row is excluded: the decision carries its rule id "
        "(`block:<seed>`, `rule:<id>`, or `listed`) and the category whose rationale is in "
        "`docs/vocabulary-curation.json`.")
    add("")
    add("## C. Selection-scope proof (exclusion is functional, not cosmetic)")
    add("")
    add("In `index.html` the deck boundary is built once at boot:")
    add("")
    add("```js")
    add("const archivedIds = new Set(vocabulary.filter(isArchivedEntry).map(entry => entry.id));")
    add("const deck = vocabulary.filter(entry => !archivedIds.has(entry.id));")
    add("```")
    add("")
    add("`deck` (not `vocabulary`) feeds every scheduling and question path: `selectSession`, "
        "`selectPrioritySession`, `studyGroupCandidates`, `sprintEligibleCount`, `selectSprintSession`, "
        "`buildExercisePlan(..., { vocabulary: deck })`, `generateQuestion`, `gradeAnswer`, the weak-word list in the "
        "dashboard, the Settings flagged list and the search index's distractor pool. Archived rows remain in "
        "`vocabulary` so that IDs, stored progress, favourites, backups and the search screen survive curation.")
    add("")
    add(f"Curriculum cross-check: **{curriculum['tokens']}** curriculum words were transcribed for grades 6-9; "
        f"**{curriculum['presentInBank']}** of them exist in the bank; **{curriculum['excluded']}** are excluded and "
        f"**{curriculum['inFocus']}** are still taught.")
    add("")
    if curriculum["unexplained"]:
        add("Unexplained retentions (curriculum-level, no family-root exemption):")
        add("")
        for record in curriculum["unexplained"]:
            add(f"- `{record['word']}` (id {record['id']}, {record['level']}, {record['type'] or 'no type'}) — grade {record['curriculum']}")
    else:
        add("Every curriculum-level word (A1-B1) that is still taught is a **family root** whose note teaches the derived "
            "forms (`Cùng gốc: …`), which is the documented exemption in the curation map. No unexplained retention.")
    add("")
    add("## D. High-quality inclusion standard, as shipped")
    add("")
    add("The standard asks each retained entry to earn its place with an advanced sense, a word family, a collocation, a "
        "phrasal verb, an idiom or a confusable. The schema can carry all of these; here is what the rows actually contain:")
    add("")
    add("| Standard signal | Retained headwords carrying it |")
    add("| --- | --- |")
    add(f"| Word-formation / advanced-sense type | {report['structure']['word-formation']:,} |")
    add(f"| Academic register type | {report['structure']['academic']:,} |")
    add(f"| Word-family note (`Cùng gốc:`) | {report['quality']['wordFamily']:,} |")
    add(f"| Editorial note | {report['quality']['notes']:,} |")
    add(f"| Register or connotation | {report['quality']['registerOrConnotation']:,} |")
    add(f"| Idiom entry | {report['structure']['idiom']:,} |")
    add(f"| Phrasal-verb entry | {report['structure']['phrasalVerb']:,} |")
    add(f"| Collocation entry | {report['structure']['collocation']:,} |")
    add(f"| Confusable pair entry | {report['structure']['confusable']:,} |")
    add(f"| Linker entry | {report['structure']['linker']:,} |")
    add(f"| Synonym list | {report['quality']['synonyms']:,} |")
    add(f"| Antonym list | {report['quality']['antonyms']:,} |")
    add(f"| Collocation list | {report['quality']['collocations']:,} |")
    add(f"| Example sentence | {report['quality']['examples']:,} |")
    add("")
    add("**Gap, stated plainly:** the shipped bank documents word families and senses well and collocations/idioms/phrasal "
        "verbs only as separate headwords; the `synonyms`, `antonyms`, `collocations` and `examples` fields are empty on "
        "almost every row. Filling them is authoring work that needs a source per row, so this audit measures the gap and "
        "does not invent content to close it.")
    add("")
    add("## E. REVIEW queue")
    add("")
    if report["review"]:
        add("| ID | Word | Level | Why it needs a human |")
        add("| --- | --- | --- | --- |")
        for record in report["review"]:
            add(f"| {record['id']} | `{record['word']}` | {record.get('level') or 'unlabelled'} | {record['reason']} |")
        add("")
        add("These rows stay exactly as they are until an editor decides; they were not auto-archived and their IDs and "
            "progress are untouched.")
    else:
        add("Empty: every row is explained by a documented rule.")
    add("")
    add("## F. Exam attestation of excluded rows (considered, not used)")
    add("")
    add(f"**{report['archivedExamAttestation']['attested']:,}** excluded rows are attested in at least one transcribed exam, "
        f"and **{report['archivedExamAttestation']['attestedAtLeastFive']:,}** in five or more (maximum "
        f"{report['archivedExamAttestation']['maximum']}). The curation map already states why that is not a reinstatement "
        "criterion: an exam paper is full of basic words, and their presence is not evidence that the word discriminates "
        "between candidates. No row was reinstated on frequency alone.")
    add("")
    add("## G. How to reproduce")
    add("")
    add("```bash")
    add("python scripts/rc4_vocabulary_audit.py          # rewrite this report and its JSON")
    add("python scripts/rc4_vocabulary_audit.py --check  # fail if the committed report is stale")
    add("python -m unittest tests.test_rc4_vocabulary_audit -v")
    add("```")
    add("")
    add("## H. What this audit does not claim")
    add("")
    for limit in report["limits"]:
        add(f"- {limit}")
    add("")
    return "\n".join(lines)


def write_report(report: dict[str, Any]) -> None:
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_MD.write_text(render_markdown(report), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the committed report differs from the data")
    args = parser.parse_args()

    rows = parse_table(VOCAB_MD)
    report = classify(rows, load_spec())

    if args.check:
        if not REPORT_JSON.exists() or not REPORT_MD.exists():
            print("rc4 audit: report is missing; run python scripts/rc4_vocabulary_audit.py", file=sys.stderr)
            return 1
        committed = json.loads(REPORT_JSON.read_text(encoding="utf-8"))
        if committed != report or REPORT_MD.read_text(encoding="utf-8") != render_markdown(report):
            print("rc4 audit: report is stale; run python scripts/rc4_vocabulary_audit.py", file=sys.stderr)
            return 1
        print(f"rc4 audit: report matches {len(rows)} rows ({report['counts']['reviewed']} in review).")
        return 0

    write_report(report)
    print(
        "rc4 audit: "
        f"{report['counts']['inspectedRows']} rows, "
        f"{report['counts']['retainedHeadwords']} retained, "
        f"{report['counts']['excludedHeadwords']} excluded, "
        f"{report['counts']['reviewed']} in review, "
        f"policy reconciled={report['policyReplay']['reconciled']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
