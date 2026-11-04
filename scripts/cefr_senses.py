#!/usr/bin/env python3
"""Sense-level CEFR classification engine for the v1.0.0 stable candidate.

Design (recorded in DESIGN_LOG.md, 2026-11-03):

* A headword's CEFR level belongs to an individual lexical SENSE, not to the
  headword as a whole. Every vocabulary row therefore carries a `senses` array;
  each sense has a stable senseId, the Vietnamese gloss, a POS, exactly one CEFR
  level, an evidence class, a confidence, structured sources and a rationale.
* The legacy headword-level `level:*` tag is kept unchanged as a backward-
  compatible fallback (old embedded builds, old exports, old backups). The
  runtime prefers `senses` when present and falls back to the tag otherwise.
* Evidence classes:
    - `source_supported`       one published CEFR reference directly supports
                               the level (CEFR-J Vocabulary Profile 1.5,
                               Octanove C1/C2 profile, Oxford 3000/5000 wordlists).
    - `cross_validated`        two or more independent published references agree.
    - `disputed`               published references disagree; the documented
                               hierarchy resolves the level and every vote is
                               recorded in `sources` and `rationale`.
    - `editorial_estimate`     no consulted published reference lists the word;
                               a curated editorial judgement (scripts/
                               cefr_editorial_map.py) proposes a level. These
                               carry `needsIndependentValidation: true` and are
                               never counted as verified.
    - `unresolved`             no defensible classification could be reached
                               (blocker; must carry a reason). Target: zero.
* Confidence scale: HIGH / MEDIUM / LOW / VERY_LOW, kept separate from the
  evidence class.
* Reference hierarchy when sources disagree (per-sense evidence wins over
  word-level evidence; Oxford wordlists carry per-sense levels):
    1. Oxford 3000/5000 sense row (level printed for that sense)
    2. CEFR-J Vocabulary Profile 1.5 (headword+pos, else headword)
    3. Octanove C1/C2 vocabulary profile (headword+pos, else headword)
    4. Oxford 3000/5000 word-level (lowest level printed for the headword)
* Multi-sense headwords: when the Oxford wordlists list the same headword under
  several annotated senses (e.g. `bank (money)` / `bank (river)`), the bank row
  is split into one sense per matching Oxford row, each with that row's own
  level. The bank's combined Vietnamese gloss is distributed across the senses
  when its `;`-separated parts line up with the sense count, otherwise each
  sense carries the full gloss plus the Oxford annotation as its label.

The engine is deterministic: same bank + same reference snapshots in
audit/v100/refs/ => same senses. `scripts/build_senses.py` applies it to
data/vocabulary.json and writes the machine-readable audit.
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REFS = ROOT / "audit" / "v100" / "refs"

CEFR_LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")
UNCLASSIFIED = "UNCLASSIFIED"
EVIDENCE_CLASSES = ("source_supported", "cross_validated", "disputed", "editorial_estimate", "unresolved")
CONFIDENCE_LEVELS = ("HIGH", "MEDIUM", "LOW", "VERY_LOW")

SOURCE_REFS = {
    "cefrj": "cefrj-vocabulary-profile-1.5",
    "octanove": "octanove-vocabulary-profile-c1c2-1.0",
    "oxford3000": "oxford-3000-wordlist",
    "oxford5000": "oxford-5000-expanded-wordlist",
    "editorial": "editorial-curation-map",
    "frequency": "corpus-frequency-index",
}

# bank POS -> reference POS names used by the published lists
POS_ALIASES = {
    "n": ("noun", "n"), "noun": ("noun", "n"),
    "v": ("verb", "v"), "verb": ("verb", "v"),
    "adj": ("adjective", "adj"), "adv": ("adverb", "adv"),
    "prep": ("preposition", "prep"), "pron": ("pronoun", "pron"),
    "conj": ("conjunction", "conj"),
    "det": ("determiner", "det"), "determiner": ("determiner", "det"),
    "modal": ("modal auxiliary", "modal"), "number": ("number", "number"),
    "interj": ("interjection", "interj"),
}
# ordered longest-first so "modal v." is not read as "v."
OXFORD_POS_LABELS = (
    ("modal v.", "v"), ("indefinite article", "det"), ("interj.", "interj"),
    ("n.", "n"), ("v.", "v"), ("adj.", "adj"), ("adv.", "adv"), ("prep.", "prep"),
    ("pron.", "pron"), ("conj.", "conj"), ("det.", "det"), ("number", "number"),
)


def _oxford_sense_pos(raw: str) -> str | None:
    """Map an Oxford 'Part of Speech' cell like 'v. A1, n. B2' to bank POS letters."""
    cell = (raw or "").lower()
    found: list[str] = []
    for label, code in OXFORD_POS_LABELS:
        if re.search(r"(^|[,\s/])" + re.escape(label), cell) and code not in found:
            found.append(code)
    if not found:
        return None
    return found[0] if len(found) == 1 else ",".join(sorted(found))


def normalize_word(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value or "")
    decomposed = re.sub(r"[̀-ͯ]", "", decomposed).replace("đ", "d").replace("Đ", "d")
    return " ".join(decomposed.lower().split())


def _pos_variants(pos: str) -> tuple[str, ...]:
    return POS_ALIASES.get((pos or "").strip().lower(), ((pos or "").strip().lower(),))


def _oxford_levels(raw: str) -> list[str]:
    out: list[str] = []
    for part in re.split(r"[;,]", raw or ""):
        token = part.strip().upper()
        if token in CEFR_LEVELS and token not in out:
            out.append(token)
    return out


class References:
    def __init__(self, refs_dir: Path = REFS):
        self.cefrj: dict[str, list[dict[str, Any]]] = {}
        path = refs_dir / "cefrj-vocabulary-profile-1.5.csv"
        for row_no, row in enumerate(csv.DictReader(path.open(encoding="utf-8")), start=2):
            self.cefrj.setdefault(normalize_word(row["headword"]), []).append(
                {"pos": row["pos"].strip().lower(), "level": row["CEFR"].strip().upper(), "line": row_no}
            )
        self.octanove: dict[str, list[dict[str, Any]]] = {}
        path = refs_dir / "octanove-vocabulary-profile-c1c2-1.0.csv"
        for row_no, row in enumerate(csv.DictReader(path.open(encoding="utf-8")), start=2):
            self.octanove.setdefault(normalize_word(row["headword"]), []).append(
                {"pos": row["pos"].strip().lower(), "level": row["CEFR"].strip().upper(), "line": row_no}
            )
        self.oxford: dict[str, list[dict[str, Any]]] = {}
        for name, fname in (("oxford3000", "oxford-3000.en.tsv"), ("oxford5000", "oxford-5000-expanded.en.tsv")):
            path = refs_dir / fname
            for row_no, row in enumerate(csv.DictReader(path.open(encoding="utf-8"), delimiter="\t"), start=2):
                head = row["Word"].split("(")[0].strip()
                self.oxford.setdefault(normalize_word(head), []).append({
                    "source": name,
                    "file": fname,
                    "line": row_no,
                    "word": row["Word"].strip(),
                    "annotation": row["Annotation"].strip(),
                    "sense": row["Sense"].strip(),
                    "pos": _oxford_sense_pos(row["Part of Speech"]),
                    "levels": _oxford_levels(row["Level"]),
                    "raw_level": row["Level"].strip(),
                })
        self.frequency: dict[str, int] = {}
        path = refs_dir / "frequency-top30k.csv"
        if path.exists():
            for row in csv.DictReader(path.open(encoding="utf-8")):
                try:
                    self.frequency[normalize_word(row["Word"])] = int(row["Rank"])
                except (KeyError, ValueError):
                    continue

    def votes_for(self, word: str, pos: str) -> dict[str, dict[str, Any]]:
        """Collect published-level votes for one headword/POS."""
        votes: dict[str, dict[str, Any]] = {}
        key = normalize_word(word)
        pos_keys = set(_pos_variants(pos))
        for source, table in (("cefrj", self.cefrj), ("octanove", self.octanove)):
            rows = table.get(key, [])
            exact = [r for r in rows if r["pos"] in pos_keys]
            chosen = exact or rows
            for r in chosen:
                if r["level"] in CEFR_LEVELS:
                    votes.setdefault(source, {"level": r["level"], "line": r["line"], "pos": r["pos"], "pos_match": bool(exact)})
                    break
        ox_rows = self.oxford.get(key, [])
        pos_rows = [r for r in ox_rows if r["pos"] and r["pos"] in pos_keys]
        pool = pos_rows or ox_rows
        if pool:
            levels = sorted({lv for r in pool for lv in r["levels"]}, key=CEFR_LEVELS.index)
            if levels:
                votes.setdefault("oxford", {
                    "level": levels[0],
                    "levels": levels,
                    "line": pool[0]["line"],
                    "file": pool[0]["file"],
                    "source": pool[0]["source"],
                    "pos": pool[0]["pos"] or "",
                    "pos_match": bool(pos_rows),
                })
        return votes

    def oxford_sense_rows(self, word: str, pos: str) -> list[dict[str, Any]]:
        """Oxford rows for the headword whose POS matches the bank row.

        An Oxford cell like 'n,v' matches a bank row of either POS, so the
        homograph split follows the bank row's own POS; rows of another POS
        (kind adj. vs n.) never leak into a noun row's senses.
        """
        key = normalize_word(word)
        pos_keys = set(_pos_variants(pos))
        rows = self.oxford.get(key, [])
        matched = [r for r in rows if r["pos"] and set(r["pos"].split(",")) & pos_keys]
        return matched


def _source_record(ref: str, locator: str, supports: str) -> dict[str, str]:
    return {"ref": ref, "locator": locator, "supports": supports}


def _resolve_level(votes: dict[str, dict[str, Any]], refs: References, word: str, pos: str) -> tuple[str, str, str, list[dict[str, str]], bool]:
    """Return (cefr, evidence, confidence, sources, needs_validation)."""
    if not votes:
        return _editorial(word, pos, refs)
    levels = {v["level"] for v in votes.values()}
    sources: list[dict[str, str]] = []
    for source, vote in votes.items():
        if source == "oxford":
            ref = SOURCE_REFS[vote["source"]]
        else:
            ref = SOURCE_REFS[source]
        if source == "cefrj":
            sources.append(_source_record(ref, f"row {vote['line']}: headword={word.lower()}, pos={vote.get('pos', '')}, CEFR={vote['level']}",
                                          "published CEFR level for this headword+POS in the CEFR-J Vocabulary Profile 1.5"))
        elif source == "octanove":
            sources.append(_source_record(ref, f"row {vote['line']}: headword={word.lower()}, pos={vote.get('pos', '')}, CEFR={vote['level']}",
                                          "published C1/C2 level for this headword in the Octanove vocabulary profile 1.0"))
        else:
            sources.append(_source_record(SOURCE_REFS[vote["source"]], f"{vote['file']}:{vote['line']}: {word.lower()} ({vote.get('raw_level', '')})",
                                          "Oxford Learner's Dictionaries wordlist level for this headword"))
    if len(levels) == 1:
        level = levels.pop()
        if len(votes) >= 2:
            return level, "cross_validated", "HIGH", sources, False
        exact = all(v.get("pos_match", True) for v in votes.values())
        return level, "source_supported", "HIGH" if exact else "MEDIUM", sources, False
    # disagreement: resolve by the documented hierarchy
    order = ["oxford", "cefrj", "octanove"]
    for source in order:
        if source in votes:
            level = votes[source]["level"]
            break
    else:
        level = sorted(levels, key=CEFR_LEVELS.index)[0]
    disagreement = ", ".join(f"{s}={v['level']}" for s, v in votes.items())
    rationale = (f"published references disagree ({disagreement}); "
                 f"resolved to {level} by the documented hierarchy (Oxford sense-level > CEFR-J > Octanove > Oxford word-level); "
                 "recorded as disputed, not as verified agreement")
    return level, "disputed", "MEDIUM", sources + [_source_record(SOURCE_REFS["editorial"], "hierarchy", rationale)], False


def _editorial(word: str, pos: str, refs: References) -> tuple[str, str, str, list[dict[str, str]], bool]:
    from cefr_editorial_map import EDITORIAL_LEVELS  # local import: curated data
    key = normalize_word(word)
    if key in EDITORIAL_LEVELS:
        level = EDITORIAL_LEVELS[key]
        sources = [_source_record(SOURCE_REFS["editorial"], f"cefr_editorial_map.py: {key}",
                                  "curated editorial classification; the consulted published CEFR lists do not contain this form")]
        return level, "editorial_estimate", "MEDIUM", sources, True
    rank = refs.frequency.get(key)
    if rank is not None:
        if rank <= 2000:
            level, confidence = "B1", "LOW"
        elif rank <= 8000:
            level, confidence = "B2", "LOW"
        else:
            level, confidence = "C1", "VERY_LOW"
        sources = [_source_record(SOURCE_REFS["frequency"], f"frequency-top30k.csv: rank {rank}",
                                  "corpus frequency rank only; used solely to propose an editorial band, never as a level source")]
        return level, "editorial_estimate", confidence, sources, True
    return UNCLASSIFIED, "unresolved", "VERY_LOW", [
        _source_record(SOURCE_REFS["editorial"], "none",
                       "no consulted published reference and no curated editorial entry; explicit blocker, not a guess")
    ], True


def classify_entry(entry: dict[str, Any], refs: References) -> list[dict[str, Any]]:
    """Build the normalized sense list for one vocabulary row."""
    entry_id = str(entry.get("id", ""))
    word = str(entry.get("word", ""))
    pos = str(entry.get("pos", ""))
    meaning = str(entry.get("meaning", ""))
    ox_rows = refs.oxford_sense_rows(word, pos)
    # multi-sense split: >=2 Oxford rows with distinct annotations/senses for this POS
    distinct = {(r["annotation"], r["sense"]) for r in ox_rows}
    senses: list[dict[str, Any]] = []
    if len(ox_rows) >= 2 and len(distinct) >= 2:
        gloss_parts = [p.strip() for p in meaning.split(";") if p.strip()]
        distribute = len(gloss_parts) == len(ox_rows) and len(gloss_parts) > 1
        for index, row in enumerate(ox_rows, start=1):
            levels = row["levels"] or sorted({lv for r in ox_rows for lv in r["levels"]}, key=CEFR_LEVELS.index)
            if not levels:
                level, evidence, confidence, sources, needs = _resolve_level(refs.votes_for(word, pos), refs, word, pos)
            else:
                level = levels[0]
                evidence = "source_supported"
                confidence = "HIGH"
                ref_name = SOURCE_REFS[row["source"]]
                sources = [_source_record(ref_name, f"{row['file']}:{row['line']}: {row['word']} (sense {row['sense'] or row['annotation'] or '—'}, level cell {row['raw_level']!r})",
                                          "Oxford wordlist prints this CEFR level for this specific sense of the headword")]
                votes = refs.votes_for(word, pos)
                if any(v["level"] == level for v in votes.values()):
                    evidence = "cross_validated"
                    for source, vote in votes.items():
                        if vote["level"] == level and source != "oxford":
                            sources.append(_source_record(SOURCE_REFS[source], f"row {vote['line']}",
                                                          "independent published list agrees at the same level"))
                needs = False
            label = row["annotation"] or (f"sense {row['sense']}" if row["sense"] else "")
            sense_meaning = gloss_parts[index - 1] if distribute else meaning
            rationale = (f"sense-level split from the Oxford wordlists: {row['word']}"
                         + (f" ({label})" if label else "")
                         + (f" prints level cell {row['raw_level']!r}; the lowest level in the cell ({level}) is used" if len(levels) > 1 else f" at level {level}"))
            senses.append({
                "senseId": f"{entry_id}-s{index}",
                "label": label,
                "meaning": sense_meaning,
                "pos": pos,
                "cefr": level,
                "evidence": evidence,
                "confidence": confidence,
                "sources": sources,
                "rationale": rationale,
                "needsIndependentValidation": needs,
            })
        return senses
    level, evidence, confidence, sources, needs = _resolve_level(refs.votes_for(word, pos), refs, word, pos)
    rationale = {
        "source_supported": "level taken directly from the cited published CEFR reference",
        "cross_validated": "two or more independent published references agree on this level",
        "disputed": "published references disagree; resolved by the documented hierarchy and recorded as disputed",
        "editorial_estimate": "not listed in the consulted published CEFR references; curated editorial estimate, requires two independent validations before it may be treated as verified",
        "unresolved": "no defensible classification reached; explicit blocker",
    }[evidence]
    if evidence == "disputed":
        rationale = next(s["supports"] for s in sources if s["ref"] == SOURCE_REFS["editorial"])
    return [{
        "senseId": f"{entry_id}-s1",
        "label": "",
        "meaning": meaning,
        "pos": pos,
        "cefr": level,
        "evidence": evidence,
        "confidence": confidence,
        "sources": sources,
        "rationale": rationale,
        "needsIndependentValidation": needs,
    }]


def validate_senses(entry: dict[str, Any]) -> list[str]:
    """Schema validation for one entry's senses array (used by validate_vocab.py)."""
    errors: list[str] = []
    senses = entry.get("senses")
    entry_id = str(entry.get("id", "?"))
    if not isinstance(senses, list) or not senses:
        return [f"entry {entry_id}: senses must be a non-empty array"]
    seen: set[str] = set()
    for sense in senses:
        if not isinstance(sense, dict):
            errors.append(f"entry {entry_id}: sense must be an object")
            continue
        sid = sense.get("senseId")
        if not isinstance(sid, str) or not re.fullmatch(re.escape(entry_id) + r"-s[1-9][0-9]*", sid):
            errors.append(f"entry {entry_id}: invalid senseId {sid!r}")
        elif sid in seen:
            errors.append(f"entry {entry_id}: duplicate senseId {sid!r}")
        else:
            seen.add(sid)
        if sense.get("cefr") not in CEFR_LEVELS + (UNCLASSIFIED,):
            errors.append(f"entry {entry_id} sense {sid}: invalid cefr {sense.get('cefr')!r}")
        if sense.get("evidence") not in EVIDENCE_CLASSES:
            errors.append(f"entry {entry_id} sense {sid}: invalid evidence {sense.get('evidence')!r}")
        if sense.get("confidence") not in CONFIDENCE_LEVELS:
            errors.append(f"entry {entry_id} sense {sid}: invalid confidence {sense.get('confidence')!r}")
        if not isinstance(sense.get("meaning"), str) or not sense.get("meaning", "").strip():
            errors.append(f"entry {entry_id} sense {sid}: missing meaning")
        sources = sense.get("sources")
        if not isinstance(sources, list) or not sources:
            errors.append(f"entry {entry_id} sense {sid}: sources must be a non-empty array")
        else:
            for src in sources:
                if not isinstance(src, dict) or not isinstance(src.get("ref"), str) or not isinstance(src.get("supports"), str):
                    errors.append(f"entry {entry_id} sense {sid}: malformed source record")
    return errors
