import pathlib, re, unittest

class SprintExamFeatureTests(unittest.TestCase):
    def setUp(self):
        self.html = pathlib.Path("index.html").read_text(encoding="utf-8")
        self.app = re.search(r'<script type="module" id="app-script">([\s\S]*?)</script>', self.html)
        self.assertIsNotNone(self.app)
        self.script = self.app.group(1)

    def test_sprint_constants_and_ui(self):
        self.assertIn("APP_VERSION = 'v1.0.0-dev4'", self.script)
        self.assertIn("EXAM_RESULT_SCHEMA_VERSION = '1.0.0'", self.script)
        self.assertIn("SPRINT_SIZE = 7", self.script)
        self.assertIn("SPRINT_LABEL", self.script)
        self.assertIn("selectSprintSession", self.script)
        self.assertIn("sprint-banner", self.html)
        self.assertIn("Học cấp tốc", self.html)
        # bounded session: priority due/weak/new, deterministic, no shuffle in sprint path
        self.assertRegex(self.script, r"function selectSprintSession")
        # ensure sprint does not shuffle - extract function body
        start = self.script.find("function selectSprintSession")
        sprint_body = self.script[start:start+3000]
        self.assertIn("return ordered.map", sprint_body)
        self.assertNotIn("shuffle(", sprint_body.lower())
        # single grading: sprint mode should not queue practice
        self.assertIn("sessionStats.mode !== 'sprint'", self.script)

    def test_exam_grading_verified_only(self):
        self.assertIn("function getQuestionVerification", self.script)
        self.assertIn("function gradeExamQuestion", self.script)
        self.assertIn("function buildExamResultJson", self.script)
        self.assertIn("function examResultFilename", self.script)
        self.assertIn("ungraded", self.script)
        # verified-only: returns ungraded when not verified
        self.assertRegex(self.script, r"if \(verification\.status !== 'verified'\)")
        self.assertIn("Chưa có đáp án được xác minh", self.script)
        # JSON summary+download with source/provenance
        self.assertIn("examResultFilename", self.script)
        self.assertIn("ket-qua-", self.script)
        self.assertIn("Blob", self.script)
        self.assertIn("application/json", self.script)
        # provenance per-question
        self.assertIn("sourceLine", self.script)
        self.assertIn("verificationStatus", self.script)

    def test_submission_summary_counts(self):
        self.assertIn("graded", self.script)
        self.assertIn("correct", self.script)
        self.assertIn("incorrect", self.script)
        self.assertIn("accuracy", self.script.lower())
        # summary should show graded/correct/incorrect/ungraded
        self.assertRegex(self.script, r"graded.*correct.*incorrect.*ungraded", re.I | re.S)

    def test_dashboard_weak_spotlight_and_search_highlight(self):
        self.assertIn("weak-spotlight", self.script)
        self.assertIn('[data-session="weak"]', self.script)
        self.assertIn("<mark>", self.script)
        self.assertIn("RegExp", self.script)

if __name__ == "__main__":
    unittest.main()
