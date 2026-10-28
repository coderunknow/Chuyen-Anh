#!/usr/bin/env python3
"""Apply the reviewed vocabulary-curation map to the Markdown rows.

The vocabulary table keeps every row and every ID: IDs are learner progress
keys, and deleting a row would renumber the seed-produced IDs that come after
it (`expand_vocabulary.py` assigns them in file/line order), silently moving a
learner's progress onto a different word. Curation therefore travels as data:

* `docs/vocabulary-curation.json` holds the reviewed decision for every row
  that is **outside the learning deck** (tag `curation:archived`) plus the
  category that explains the decision (`curation-category:<id>`);
* this module applies those tags, validates them against the table, and is the
  only writer of the `curation:*` namespace;
* the app hides archived rows from every session, count and distractor pool
  while keeping them in the data, in search (marked) and in backups — so a
  stored progress record is never dropped or re-assigned.

The map is a policy, not a dictionary claim. Each archived row carries the
measured evidence (seed file, level tag, corpus attestations) in
`docs/vocabulary-quality-audit.json`; the reason is the category's rationale,
and the category is an editorial judgement about exam value, never a claim
that a word is "wrong" or absent from the exam transcriptions.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "docs" / "vocabulary-curation.json"
ARCHIVED_TAG = "curation:archived"
CATEGORY_PREFIX = "curation-category:"
CURATION_PREFIX = "curation:"
LEGACY_ROW_LIMIT = 913

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vocab_sources import word_key  # noqa: E402


def load_spec(path: Path = SPEC_PATH) -> dict[str, Any]:
    if not path.exists():
        return {"version": 1, "categories": {}, "blocks": [], "words": [], "rules": []}
    spec = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(spec, dict):
        raise ValueError(f"{path.name}: expected an object")
    notes = spec.get("reviewNotes", [])
    if not isinstance(notes, list) or any(not isinstance(item, dict) or not item.get("word") for item in notes):
        raise ValueError(f"{path.name}: 'reviewNotes' must be a list of objects with a 'word'")
    for field in ("categories", "blocks", "words", "rules"):
        if not isinstance(spec.get(field), list if field != "categories" else dict):
            raise ValueError(f"{path.name}: '{field}' must be a {'dict' if field == 'categories' else 'list'}")
    return spec


def strip_curation(rows: list[dict[str, Any]]) -> None:
    """Remove previously applied curation tags so the map can be re-applied.

    The Markdown table is an input on the next run; without this, a word removed
    from the map would keep its archived tag forever.
    """
    for row in rows:
        tags = row.get("tags")
        if isinstance(tags, list):
            row["tags"] = [tag for tag in tags if not (isinstance(tag, str) and tag.startswith(CURATION_PREFIX))]


def is_archived(tags: Any) -> bool:
    return isinstance(tags, list) and ARCHIVED_TAG in tags


def category_of(tags: Any) -> str:
    for tag in tags if isinstance(tags, list) else []:
        if isinstance(tag, str) and tag.startswith(CATEGORY_PREFIX):
            return tag[len(CATEGORY_PREFIX):]
    return ""


def tag_value(row: dict[str, Any], namespace: str) -> str:
    prefix = f"{namespace}:"
    for tag in row.get("tags") or []:
        if isinstance(tag, str) and tag.startswith(prefix):
            return tag[len(prefix):]
    return ""


def matched_rows(rows: list[dict[str, Any]], spec: dict[str, Any],
                 seed_origin: dict[str, str] | None = None) -> tuple[dict[str, dict[str, str]], list[str]]:
    """Resolve the map to `{row key: {category, reason}}` plus problem messages.

    Only active headwords (not `family:merged`) can be archived. A family head is
    never archived by a block or rule: its merged forms are documented as part of
    that headword, so hiding the head would orphan them. Legacy rows (IDs 1-913)
    are the maintainer's own list and are outside the block/rule scope.
    """
    problems: list[str] = []
    by_key: dict[str, dict[str, Any]] = {}
    for row in rows:
        by_key.setdefault(word_key(row["word"]), row)

    categories = spec.get("categories") or {}
    decisions: dict[str, dict[str, str]] = {}

    def assign(word: str, category: str, reason: str, kind: str = "listed") -> None:
        """Record one decision. Explicit blocks/lists outrank the generic rule.

        Legacy rows (IDs 1-913) are the maintainer's own list: a seed word that is
        also a legacy headword is never archived, and that is not an error.
        """
        key = word_key(word)
        row = by_key.get(key)
        if row is None:
            problems.append(f"curation: '{word}' is not a row in the table")
            return
        if "family:merged" in (row.get("tags") or []):
            problems.append(f"curation: '{word}' is a merged family form, not a headword")
            return
        if int(row["id"]) <= LEGACY_ROW_LIMIT:
            return
        if category not in categories:
            problems.append(f"curation: '{word}' uses undeclared category '{category}'")
            return
        existing = decisions.get(key)
        if existing:
            if existing["kind"] == "rule" and kind != "rule":
                pass  # an explicit decision replaces the rule's category
            elif kind == "rule":
                return  # the explicit decision already covers this row
            elif existing["category"] != category:
                problems.append(f"curation: '{word}' is claimed by both '{existing['category']}' and '{category}'")
                return
            else:
                return
        decisions[key] = {"category": category, "reason": reason, "word": row["word"],
                          "id": row["id"], "kind": kind}

    for block in spec.get("blocks") or []:
        seed = block["seed"]
        category = block["category"]
        if category not in categories:
            problems.append(f"curation block '{seed}': undeclared category '{category}'")
            continue
        if not seed_origin:
            problems.append(f"curation block '{seed}': no seed origin map supplied")
            continue
        exceptions = {word_key(word) for word in block.get("exceptions") or []}
        for key, origin in sorted(seed_origin.items(), key=lambda item: item[0]):
            if origin != seed:
                continue
            if key in exceptions:
                continue
            row = by_key.get(key)
            if row is None:
                continue
            if "family:merged" in (row.get("tags") or []):
                continue
            if row.get("wordFamily", "").startswith("Cùng gốc: "):
                # A headword that teaches its own family is never dropped by a
                # topic block: the family note would disappear with it.
                continue
            assign(row["word"], category, f"block:{seed}", "block")
        for exception in block.get("exceptions") or []:
            if by_key.get(word_key(exception)) is None:
                problems.append(f"curation block '{seed}': exception '{exception}' is not a row in the table")

    for entry in spec.get("words") or []:
        assign(entry["word"], entry["category"], "listed", "listed")

    for rule in spec.get("rules") or []:
        category = rule["category"]
        if category not in categories:
            problems.append(f"curation rule '{rule.get('id', '?')}': undeclared category '{category}'")
            continue
        exceptions = {word_key(word) for word in rule.get("exceptions") or []}
        for exception in sorted(exceptions):
            row = by_key.get(exception)
            if row is None:
                problems.append(f"curation rule '{rule.get('id', '?')}': exception '{exception}' is not a row in the table")
        for row in rows:
            if "family:merged" in (row.get("tags") or []):
                continue
            if int(row["id"]) <= LEGACY_ROW_LIMIT:
                continue
            if row.get("wordFamily", "").startswith("Cùng gốc: "):
                continue
            if word_key(row["word"]) in exceptions:
                continue
            levels = rule.get("levels") or []
            types = rule.get("types") or []
            topics = rule.get("topics") or []
            if levels and tag_value(row, "level") not in levels:
                continue
            if types and tag_value(row, "type") not in types:
                continue
            if topics and tag_value(row, "topic") not in topics:
                continue
            assign(row["word"], category, f"rule:{rule.get('id', 'rule')}", "rule")
    return decisions, problems


def apply_curation(rows: list[dict[str, Any]], spec: dict[str, Any],
                   seed_origin: dict[str, str] | None = None) -> dict[str, Any]:
    """Strip, re-apply and propagate curation tags; return a summary."""
    strip_curation(rows)
    decisions, problems = matched_rows(rows, spec, seed_origin)
    if problems:
        raise ValueError("; ".join(problems[:20]))

    by_key = {word_key(row["word"]): row for row in rows}
    archived_ids: set[str] = set()
    for key, decision in decisions.items():
        row = by_key[key]
        row["tags"] = [tag for tag in row["tags"] if not (isinstance(tag, str) and tag.startswith(CURATION_PREFIX))]
        row["tags"].extend([ARCHIVED_TAG, f"{CATEGORY_PREFIX}{decision['category']}"])
        archived_ids.add(row["id"])

    # A merged form whose headword is archived is archived with it, with the same
    # category: the app must never show a family note for a word it does not teach.
    for row in rows:
        head = row.get("familyHead")
        if head and head in archived_ids:
            source = next(candidate for candidate in rows if candidate["id"] == head)
            category = category_of(source.get("tags"))
            row["tags"] = [tag for tag in row["tags"] if not (isinstance(tag, str) and tag.startswith(CURATION_PREFIX))]
            row["tags"].extend([ARCHIVED_TAG, f"{CATEGORY_PREFIX}{category}"])

    return {
        "archived": len(archived_ids),
        "archivedRows": sum(1 for row in rows if is_archived(row.get("tags"))),
        "categories": {category: sum(1 for decision in decisions.values() if decision["category"] == category)
                       for category in sorted(spec.get("categories") or {})},
        "decisions": decisions,
    }


def validate(rows: list[dict[str, Any]], spec: dict[str, Any]) -> list[str]:
    """Check the tags already present in the table against the map."""
    problems: list[str] = []
    categories = set(spec.get("categories") or {})
    ids = {row["id"]: row for row in rows}
    for row in rows:
        tags = row.get("tags") or []
        archived = is_archived(tags)
        category = category_of(tags)
        if archived and category not in categories:
            problems.append(f"row {row['id']} ({row['word']}): archived without a declared category")
        if category and not archived:
            problems.append(f"row {row['id']} ({row['word']}): category tag without the archived tag")
        if archived and int(row["id"]) <= LEGACY_ROW_LIMIT:
            problems.append(f"row {row['id']} ({row['word']}): legacy rows cannot be archived")
        head = row.get("familyHead")
        if head and head in ids:
            if is_archived(ids[head].get("tags")) and not archived:
                problems.append(f"row {row['id']} ({row['word']}): family head {head} is archived but this form is not")
            if is_archived(ids[head].get("tags")) and is_archived(tags) and category_of(ids[head].get("tags")) != category:
                problems.append(f"row {row['id']} ({row['word']}): archived category differs from its family head")
        if "family:merged" in tags and archived and not head:
            problems.append(f"row {row['id']} ({row['word']}): merged form archived without a family head")
    return problems
