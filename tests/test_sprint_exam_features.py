"""Shipped-file contract for the sprint surface and the release version.

Behavioural coverage lives elsewhere and is the authoritative evidence:
`tests/static-app.test.js` imports the real module and exercises the sprint
scheduler, the exam grading policy and the exported result JSON;
`tests/browser-learning.cjs` and `tests/browser-exams.cjs` drive the real
application in Chromium. The few checks here only pin facts that those suites
cannot see about the shipped single file - the release version constant and the
absence of the retired fixed sprint cap - so a regression fails in two
independent places instead of being hidden behind a weakened assertion.
"""
import pathlib
import re
import unittest


class ShippedSprintContractTests(unittest.TestCase):
    def setUp(self):
        self.html = pathlib.Path("index.html").read_text(encoding="utf-8")
        self.app = re.search(r'<script type="module" id="app-script">([\s\S]*?)</script>', self.html)
        self.assertIsNotNone(self.app)
        self.script = self.app.group(1)

    def test_release_version_is_the_rc1_candidate(self):
        self.assertIn("APP_VERSION = 'v1.0.0-rc1'", self.script)
        self.assertIn("export function skipSessionCard(", self.script)
        self.assertIn("export function consolidationTurnNote(", self.script)
        self.assertIn("EXAM_RESULT_SCHEMA_VERSION = '1.0.0'", self.script)

    def test_the_fixed_seven_word_sprint_cap_is_gone(self):
        # The cap was expressed as a constant, a targeted session size and literal
        # "7 từ" copy. Any return of that hidden truncation fails here first, and
        # the behavioural suites fail as well.
        self.assertFalse("SPRINT_SIZE" in self.script, "SPRINT_SIZE must not return")
        self.assertFalse("Học cấp tốc · 7 từ" in self.html, "the bundled banner must not claim 7 words")
        self.assertFalse("giới hạn 7 lượt" in self.html, "the bundled copy must not claim a 7-turn limit")

    def test_the_sprint_uses_the_configured_session_size(self):
        self.assertIn("selectSprintSession(vocabulary, progress, { size: prefs.sessionSize })", self.script)
        self.assertIn("function sprintEligibleCount", self.script)
        # Throughput work must not reintroduce a fixed dwell timer; the hand-off is
        # decided by one exported predicate and happens immediately.
        self.assertNotIn("SPRINT_AUTO_ADVANCE_MS", self.script)
        self.assertFalse(re.search(r"setTimeout\(\s*\(\)\s*=>\s*\{?\s*advanceCard", self.script),
                         "advancing must not be scheduled on a timer")
        self.assertIn("function shouldHandOffImmediately", self.script)
        self.assertIn("shouldHandOffImmediately({", self.script)
        self.assertIn("consolidation: item.consolidation, revealed", self.script)

    def test_sprint_uses_the_adaptive_retrieval_ladder(self):
        # The sprint must not fall back to the attempt-count rotation that the other
        # sessions still use; that rotation is what made every never-graded word a
        # four-option recognition question.
        self.assertIn("export function sprintRetrievalDemand", self.script)
        self.assertIn("function questionModeFor(item)", self.script)
        self.assertIn("if (sessionStats?.mode === 'sprint') return sprintRetrievalDemand(item.progress);",
                      self.script)
        self.assertIn("mode = choices[(progress.correctCount + progress.wrongCount) % choices.length];",
                      self.script)

    def test_sprint_consolidation_is_bounded_and_practice_class(self):
        self.assertIn("export function queueConsolidation", self.script)
        self.assertIn("export function sprintTurnBudget", self.script)
        self.assertIn("export const SPRINT_CONSOLIDATION_GAP = 3;", self.script)
        self.assertIn("needsConsolidationTurn({ correct, demand })", self.script)
        # The delayed check is graded in its own branch, never through updateProgress
        # and never through the practice counters.
        self.assertIn("} else if (item.consolidation) {", self.script)
        self.assertIn("consolidation: item.consolidation === true", self.script)
        self.assertIn("consolidation: item.consolidation, revealed", self.script)
        self.assertNotIn("sprintRetrievalDemand(updated)", self.script)
        self.assertNotIn("updateProgress(progress[item.vocab.id], correct, Date.now() - questionStarted);\n      progress[item.vocab.id] = updated;\n      item.progress = updated;\n    } else if (item.consolidation)",
                         self.script)

    def test_sprint_is_not_exempt_from_corrective_practice(self):
        # Sprint once skipped the corrective retry while still telling the learner
        # a retry had been queued.
        self.assertFalse("sessionStats.mode !== 'sprint'" in self.script,
                         "sprint must not be exempt from corrective practice")
        self.assertIn("if (!correct && queuePractice(session, item))", self.script)


if __name__ == "__main__":
    unittest.main()
