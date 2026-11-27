# Method note — tailieudieuky.com file-asset digests

The host serves `503 osh-mitigated: challenge-unrunnable` to non-browser
clients (curl and Node fetch both blocked; verified 2026-11-26). A real
Chromium session passes the challenge. Steps for a clean reproduction:

1. Serve the repository's `index.html` locally (or use any page on the host)
   in a real Chromium browser and let the challenge clear once.
2. In that page context, run the session's one-off browser-console scripts
   (`browser_digest_check.js`, `browser_recon2.js`, built on the
   de-duplicated URL list from `extract_asset_list.py`) after loading the
   60 unique file URLs covering the 140 pdf/docx asset records; 53 URLs carry
   2+ recorded assets each because the host re-packaged several files into
   single ZIP bundles. Note: these three helpers were session-local one-offs
   run from the browser console and were **not committed** to the repository —
   steps 2-3 below describe exactly what they did, so the procedure is
   reproducible from this note alone; their outputs ARE tracked
   (`tailieudieuky-recon.json`, `asset-digest-classification.json`).
3. `browser_recon2.js` fetches each URL with credentials, hashes the
   response, and — when the bytes are a ZIP — walks the central directory,
   inflates every member (`DecompressionStream('deflate-raw')`) and hashes
   each member, so a recorded digest can match either the response bytes or
   a member inside a re-packaged archive.
4. Results land in `tailieudieuky-recon.json`; the classification logic and
   outcome are in `asset-digest-classification.json`.

The 22 `type: html` records are document *pages* (dynamic content — live
clock, share widgets), so their digests are capture-time snapshots and are
not byte-re-comparable against the live page by design; their content is
instead verified through the source `.md` -> `contentSha256` -> embedded
markdown chain (106/106, see `exam-integrity.json`).
