#!/usr/bin/env python3
"""Migrate an older vocabulary JSON (backup, export, previous release) to the
v1.0.0 sense-level CEFR model.

The migration is deterministic, validated and reversible:

* deterministic — the `senses` array is derived only from the row plus the
  pinned reference snapshots, so the same input always yields the same output;
* validated — every migrated row must pass scripts/cefr_senses.validate_senses
  before the file is written, and ids/words/meanings/tags are asserted
  unchanged (lossless for everything the old format carried);
* reversible — the `senses` field is additive; deleting it restores the exact
  legacy bytes, and the runtime falls back to the headword `level:*` tag when
  `senses` is absent, so a migrated file can always be downgraded by dropping
  the field (tested in tests/test_migrate_senses.py).

Usage:
    python scripts/migrate_senses.py OLD.json OUT.json
    python scripts/migrate_senses.py --backup audit/v100/backup/data-pre-v100.tgz OUT.json
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cefr_senses import References, classify_entry, validate_senses  # noqa: E402

PRESERVED_FIELDS = ("id", "word", "pos", "meaning", "tags", "wordFamily", "synonyms",
                    "antonyms", "collocations", "register", "connotation", "notes",
                    "sources", "examples", "difficulty", "createdAt", "familyHead")


def migrate(data: list[dict], refs: References) -> list[dict]:
    result = []
    for entry in data:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
            raise ValueError("entry without a string id")
        before = {field: entry.get(field) for field in PRESERVED_FIELDS}
        senses = classify_entry(entry, refs)
        errors = validate_senses({**entry, "senses": senses})
        if errors:
            raise ValueError(f"migration produced an invalid row {entry['id']}: {'; '.join(errors)}")
        new_entry = dict(entry)
        new_entry["senses"] = senses
        after = {field: new_entry.get(field) for field in PRESERVED_FIELDS}
        if before != after:
            raise ValueError(f"migration would mutate preserved fields of row {entry['id']}")
        result.append(new_entry)
    return result


def load_source(path: Path) -> list[dict]:
    if path.suffix == ".tgz":
        with tarfile.open(path) as tar:
            member = tar.extractfile("data/vocabulary.json")
            if member is None:
                raise ValueError("backup archive has no data/vocabulary.json")
            return json.loads(io.TextIOWrapper(member, encoding="utf-8").read())
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="old vocabulary JSON or a backup .tgz containing data/vocabulary.json")
    parser.add_argument("output", type=Path, help="where to write the migrated JSON")
    args = parser.parse_args()
    refs = References()
    data = load_source(args.input)
    if not isinstance(data, list):
        print("input must be a JSON array", file=sys.stderr)
        return 1
    migrated = migrate(data, refs)
    args.output.write_text(json.dumps(migrated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    senses = sum(len(entry["senses"]) for entry in migrated)
    print(f"migrated {len(migrated)} entries ({senses} senses) -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
