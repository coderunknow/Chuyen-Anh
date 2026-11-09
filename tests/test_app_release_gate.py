"""The staged application must have a published release in its own channel."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('app_release_gate', ROOT / 'scripts/app_release_gate.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class AppReleaseGateTests(unittest.TestCase):
    def test_exact_version_channel_and_publication(self):
        def result(payload, code=0):
            return type('Result', (), {'returncode': code, 'stdout': json.dumps(payload)})()
        stable = {'tag_name': 'v1.0.0', 'draft': False, 'prerelease': False, 'published_at': '2026-11-04T12:00:00Z'}
        prerelease = {'tag_name': 'v1.0.0-rc10', 'draft': False, 'prerelease': True, 'published_at': '2026-11-03T12:00:00Z'}
        cases = [
            ('v1.0.0', prerelease, False), ('v1.0.0', {**stable, 'draft': True}, False),
            ('v1.0.0', {**stable, 'prerelease': True}, False), ('v1.0.0', stable, True),
            ('v1.0.0', {**stable, 'tag_name': 'v1.0.1'}, False),
            ('v1.0.0', {**stable, 'published_at': None}, False),
            ('v1.0.0-rc10', prerelease, True), ('v1.0.0-rc10', {**prerelease, 'prerelease': False}, False),
            ('v1.0.0', [], False), ('v1.0.0', {}, False),
        ]
        for version, payload, expected in cases:
            with self.subTest(version=version, payload=payload), patch.object(gate.subprocess, 'run', return_value=result(payload)) as run:
                self.assertEqual(gate.release_is_published(version, 'owner/repo'), expected)
                self.assertEqual(run.call_args.kwargs['timeout'], 15)
                self.assertIn(f'/releases/tags/{version}', run.call_args.args[0][-1])
        for failure in (OSError('unavailable'), gate.subprocess.TimeoutExpired('gh', 15)):
            with patch.object(gate.subprocess, 'run', side_effect=failure):
                self.assertFalse(gate.release_is_published('v1.0.0', 'owner/repo'))
        with patch.object(gate.subprocess, 'run', return_value=result(stable, 1)):
            self.assertFalse(gate.release_is_published('v1.0.0', 'owner/repo'))
        with patch.object(gate.subprocess, 'run', return_value=type('Result', (), {'returncode': 0, 'stdout': 'not json'})()):
            self.assertFalse(gate.release_is_published('v1.0.0', 'owner/repo'))

    def test_version_extraction_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'index.html'
            self.assertIsNone(gate.app_version(path))
            for content, expected in [
                ("export const APP_VERSION = 'v1.0.0';", 'v1.0.0'),
                ('export const APP_VERSION = "v1.0.0-rc10";', 'v1.0.0-rc10'),
                ("export const APP_VERSION = 'v1.0.0';\nexport const APP_VERSION = 'v1.0.1';", None),
                ("export const APP_VERSION = 'bogus';", None), ('', None),
            ]:
                path.write_text(content, encoding='utf-8')
                self.assertEqual(gate.app_version(path), expected)

    def test_workflow_requires_both_gates_at_every_publish_step(self):
        text = (ROOT / '.github/workflows/deploy.yml').read_text(encoding='utf-8')
        self.assertIn('python3 scripts/app_release_gate.py', text)
        self.assertIn('STABLE_DEPLOY_AUTHORIZED:', text)
        self.assertIn('inputs.stable_deploy_authorized == true', text)
        for step in ('Stage standalone HTML', 'Configure Pages', 'Upload Pages artifact', 'Deploy'):
            snippet = text.split(f'- name: {step}', 1)[1][:250]
            self.assertIn("steps.gate.outputs.deploy == 'true'", snippet)
            self.assertIn("steps.app_release.outputs.deploy == 'true'", snippet)

    def test_main_holds_published_stable_release_until_separately_authorized(self):
        with tempfile.TemporaryDirectory() as directory:
            out = pathlib.Path(directory) / 'gh-output.txt'
            cases = [
                # Published stable release on push (no STABLE_DEPLOY_AUTHORIZED) -> held
                ('v1.0.0', True, {}, 'deploy=false'),
                # Published stable release with STABLE_DEPLOY_AUTHORIZED=true -> allowed
                ('v1.0.0', True, {'STABLE_DEPLOY_AUTHORIZED': 'true'}, 'deploy=true'),
                # Unpublished stable release even with STABLE_DEPLOY_AUTHORIZED=true -> held
                ('v1.0.0', False, {'STABLE_DEPLOY_AUTHORIZED': 'true'}, 'deploy=false'),
                # Published prerelease on push (no STABLE_DEPLOY_AUTHORIZED needed) -> allowed
                ('v1.0.0-rc10', True, {}, 'deploy=true'),
            ]
            for version, published, extra_env, expected in cases:
                out.write_text('', encoding='utf-8')
                env = {'GITHUB_OUTPUT': str(out), 'GITHUB_REPOSITORY': 'owner/repo', **extra_env}
                with self.subTest(version=version, published=published, extra_env=extra_env), \
                     patch.object(gate, 'app_version', return_value=version), \
                     patch.object(gate, 'release_is_published', return_value=published), \
                     patch.dict('os.environ', env, clear=True):
                    self.assertEqual(gate.main(), 0)
                    self.assertEqual(out.read_text(encoding='utf-8').strip(), expected)
