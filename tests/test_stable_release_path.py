"""Stable tags use the stable release channel, never a prerelease draft."""
import importlib.util
import os
import subprocess
import tempfile
import time
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release_artifacts_stable', ROOT / 'scripts/release_artifacts.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class StableReleasePathTests(unittest.TestCase):
    def test_only_target_stable_tag_is_newly_allowed(self):
        self.assertTrue(mod.is_supported_tag('v1.0.0'))
        for invalid in ('v1.0.1', 'v1.0.0-rc', 'v1.0.0/../x', 'main'):
            self.assertFalse(mod.is_supported_tag(invalid), invalid)

    def test_stable_push_is_dispatched_for_packaging(self):
        calls = []
        with patch.dict(os.environ, {'PUSH_TAG': 'v1.0.0', 'INPUT_TAG': ''}), \
             patch.object(mod, 'process', lambda tag, **kw: calls.append((tag, kw))):
            mod.main()
        self.assertEqual(calls, [('v1.0.0', {'future': True})])

    def test_stable_notes_and_workflow_do_not_describe_prerelease(self):
        notes = mod.release_notes('v1.0.0')
        self.assertIn('stable', notes.lower())
        self.assertNotIn('prerelease', notes.lower())
        text = (ROOT / '.github/workflows/release-artifacts.yml').read_text(encoding='utf-8')
        self.assertIn('"v1.0.0"', text)

    def test_stable_build_checks_tagged_app_version_before_testing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'repo'
            root.mkdir()
            for name, text in [('index.html', "export const APP_VERSION = 'v1.0.0-rc10';"),
                               ('README.md', 'readme'), ('LICENSE', 'license')]:
                (root / name).write_text(text, encoding='utf-8')
            subprocess.run(['git', 'init', '-q'], cwd=root, check=True)
            subprocess.run(['git', 'config', 'user.email', 'test@example.com'], cwd=root, check=True)
            subprocess.run(['git', 'config', 'user.name', 'test'], cwd=root, check=True)
            subprocess.run(['git', 'add', '.'], cwd=root, check=True)
            subprocess.run(['git', 'commit', '-qm', 'test'], cwd=root, check=True)
            out = Path(directory) / 'out'
            out.mkdir()
            with patch.object(mod, 'ROOT', root), patch.object(mod, 'test_source') as checks:
                with self.assertRaisesRegex(RuntimeError, 'does not match stable tag'):
                    mod.build('v1.0.0', 'HEAD', out)
                checks.assert_not_called()
            (root / 'index.html').write_text("export const APP_VERSION = 'v1.0.0';", encoding='utf-8')
            subprocess.run(['git', 'add', 'index.html'], cwd=root, check=True)
            subprocess.run(['git', 'commit', '-qm', 'stable'], cwd=root, check=True)
            out = Path(directory) / 'out2'
            out.mkdir()
            with patch.object(mod, 'ROOT', root), patch.object(mod, 'test_source') as checks:
                assets = mod.build('v1.0.0', 'HEAD', out)
                checks.assert_called_once()
                self.assertEqual(len(assets), 3)
            second = Path(directory) / 'out3'
            second.mkdir()
            # Archive metadata must not depend on extraction time, timezone or umask.
            with patch.dict(os.environ, {'TZ': 'Pacific/Honolulu'}), patch.object(mod, 'ROOT', root), patch.object(mod, 'test_source'):
                if hasattr(time, 'tzset'):
                    time.tzset()
                try:
                    second_assets = mod.build('v1.0.0', 'HEAD', second)
                finally:
                    os.environ.pop('TZ', None)
                    if hasattr(time, 'tzset'):
                        time.tzset()
            for name in assets:
                self.assertEqual(assets[name].read_bytes(), second_assets[name].read_bytes(), name)
            manifest = assets['chuyen-anh-v1.0.0-checksums.txt'].read_text()
            self.assertIn(mod.sha(assets['chuyen-anh-v1.0.0.html']), manifest)
            self.assertIn(mod.sha(assets['chuyen-anh-v1.0.0.zip']), manifest)

    def test_existing_wrong_channel_fails_before_build_or_upload(self):
        release = {'tagName': 'v1.0.0', 'isDraft': True, 'isPrerelease': True, 'assets': []}
        with patch.object(mod, 'release_for', return_value=release), patch.object(mod, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'channel mismatch'):
                mod.process('v1.0.0', future=True)
            run.assert_not_called()

    def test_stable_draft_creation_does_not_request_prerelease(self):
        self.assertFalse(mod.is_prerelease_tag('v1.0.0'))
        self.assertTrue(mod.is_prerelease_tag('v1.0.0-rc10'))
        self.assertNotIn('--prerelease', mod.release_create_command('v1.0.0'))
        self.assertIn('--prerelease', mod.release_create_command('v1.0.0-rc10'))
        self.assertIn('--draft', mod.release_create_command('v1.0.0'))

if __name__ == '__main__':
    unittest.main()

class StableDispatchContractTests(unittest.TestCase):
    def test_stable_dispatch_requires_separate_explicit_confirmation(self):
        text = (ROOT / '.github/workflows/release-published-dispatch.yml').read_text(encoding='utf-8')
        self.assertIn('workflow_dispatch:', text)
        self.assertIn('stable_deploy_authorized:', text)
        self.assertIn("github.event_name == 'workflow_dispatch'", text)
        self.assertIn("github.ref == 'refs/heads/main'", text)
        self.assertIn('inputs.stable_deploy_authorized == true', text)
        self.assertIn('python3 scripts/app_release_gate.py', text)
        self.assertIn("steps.app_release.outputs.deploy == 'true'", text)
        self.assertNotIn('force_deploy', text)
