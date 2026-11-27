'use strict';

/**
 * Chuyên Anh telemetry — plain Node service entrypoint.
 *
 * The Vercel project uses framework "node" (see vercel.json), so the audited
 * production deployment is one Node service: this file is the entrypoint and
 * every request is delegated to the endpoint handler in ./telemetry.js.
 * Nothing here reads or logs request data — the privacy rules live in the
 * handler and the less this wrapper touches, the better they hold.
 *
 * Repository layout (there is no repository configuration that renames or
 * relocates these files — vercel.json only references the handler and sets
 * framework/headers):
 *   api/app.js        (this file, entrypoint)
 *   api/telemetry.js  (the endpoint handler, required as ./telemetry.js)
 *
 * The live deployment carries the same two files under Vercel's service
 * layout (src/app.js + src/api/telemetry.js); that src/ mapping is applied by
 * the files-based deployment call itself and is documented, with the live
 * verification transcript, in
 * audit/v100/stable-rebuild/evidence/session-2026-11-27/live-infra-hardening.md.
 *
 * Because the deployed entrypoint sits one directory above the deployed
 * handler, the require below resolves the handler at RUNTIME from whichever
 * of the two real layouts it is running in — sibling (repository/flat) or
 * nested (src/app.js + src/api/telemetry.js). tests/telemetry-entrypoint.test.js
 * packages this exact file into the documented src/ layout and boots it, so a
 * deployment-layout regression fails CI instead of failing in production.
 *
 * Live verification (read-only, 2026-11-27): OPTIONS /api/telemetry → 204
 * with the CORS preflight headers; GET /api/telemetry → 405 with Allow:
 * POST, OPTIONS. The endpoint contract itself is pinned by
 * tests/telemetry-api.test.js (19 tests) against this exact handler file.
 */

const http = require('node:http');
const path = require('node:path');

// Resolve the handler module from the layout this file actually runs in:
//  - sibling layout (repository, flat deployments): api/app.js + api/telemetry.js
//  - nested service layout (documented Vercel mapping): src/app.js + src/api/telemetry.js
const sibling = path.join(__dirname, 'telemetry.js');
const nested = path.join(__dirname, 'api', 'telemetry.js');
const handlerPath = require('node:fs').existsSync(sibling) ? sibling : nested;
if (!require('node:fs').existsSync(handlerPath)) {
  // Fail loudly and early: a deployment whose handler is missing must not
  // boot into a service that 500s on every request.
  throw new Error(`telemetry handler not found next to the entrypoint (looked at ${sibling} and ${nested})`);
}
const handler = require(handlerPath);

const server = http.createServer((req, res) => {
  Promise.resolve(handler(req, res)).catch(() => {
    // The handler sends its own errors; reaching here means it threw before
    // answering. Report availability, never the request's contents.
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (!res.writableEnded) res.end(JSON.stringify({ ok: false, error: 'internal-error' }));
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log('chuyen-anh-telemetry listening on port', port);
});
