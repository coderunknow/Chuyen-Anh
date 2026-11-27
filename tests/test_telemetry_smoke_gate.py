"""Structural contract for the production telemetry smoke workflow.

The telemetry smoke probe is the only repository automation that WRITES to the
production database (it stores one synthetic report per run). Its trigger
surface is therefore a security property, not a style preference: PR #88
showed that an automatic `pull_request` trigger turns opening a PR into an
unintended production write (one synthetic row was stored that way before the
run could be cancelled, 2026-11-17).

This suite parses the workflow's real YAML (not a textual claim) and pins:

* no automatic trigger at all — no `pull_request`, no `push`, no schedule;
* a `workflow_dispatch` trigger whose inputs force a deliberate confirmation
  of the production write and a declared, format-checked deployment identity;
* a `concurrency` group so two dispatches cannot race;
* least privilege (`contents: read`), the pinned checkout action, and the
  probe step that actually exercises the deployed endpoint.
"""

import re
import unittest
from pathlib import Path

# Declared dependency of this suite (tests/requirements.txt): the gate parses
# the workflow's real YAML instead of trusting a textual claim. When PyYAML is
# missing the tests skip with that reason instead of erroring at import — a
# fresh checkout must collect the same test count everywhere; CI installs the
# pinned requirement before `unittest discover` so the gate always runs there.
try:
    import yaml
except ImportError:  # pragma: no cover - exercised by the skip path
    yaml = None

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "telemetry-smoke.yml"
CHECKOUT_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1"


def load() -> dict:
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


@unittest.skipUnless(
    yaml is not None,
    "PyYAML is required to parse telemetry-smoke.yml (pip install -r tests/requirements.txt; CI installs it)",
)
class TelemetrySmokeGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.doc = load()

    def test_the_workflow_has_no_automatic_trigger(self) -> None:
        on_block = self.doc.get(True) or self.doc.get("on") or {}
        self.assertIsInstance(on_block, dict, "`on:` must be a mapping of explicit triggers")
        self.assertEqual(
            set(on_block.keys()), {"workflow_dispatch"},
            f"the production-writing probe must not trigger automatically; found: {sorted(on_block)}"
        )

    def test_dispatch_requires_the_production_write_confirmation(self) -> None:
        inputs = self.doc[True]["workflow_dispatch"]["inputs"]
        self.assertIn("confirm_production_write", inputs)
        confirmation = inputs["confirm_production_write"]
        self.assertEqual(confirmation.get("type"), "boolean")
        self.assertEqual(confirmation.get("required"), True)
        self.assertIn("production", confirmation.get("description", "").lower(),
                      "the input must name the production write it confirms")

    def test_dispatch_requires_a_verified_deployment_identity(self) -> None:
        inputs = self.doc[True]["workflow_dispatch"]["inputs"]
        self.assertIn("deployment_identity", inputs)
        identity = inputs["deployment_identity"]
        self.assertEqual(identity.get("required"), True)
        self.assertIn("deployed", identity.get("description", "").lower())
        # ChatGPT round-2 finding: the audit trail must not overstate what the
        # workflow verified. It has no Vercel credentials, so the input is a
        # caller DECLARATION: the description says so, the step is named
        # accordingly, and the recorded summary line must not claim an
        # independently verified identity.
        self.assertIn("declares", identity.get("description", "").lower())
        self.assertIn("not independently verified", identity.get("description", "").lower())
        steps = self.doc["jobs"]["probe"]["steps"]
        identity_step = next(step for step in steps if "deployment identity" in step.get("name", "").lower())
        self.assertIn("declared", identity_step["name"].lower())
        run = identity_step["run"]
        # The string is format-checked (Vercel deployment id or commit SHA) so
        # the audit trail cannot record an arbitrary label.
        self.assertRegex(run, r"grep -Eq")
        self.assertRegex(run, r"dpl_")
        self.assertIn("caller-declared", run)
        self.assertNotIn("deployed revision: $DEPLOYMENT_IDENTITY", run,
                         "the summary must not present the declared id as a resolved/verified deployment")

    def test_a_missing_confirmation_fails_before_any_checkout(self) -> None:
        steps = self.doc["jobs"]["probe"]["steps"]
        gate = steps[0]
        self.assertIn("confirm_production_write != true", gate.get("if", ""),
                      "the first step must refuse to run without the confirmation")
        self.assertIn("exit 1", gate.get("run", ""), "the gate must fail the job")
        # The checkout must be conditional on the confirmation so the probe
        # script never even downloads without it.
        checkout = next(step for step in steps if "actions/checkout" in str(step.get("uses", "")))
        self.assertEqual(checkout.get("if"), "${{ inputs.confirm_production_write == true }}")

    def test_dispatches_cannot_race_or_replay(self) -> None:
        concurrency = self.doc.get("concurrency") or {}
        self.assertIn("group", concurrency, "dispatches must serialise on a concurrency group")
        self.assertEqual(concurrency.get("cancel-in-progress"), False,
                         "a queued probe must not be silently cancelled and retried")

    def test_least_privilege_and_pinned_actions(self) -> None:
        self.assertEqual(self.doc["permissions"], {"contents": "read"})
        steps = self.doc["jobs"]["probe"]["steps"]
        for step in steps:
            uses = step.get("uses")
            if not uses:
                continue
            self.assertIn(f"@{CHECKOUT_SHA}", uses,
                          f"every action must pin the repository's Node-24 SHA: {uses}")
            self.assertNotIn("v4", uses.split("@", 1)[1],
                             "no mutable tag comments after the SHA")

    def test_the_probe_step_exercises_the_deployed_endpoint_script(self) -> None:
        steps = self.doc["jobs"]["probe"]["steps"]
        probe = next(step for step in steps if "run" in step and "telemetry_endpoint_smoke" in step["run"])
        self.assertIn("python", probe["run"], "the probe runs the repository's endpoint script")
        self.assertTrue((ROOT / "tests" / "telemetry_endpoint_smoke.py").exists(),
                        "the probe script must be tracked at the referenced path")
        # The probe script itself must still be the production-writing contract
        # (it POSTs a valid report); this keeps the test honest about what the
        # workflow would do once dispatched with the confirmation.
        source = (ROOT / "tests" / "telemetry_endpoint_smoke.py").read_text(encoding="utf-8")
        self.assertRegex(source, r'call\("POST"')

    def test_the_timeout_is_bounded(self) -> None:
        job = self.doc["jobs"]["probe"]
        self.assertLessEqual(int(job["timeout-minutes"]), 10,
                             "a production-writing job must not hang past its bound")


if __name__ == "__main__":
    unittest.main()
