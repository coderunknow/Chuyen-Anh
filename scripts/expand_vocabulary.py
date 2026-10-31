#!/usr/bin/env python3
"""Materialise the vocabulary Markdown table from the legacy rows and the seeds.

The Markdown table stays the canonical source for `data/vocabulary.json`. This
script is the only writer of that table: it keeps IDs 1–913 exactly as they are
(adding the `SOURCES` cell), then appends every accepted seed row from
`data/vocab-seed/*.tsv` in file and line order with sequential IDs.

Duplicate rules are enforced here, not by hand:

* a candidate whose runtime word key already exists is skipped;
* a candidate that is only an inflection of an existing headword is skipped;
* a candidate that is only an -ise/-ize, -our/-or, -re/-er or -lled/-led
  spelling variant of an existing headword is skipped;
* a candidate that is a word-family form already taught under a legacy headword
  (`wordFamily` prose and `docs/vocabulary-300-families.json`) is skipped, so a
  derived form is never counted twice as a headword of its own.

The table also carries the **root rule**: one headword per word root. A row whose
word shares another headword's root is kept in the table as an audit record but
tagged `family:merged` + `family-head:<id>`, and its form is listed in the
headword's `WORD_FAMILY` note. `docs/vocabulary-families.json` is the reviewed
source of that rule; `scripts/vocabulary_families.py` applies and validates it.
Only active rows (every row without `family:merged`) are headwords, so every
count in the app and the docs is a count of roots.

Every skip is reported by `--report` and by `scripts/audit_vocabulary.py`, so
the number of dropped candidates is auditable instead of silent.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from learned_vocabulary import display_table, parse_table  # noqa: E402
from vocabulary_families import (  # noqa: E402
    NOTE_PREFIX,
    apply_families,
    is_merged,
    validate as validate_families,
)
from vocabulary_curation import (  # noqa: E402
    apply_curation,
    is_archived,
    load_spec as load_curation_spec,
    validate as validate_curation,
)
from vocab_sources import (  # noqa: E402
    build_exam_index,
    dedupe_sources,
    dictionary_source,
    exam_locator,
    exam_source,
    load_registry,
    origin_source,
    validate_sources,
    word_key,
)

DEFAULT_MARKDOWN = ROOT / "Learned_Vocabulary_List.md"
SEED_DIR = ROOT / "data" / "vocab-seed"
LEGACY_COUNT = 913
SEED_HEADER = ("word", "pos", "meaning", "level", "topic", "type", "skills")
LEVELS = {"B1", "B2", "C1", "C2"}
TYPES = {"academic", "word-formation", "confusable", "topic", "core", "linker"}
SKILLS = {"reading", "word-formation", "cloze", "sentence-transformation", "writing", "grammar"}
TOPIC_RE = re.compile(r"^[a-z][a-z-]{2,24}$")
NOTE_CITATION_RE = re.compile(
    r"\[(?P<locator>[^\]\s]+\.md:\d+)\]\((?P<url>https://github\.com/[^)\s]+)\)"
)

# Inflectional (not derivational) endings. -er/-est are comparative only when the
# base headword is an adjective; "teacher" from "teach" or "manager" from
# "manage" is a separate lexical unit and is kept.
PLURAL_SUFFIXES = ("s", "es", "ies")
VERB_SUFFIXES = ("ed", "ing", "ying", "ied")
COMPARATIVE_SUFFIXES = ("er", "est", "ier", "iest")


def token_key(value: str) -> str:
    return word_key(value)


def spelling_variants(word: str) -> set[str]:
    """Equivalent British/American spellings, generated in both directions.

    Only forms that actually exist in the table are used to drop a candidate, so
    an unrelated word cannot be lost to an over-broad rewrite.
    """
    variants: set[str] = set()
    for old, new in (("ise", "ize"), ("isation", "ization"), ("yse", "yze"), ("our", "or"),
                     ("re", "er"), ("lled", "led"), ("lling", "ling"), ("ae", "e"), ("oe", "e")):
        if word.endswith(old):
            variants.add(word[: -len(old)] + new)
        if word.endswith(new):
            variants.add(word[: -len(new)] + old)
    if "-" in word:
        variants.add(word.replace("-", " "))
    if " " in word:
        variants.add(word.replace(" ", "-"))
    return variants


def inflection_bases(word: str, suffixes: tuple[str, ...]) -> set[str]:
    bases: set[str] = set()
    for suffix in suffixes:
        if len(word) > len(suffix) + 2 and word.endswith(suffix):
            stem = word[: -len(suffix)]
            bases.add(stem)
            bases.add(stem + "e")
            if suffix in {"ies", "ying", "ied", "ier", "iest"}:
                bases.add(stem + "y")
            if suffix in {"ing", "ed", "er", "est"} and len(stem) > 3 and stem[-1] == stem[-2]:
                bases.add(stem[:-1])
            if suffix in {"ing", "er", "est"}:
                bases.add(stem[:-1] if stem.endswith("y") else stem)
    return bases


FAMILY_SPEC_PATH = ROOT / "docs" / "vocabulary-300-families.json"
FAMILY_TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z'-]*")


def family_forms(legacy: list[dict[str, Any]]) -> dict[str, str]:
    """Normalised word-family forms already taught, mapped to their headword.

    The machine list is authoritative for IDs 614-913; the `wordFamily` prose is
    parsed for the earlier rows, where the family is written as free text such as
    `scarcity (n), scarcely (adv)`. A form equal to its own headword is dropped.
    """
    forms: dict[str, str] = {}
    if FAMILY_SPEC_PATH.exists():
        spec = json.loads(FAMILY_SPEC_PATH.read_text(encoding="utf-8"))
        for entry in spec.get("entries", []):
            head = word_key(entry["word"])
            for form in entry.get("forms", []):
                key = word_key(form)
                if key and key != head:
                    forms.setdefault(key, entry["word"])
    for record in legacy:
        head = word_key(record["word"])
        # The curated "Cùng gốc:" note is this script's own output: parsing it
        # back would reject the merged rows on the next run and make the build
        # non-idempotent. Only the hand-written prose before it is evidence.
        prose = (record.get("wordFamily") or "").split(NOTE_PREFIX, 1)[0]
        for token in FAMILY_TOKEN_RE.findall(prose):
            key = word_key(token)
            if len(key) > 2 and key != head:
                forms.setdefault(key, record["word"])
    return forms


def conflict(word: str, known: dict[str, tuple[str, str]], family: dict[str, str] | None = None) -> str | None:
    key = word_key(word)
    if family and key in family:
        return f"word-family form of {family[key]}"
    if key in known:
        return f"duplicate of {known[key][0]}"
    for suffixes in (PLURAL_SUFFIXES, VERB_SUFFIXES):
        for base in sorted(inflection_bases(key, suffixes)):
            if base in known:
                return f"inflection of {known[base][0]}"
    for base in sorted(inflection_bases(key, COMPARATIVE_SUFFIXES)):
        if base in known and "adj" in known[base][1].split("/"):
            return f"comparative of {known[base][0]}"
    for variant in sorted(spelling_variants(key)):
        if variant in known:
            return f"spelling variant of {known[variant][0]}"
    return None


def read_seeds(directory: Path = SEED_DIR) -> list[dict[str, Any]]:
    seeds: list[dict[str, Any]] = []
    for path in sorted(directory.glob("*.tsv")):
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            cells = line.split("\t")
            if len(cells) != len(SEED_HEADER):
                raise ValueError(f"{path.name}:{number}: expected {len(SEED_HEADER)} cells, found {len(cells)}")
            row = dict(zip(SEED_HEADER, (cell.strip() for cell in cells)))
            missing = [field for field in SEED_HEADER if not row[field]]
            if missing:
                raise ValueError(f"{path.name}:{number}: empty field(s) {missing}")
            if row["level"] not in LEVELS:
                raise ValueError(f"{path.name}:{number}: level {row['level']!r} is not one of {sorted(LEVELS)}")
            if row["type"] not in TYPES:
                raise ValueError(f"{path.name}:{number}: type {row['type']!r} is not one of {sorted(TYPES)}")
            if not TOPIC_RE.match(row["topic"]):
                raise ValueError(f"{path.name}:{number}: topic {row['topic']!r} must be a lowercase slug")
            skills = [skill.strip() for skill in row["skills"].split(",") if skill.strip()]
            if not skills or any(skill not in SKILLS for skill in skills):
                raise ValueError(f"{path.name}:{number}: skills {row['skills']!r} must be a subset of {sorted(SKILLS)}")
            if len(row["word"].split()) != 1:
                raise ValueError(f"{path.name}:{number}: {row['word']!r} is multi-word; phrase data belongs in Learned_Phrase_List.md")
            seeds.append({**row, "skills": skills, "file": path.name, "line": number})
    return seeds


def seed_tags(seed: dict[str, Any], evidence: str) -> list[str]:
    tags = [
        f"level:{seed['level']}",
        "level-source:editorial",
        f"topic:{seed['topic']}",
        f"type:{seed['type']}",
        f"source:{evidence}",
    ]
    tags.extend(f"skill:{skill}" for skill in seed["skills"])
    return tags


def legacy_sources(record: dict[str, Any], index: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    """Provenance for a pre-beta7 row: origin, dictionary, and exam evidence."""
    sources: list[dict[str, str]] = []
    entry_id = int(record["id"])
    if entry_id <= 613:
        sources.append(origin_source(
            "headword, Vietnamese gloss and part of speech recorded in this repository before beta7"
        ))
    else:
        # IDs 614–913 were added with a citation in NOTES; keep it when the cited
        # line still shows the form, otherwise fall back to the corpus index.
        for match in NOTE_CITATION_RE.finditer(record["notes"]):
            locator = match.group("locator")
            relative, _, line_text = locator.rpartition(":L") if ":L" in locator else locator.rpartition(":")
            path = ROOT / "De-chuyen-Anh-vao-10" / relative
            if not path.exists():
                continue
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
            try:
                cited = lines[int(line_text) - 1]
            except (IndexError, ValueError):
                continue
            observed = next((token for token in re.findall(r"[A-Za-z][A-Za-z'-]*", cited)
                             if token.lower().startswith(record["word"].lower())), None)
            if observed:
                obs_hit = exam_locator(index, observed)
                obs_docs = obs_hit["documents"] if obs_hit else 1
                sources.append(exam_source(f"{relative}:L{line_text}", obs_docs, observed))
    if len(record["word"].split()) == 1:
        sources.append(dictionary_source(record["word"]))
    hit = exam_locator(index, record["word"])
    if hit:
        sources.append(exam_source(hit["locator"], hit["documents"], words=hit["words"], shown=hit["shown"]))
    return dedupe_sources(sources)


def build_table(records: list[dict[str, Any]], index: dict[str, dict[str, Any]],
                curation: dict[str, Any] | None = None,
                seed_origin: dict[str, str] | None = None) -> tuple[list[dict[str, Any]], list[dict[str, str]], list[str]]:
    """Return (rows, skipped seeds, problems).

    `curation` is the reviewed `docs/vocabulary-curation.json` map and
    `seed_origin` maps a normalised seed word to its seed file, so the map's
    topic blocks can be applied without re-reading the seeds here.
    """
    problems: list[str] = []
    legacy = records[:LEGACY_COUNT]
    if len(records) < LEGACY_COUNT:
        raise ValueError(f"expected at least {LEGACY_COUNT} legacy records, found {len(records)}")
    known: dict[str, tuple[str, str]] = {}
    rows: list[dict[str, Any]] = []
    for record in legacy:
        row = dict(record)
        row["sources"] = legacy_sources(record, index)
        rows.append(row)
        known.setdefault(token_key(record["word"]), (record["id"], record["pos"]))

    family = family_forms(legacy)
    skipped: list[dict[str, str]] = []
    for seed in read_seeds():
        reason = conflict(seed["word"], known, family)
        if reason:
            skipped.append({"word": seed["word"], "reason": reason, "file": seed["file"], "line": str(seed["line"])})
            continue
        evidence = "exam"
        sources = [dictionary_source(seed["word"])]
        hit = exam_locator(index, seed["word"])
        if hit:
            sources.append(exam_source(hit["locator"], hit["documents"], words=hit["words"], shown=hit["shown"]))
        else:
            evidence = "dictionary"
        row = {
            "id": str(len(rows) + 1),
            "word": seed["word"],
            "pos": seed["pos"],
            "meaning": seed["meaning"],
            "wordFamily": "",
            "synonyms": [],
            "antonyms": [],
            "collocations": [],
            "register": "",
            "connotation": "",
            "notes": "",
            "tags": seed_tags(seed, evidence),
            "sources": dedupe_sources(sources),
        }
        rows.append(row)
        known[token_key(seed["word"])] = (row["id"], row["pos"])

    # One headword per root: mark merged rows and write the headword's family note.
    apply_families(rows)
    problems.extend(validate_families(rows))

    # Curation runs after the root rule: only active headwords can be archived,
    # and a merged form always follows its headword.
    if curation is not None:
        origins = seed_origin
        if origins is None:
            origins = {}
            for seed in read_seeds():
                origins.setdefault(token_key(seed["word"]), seed["file"])
        apply_curation(rows, curation, origins)
        problems.extend(validate_curation(rows, curation))

    registry = load_registry()
    for row in rows:
        for message in validate_sources(row["sources"], registry):
            problems.append(f"row {row['id']} ({row['word']}): {message}")
        if row["sources"] and all(source["ref"] == "cambridge" for source in row["sources"]):
            # A dictionary locator alone is acceptable, but it is weaker evidence
            # than a transcribed occurrence; the audit reports the split.
            pass
    return rows, skipped, problems


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the Markdown table is not current")
    parser.add_argument("--markdown", type=Path, default=DEFAULT_MARKDOWN)
    parser.add_argument("--report", type=Path, help="write a JSON report of accepted/skipped seed rows")
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        records = parse_table(args.markdown)
        index = build_exam_index()
        rows, skipped, problems = build_table(records, index, load_curation_spec())
        if problems:
            raise ValueError("source problems:\n" + "\n".join(problems[:40]))
        rendered = display_table(rows)
    except (OSError, ValueError, KeyError) as error:
        print(f"Vocabulary table build failed: {error}", file=sys.stderr)
        return 1

    active_rows = [row for row in rows if not is_merged(row["tags"])]

    if args.report:
        by_level: dict[str, int] = {}
        by_type: dict[str, int] = {}
        by_topic: dict[str, int] = {}
        evidence = {"exam": 0, "dictionary": 0}
        for row in rows[LEGACY_COUNT:]:
            tags = row["tags"]
            level = next(tag.split(":", 1)[1] for tag in tags if tag.startswith("level:"))
            by_level[level] = by_level.get(level, 0) + 1
            kind = next(tag.split(":", 1)[1] for tag in tags if tag.startswith("type:"))
            by_type[kind] = by_type.get(kind, 0) + 1
            topic = next(tag.split(":", 1)[1] for tag in tags if tag.startswith("topic:"))
            by_topic[topic] = by_topic.get(topic, 0) + 1
            kind_source = next(tag.split(":", 1)[1] for tag in tags if tag.startswith("source:"))
            evidence[kind_source] = evidence.get(kind_source, 0) + 1
        args.report.parent.mkdir(parents=True, exist_ok=True)
        archived_rows = [row for row in rows if is_archived(row.get("tags"))]
        args.report.write_text(json.dumps({
            "generatedBy": "scripts/expand_vocabulary.py",
            "legacyRows": LEGACY_COUNT,
            "activeRows": len(active_rows),
            "rowsInTable": len(rows),
            "mergedRows": len(rows) - len(active_rows),
            "newRows": len(rows) - LEGACY_COUNT,
            "seedsRead": len(rows) - LEGACY_COUNT + len(skipped),
            "skippedSeeds": skipped,
            "newByLevel": dict(sorted(by_level.items())),
            "newByType": dict(sorted(by_type.items())),
            "newByTopic": dict(sorted(by_topic.items())),
            "newByEvidence": dict(sorted(evidence.items())),
            "archivedRows": len(archived_rows),
            "retainedHeadwords": len([row for row in active_rows if not is_archived(row.get("tags"))]),
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.check:
        current = args.markdown.read_text(encoding="utf-8")
        if current != rendered:
            print("Learned_Vocabulary_List.md is out of sync; run python scripts/expand_vocabulary.py", file=sys.stderr)
            return 1
        print(f"Vocabulary table matches {len(rows)} rows ({LEGACY_COUNT} legacy + {len(rows) - LEGACY_COUNT} seed); "
              f"{len(active_rows)} active headwords, {len(rows) - len(active_rows)} merged family forms.")
        return 0

    args.markdown.write_text(rendered, encoding="utf-8")
    print(f"Wrote {len(rows)} rows to {args.markdown.relative_to(ROOT)} ({LEGACY_COUNT} legacy + {len(rows) - LEGACY_COUNT} seed, "
          f"{len(skipped)} seed(s) skipped, {len(rows) - len(active_rows)} merged family form(s), {len(active_rows)} headwords).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
