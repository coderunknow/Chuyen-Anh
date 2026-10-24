#!/usr/bin/env python3
"""Load the curated word-family map and turn it into row-level facts.

The vocabulary counts **roots, not forms**. A word that shares another
headword's root (an inflection, a spelling variant, a derivation or a close
cognate) is not a headword of its own: it belongs in that headword's
`WORD_FAMILY` note, and its own row is kept in the table as an audit record
tagged `family:merged` + `family-head:<id>`.

Everything about that rule lives in `docs/vocabulary-families.json`, which is
reviewed by hand; this module only reads it, validates it against the table and
renders the notes, so the Markdown table, the JSON, the HTML and the app all
follow one source.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "docs" / "vocabulary-families.json"
MERGED_TAG = "family:merged"
HEAD_TAG_PREFIX = "family-head:"
NOTE_PREFIX = "Cùng gốc: "

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vocab_sources import word_key  # noqa: E402


def load_spec(path: Path = SPEC_PATH) -> dict[str, Any]:
    if not path.exists():
        return {"families": [], "counts": {}}
    spec = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(spec, dict) or not isinstance(spec.get("families"), list):
        raise ValueError(f"{path.name}: expected an object with a 'families' array")
    return spec


def audit_view(field: str, value: Any) -> Any:
    """Strip family bookkeeping from a field the dev4/dev5 ledgers audited.

    Those ledgers review dictionary evidence for the 913 legacy rows and were
    frozen before the root rule existed, so the family tags and the generated
    "Cùng gốc:" note are outside what they verified; comparing them directly
    would rewrite a historical record for a bookkeeping change.
    """
    if field == "tags" and isinstance(value, list):
        return [tag for tag in value if tag != MERGED_TAG and not tag.startswith(HEAD_TAG_PREFIX)]
    if field == "wordFamily" and isinstance(value, str):
        return value.split(NOTE_PREFIX, 1)[0].strip()
    return value


def note_for(family: dict[str, Any]) -> str:
    """Render the learner-facing note that replaces the merged rows."""
    parts = [f"{member['word']} ({member['pos']}: {member['meaning']})" for member in family.get("members", [])]
    return NOTE_PREFIX + "; ".join(parts)


def append_note(existing: str, note: str) -> str:
    """Append a note without duplicating it and without touching earlier prose."""
    existing = (existing or "").strip()
    if not existing:
        return note
    if note in existing:
        return existing
    return f"{existing} {note}" if existing.endswith(".") else f"{existing}. {note}"


def strip_family_bookkeeping(rows: list[dict[str, Any]]) -> None:
    """Remove family tags and generated notes so the map can be re-applied cleanly.

    The table is an input on the next run, so a family that is edited out of the
    map would otherwise leave its tags and its "Cùng gốc:" note behind. Only the
    generated note is removed; hand-written WORD_FAMILY prose is kept verbatim.
    """
    for row in rows:
        tags = row.get("tags")
        if isinstance(tags, list):
            row["tags"] = [tag for tag in tags if tag != MERGED_TAG and not tag.startswith(HEAD_TAG_PREFIX)]
        note = row.get("wordFamily")
        if isinstance(note, str) and NOTE_PREFIX in note:
            row["wordFamily"] = note.split(NOTE_PREFIX, 1)[0].strip()


def apply_families(rows: list[dict[str, Any]], spec: dict[str, Any] | None = None) -> None:
    """Mark merged rows and append the family note to their headword, in place."""
    spec = spec if spec is not None else load_spec()
    strip_family_bookkeeping(rows)
    by_key: dict[str, dict[str, Any]] = {}
    for row in rows:
        by_key.setdefault(word_key(row["word"]), row)
    for family in spec.get("families", []):
        head = by_key.get(word_key(family["head"]))
        if head is None:
            raise ValueError(f"family head {family['head']!r} has no row in the table")
        if family.get("members"):
            head["wordFamily"] = append_note(head.get("wordFamily", ""), note_for(family))
        for member in family.get("members", []):
            row = by_key.get(word_key(member["word"]))
            if row is None:
                raise ValueError(f"family member {member['word']!r} has no row in the table")
            if row is head:
                raise ValueError(f"family {family['head']!r} lists itself as a member")
            tags = list(row.get("tags") or [])
            tags = [tag for tag in tags if tag != MERGED_TAG and not tag.startswith(HEAD_TAG_PREFIX)]
            tags.append(MERGED_TAG)
            tags.append(f"{HEAD_TAG_PREFIX}{head['id']}")
            row["tags"] = tags


def head_id_of(tags: list[str] | None) -> str | None:
    for tag in tags or []:
        if tag.startswith(HEAD_TAG_PREFIX):
            return tag[len(HEAD_TAG_PREFIX):]
    return None


def is_merged(tags: list[str] | None) -> bool:
    return MERGED_TAG in (tags or [])


def validate(rows: list[dict[str, Any]], spec: dict[str, Any] | None = None) -> list[str]:
    """Return problems with the map itself and with the rows it produced."""
    spec = spec if spec is not None else load_spec()
    problems: list[str] = []
    by_id = {row["id"]: row for row in rows}
    by_key: dict[str, dict[str, Any]] = {}
    for row in rows:
        by_key.setdefault(word_key(row["word"]), row)

    seen_heads: set[str] = set()
    seen_members: dict[str, str] = {}
    for family in spec.get("families", []):
        head_word = family.get("head")
        head = by_key.get(word_key(head_word or ""))
        if head is None:
            problems.append(f"family head {head_word!r} is not a row")
            continue
        if str(head["id"]) != str(family.get("headId")):
            problems.append(f"family head {head_word!r} has id {head['id']}, map says {family.get('headId')}")
        key = word_key(head_word)
        if key in seen_heads:
            problems.append(f"family head {head_word!r} is declared twice")
        seen_heads.add(key)
        if is_merged(head.get("tags")):
            problems.append(f"family head {head_word!r} is itself marked as merged")
        note = head.get("wordFamily") or ""
        for member in family.get("members", []):
            word = member.get("word") or ""
            row = by_key.get(word_key(word))
            if row is None:
                problems.append(f"family member {word!r} of {head_word!r} is not a row")
                continue
            if word_key(word) in seen_members:
                problems.append(f"family member {word!r} is declared in two families")
            seen_members[word_key(word)] = head_word
            if str(row["id"]) != str(member.get("id")):
                problems.append(f"family member {word!r} has id {row['id']}, map says {member.get('id')}")
            if row["pos"] != member.get("pos") or row["meaning"] != member.get("meaning"):
                problems.append(f"family member {word!r} changed pos/meaning; the family note is stale")
            if not is_merged(row.get("tags")):
                problems.append(f"family member {word!r} is not tagged {MERGED_TAG}")
            if head_id_of(row.get("tags")) != str(head["id"]):
                problems.append(f"family member {word!r} does not point at {head['id']}")
            if word and word.lower() not in note.lower():
                problems.append(f"family member {word!r} is missing from {head_word!r}'s WORD_FAMILY note")

    for row in rows:
        if is_merged(row.get("tags")):
            if str(row["id"]) not in by_id:
                problems.append(f"row {row['id']} is marked merged but missing")
        elif head_id_of(row.get("tags")):
            problems.append(f"row {row['id']} ({row['word']!r}) has a family head but is not marked merged")
    return problems


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Report the curated word-family map.")
    parser.add_argument("--json", type=Path, default=ROOT / "data" / "vocabulary.json")
    args = parser.parse_args()

    spec = load_spec()
    data = json.loads(args.json.read_text(encoding="utf-8"))
    merged = [entry for entry in data if is_merged(entry.get("tags"))]
    active = [entry for entry in data if not is_merged(entry.get("tags"))]
    print(f"{len(spec.get('families', []))} families; {len(merged)} merged rows; {len(active)} active headwords")
    for problem in validate(data, spec):
        print(f"problem: {problem}")
    return 0 if not validate(data, spec) else 1


if __name__ == "__main__":
    raise SystemExit(main())
