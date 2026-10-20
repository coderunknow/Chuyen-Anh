"""Regression tests for the deploy-hold gate (scripts/deploy_gate.py) and its workflow."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load_module():
    spec = importlib.util.spec_from_file_location('deploy_gate', ROOT / 'scripts' / 'deploy_gate.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReadHoldTests(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()
        self.tmp = tempfile.TemporaryDirectory(prefix='hold-test-')
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)

    def write(self, text):
        (self.root / self.mod.HOLD_FILE).write_text(text, encoding='utf-8')

    def test_missing_marker_means_no_hold(self):
        self.assertEqual(self.mod.read_hold(self.root), (False, None))

    def test_marker_names_the_release_that_must_publish_first(self):
        self.write('# hold Pages until this prerelease is published\nv1.0.0-dev5\n')
        self.assertEqual(self.mod.read_hold(self.root), (True, 'v1.0.0-dev5'))

    def test_unreadable_or_empty_markers_hold_instead_of_deploying(self):
        self.write('')
        self.assertEqual(self.mod.read_hold(self.root), (True, None))
        self.write('   \n# only comments\n')
        self.assertEqual(self.mod.read_hold(self.root), (True, None))
        self.write('not a tag! with spaces')
        self.assertEqual(self.mod.read_hold(self.root), (True, None))


class ReleaseStatusTests(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()

    def test_only_a_published_prerelease_opens_the_status_gate(self):
        payloads = [
            ({'draft': True, 'prerelease': True}, 'draft'),
            ({'draft': False, 'prerelease': False}, 'not-prerelease'),
            ({'draft': False, 'prerelease': True}, 'published'),
        ]
        payloads.extend([({}, 'missing'), ({'draft': False, 'prerelease': 1}, 'missing')])
        for payload, expected in payloads:
            result = type('Result', (), {
                'returncode': 0,
                'stdout': json.dumps(payload),
            })()
            with patch.object(self.mod.subprocess, 'run', return_value=result):
                self.assertEqual(self.mod.release_status('v1.0.0-dev5', 'owner/repo'), expected)


class DecideDeployTests(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()

    def test_no_hold_deploys(self):
        deploy, reason = self.mod.decide_deploy(has_hold=False, hold_tag=None, status='missing', force=False)
        self.assertTrue(deploy)
        self.assertIn('no deploy hold marker', reason)

    def test_unpublished_release_holds_the_deployment(self):
        for status in ('missing', 'draft', 'not-prerelease'):
            deploy, reason = self.mod.decide_deploy(has_hold=True, hold_tag='v1.0.0-dev5', status=status, force=False)
            self.assertFalse(deploy, status)
            self.assertIn('v1.0.0-dev5', reason)
            self.assertIn('held', reason)

    def test_published_release_opens_the_gate_for_all_later_pushes(self):
        deploy, reason = self.mod.decide_deploy(has_hold=True, hold_tag='v1.0.0-dev5', status='published', force=False)
        self.assertTrue(deploy)
        self.assertIn('published', reason)

    def test_unreadable_marker_holds(self):
        deploy, reason = self.mod.decide_deploy(has_hold=True, hold_tag=None, status='published', force=False)
        self.assertFalse(deploy)
        self.assertIn('unreadable', reason)

    def test_force_overrides_the_hold_for_maintainer_dispatch(self):
        deploy, reason = self.mod.decide_deploy(has_hold=True, hold_tag='v1.0.0-dev5', status='missing', force=True)
        self.assertTrue(deploy)
        self.assertIn('forced', reason)


class HoldMarkerLifecycleTests(unittest.TestCase):
    def test_hold_marker_names_the_dev5_release_tag(self):
        # Keep deployment gated until the explicitly named v1.0.0-dev5 prerelease
        # has been built, verified, and published. The gate reads its live release state.
        path = ROOT / 'DEPLOY_HOLD'
        self.assertTrue(path.exists(), 'DEPLOY_HOLD must protect the dev5 release sequence')
        text = path.read_text(encoding='utf-8')
        tags = [line.strip() for line in text.splitlines()
                if line.strip() and not line.strip().startswith('#')]
        self.assertEqual(tags, ['v1.0.0-dev5'])


class DeployWorkflowContractTests(unittest.TestCase):
    def test_deploy_job_runs_tests_but_gates_every_publish_step(self):
        text = (ROOT / '.github' / 'workflows' / 'deploy.yml').read_text(encoding='utf-8')
        self.assertIn('scripts/deploy_gate.py', text)
        self.assertIn('id: gate', text)
        checkout = text.index('- name: Checkout')
        self.assertIn('ref: main', text[checkout:checkout + 180],
                      'release-event deploys must check out main, not an older tag ref')
        self.assertIn("if: steps.gate.outputs.deploy == 'true'", text)
        for step in ('Stage standalone HTML', 'Configure Pages', 'Upload Pages artifact', 'Deploy'):
            marker = f'- name: {step}'
            index = text.index(marker)
            self.assertIn("if: steps.gate.outputs.deploy == 'true'", text[index:index + 200],
                          f'the "{step}" step must be gated')
        self.assertIn('force_deploy', text)
        self.assertIn('release:', text)
        self.assertIn('types: [published]', text)
        self.assertIn("github.event_name == 'workflow_dispatch'", text)
        self.assertIn('DEPLOY_HOLD', text)
        self.assertIn('scripts/deploy_gate.py', text)
        # Tests run before the gate can skip publishing, so a held merge still verifies content.
        self.assertLess(text.index('Run Python unit tests'), text.index('Stage standalone HTML'))

    def test_static_checks_cover_the_release_and_gate_scripts(self):
        text = (ROOT / '.github' / 'workflows' / 'ci.yml').read_text(encoding='utf-8')
        self.assertIn('scripts/release_artifacts.py', text)
        self.assertIn('scripts/deploy_gate.py', text)
        self.assertIn('DEPLOY_HOLD', text)
        self.assertIn('.github/workflows/release-artifacts.yml', text)


if __name__ == '__main__':
    unittest.main()
