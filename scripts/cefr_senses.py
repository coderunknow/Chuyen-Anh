#!/usr/bin/env python3
"""Sense-level CEFR classification engine for the v1.0.0 stable candidate.

Design (recorded in DESIGN_LOG.md, 2026-11-03; expanded 2026-11-08):

* A headword's CEFR level belongs to an individual lexical SENSE, not to the
  headword as a whole. Every vocabulary row therefore carries a `senses` array;
  each sense has a stable senseId, the Vietnamese gloss, an atomic POS, exactly
  one CEFR level, an evidence class, a confidence, structured sources and a
  rationale.
* The legacy headword-level `level:*` tag is kept unchanged as a backward-
  compatible fallback (old embedded builds, old exports, old backups). The
  runtime prefers `senses` when present and falls back to the tag otherwise.
* Evidence classes:
    - `source_supported`       one published CEFR reference group directly
                               supports the level (CEFR-J Vocabulary Profile 1.5,
                               Octanove C1/C2 profile, Oxford 3000/5000 wordlists,
                               Cambridge Dictionary / EVP verified badges).
    - `cross_validated`        two or more INDEPENDENT published reference
                               groups (`independenceGroup` in
                               `docs/vocabulary-sources.json`) agree on the level
                               without relying on an editorial gloss split.
    - `disputed`               published references disagree; the documented
                               hierarchy resolves the level and every vote is
                               recorded in `sources` and `rationale`.
    - `editorial_estimate`     no consulted published reference lists the word+POS;
                               a curated editorial judgement (`scripts/
                               cefr_editorial_map.py`) proposes a level. Always
                               carries `needsIndependentValidation: true`.
    - `unresolved`             no defensible classification could be reached
                               (blocker; must carry a reason). Target: zero.
* Reference hierarchy when sources disagree (per-sense evidence wins over
  word-level evidence):
    1. Oxford 3000/5000 annotated sense row (level printed for that sense)
    2. Cambridge Dictionary / EVP verified sense badge (`cambridge-evp`)
    3. CEFR-J Vocabulary Profile 1.5 (headword+pos)
    4. Octanove C1/C2 vocabulary profile (headword+pos)
    5. Oxford 3000/5000 word-level (lowest level printed for the headword+pos)
* Multi-sense headwords & composite-POS rows:
    - Multi-row Oxford homographs (`entries` in `docs/sense-gloss-mappings.json`)
      and composite-POS legacy rows (`posSplits` in `docs/sense-gloss-mappings.json`)
      are split only via explicit reviewed gloss mappings; unrepresented senses
      (`gloss: null`) are omitted; missing or stale mappings fail closed.
    - Because English CEFR lists do not translate Vietnamese glosses, every sense
      whose Vietnamese meaning was sliced via `editorial-sense-gloss-map` keeps
      `needsIndependentValidation: true` and is never promoted to `cross_validated`.
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
LEVEL_RE = re.compile(r"\b(A1|A2|B1|B2|C1|C2)\b", re.IGNORECASE)

SOURCE_REFS = {
    "cefrj": "cefrj-vocabulary-profile-1.5",
    "octanove": "octanove-vocabulary-profile-c1c2-1.0",
    "oxford3000": "oxford-3000-wordlist",
    "oxford5000": "oxford-5000-expanded-wordlist",
    "evp": "cambridge-evp",
    "editorial": "editorial-curation-map",
    "sense_mapping": "editorial-sense-gloss-map",
    "frequency": "corpus-frequency-index",
}

INDEPENDENCE_GROUPS = {
    "cefrj": "open-language-profiles",
    "octanove": "open-language-profiles",
    "oxford": "oxford-university-press",
    "evp": "cambridge-university-press",
}

# bank POS -> reference POS names used by the published lists.
# Note: "vern" normalizes upstream Octanove row 2129 (`remonstrate,vern,C2`)
# without modifying the checksummed upstream CSV snapshot.
POS_ALIASES = {
    "n": ("noun", "n"), "noun": ("noun", "n"),
    "v": ("verb", "v", "vern", "be-verb", "do-verb", "have-verb"),
    "verb": ("verb", "v", "vern", "be-verb", "do-verb", "have-verb"),
    "adj": ("adjective", "adj"), "adv": ("adverb", "adv"),
    "prep": ("preposition", "prep"), "pron": ("pronoun", "pron"),
    "conj": ("conjunction", "conj"),
    "det": ("determiner", "det"), "determiner": ("determiner", "det"),
    "modal": ("modal auxiliary", "modal", "v"),
    "number": ("number", "ordinal number"),
    "interj": ("interjection", "interj"),
}

# ordered longest-first so "modal v." is not read as "v."
OXFORD_POS_LABELS = (
    ("modal v.", "v"), ("indefinite article", "det"), ("definite article", "det"),
    ("ordinal number", "number"),
    ("exclam.", "interj"), ("interj.", "interj"),
    ("n.", "n"), ("v.", "v"), ("adj.", "adj"), ("adv.", "adv"), ("prep.", "prep"),
    ("pron.", "pron"), ("conj.", "conj"), ("det.", "det"), ("number", "number"),
)

# Verified bidirectional BrE <-> AmE / hyphen-space headword equivalents.
ORTHOGRAPHIC_PAIRS = (
    ("globalization", "globalisation"),
    ("neighborhood", "neighbourhood"),
    ("behavioral", "behavioural"),
    ("percent", "per cent"),
    ("chilli", "chili"),
    ("yoghurt", "yogurt"),
    ("omelette", "omelet"),
    ("whisky", "whiskey"),
    ("pyjamas", "pajamas"),
    ("math", "maths"),
    ("program", "programme"),
    ("catalog", "catalogue"),
    ("dialog", "dialogue"),
    ("skeptical", "sceptical"),
    ("scrutinize", "scrutinise"),
    ("jeopardize", "jeopardise"),
    ("appall", "appal"),
    ("ardor", "ardour"),
)
ORTHOGRAPHIC_MAP: dict[str, set[str]] = {}
for _a, _b in ORTHOGRAPHIC_PAIRS:
    ORTHOGRAPHIC_MAP.setdefault(_a, set()).add(_b)
    ORTHOGRAPHIC_MAP.setdefault(_b, set()).add(_a)

# POS-scoped BrE <-> AmE noun equivalents (where verb vs noun spelling differs in BrE).
POS_ORTHOGRAPHIC_MAP: dict[tuple[str, str], set[str]] = {
    ("license", "n"): {"licence"},
    ("licence", "n"): {"license"},
    ("tire", "n"): {"tyre"},
    ("tyre", "n"): {"tire"},
    ("practice", "v"): {"practise"},
    ("practise", "v"): {"practice"},
}


def normalize_word(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value or "")
    decomposed = re.sub(r"[̀-ͯ]", "", decomposed).replace("đ", "d").replace("Đ", "d")
    return " ".join(decomposed.lower().split())


def headword_variants(word: str, pos: str = "") -> tuple[str, ...]:
    """Return normalized headword forms (canonical first, then verified equivalents)."""
    key = normalize_word(word)
    if not key:
        return ()
    out: list[str] = [key]
    for alt in sorted(ORTHOGRAPHIC_MAP.get(key, ())):
        if alt not in out:
            out.append(alt)
    if key.endswith("isation") and len(key) > 7:
        z_form = key[:-7] + "ization"
        if z_form not in out:
            out.append(z_form)
    elif key.endswith("ization") and len(key) > 7:
        s_form = key[:-7] + "isation"
        if s_form not in out:
            out.append(s_form)
    pos_parts = [p.strip() for p in (pos or "").lower().split("/") if p.strip()]
    for p in pos_parts:
        p_norm = "n" if p in ("n", "noun") else ("v" if p in ("v", "verb") else p)
        for alt in sorted(POS_ORTHOGRAPHIC_MAP.get((key, p_norm), ())):
            if alt not in out:
                out.append(alt)
    return tuple(out)


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


def _pos_variants(pos: str) -> tuple[str, ...]:
    # A bank row such as "v/n" includes both parts of speech; treating the
    # literal combined spelling as a POS silently falls back to unrelated rows.
    variants = []
    for part in (pos or "").strip().lower().split("/"):
        part = part.strip()
        variants.extend(POS_ALIASES.get(part, (part,)))
    return tuple(dict.fromkeys(variants))


def _oxford_pos_levels(raw: str) -> dict[str, str]:
    """Map an Oxford 'Part of Speech' cell like 'det., pron. A2, adv. B1' to {pos_code: level}.

    Parses each span preceding a CEFR level token so grouped POS labels sharing
    one printed level (e.g. `prep. A1, conj., adv. A2` or `exclam., v., adj. A1`)
    all receive that span's level rather than only the last label before the token.
    """
    cell = raw or ""
    out: dict[str, str] = {}
    prev_end = 0
    for match in LEVEL_RE.finditer(cell):
        segment = cell[prev_end:match.start()].lower()
        level = match.group(1).upper()
        prev_end = match.end()
        for label, code in OXFORD_POS_LABELS:
            if re.search(r"(^|[,\s/;])" + re.escape(label), segment) and code not in out:
                out[code] = level
    return out


def _oxford_levels(raw: str) -> list[str]:
    out: list[str] = []
    for part in re.split(r"[;,]", raw or ""):
        token = part.strip().upper()
        if token in CEFR_LEVELS and token not in out:
            out.append(token)
    return out


class References:
    def __init__(self, refs_dir: Path = REFS):
        mapping_doc = json.loads((ROOT / "docs" / "sense-gloss-mappings.json").read_text(encoding="utf-8"))
        self.sense_mappings: dict[str, dict[str, Any]] = mapping_doc["entries"]
        self.pos_splits: dict[str, dict[str, Any]] = mapping_doc.get("posSplits", {})

        self.cefrj: dict[str, list[dict[str, Any]]] = {}
        path = refs_dir / "cefrj-vocabulary-profile-1.5.csv"
        with path.open(encoding="utf-8") as fh:
            for row_no, row in enumerate(csv.DictReader(fh), start=2):
                forms = tuple(dict.fromkeys(normalize_word(part) for part in row["headword"].split("/") if normalize_word(part)))
                rec = {
                    "pos": row["pos"].strip().lower(),
                    "level": row["CEFR"].strip().upper(),
                    "line": row_no,
                    "headword": row["headword"].strip(),
                    "words": forms,
                }
                for form in forms:
                    self.cefrj.setdefault(form, []).append(rec)

        self.octanove: dict[str, list[dict[str, Any]]] = {}
        path = refs_dir / "octanove-vocabulary-profile-c1c2-1.0.csv"
        with path.open(encoding="utf-8") as fh:
            for row_no, row in enumerate(csv.DictReader(fh), start=2):
                forms = tuple(dict.fromkeys(normalize_word(part) for part in row["headword"].split("/") if normalize_word(part)))
                rec = {
                    "pos": row["pos"].strip().lower(),
                    "level": row["CEFR"].strip().upper(),
                    "line": row_no,
                    "headword": row["headword"].strip(),
                    "words": forms,
                }
                for form in forms:
                    self.octanove.setdefault(form, []).append(rec)

        self.oxford: dict[str, list[dict[str, Any]]] = {}
        for name, fname in (("oxford3000", "oxford-3000.en.tsv"), ("oxford5000", "oxford-5000-expanded.en.tsv")):
            path = refs_dir / fname
            with path.open(encoding="utf-8") as fh:
                for row_no, row in enumerate(csv.DictReader(fh, delimiter="\t"), start=2):
                    head_raw = row["Word"].split("(")[0].strip()
                    forms = tuple(dict.fromkeys(
                        normalize_word(part)
                        for part in re.split(r"[,/]", head_raw)
                        if normalize_word(part)
                    ))
                    pos_levels = _oxford_pos_levels(row["Part of Speech"])
                    levels = _oxford_levels(row["Level"]) or list(dict.fromkeys(pos_levels.values()))
                    raw_level = row["Level"].strip() or ", ".join(levels)
                    rec = {
                        "source": name,
                        "file": fname,
                        "line": row_no,
                        "word": row["Word"].strip(),
                        "words": forms,
                        "annotation": row["Annotation"].strip(),
                        "sense": row["Sense"].strip(),
                        "pos": _oxford_sense_pos(row["Part of Speech"]),
                        "pos_levels": pos_levels,
                        "levels": levels,
                        "raw_level": raw_level,
                    }
                    for form in forms:
                        self.oxford.setdefault(form, []).append(rec)

        self.evp: dict[str, list[dict[str, Any]]] = {}
        self.evp_by_line: dict[int, dict[str, Any]] = {}
        evp_path = refs_dir / "cambridge-evp-verified.tsv"
        if evp_path.exists():
            with evp_path.open(encoding="utf-8") as fh:
                for row_no, row in enumerate(csv.DictReader(fh, delimiter="\t"), start=2):
                    forms = tuple(dict.fromkeys(normalize_word(part) for part in row["headword"].split("/") if normalize_word(part)))
                    rec = {
                        "file": "cambridge-evp-verified.tsv",
                        "line": row_no,
                        "headword": row["headword"].strip(),
                        "words": forms,
                        "pos": row["pos"].strip().lower(),
                        "sense": row["sense"].strip(),
                        "level": row["cefr"].strip().upper(),
                        "url": row["url"].strip(),
                    }
                    self.evp_by_line[row_no] = rec
                    for form in forms:
                        self.evp.setdefault(form, []).append(rec)

        self.frequency: dict[str, int] = {}
        path = refs_dir / "frequency-top30k.csv"
        if path.exists():
            with path.open(encoding="utf-8") as fh:
                for row in csv.DictReader(fh):
                    try:
                        self.frequency[normalize_word(row["Word"])] = int(row["Rank"])
                    except (KeyError, ValueError):
                        continue

    def _lookup_rows(self, table: dict[str, list[dict[str, Any]]], variants: tuple[str, ...]) -> list[dict[str, Any]]:
        seen_lines: set[tuple[str, int]] = set()
        rows: list[dict[str, Any]] = []
        for key in variants:
            for r in table.get(key, []):
                ident = (r.get("file", ""), int(r.get("line", 0)))
                if ident not in seen_lines:
                    seen_lines.add(ident)
                    rows.append(r)
        return rows

    def votes_for(self, word: str, pos: str) -> dict[str, dict[str, Any]]:
        """Collect published-level votes for one headword/POS."""
        votes: dict[str, dict[str, Any]] = {}
        variants = headword_variants(word, pos)
        if not variants:
            return votes
        pos_keys = set(_pos_variants(pos))
        for source, attr in (("cefrj", "cefrj"), ("octanove", "octanove")):
            table = getattr(self, attr, {})
            # Check exact-POS match across verified orthographic variants before falling back
            # to a different-POS row on the canonical spelling.
            all_rows = self._lookup_rows(table, variants)
            exact = [r for r in all_rows if r["pos"] in pos_keys]
            canonical_rows = table.get(variants[0], [])
            chosen = exact or canonical_rows
            for r in chosen:
                if r["level"] in CEFR_LEVELS:
                    votes.setdefault(source, {
                        "level": r["level"],
                        "line": r["line"],
                        "pos": r["pos"],
                        "headword": r.get("headword", word.lower()),
                        "pos_match": bool(exact),
                    })
                    break

        evp_table = getattr(self, "evp", {})
        if evp_table:
            evp_rows = self._lookup_rows(evp_table, variants)
            evp_exact = [r for r in evp_rows if r["pos"] in pos_keys and r["level"] in CEFR_LEVELS]
            # Only emit a headword+POS EVP vote when all verified EVP rows for this
            # headword+POS agree on a single CEFR level (multi-level homographs such
            # as bank/lie/March/race/rock are linked per sense via evpLine instead).
            evp_levels = {r["level"] for r in evp_exact}
            if len(evp_levels) == 1:
                selected_evp = evp_exact[0]
                votes.setdefault("evp", {
                    "level": selected_evp["level"],
                    "line": selected_evp["line"],
                    "file": selected_evp["file"],
                    "pos": selected_evp["pos"],
                    "sense": selected_evp["sense"],
                    "headword": selected_evp["headword"],
                    "pos_match": True,
                })

        ox_table = getattr(self, "oxford", {})
        ox_all = self._lookup_rows(ox_table, variants)
        pos_rows = [r for r in ox_all if r["pos"] and set(r["pos"].split(",")) & pos_keys]
        pool = pos_rows or ox_table.get(variants[0], [])
        if pool:
            candidates: list[tuple[str, dict[str, Any]]] = []
            for r in pool:
                specific = {r["pos_levels"][p] for p in pos_keys
                            if r.get("pos_levels", {}).get(p) in CEFR_LEVELS}
                candidates.extend((level, r) for level in (specific or set(r["levels"])))
            if candidates:
                level, selected = min(candidates, key=lambda item: CEFR_LEVELS.index(item[0]))
                levels = sorted({item[0] for item in candidates}, key=CEFR_LEVELS.index)
                votes.setdefault("oxford", {
                    "level": level,
                    "levels": levels,
                    "line": selected["line"],
                    "file": selected["file"],
                    "source": selected["source"],
                    "word": selected.get("word", word.lower()),
                    "raw_level": selected.get("raw_level", ""),
                    "pos": selected["pos"] or "",
                    "pos_match": bool(pos_rows),
                })
        return votes

    def oxford_sense_rows(self, word: str, pos: str) -> list[dict[str, Any]]:
        """Oxford rows for the headword whose POS matches the bank row."""
        key = normalize_word(word)
        pos_keys = set(_pos_variants(pos))
        rows = getattr(self, "oxford", {}).get(key, [])
        return [r for r in rows if r["pos"] and set(r["pos"].split(",")) & pos_keys]


def _source_record(ref: str, locator: str, supports: str) -> dict[str, str]:
    return {"ref": ref, "locator": locator, "supports": supports}


def _resolve_level(
    votes: dict[str, dict[str, Any]],
    refs: References,
    word: str,
    pos: str,
    *,
    mapped_gloss: bool = False,
) -> tuple[str, str, str, list[dict[str, str]], bool]:
    """Return (cefr, evidence, confidence, sources, needs_validation)."""
    exact_votes = {source: vote for source, vote in votes.items() if vote.get("pos_match") is True}
    if not exact_votes:
        from cefr_editorial_map import EDITORIAL_POS_LEVELS  # local import: curated data
        key = normalize_word(word)
        pos_norm = (pos or "").strip().lower()
        if (key, pos_norm) in EDITORIAL_POS_LEVELS:
            level = EDITORIAL_POS_LEVELS[(key, pos_norm)]
            return level, "editorial_estimate", "MEDIUM", [
                _source_record(
                    SOURCE_REFS["editorial"],
                    f"cefr_editorial_map.py: ({key!r}, {pos_norm!r})",
                    "curated POS-specific editorial classification for an unrelated homonym where other-POS references do not apply",
                )
            ], True
        if not votes:
            return _editorial(word, pos, refs)
        # Tentative editorial proxy from a different POS; never direct CEFR evidence.
        source = next(name for name in ("evp", "cefrj", "octanove", "oxford") if name in votes)
        vote = votes[source]
        ref = SOURCE_REFS[vote["source"]] if source == "oxford" else SOURCE_REFS[source]
        if source == "oxford":
            locator = f"{vote['file']}:{vote['line']}"
        elif source == "evp":
            locator = f"{vote['file']}:{vote['line']}"
        else:
            locator = f"row {vote['line']}"
        return vote["level"], "editorial_estimate", "LOW", [
            _source_record(ref, locator, "different POS only; not direct CEFR evidence for this entry"),
            _source_record(SOURCE_REFS["editorial"], "method:cross-pos-proxy",
                           "unverified editorial proxy from a reference for a different POS; independent validation required"),
        ], True

    votes = exact_votes
    levels = {v["level"] for v in votes.values()}
    sources: list[dict[str, str]] = []
    groups: set[str] = set()
    for source, vote in votes.items():
        groups.add(INDEPENDENCE_GROUPS[source])
        if source == "cefrj":
            sources.append(_source_record(
                SOURCE_REFS["cefrj"],
                f"row {vote['line']}: headword={vote.get('headword', word.lower())}, pos={vote.get('pos', '')}, CEFR={vote['level']}",
                "published CEFR level for this headword+POS in the CEFR-J Vocabulary Profile 1.5",
            ))
        elif source == "octanove":
            sources.append(_source_record(
                SOURCE_REFS["octanove"],
                f"row {vote['line']}: headword={vote.get('headword', word.lower())}, pos={vote.get('pos', '')}, CEFR={vote['level']}",
                "published C1/C2 level for this headword+POS in the Octanove vocabulary profile 1.0",
            ))
        elif source == "evp":
            sources.append(_source_record(
                SOURCE_REFS["evp"],
                f"{vote['file']}:{vote['line']}: {vote['headword']} ({vote['pos']}, {vote['sense']}) -> {vote['level']}",
                "printed English Vocabulary Profile (EVP) CEFR badge verified in Cambridge Dictionary Online",
            ))
        else:
            sources.append(_source_record(
                SOURCE_REFS[vote["source"]],
                f"{vote['file']}:{vote['line']}: {vote.get('word', word.lower())} ({vote.get('raw_level', '')})",
                "Oxford Learner's Dictionaries wordlist level for this headword+POS",
            ))

    if len(levels) == 1:
        level = levels.pop()
        if len(groups) >= 2 and not mapped_gloss:
            return level, "cross_validated", "HIGH", sources, False
        return level, "source_supported", "HIGH", sources, bool(mapped_gloss)

    # Disagreement: resolve by the documented hierarchy.
    # Oxford sense-level splits are resolved per sense in classify_entry; here
    # Cambridge EVP sense badges rank ahead of headword+POS lists (CEFR-J,
    # Octanove), which in turn rank ahead of Oxford word-level votes.
    order = ["evp", "cefrj", "octanove", "oxford"]
    for source in order:
        if source in votes:
            level = votes[source]["level"]
            break
    else:
        level = sorted(levels, key=CEFR_LEVELS.index)[0]
    disagreement = ", ".join(f"{s}={v['level']}" for s, v in votes.items())
    rationale = (
        f"published references disagree ({disagreement}); "
        f"resolved to {level} by the documented hierarchy (Oxford sense-level, resolved per sense, "
        f"> Cambridge EVP > CEFR-J > Octanove > Oxford word-level); "
        "recorded as disputed, not as verified agreement"
    )
    return (
        level,
        "disputed",
        "MEDIUM",
        sources + [_source_record(SOURCE_REFS["editorial"], "hierarchy", rationale)],
        bool(mapped_gloss),
    )


def _editorial(word: str, pos: str, refs: References) -> tuple[str, str, str, list[dict[str, str]], bool]:
    from cefr_editorial_map import EDITORIAL_LEVELS  # local import: curated data
    for key in headword_variants(word, pos):
        if key in EDITORIAL_LEVELS:
            level = EDITORIAL_LEVELS[key]
            sources = [_source_record(
                SOURCE_REFS["editorial"],
                f"cefr_editorial_map.py: {key}",
                "curated editorial classification; the consulted published CEFR lists do not contain this form+POS",
            )]
            return level, "editorial_estimate", "MEDIUM", sources, True
    key = normalize_word(word)
    rank = getattr(refs, "frequency", {}).get(key)
    if rank is not None:
        if rank <= 2000:
            level, confidence = "B1", "LOW"
        elif rank <= 8000:
            level, confidence = "B2", "LOW"
        else:
            level, confidence = "C1", "VERY_LOW"
        sources = [_source_record(
            SOURCE_REFS["frequency"],
            f"frequency-top30k.csv: rank {rank}",
            "corpus frequency rank only; used solely to propose an editorial band, never as a level source",
        )]
        return level, "editorial_estimate", confidence, sources, True
    return UNCLASSIFIED, "unresolved", "VERY_LOW", [
        _source_record(
            SOURCE_REFS["editorial"],
            "none",
            "no consulted published reference and no curated editorial entry; explicit blocker, not a guess",
        )
    ], True


def _build_rationale(evidence: str, sources: list[dict[str, str]], *, mapped_gloss: bool = False) -> str:
    if evidence == "disputed":
        base = next(s["supports"] for s in sources if s["ref"] == SOURCE_REFS["editorial"])
    elif evidence == "editorial_estimate" and any(s.get("locator") == "method:cross-pos-proxy" for s in sources):
        base = "editorial estimate based only on a reference for a different POS; independent validation required"
    else:
        base = {
            "source_supported": "level taken directly from the cited published CEFR reference",
            "cross_validated": "two or more independent published references agree on this level",
            "editorial_estimate": "not listed in the consulted published CEFR references for this POS; curated editorial estimate, requires two independent validations before it may be treated as verified",
            "unresolved": "no defensible classification reached; explicit blocker",
        }[evidence]
    if mapped_gloss and "mapping" not in base:
        base += "; gloss-to-POS/sense mapping requires independent validation"
    return base


def classify_entry(entry: dict[str, Any], refs: References) -> list[dict[str, Any]]:
    """Build the normalized sense list for one vocabulary row."""
    entry_id = str(entry.get("id", ""))
    word = str(entry.get("word", ""))
    pos = str(entry.get("pos", ""))
    meaning = str(entry.get("meaning", ""))

    # 1. Composite-POS split (e.g. `adj/v`, `n/v`, `adj/n/v`) via reviewed posSplits.
    if "/" in pos:
        pos_splits = getattr(refs, "pos_splits", {})
        split_spec = pos_splits.get(entry_id)
        if not split_spec or any(split_spec.get(k) != v for k, v in (("word", word), ("pos", pos), ("meaning", meaning))):
            raise ValueError(f"missing or stale composite-POS mapping for entry {entry_id} ({word})")
        remainder = meaning
        for item in split_spec["senses"]:
            gloss = item.get("gloss")
            if gloss:
                if gloss not in remainder:
                    raise ValueError(f"invalid or duplicate composite-POS gloss mapping for entry {entry_id} ({word})")
                remainder = remainder.replace(gloss, "", 1)
        if remainder.strip(" \t,;/"):
            raise ValueError(f"composite-POS mapping does not cover the original meaning for entry {entry_id} ({word})")
        glossed_items = [item for item in split_spec["senses"] if item.get("gloss")]
        if not glossed_items:
            raise ValueError(f"composite-POS mapping has no glossed senses for entry {entry_id} ({word})")
        senses: list[dict[str, Any]] = []
        mapped_multi = len(glossed_items) > 1 or len(split_spec["senses"]) > 1
        for idx, item in enumerate(glossed_items, start=1):
            atomic_pos = str(item["pos"]).strip()
            sense_meaning = str(item["gloss"]).strip()
            label = str(item.get("label") or f"({atomic_pos})")
            level, evidence, confidence, sources, _ = _resolve_level(
                refs.votes_for(word, atomic_pos),
                refs,
                word,
                atomic_pos,
                mapped_gloss=mapped_multi,
            )
            sources = list(sources) + [
                _source_record(
                    SOURCE_REFS["sense_mapping"],
                    f"docs/sense-gloss-mappings.json: posSplits.{entry_id} ({atomic_pos}); {split_spec['dictionary']}",
                    "editorial alignment of a composite-POS gloss segment to its atomic part of speech; independent review required",
                )
            ]
            senses.append({
                "senseId": f"{entry_id}-s{idx}",
                "label": label,
                "meaning": sense_meaning,
                "pos": atomic_pos,
                "cefr": level,
                "evidence": evidence,
                "confidence": confidence,
                "sources": sources,
                "rationale": _build_rationale(evidence, sources, mapped_gloss=True),
                "needsIndependentValidation": True,
            })
        return senses

    # 2. Multi-sense Oxford homograph split (annotated senses or explicit mapped homographs like March/march).
    ox_rows = refs.oxford_sense_rows(word, pos)
    distinct = {(r["annotation"], r["sense"]) for r in ox_rows}
    sense_mappings = getattr(refs, "sense_mappings", {})
    if len(ox_rows) >= 2 and (len(distinct) >= 2 or entry_id in sense_mappings):
        mapping = sense_mappings.get(entry_id)
        if not mapping or any(mapping.get(k) != v for k, v in (("word", word), ("pos", pos), ("meaning", meaning))):
            raise ValueError(f"missing or stale sense mapping for entry {entry_id} ({word})")
        mapped = {(item["source"], item["line"]): item for item in mapping["rows"]}
        if len(mapped) != len(mapping["rows"]) or set(mapped) != {(r["file"], r["line"]) for r in ox_rows}:
            raise ValueError(f"sense mapping row set changed for entry {entry_id} ({word})")
        remainder = meaning
        for item in mapping["rows"]:
            gloss = item.get("gloss")
            if gloss:
                if gloss not in remainder or not item.get("dictionary"):
                    raise ValueError(f"invalid or duplicate gloss mapping for entry {entry_id} ({word})")
                remainder = remainder.replace(gloss, "", 1)
        if remainder.strip(" \t,;"):
            raise ValueError(f"sense mapping does not cover the original meaning for entry {entry_id} ({word})")
        senses = []
        evp_by_line = getattr(refs, "evp_by_line", {})
        for row in ox_rows:
            item = mapped[(row["file"], row["line"])]
            # Allow mapping annotation override only when the Oxford row itself has empty annotation/sense (e.g. March vs march)
            if (row["annotation"] or row["sense"]) and (item.get("annotation") != row["annotation"] or item.get("sense") != row["sense"]):
                raise ValueError(f"sense mapping source row changed for entry {entry_id} ({word})")
            if not item.get("gloss"):
                continue
            pos_levels = sorted({row["pos_levels"][p] for p in _pos_variants(pos)
                                 if p in row.get("pos_levels", {})}, key=CEFR_LEVELS.index)
            levels = pos_levels or row["levels"] or sorted({lv for r in ox_rows for lv in r["levels"]}, key=CEFR_LEVELS.index)
            if not levels:
                level, evidence, confidence, sources, _ = _resolve_level(
                    refs.votes_for(word, pos), refs, word, pos, mapped_gloss=True
                )
            else:
                level = levels[0]
                evidence = "source_supported"
                confidence = "HIGH"
                ref_name = SOURCE_REFS[row["source"]]
                sources = [_source_record(
                    ref_name,
                    f"{row['file']}:{row['line']}: {row['word']} (sense {row['sense'] or row['annotation'] or item.get('annotation') or '—'}, level cell {row['raw_level']!r})",
                    "Oxford wordlist prints this CEFR level for this specific sense of the headword",
                )]
                evp_line = item.get("evpLine")
                if evp_line and evp_line in evp_by_line:
                    evp_rec = evp_by_line[evp_line]
                    sources.append(_source_record(
                        SOURCE_REFS["evp"],
                        f"{evp_rec['file']}:{evp_rec['line']}: {evp_rec['headword']} ({evp_rec['pos']}, {evp_rec['sense']}) -> {evp_rec['level']}",
                        "printed English Vocabulary Profile (EVP) CEFR badge verified in Cambridge Dictionary Online for this sense",
                    ))
                    if evp_rec["level"] != level:
                        evidence = "disputed"
                        confidence = "MEDIUM"
                        sources.append(_source_record(
                            SOURCE_REFS["editorial"],
                            "hierarchy",
                            f"published sense references disagree (oxford_sense={level}, evp={evp_rec['level']}); resolved to {level} by the documented hierarchy (Oxford sense-level > Cambridge EVP)",
                        ))
            label = row["annotation"] or (f"sense {row['sense']}" if row["sense"] else item.get("annotation", ""))
            sense_meaning = item["gloss"]
            sources.append(_source_record(
                SOURCE_REFS["sense_mapping"],
                f"docs/sense-gloss-mappings.json: {entry_id}; {item['dictionary']}",
                "editorial alignment of an existing gloss to a dictionary homograph; independent review required",
            ))
            rationale = (
                f"sense-level split from the Oxford wordlists: {row['word']}"
                + (f" ({label})" if label else "")
                + (f" prints level cell {row['raw_level']!r}; the lowest level in the cell ({level}) is used" if len(levels) > 1 else f" at level {level}")
            )
            if pos_levels:
                rationale += f"; POS-specific Oxford cell {pos}. {level}"
            rationale += "; gloss-to-sense mapping requires independent validation"
            senses.append({
                "senseId": item["senseId"],
                "label": label,
                "meaning": sense_meaning,
                "pos": pos,
                "cefr": level,
                "evidence": evidence,
                "confidence": confidence,
                "sources": sources,
                "rationale": rationale,
                "needsIndependentValidation": True,
            })
        return senses

    # 3. Standard atomic-POS entry.
    level, evidence, confidence, sources, needs = _resolve_level(refs.votes_for(word, pos), refs, word, pos)
    return [{
        "senseId": f"{entry_id}-s1",
        "label": "",
        "meaning": meaning,
        "pos": pos,
        "cefr": level,
        "evidence": evidence,
        "confidence": confidence,
        "sources": sources,
        "rationale": _build_rationale(evidence, sources),
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
        elif sense.get("evidence") == "editorial_estimate" and sense.get("needsIndependentValidation") is not True:
            errors.append(f"entry {entry_id} sense {sid}: editorial_estimate requires needsIndependentValidation=true")
        if sense.get("confidence") not in CONFIDENCE_LEVELS:
            errors.append(f"entry {entry_id} sense {sid}: invalid confidence {sense.get('confidence')!r}")
        if not isinstance(sense.get("meaning"), str) or not sense.get("meaning", "").strip():
            errors.append(f"entry {entry_id} sense {sid}: missing meaning")
        if not isinstance(sense.get("pos"), str) or not sense.get("pos", "").strip() or "/" in sense.get("pos", ""):
            errors.append(f"entry {entry_id} sense {sid}: sense pos must be a non-empty atomic POS")
        sources = sense.get("sources")
        if not isinstance(sources, list) or not sources:
            errors.append(f"entry {entry_id} sense {sid}: sources must be a non-empty array")
        else:
            for src in sources:
                if not isinstance(src, dict) or not isinstance(src.get("ref"), str) or not isinstance(src.get("supports"), str):
                    errors.append(f"entry {entry_id} sense {sid}: malformed source record")
    return errors
