"""Regression tests for the deploy-hold gate (scripts/deploy_gate.py) and its workflow."""
import importlib.util
import json
import os
import pathlib
import sys
import tempfile
import re
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

    def test_missing_repository_is_reported_as_a_configuration_gap(self):
        # Before rc3 a local run (no --repo, no GITHUB_REPOSITORY) printed
        # "release v1.0.0-rc2 is missing" even though the release was published:
        # the gate had simply not asked GitHub. Holding is right (fail closed);
        # blaming the release is not, because it sends a maintainer to the wrong
        # place. The reason must name the missing input instead.
        deploy, reason = self.mod.decide_deploy(has_hold=True, hold_tag='v1.0.0-dev5',
                                                status='missing', force=False, repo='')
        self.assertFalse(deploy)
        self.assertIn('no repository was supplied', reason)
        self.assertNotIn('is missing;', reason)

    def test_unknown_repository_still_holds_and_says_so(self):
        deploy, reason = self.mod.decide_deploy(has_hold=True, hold_tag='v1.0.0-dev5',
                                                status='missing', force=False, repo='owner/repo')
        self.assertFalse(deploy)
        self.assertIn('is missing; deployment held', reason)

    def test_force_overrides_the_hold_for_maintainer_dispatch(self):
        deploy, reason = self.mod.decide_deploy(has_hold=True, hold_tag='v1.0.0-dev5', status='missing', force=True)
        self.assertTrue(deploy)
        self.assertIn('forced', reason)


class HoldMarkerLifecycleTests(unittest.TestCase):
    def test_hold_marker_names_the_release_that_must_publish_first(self):
        # Keep deployment gated until the explicitly named prerelease has been
        # built, verified, and published. The gate reads its live release state, so
        # the marker simply has to name one valid tag: it must be the version the
        # shipped file declares, otherwise a merge could publish code whose own
        # prerelease does not exist yet under cover of an unrelated, older release.
        path = ROOT / 'DEPLOY_HOLD'
        self.assertTrue(path.exists(), 'DEPLOY_HOLD must protect the release sequence')
        text = path.read_text(encoding='utf-8')
        tags = [line.strip() for line in text.splitlines()
                if line.strip() and not line.strip().startswith('#')]
        self.assertEqual(tags, ['v1.0.0-rc4'])
        self.assertRegex(tags[0], r'^v\d+\.\d+\.\d+-(?:dev|beta|rc)\d+$')
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        live = re.search(r"APP_VERSION = '([^']+)'", html)
        self.assertIsNotNone(live, 'the shipped file declares its version')
        self.assertEqual(tags[0], live.group(1),
                         'the hold names the release of the version actually shipped')


class ReleasePublishedDispatchWorkflowContractTests(unittest.TestCase):
    def test_published_prerelease_dispatches_gated_main_workflow_with_minimal_permissions(self):
        path = ROOT / '.github' / 'workflows' / 'release-published-dispatch.yml'
        text = path.read_text(encoding='utf-8')
        self.assertIn('release:', text)
        self.assertIn('types: [published]', text)
        self.assertIn('if: github.event.release.prerelease == true', text)
        self.assertIn('actions: write', text)
        self.assertIn('contents: read', text)
        self.assertIn('/actions/workflows/deploy.yml/dispatches', text)
        self.assertIn("--data '{\"ref\":\"main\"}'", text)
        self.assertNotIn('pages: write', text)
        self.assertNotIn('environment:', text)


class DeployWorkflowContractTests(unittest.TestCase):
    def test_deploy_job_runs_tests_but_gates_every_publish_step(self):
        text = (ROOT / '.github' / 'workflows' / 'deploy.yml').read_text(encoding='utf-8')
        self.assertIn('scripts/deploy_gate.py', text)
        self.assertIn('id: gate', text)
        checkout = text.index('- name: Checkout')
        self.assertIn('ref: main', text[checkout:checkout + 180],
                      'release-triggered dispatches must deploy main, not an older tag ref')
        self.assertIn("if: steps.gate.outputs.deploy == 'true'", text)
        for step in ('Stage standalone HTML', 'Configure Pages', 'Upload Pages artifact', 'Deploy'):
            marker = f'- name: {step}'
            index = text.index(marker)
            self.assertIn("if: steps.gate.outputs.deploy == 'true'", text[index:index + 200],
                          f'the "{step}" step must be gated')
        self.assertIn('force_deploy', text)
        self.assertNotIn('types: [published]', text,
                         'release tags must dispatch the deploy workflow on main through a separate workflow')
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
        self.assertIn('.github/workflows/release-published-dispatch.yml', text)
        self.assertEqual(text.count('.github/workflows/release-published-dispatch.yml'), 2,
                         'both pull_request and push filters must cover the dispatcher')




class ReleaseStatusFailureModesTests(unittest.TestCase):
    """RC2 remediation (RT-05/RT-06): every `gh` failure mode must resolve to
    'missing', and the call itself must be bounded by an internal timeout."""

    def setUp(self):
        self.mod = load_module()

    @staticmethod
    def result(returncode=0, stdout='{}'):
        return type('Result', (), {'returncode': returncode, 'stdout': stdout})()

    def test_nonzero_exit_counts_as_missing(self):
        with patch.object(self.mod.subprocess, 'run', return_value=self.result(returncode=1, stdout='{}')):
            self.assertEqual(self.mod.release_status('v1.0.0-rc2', 'owner/repo'), 'missing')

    def test_unparseable_output_counts_as_missing(self):
        with patch.object(self.mod.subprocess, 'run', return_value=self.result(stdout='<html>rate limited</html>')):
            self.assertEqual(self.mod.release_status('v1.0.0-rc2', 'owner/repo'), 'missing')

    def test_gh_is_called_with_a_bounded_internal_timeout(self):
        with patch.object(self.mod.subprocess, 'run', return_value=self.result(stdout=json.dumps(
                {'draft': False, 'prerelease': True}))) as run:
            self.assertEqual(self.mod.release_status('v1.0.0-rc2', 'owner/repo'), 'published')
            _, kwargs = run.call_args
            self.assertIn('timeout', kwargs, 'the gh lookup must carry an internal timeout')
            self.assertEqual(kwargs['timeout'], self.mod.RELEASE_STATUS_TIMEOUT_SEC,
                             "the call uses the gate's own bounded timeout")
            self.assertGreaterEqual(self.mod.RELEASE_STATUS_TIMEOUT_SEC, 5)
            self.assertLessEqual(self.mod.RELEASE_STATUS_TIMEOUT_SEC, 60)

    def test_timeout_expired_counts_as_missing(self):
        expired = self.mod.subprocess.TimeoutExpired(cmd='gh', timeout=self.mod.RELEASE_STATUS_TIMEOUT_SEC)
        with patch.object(self.mod.subprocess, 'run', side_effect=expired):
            self.assertEqual(self.mod.release_status('v1.0.0-rc2', 'owner/repo'), 'missing',
                             'a hung gh fails closed: the deploy stays held')

    def test_unlaunchable_gh_counts_as_missing(self):
        with patch.object(self.mod.subprocess, 'run', side_effect=OSError('gh missing')):
            self.assertEqual(self.mod.release_status('v1.0.0-rc2', 'owner/repo'), 'missing')


class ReadHoldFailureModeTests(unittest.TestCase):
    def test_unreadable_marker_file_holds(self):
        mod = load_module()
        with tempfile.TemporaryDirectory(prefix='hold-unreadable-') as tmp:
            root = pathlib.Path(tmp)
            (root / mod.HOLD_FILE).write_text('v1.0.0-rc2\n', encoding='utf-8')
            with patch.object(pathlib.Path, 'read_text', side_effect=OSError('permission denied')):
                self.assertEqual(mod.read_hold(root), (True, None),
                                 'an unreadable marker must hold, never deploy')


class GateMainOutputTests(unittest.TestCase):
    """The wiring itself: what `main()` writes to GITHUB_OUTPUT decides whether
    the publish steps run, so each decision shape must be observable here."""

    def run_main(self, prepare=None, argv_extra=()):
        mod = load_module()
        with tempfile.TemporaryDirectory(prefix='gate-main-') as tmp:
            root = pathlib.Path(tmp)
            if prepare:
                prepare(mod, root)
            out = root / 'gh-output.txt'
            env = {k: v for k, v in os.environ.items()
                   if k not in ('FORCE_DEPLOY', 'GITHUB_REPOSITORY')}
            env['GITHUB_OUTPUT'] = str(out)
            argv = ['deploy_gate.py', '--root', str(root), *argv_extra]
            with open(os.devnull, 'w', encoding='utf-8') as devnull, \
                    patch.dict(os.environ, env, clear=True), \
                    patch.object(sys, 'argv', argv), \
                    patch.object(sys, 'stdout', new=devnull):
                mod.main()
            return out.read_text(encoding='utf-8')

    def test_missing_marker_deploys_with_an_explicit_reason(self):
        output = self.run_main()
        self.assertIn('deploy=true', output)
        self.assertIn('reason=no deploy hold marker', output)

    def test_unreadable_marker_holds_through_the_output_file(self):
        def prepare(mod, root):
            (root / mod.HOLD_FILE).write_text('', encoding='utf-8')
        output = self.run_main(prepare=prepare)
        self.assertIn('deploy=false', output,
                      'the output file must carry the held decision, not a hard-coded true')
        self.assertIn('unreadable', output)

    def test_force_is_off_by_default_for_the_cli(self):
        def prepare(mod, root):
            (root / mod.HOLD_FILE).write_text('v1.0.0-rc2\n', encoding='utf-8')
        output = self.run_main(prepare=prepare)
        self.assertIn('deploy=false', output)
        self.assertIn('held', output)
        self.assertNotIn('forced', output)


class WorkflowTimeoutAndHoldPathsContractTests(unittest.TestCase):
    """RC2 remediation (RT-05): the workflow properties the earlier suite did
    not pin — the deploy job's own timeout, the gate step's token, and the
    DEPLOY_HOLD entries inside every paths filter (not just somewhere)."""

    @staticmethod
    def paths_blocks(text):
        blocks = []
        lines = text.splitlines()
        index = 0
        while index < len(lines):
            if lines[index].rstrip().endswith('paths:'):
                index += 1
                block = []
                while index < len(lines) and (
                        lines[index].startswith('      - ')
                        or not lines[index].strip()
                        or lines[index].strip().startswith('#')):
                    block.append(lines[index])
                    index += 1
                blocks.append('\n'.join(block))
            else:
                index += 1
        return blocks

    def test_deploy_job_declares_its_own_timeout(self):
        text = (ROOT / '.github' / 'workflows' / 'deploy.yml').read_text(encoding='utf-8')
        head = text[:text.index('steps:')]
        self.assertRegex(head, r'timeout-minutes:\s*\d+',
                         'the deploy job must bound itself, including a hung gate step')

    def test_every_paths_filter_mentions_the_hold_marker(self):
        for workflow in ('deploy.yml', 'ci.yml'):
            text = (ROOT / '.github' / 'workflows' / workflow).read_text(encoding='utf-8')
            blocks = self.paths_blocks(text)
            self.assertGreaterEqual(len(blocks), 1, workflow)
            for number, block in enumerate(blocks, start=1):
                self.assertIn('- "DEPLOY_HOLD"', block,
                              f'{workflow} paths block #{number} must trigger on hold-marker changes')

    def test_gate_step_keeps_its_gh_token(self):
        text = (ROOT / '.github' / 'workflows' / 'deploy.yml').read_text(encoding='utf-8')
        start = text.index('- name: Evaluate deploy hold')
        step = text[start:start + 400]
        self.assertIn('GH_TOKEN', step,
                      'the release lookup must run authenticated or it degrades to constant failures')


if __name__ == '__main__':
    unittest.main()
