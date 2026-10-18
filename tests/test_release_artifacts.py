"""Regression tests for the release-artifact pipeline (scripts/release_artifacts.py).

The network-facing `gh`/`git` calls are replaced with recorded fakes so every
branch of the packaging contract can be exercised deterministically.
"""
import importlib.util
import json
import os
import pathlib
import subprocess
import tempfile
import unittest
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load_module():
    spec = importlib.util.spec_from_file_location('release_artifacts', ROOT / 'scripts' / 'release_artifacts.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReleaseArtifactUnitTests(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()
        self.tmp = tempfile.TemporaryDirectory(prefix='rel-test-')
        self.addCleanup(self.tmp.cleanup)
        self.temp = pathlib.Path(self.tmp.name)
        os.environ['GH_REPO'] = 'coderunknow/Chuyen-Anh'

    def test_sha256_matches_known_vector(self):
        probe = self.temp / 'probe.bin'
        probe.write_bytes(b'abc')
        self.assertEqual(self.mod.sha(probe),
                         'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')

    def test_manifest_lists_sha256sum_compatible_lines_for_html_and_zip(self):
        html = self.temp / 'chuyen-anh-vX.html'
        zipf = self.temp / 'chuyen-anh-vX.zip'
        manifest = self.temp / 'chuyen-anh-vX-checksums.txt'
        html.write_text('<html></html>', encoding='utf-8')
        zipf.write_bytes(b'zip-bytes')
        self.mod.write_manifest({html.name: html, zipf.name: zipf, manifest.name: manifest}, manifest)
        lines = manifest.read_text(encoding='utf-8').strip().splitlines()
        self.assertEqual(len(lines), 2)
        for line, name in zip(lines, [html.name, zipf.name]):
            digest, _, listed = line.partition('  ')
            self.assertEqual(listed, name)
            self.assertEqual(digest, self.mod.sha(self.temp / name))
            self.assertRegex(digest, r'^[a-f0-9]{64}$')

    def test_zip_contract_requires_exact_root_files_with_identical_bytes(self):
        extracted = self.temp / 'source'
        extracted.mkdir()
        for name in self.mod.FILES:
            (extracted / name).write_text(f'content-of-{name}', encoding='utf-8')
        good = self.temp / 'good.zip'
        with zipfile.ZipFile(good, 'w') as bundle:
            for name in self.mod.FILES:
                bundle.write(extracted / name, arcname=name)
        self.mod.verify_zip_contract(good, extracted)

        extra = self.temp / 'extra.zip'
        with zipfile.ZipFile(extra, 'w') as bundle:
            for name in self.mod.FILES:
                bundle.write(extracted / name, arcname=name)
            bundle.writestr('extra.txt', 'surplus')
        with self.assertRaises(RuntimeError):
            self.mod.verify_zip_contract(extra, extracted)

        wrong = self.temp / 'wrong.zip'
        with zipfile.ZipFile(wrong, 'w') as bundle:
            for name in self.mod.FILES:
                bundle.writestr(name, 'tampered')
        with self.assertRaises(RuntimeError):
            self.mod.verify_zip_contract(wrong, extracted)

    def test_build_materializes_tag_commit_into_html_zip_and_manifest(self):
        repo = self.temp / 'repo'
        repo.mkdir()
        (repo / 'index.html').write_text('<html><body>app</body></html>', encoding='utf-8')
        (repo / 'README.md').write_text('# readme', encoding='utf-8')
        (repo / 'LICENSE').write_text('license text', encoding='utf-8')
        subprocess.run(['git', 'init', '-q'], cwd=repo, check=True)
        subprocess.run(['git', 'config', 'user.email', 'test@example.com'], cwd=repo, check=True)
        subprocess.run(['git', 'config', 'user.name', 'test'], cwd=repo, check=True)
        subprocess.run(['git', 'add', '.'], cwd=repo, check=True)
        subprocess.run(['git', 'commit', '-qm', 'fixture'], cwd=repo, check=True)
        commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=repo, check=True,
                                text=True, stdout=subprocess.PIPE).stdout.strip()

        self.mod.ROOT = repo
        self.mod.test_source = lambda source: None  # the fixture tree has no test suite
        out = self.temp / 'out'
        out.mkdir()
        artifacts = self.mod.build('v0.0.0-test', commit, out)

        html_name = 'chuyen-anh-v0.0.0-test.html'
        zip_name = 'chuyen-anh-v0.0.0-test.zip'
        manifest_name = 'chuyen-anh-v0.0.0-test-checksums.txt'
        self.assertEqual(sorted(artifacts), sorted([html_name, zip_name, manifest_name]))
        self.assertEqual(artifacts[html_name].read_bytes(), (repo / 'index.html').read_bytes())
        with zipfile.ZipFile(artifacts[zip_name]) as bundle:
            self.assertEqual(bundle.namelist(), list(self.mod.FILES))
            for name in self.mod.FILES:
                self.assertEqual(bundle.read(name), (repo / name).read_bytes())
        manifest_lines = artifacts[manifest_name].read_text(encoding='utf-8').strip().splitlines()
        self.assertEqual(manifest_lines[0], f"{self.mod.sha(artifacts[html_name])}  {html_name}")
        self.assertEqual(manifest_lines[1], f"{self.mod.sha(artifacts[zip_name])}  {zip_name}")


class ProcessFlowTests(unittest.TestCase):
    """Branch coverage for process(): tag resolution, uploads, and re-verification."""

    TAG = 'v1.0.0-dev3'
    COMMIT = 'a' * 40

    def setUp(self):
        self.mod = load_module()
        self.tmp = tempfile.TemporaryDirectory(prefix='rel-flow-')
        self.addCleanup(self.tmp.cleanup)
        self.temp = pathlib.Path(self.tmp.name)
        os.environ['GH_REPO'] = 'coderunknow/Chuyen-Anh'
        self.uploaded = []
        self.created = []
        self.release_state = {'assets': [], 'isDraft': True, 'isPrerelease': True, 'tagName': self.TAG}
        self.remote_sha = self.COMMIT
        self.download_content = {}
        self.artifacts = {}
        for name in (f'chuyen-anh-{self.TAG}.html', f'chuyen-anh-{self.TAG}.zip',
                     f'chuyen-anh-{self.TAG}-checksums.txt'):
            path = self.temp / name
            path.write_bytes(f'bytes-of-{name}'.encode('utf-8'))
            self.artifacts[name] = path

        mod = self.mod
        mod.build = lambda tag, commit, temp: dict(self.artifacts)
        mod.release_for = lambda tag: json.loads(json.dumps(self.release_state)) if self.release_state else None

        def fake_run(args, *, cwd=mod.ROOT, capture=False):
            if args[:2] == ['git', 'rev-parse']:
                return self.COMMIT
            if args[0] == 'gh' and args[1] == 'api':
                return json.dumps({'sha': self.remote_sha})
            if args[0] == 'gh' and args[1] == 'release' and args[2] == 'create':
                self.created.append(args)
                self.release_state = {'assets': [], 'isDraft': True, 'isPrerelease': True, 'tagName': self.TAG}
                return ''
            if args[0] == 'gh' and args[1] == 'release' and args[2] == 'upload':
                self.uploaded.extend(args[4:])
                for item in args[4:]:
                    name = pathlib.Path(item).name
                    self.release_state['assets'].append({
                        'name': name,
                        'digest': f"sha256:{mod.sha(self.artifacts[name])}",
                    })
                return ''
            if args[0] == 'gh' and args[1] == 'release' and args[2] == 'download':
                target = pathlib.Path(args[-1])
                target.mkdir(parents=True, exist_ok=True)
                if '--pattern' in args:
                    names = [args[args.index('--pattern') + 1]]
                else:
                    names = [asset['name'] for asset in self.release_state['assets']] or list(self.artifacts)
                for name in names:
                    content = self.download_content.get(name, self.artifacts[name].read_bytes())
                    (target / name).write_bytes(content)
                return ''
            raise AssertionError(f'unexpected run args: {args}')

        mod.run = fake_run

    def test_backfill_refuses_a_tag_without_an_existing_release(self):
        self.release_state = None
        with self.assertRaisesRegex(RuntimeError, 'refusing to create one during backfill'):
            self.mod.process(self.TAG)
        self.assertEqual(self.created, [])

    def test_tag_resolving_to_another_commit_is_refused(self):
        self.remote_sha = 'b' * 40
        with self.assertRaisesRegex(RuntimeError, 'resolves to'):
            self.mod.process(self.TAG, future=True)
        self.assertEqual(self.created, [])

    def test_same_name_asset_with_other_content_is_never_replaced(self):
        name = f'chuyen-anh-{self.TAG}.html'
        self.release_state['assets'].append({'name': name, 'digest': 'sha256:' + '0' * 64})
        self.download_content[name] = b'tampered-bytes'
        with self.assertRaisesRegex(RuntimeError, 'refusing to replace it'):
            self.mod.process(self.TAG, future=True)
        self.assertEqual(self.uploaded, [])

    def test_matching_existing_assets_are_skipped_and_only_missing_assets_upload(self):
        name = f'chuyen-anh-{self.TAG}.html'
        self.release_state['isDraft'] = False
        self.release_state['assets'].append({'name': name, 'digest': f'sha256:{self.mod.sha(self.artifacts[name])}'})
        self.mod.process(self.TAG, future=True)
        self.assertEqual([pathlib.Path(item).name for item in self.uploaded],
                         [f'chuyen-anh-{self.TAG}.zip', f'chuyen-anh-{self.TAG}-checksums.txt'])

    def test_a_changed_download_after_upload_fails_verification(self):
        zip_name = f'chuyen-anh-{self.TAG}.zip'
        # The upload reports success, but the re-download does not match the built file.
        self.download_content[zip_name] = b'corrupted-in-flight'
        with self.assertRaisesRegex(RuntimeError, 'differs from the built artifact'):
            self.mod.process(self.TAG, future=True)
        self.assertEqual(len(self.uploaded), 3)

    def test_reported_asset_digest_must_match_the_built_artifact(self):
        self.mod.release_for = lambda tag: {
            'assets': [{'name': name, 'digest': 'sha256:' + '1' * 64} for name in self.artifacts],
            'isDraft': True, 'isPrerelease': True, 'tagName': self.TAG
        }
        with self.assertRaisesRegex(RuntimeError, 'digest'):
            self.mod.process(self.TAG, future=True)

    def test_future_tag_creates_a_draft_prerelease_with_verification_notes(self):
        self.release_state = None
        self.mod.process(self.TAG, future=True)
        self.assertEqual(len(self.created), 1)
        args = self.created[0]
        self.assertIn('--draft', args)
        self.assertIn('--prerelease', args)
        self.assertIn(f'Chuyên Anh {self.TAG}', args)
        notes = args[args.index('--notes') + 1]
        self.assertIn(f'chuyen-anh-{self.TAG}-checksums.txt', notes)
        self.assertIn('sha256sum -c', notes)
        self.assertEqual(len(self.uploaded), 3)


class ReleaseWorkflowContractTests(unittest.TestCase):
    def test_workflow_packages_the_pushed_tag_with_write_permission_only(self):
        text = (ROOT / '.github' / 'workflows' / 'release-artifacts.yml').read_text(encoding='utf-8')
        self.assertIn('"v1.0.0-dev*"', text)
        self.assertIn('contents: write', text)
        self.assertIn('scripts/release_artifacts.py', text)
        self.assertIn('PUSH_TAG', text)
        self.assertNotIn('pull_request', text)


if __name__ == '__main__':
    unittest.main()
