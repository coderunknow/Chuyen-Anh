"""Offline checks for ``scripts/build_flashcards.py`` and ``flashcards.html``.

The single-file app is generated from the repository sources, so the guarantees
worth testing are:

* the derived data really comes from ``Learned_Vocabulary_List.md`` plus the
  curated exam notes (300 documented words keep their family / distinction /
  citation and stay traceable to a real line in ``De-chuyen-Anh-vao-10/``),
* the artifact committed in the repository matches what the builder produces
  now (no stale file, same data fingerprint),
* the output stays one self-contained offline file whose script and stylesheet
  still agree on element ids.
"""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "build_flashcards.py"
ARTIFACT = ROOT / "flashcards.html"
TEMPLATE = ROOT / "src" / "flashcards" / "template.html"
STYLESHEET = ROOT / "src" / "flashcards" / "style.css"
APP = ROOT / "src" / "flashcards" / "app.js"
PRONUNCIATION = ROOT / "data" / "pronunciation.json"

spec = importlib.util.spec_from_file_location("build_flashcards", SCRIPT)
builder = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(builder)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _payload_from_artifact() -> dict:
    match = re.search(r'<script type="application/json" id="ca-data">(.*?)</script>', _read(ARTIFACT), re.S)
    assert match, "flashcards.html must embed the study data"
    return json.loads(match.group(1))


class DerivedDataTests(unittest.TestCase):
    """The study data must stay traceable to the repository sources."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.payload = builder.build_payload()
        cls.entries = cls.payload["entries"]
        cls.by_id = {entry["id"]: entry for entry in cls.entries}
        cls.documented = [entry for entry in cls.entries if entry["documented"]]

    def test_payload_covers_the_learned_list(self) -> None:
        rows = builder.load_learned()
        self.assertEqual(len(rows), 913)
        self.assertEqual([entry["id"] for entry in self.entries], [row["id"] for row in rows])
        self.assertEqual(len(self.by_id), len(self.entries), "ids must be unique")
        words = [entry["word"].casefold() for entry in self.entries]
        self.assertEqual(len(set(words)), len(words), "headwords must be unique")
        for entry, row in zip(self.entries, rows):
            with self.subTest(word=entry["word"]):
                self.assertEqual(entry["word"], row["word"])
                self.assertEqual(entry["pos"], row["pos"])

    def test_payload_meta_describes_the_data(self) -> None:
        meta = self.payload["meta"]
        self.assertEqual(meta["total"], len(self.entries))
        self.assertEqual(meta["documented"], len(self.documented))
        self.assertEqual(meta["cloze"], sum(1 for entry in self.entries if entry.get("cloze")))
        self.assertEqual(meta["withIpa"], sum(1 for entry in self.entries if entry["ipa"]))
        self.assertEqual(sum(meta["levelCounts"].values()), len(self.entries))
        self.assertEqual(sum(meta["tierCounts"].values()), len(self.entries))
        self.assertEqual(meta["sourceList"], "Learned_Vocabulary_List.md")
        for source in ("Learned_Vocabulary_List.md", "data/vocabulary.json", "docs/vocabulary-300-evidence.json"):
            self.assertIn(source, meta["sources"])
        for key in ("level", "tier", "corpus", "ipa"):
            self.assertTrue(meta["notes"].get(key), f"meta.notes.{key} explains the derivation")
        self.assertIn(str(meta["total"]), meta["title"])

    def test_every_entry_is_study_ready(self) -> None:
        allowed_pos = {"n", "v", "adj", "adv", "idiom", "phrasal v", "collocation", "phrase", "prep phrase", "conj", "grammar"}
        for entry in self.entries:
            with self.subTest(word=entry["word"]):
                self.assertTrue(entry["word"].strip())
                self.assertTrue(entry["meaning"].strip())
                self.assertLessEqual(len(entry["meaning"]), 400, "meanings stay readable on a card")
                self.assertIn(entry["level"], (1, 2, 3, 4, 5))
                self.assertIn(entry["tier"], (1, 2, 3))
                self.assertGreaterEqual(entry["syllables"], 1)
                self.assertGreaterEqual(entry["corpusFiles"], 0)
                self.assertNotIn("**", entry["meaning"])
                self.assertNotIn("<", entry["meaning"])
                parts = {part.strip() for part in entry["pos"].split("/")}
                self.assertTrue(parts <= allowed_pos, f"unknown part of speech: {entry['pos']}")
                if entry["ipa"]:
                    self.assertRegex(entry["ipa"], r"^/[^/\d]+/$")
                    self.assertNotRegex(entry["ipa"], r"[A-Z]")
                else:
                    self.assertEqual(entry["ipa"], "", "words without a dictionary entry carry an empty IPA")

    def test_documented_entries_are_grounded(self) -> None:
        self.assertEqual(len(self.documented), 300)
        for entry in self.documented:
            with self.subTest(word=entry["word"]):
                self.assertGreater(len(entry["family"]), 10, "word family note")
                self.assertGreater(len(entry["distinction"]), 30, "distinction note")
                self.assertNotIn("**", entry["family"] + entry["distinction"])
                self.assertTrue(entry["ref"]["path"].startswith("De-chuyen-Anh-vao-10/"))
                self.assertGreater(entry["ref"]["line"], 0)
                self.assertIn("/blob/", entry["ref"]["url"])
                if entry["example"]:
                    self.assertGreater(len(entry["example"]), 25, "short exam fragments are dropped")
                    self.assertIn(entry["exampleForm"].casefold(), entry["example"].casefold())
                    self.assertNotRegex(entry["example"], r"\|\s*[A-D]\.")
                    self.assertNotIn("**", entry["example"])
                if entry.get("cloze"):
                    self.assertEqual(entry["cloze"]["answer"].casefold(), entry["cloze"]["form"].casefold())
                    if entry["example"]:
                        self.assertIn(entry["cloze"]["form"].casefold(), entry["example"].casefold())

    def test_documented_sources_point_at_real_lines(self) -> None:
        cache: dict[str, list[str]] = {}
        for entry in self.documented:
            with self.subTest(word=entry["word"]):
                path = ROOT / entry["ref"]["path"]
                self.assertTrue(path.is_file(), f"missing source file for {entry['word']}")
                if entry["ref"]["path"] not in cache:
                    cache[entry["ref"]["path"]] = _read(path).splitlines()
                lines = cache[entry["ref"]["path"]]
                self.assertLessEqual(entry["ref"]["line"], len(lines))
                at = entry["ref"]["line"] - 1
                window = " ".join(lines[max(0, at - 2):at + 3]).casefold()
                form = (entry.get("exampleForm") or (entry.get("cloze") or {}).get("form") or entry["word"]).casefold()
                self.assertIn(form, window, "the cited paragraph really contains the word")
                if entry["example"]:
                    self.assertIn(form, entry["example"].casefold(), "the example sentence shows the word")

    def test_cloze_items_are_usable(self) -> None:
        cloze = [entry for entry in self.entries if entry.get("cloze")]
        self.assertGreaterEqual(len(cloze), 200)
        self.assertEqual(len(cloze), self.payload["meta"]["cloze"])
        for entry in cloze:
            with self.subTest(word=entry["word"]):
                text = entry["cloze"]["text"]
                self.assertEqual(text.count("_____"), 1, "exactly one blank per sentence")
                self.assertNotRegex(text.replace("_____", ""), r"_{3,}", "no leftover blanks from the exam")
                self.assertGreaterEqual(len(text.replace("_____", entry["cloze"]["answer"])), 40,
                                        "the sentence keeps enough context to guess the word")
                self.assertNotIn("**", text)
                self.assertNotIn("<", text)
                self.assertNotRegex(text, r"\|\s*[A-D]\.")
                self.assertIn(entry["cloze"]["answer"].casefold(), text.replace("_____", entry["cloze"]["answer"].casefold()).casefold())

    def test_difficulty_levels_are_ordered_and_clamped(self) -> None:
        self.assertEqual({entry["level"] for entry in self.entries}, {1, 2, 3, 4, 5})
        self.assertEqual(builder.difficulty_level(-1), 1)
        self.assertEqual(builder.difficulty_level(99), 5)
        easy = builder.difficulty_score({"word": "cat", "pos": "n", "documented": False, "corpusFiles": 20, "syllables": 1})
        hard = builder.difficulty_score({"word": "indefatigable", "pos": "adj", "documented": False, "corpusFiles": 0, "syllables": 6})
        self.assertLess(easy, hard)
        self.assertGreaterEqual(builder.difficulty_level(hard), 3)
        self.assertLessEqual(builder.difficulty_level(2.0, coverage=30), 2, "well covered words stay approachable")

    def test_priority_tiers_follow_exam_coverage(self) -> None:
        for entry in self.entries:
            with self.subTest(word=entry["word"]):
                expected = builder.priority_tier(entry)
                self.assertEqual(entry["tier"], expected)
                if entry["documented"] or entry["corpusFiles"] >= 8:
                    self.assertEqual(entry["tier"], 1)
                elif entry["corpusFiles"] >= 3:
                    self.assertEqual(entry["tier"], 2)
                else:
                    self.assertEqual(entry["tier"], 3)
        counts = self.payload["meta"]["tierCounts"]
        self.assertEqual(counts["1"], sum(1 for entry in self.entries if entry["tier"] == 1))
        self.assertEqual(counts["2"], sum(1 for entry in self.entries if entry["tier"] == 2))
        self.assertEqual(counts["3"], sum(1 for entry in self.entries if entry["tier"] == 3))

    def test_frequency_reflects_the_exam_corpus(self) -> None:
        counts = [entry["corpusFiles"] for entry in self.entries]
        self.assertGreater(max(counts), 5, "some words appear in several exams")
        self.assertGreater(sum(1 for value in counts if value == 0), 50, "most words are not everywhere")
        self.assertLessEqual(max(counts), self.payload["meta"]["corpusFiles"])
        self.assertEqual(sum(1 for value in counts if value), self.payload["meta"]["grounded"])

    def test_pronunciation_data_is_complete_and_licensed(self) -> None:
        pronunciation = json.loads(_read(PRONUNCIATION))
        words = pronunciation["words"]
        self.assertGreaterEqual(len(words), 800)
        self.assertEqual(pronunciation["count"], len(words))
        self.assertIn("CMU", pronunciation["source"])
        self.assertIn("BSD-2", pronunciation["license"])
        for key, value in list(words.items())[:200]:
            with self.subTest(word=key):
                self.assertRegex(key, r"^[^|]+\|[^|]+$")
                self.assertTrue(value["ipa"].startswith("/") and value["ipa"].endswith("/"))
                self.assertGreaterEqual(value["syllables"], 1)
        expected = {f"{entry['word']}|{entry['pos']}".casefold() for entry in self.entries if entry["ipa"]}
        self.assertTrue(expected)
        self.assertEqual(self.payload["meta"]["withIpa"], len(expected))
        self.assertEqual(set(words) & expected, expected, "every card with IPA has a dictionary record")

    def test_helpers_handle_text_edge_cases(self) -> None:
        rich = builder.split_documented(
            "nghĩa gốc. **Họ từ:** acquire (v), acquisition (n). "
            "**Phân biệt:** khác với obtain. "
            "**Nguồn:** [2025/ba-ria-vung-tau/so.md:102]"
            "(https://github.com/coderunknow/Chuyen-Anh/blob/main/De-chuyen-Anh-vao-10/2025/ba-ria-vung-tau/so.md#L102) "
            "(dạng trong nguồn: acquire)."
        )
        self.assertEqual(rich["meaning"], "nghĩa gốc.")
        self.assertIn("acquisition", rich["family"])
        self.assertIn("obtain", rich["distinction"])
        self.assertEqual(rich["source_path"], "2025/ba-ria-vung-tau/so.md")
        self.assertEqual(rich["source_line"], 102)
        self.assertEqual(rich["source_form"], "acquire")
        self.assertTrue(rich["source_url"].endswith("so.md#L102"))
        partial = builder.split_documented("nghĩa. **Họ từ:** a (v). **Phân biệt:** b.")
        self.assertEqual(partial["family"], "a (v).")
        self.assertEqual(partial["distinction"], "b.")
        self.assertEqual(partial["citation"], "")
        plain = builder.split_documented("chỉ có nghĩa")
        self.assertEqual(plain["meaning"], "chỉ có nghĩa")
        self.assertFalse(plain["citation"])
        self.assertFalse(builder.cloze_ready("| **A.** one | **B.** two | **C.** three |", "one"))
        self.assertFalse(builder.cloze_ready("Too short.", "short"))
        self.assertFalse(builder.usable_context("(DEDICATE)", "dedicate", 1))
        self.assertTrue(builder.cloze_ready("Schools should recognise students' use of AI tools.", "tools"))
        self.assertEqual(builder.clean_excerpt("**3. **In today's <u>job</u> market\\_\\_\\_ we \\*adapt\\*."),
                         "In today's job market___ we *adapt*.")
        self.assertEqual(builder.letters_only("Throw one's hat-in the ring"), "throwoneshatinthering")
        self.assertEqual(builder.strip_accents("Nghịch cảnh"), "Nghich canh")
        self.assertEqual(builder.syllable_count("ubiquitous"), 4)

    def test_inflection_forms_cover_regular_morphology(self) -> None:
        self.assertIn("deteriorated", builder.inflection_forms("deteriorate"))
        self.assertIn("deteriorating", builder.inflection_forms("deteriorate"))
        self.assertIn("carries", builder.inflection_forms("carry"))
        self.assertIn("carried", builder.inflection_forms("carry"))
        self.assertIn("matches", builder.inflection_forms("match"))
        phrase = builder.inflection_forms("menial task")
        self.assertEqual(phrase[0], "menial task", "the exact headword is always matched first")

    def test_fingerprint_is_stable_and_ignores_pronunciation(self) -> None:
        first = builder.fingerprint(self.payload)
        self.assertEqual(len(first), 64)
        self.assertRegex(first, r"^[0-9a-f]{64}$")
        self.assertEqual(first, builder.fingerprint(builder.build_payload()))
        self.assertEqual(first, self.payload["meta"]["fingerprint"])
        other = json.loads(json.dumps(self.payload))
        other["entries"][0]["ipa"] = "/test/"
        other["entries"][0]["syllables"] = 9
        self.assertEqual(builder.fingerprint(other), first, "pronunciation is optional metadata")
        other["entries"][0]["meaning"] = "nghĩa khác"
        self.assertNotEqual(builder.fingerprint(other), first, "study data changes the fingerprint")

    def test_json_payload_is_inert_inside_script_tags(self) -> None:
        text = builder.json_for_script({"x": "</script><script>alert(1)</script>", "y": "a & b"})
        self.assertNotIn("</script>", text)
        self.assertNotIn("<", text)
        self.assertEqual(json.loads(text), {"x": "</script><script>alert(1)</script>", "y": "a & b"})


class ArtifactTests(unittest.TestCase):
    """flashcards.html has to stay fresh, self-contained and wired up."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.html = _read(ARTIFACT)
        cls.payload = _payload_from_artifact()

    def test_artifact_matches_the_builder(self) -> None:
        self.assertTrue(ARTIFACT.is_file(), "run: python3 scripts/build_flashcards.py")
        with contextlib.redirect_stdout(io.StringIO()) as captured:
            code = builder.main(["--check"])
        self.assertEqual(code, 0, f"flashcards.html is stale, rebuild it ({captured.getvalue().strip()})")
        self.assertEqual(self.payload["meta"]["fingerprint"], builder.fingerprint(builder.build_payload()))
        self.assertEqual(self.payload["meta"]["total"], len(self.payload["entries"]))

    def test_artifact_is_one_offline_file(self) -> None:
        size = len(self.html.encode("utf-8"))
        self.assertGreater(size, 200_000, "the whole vocabulary travels inside the file")
        self.assertLess(size, 1_500_000, "still a single shareable file")
        self.assertRegex(self.html, r"^<!doctype html>")
        self.assertNotRegex(self.html, r"\{\{[A-Z_]+\}\}", "every template placeholder is filled")
        self.assertNotIn("<script src=", self.html)
        self.assertNotIn("<link rel=\"stylesheet\"", self.html)
        self.assertNotIn("@import", self.html)
        self.assertNotIn("fetch(", self.html)
        self.assertNotIn("XMLHttpRequest", self.html)
        self.assertNotIn("src/flashcards", self.html, "app.js and style.css are inlined, not linked")
        self.assertIn("<style>", self.html)
        self.assertIn('id="ca-data"', self.html)
        self.assertIn("localStorage", self.html)
        for url in re.findall(r'(?:src|href)="(https?://[^"]+)"', self.html):
            self.assertIn("github.com/coderunknow/Chuyen-Anh", url, "only citation links go online")

    def test_artifact_keeps_every_documented_word(self) -> None:
        documented = [entry for entry in self.payload["entries"] if entry["documented"]]
        self.assertEqual(len(documented), 300)
        for entry in documented[:40]:
            with self.subTest(word=entry["word"]):
                self.assertTrue(entry["family"])
                self.assertTrue(entry["distinction"])
                self.assertIn("path", entry["ref"])
        self.assertEqual(self.payload["entries"][-1]["id"], "913")
        self.assertIn("913", self.html)

    def test_template_and_app_agree_on_element_ids(self) -> None:
        template = _read(TEMPLATE)
        app = _read(APP)
        ids = re.findall(r'\bid="([^"]+)"', template)
        self.assertEqual(len(ids), len(set(ids)), "duplicated id in the template")
        patterns = [
            re.compile(r"\$\$?\(\s*'#([\w-]+)"),
            re.compile(r"getElementById\(\s*'([\w-]+)'"),
            re.compile(r"querySelector(?:All)?\(\s*'#([\w-]+)"),
        ]
        referenced: set[str] = set()
        for pattern in patterns:
            for value in pattern.findall(app):
                # '#view-' + name / '#nav-' + name are built at runtime.
                if not value.endswith("-"):
                    referenced.add(value)
        self.assertTrue(referenced, "the app looks up its elements by id")
        missing = sorted(referenced - set(ids))
        self.assertEqual(missing, [], f"app.js points at ids that the template does not define: {missing}")

    def test_stylesheet_defines_every_variable_it_uses(self) -> None:
        css = _read(STYLESHEET)
        self.assertEqual(css.count("{"), css.count("}"), "balanced blocks")
        defined = set(re.findall(r"(--[\w-]+)\s*:", css))
        used = set(re.findall(r"var\((--[\w-]+)", css))
        self.assertEqual(sorted(used - defined), [], "no undefined custom property")
        for token in ("--bg", "--text", "--accent", "--line", "--scale"):
            self.assertIn(token, defined)
        self.assertIn('[data-theme="light"]', css, "a light theme ships with the dark default")

    def test_artifact_keeps_accessibility_basics(self) -> None:
        for snippet in [
            'lang="vi"',
            'name="viewport"',
            'aria-live="polite"',
            'class="skip-link"',
            'aria-label="Khu vực chính"',
            "prefers-reduced-motion",
            "focus-visible",
            "color-scheme: dark",
            "color-scheme: light",
            'id="btn-help"',
            'aria-label=',
            "<main",
            "<nav",
            "aria-modal",
        ]:
            with self.subTest(snippet=snippet):
                self.assertIn(snippet, self.html)


if __name__ == "__main__":
    unittest.main()
