"""Round-8 (PR #88 review): the browser-session reproduction note claims the
URL-extension filter yields 140 file-asset records / 60 unique URLs / 53 URLs
carrying 2+ records. The committed re-created helper must reproduce those
figures from the tracked data, so the note's counts stay executable evidence."""
import json
import pathlib
import subprocess
import unittest

REPO = pathlib.Path(__file__).resolve().parents[1]
HELPER = REPO / 'audit/v100/stable-rebuild/evidence/session-2026-11-26/scripts/extract_asset_list.py'


class ReconAssetListTests(unittest.TestCase):
    def test_extract_asset_list_reproduces_the_note_counts(self) -> None:
        out = subprocess.run(
            ['python3', str(HELPER), '--json'], capture_output=True, text=True, check=True
        ).stdout
        data = json.loads(out)
        self.assertEqual(data['fileAssetRecords'], 140)
        self.assertEqual(data['uniqueUrls'], 60)
        self.assertEqual(data['urlsCarryingTwoOrMoreRecords'], 53)
        self.assertEqual(data['assetRecordsTotal'], 186)
        # the documented contrast with the type-based filter
        self.assertEqual(data['typeFilterContrast']['pdfOrDocxTypedRecords'], 164)
        self.assertEqual(data['typeFilterContrast']['uniqueUrlsByType'], 84)


if __name__ == '__main__':
    unittest.main()
