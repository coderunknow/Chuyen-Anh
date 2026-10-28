"""Every corpus locator must open on a line that shows what it claims.

Provenance is only worth something if a reader can check it. A locator such as
`2025/hai-phong/so.md:L301` has to name a real file and a real line, and that
line has to contain the form the claim talks about. This caught a real defect:
when the exam body started being filtered (front matter, the archive's own
"Nguồn và giới hạn" section and its blockquotes are not exam text), the line
numbers were computed on the filtered text, so every locator drifted by the
number of removed lines and pointed at empty lines or at unrelated sentences.

The test also pins the wording for multi-word headwords: their count is the
number of papers where *every* word occurs, while the locator line shows only
the rarest one, so the claim must say that instead of claiming the phrase.
"""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAM_ROOT = ROOT / "De-chuyen-Anh-vao-10"
LOCATOR_RE = re.compile(r"(?P<path>.+\.md):L(?P<line>\d+)$")
SHOWN_RE = re.compile(r"shows '(?P<form>[^']+)'")
FORM_RE = re.compile(r"form '(?P<form>[^']+)' occurs")


class EvidenceLocatorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        vocabulary = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))
        cls.rows = vocabulary["entries"] if isinstance(vocabulary, dict) else vocabulary
        phrases = json.loads((ROOT / "data" / "phrases.json").read_text(encoding="utf-8"))
        cls.phrases = phrases["phrases"] if isinstance(phrases, dict) else phrases
        cls._lines: dict[str, list[str]] = {}

    def lines_of(self, relative: str) -> list[str]:
        if relative not in self._lines:
            path = EXAM_ROOT / relative
            self.assertTrue(path.exists(), f"locator names a missing file: {relative}")
            self._lines[relative] = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return self._lines[relative]

    def locators(self, rows: list[dict], label: str):
        for row in rows:
            for source in row.get("sources") or []:
                locator = source.get("locator", "")
                if not locator.endswith(".md") and ":L" not in locator:
                    continue
                match = LOCATOR_RE.match(locator)
                if not match:
                    continue
                surface = row.get("word") or row.get("phrase") or ""
                yield label, row, source, match, surface

    def test_every_corpus_locator_shows_its_form(self) -> None:
        checked = 0
        for label, row, source, match, surface in list(self.locators(self.rows, "vocabulary")) + list(
            self.locators(self.phrases, "phrases")
        ):
            lines = self.lines_of(match.group("path"))
            number = int(match.group("line"))
            self.assertGreaterEqual(number, 1, f"{surface}: {source['locator']} is not a 1-based line")
            self.assertLessEqual(
                number, len(lines), f"{surface}: {source['locator']} is past the end of the file"
            )
            line = lines[number - 1]
            claim = source.get("supports", "")
            shown = SHOWN_RE.search(claim) or FORM_RE.search(claim)
            target = shown.group("form") if shown else surface.split()[0]
            self.assertIn(
                target.lower(),
                line.lower(),
                f"{label} {surface}: the cited line does not show {target!r}\n"
                f"  locator: {source['locator']}\n  line: {line[:120]!r}",
            )
            checked += 1
        self.assertGreater(checked, 4000, "the corpus locators were not actually walked")

    def test_phrase_claims_count_papers_not_lines(self) -> None:
        """`phrase occurs in N transcribed exam(s)` must mean N papers.

        The first build counted matching *lines*, so a phrase seen twice in one
        paper claimed two papers (67 of 160 sampled rows were overstated).
        """
        import sys

        sys.path.insert(0, str(ROOT / "scripts"))
        from build_phrases import LineIndex  # noqa: PLC0415 — heavy import, test-only

        index = LineIndex(ROOT)
        checked = 0
        for row in self.phrases:
            claims = [s for s in row.get("sources") or [] if s.get("ref") == "phrase-corpus"]
            if not claims:
                continue
            hits = index.occurrences(row["phrase"])
            papers = {hit[0] for hit in hits}
            match = re.search(r"occurs in (\d+) transcribed exam", claims[0]["supports"])
            self.assertIsNotNone(match, f"{row['phrase']}: corpus claim without a count")
            self.assertEqual(
                int(match.group(1)),
                len(papers),
                f"{row['phrase']}: claims {match.group(1)} paper(s), the corpus shows {len(papers)}",
            )
            checked += 1
        self.assertGreater(checked, 400, "phrase claims were not actually walked")

    def test_multi_word_headwords_do_not_claim_the_whole_phrase(self) -> None:
        seen = 0
        for row in self.rows:
            if len(row["word"].split()) == 1:
                continue
            claims = [s for s in row.get("sources") or [] if s.get("ref") == "exam-corpus"]
            for source in claims:
                text = source.get("supports", "")
                if FORM_RE.search(text):
                    # A claim that names one exact surface form is fine whatever
                    # the headword looks like: it says what the line shows.
                    continue
                seen += 1
                self.assertRegex(
                    text,
                    r"^headword words occur in \d+ transcribed exam\(s\); the locator shows '[^']+'$",
                    f"{row['word']}: a multi-word headword cannot claim the phrase itself",
                )
        self.assertGreaterEqual(seen, 25, "multi-word claims were not actually walked")


if __name__ == "__main__":
    unittest.main()
