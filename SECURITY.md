# Security Policy

## Supported versions

| Version | Supported | Notes |
| --- | --- | --- |
| `v1.0.0-rc11` (candidate) | Yes | Current proposed candidate (PR #85; `index.html` standalone offline build + SHA-256-pinned `data/exam-curated-keys.json` + hardened `api/telemetry.js`). **Not published or deployed.** |
| `v1.0.0-rc10` | Yes | Latest **published** release on GitHub Pages (2026-11-03, PR #81). `DEPLOY_HOLD` has moved to `v1.0.0-rc11`, so rc10 is no longer the deploy marker. |
| `< v1.0.0-rc10` | No | Superseded prereleases; upgrade to `v1.0.0-rc10` or the current candidate. |

## Reporting a vulnerability

Please report security issues privately via GitHub's security advisory workflow (`Security → Advisories → Report a vulnerability`) or by contacting the repository owner directly.

Do not open public issues for unpatched vulnerabilities or sensitive security findings.

## Architecture & security controls (`v1.0.0`)

- **Zero-network standalone client (`index.html`):** All vocabulary (`8,852` rows / `8,112` headwords), phrases (`1,094`), and exam transcriptions (`106` papers / `6,708` questions) are embedded locally. Curated domain-verified answer keys (`data/exam-curated-keys.json`) are fail-closed and cryptographically bound to `promptSha256` and `optionsSha256`. Study progress and exam history stay in browser `localStorage`. All untrusted/transcribed Markdown is HTML-escaped (`<script>`, `<iframe>`, `javascript:`/`data:`/`vbscript:` URLs, and raw HTML tags such as angle-bracket constituents in `2022/hai-phong/so` are rendered inert; only explicit `<u>` and `<br>` formatting tokens are emitted).
- **Opt-in default-off diagnostics (`api/telemetry.js` + Supabase):**
  - Off by default; sends a single bounded JSON `POST` (`<= 16 KB`, `<= 50` events) only when the user explicitly clicks **Gửi chẩn đoán**.
  - **Fail-closed secret validation (`RC8-SEC-001`):** `api/telemetry.js` requires a server-side `TELEMETRY_IP_SALT` of at least 16 characters and rejects known weak/placeholder values (`chuyen-anh-telemetry`, `changeme`, `default`, `secret`, `test`, `development`, `production`), returning `503 service-unavailable` without invoking upstream storage if misconfigured.
  - **Trusted proxy IP precedence (`RC8-SEC-002`):** Rate-limit client keys prefer platform-injected `x-vercel-forwarded-for`, then `x-real-ip`, then the rightmost entry of `x-forwarded-for`, preventing leftmost `X-Forwarded-For` header spoofing. Raw IP addresses are never stored or logged.
  - **Database isolation (`supabase/migrations/20261029_telemetry_ingest.sql`, `20261031_telemetry_hardening.sql`):** Schema `telemetry` enables Row-Level Security with zero permissive policies for `anon`/`authenticated`; only `service_role` can execute `public.telemetry_ingest` (`security definer`, pinned `search_path = telemetry, public, pg_temp`), which enforces 32-hex `client_key` validation, missing-key bucket rate limiting (`5 / 10 min`), per-client (`10 / 10 min`) and global (`120 / 10 min`) rate limits, and 90-day retention cleanup.
- **CI supply-chain pinning (`RC8-CI-001`):** Every GitHub Actions step across `.github/workflows/*.yml` is pinned to a full 40-character commit SHA running on Node 24 (`persist-credentials: false` on read checkouts).

## Safe use guidance

- Never commit secrets, API keys, service-role tokens, or personal data.
- Validate downloaded source material before republishing.
- Treat exam content and uploaded reference files as educational study aids, not authoritative official government releases (see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)).
