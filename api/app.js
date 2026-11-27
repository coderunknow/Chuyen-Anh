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
 * Module layout (repository paths; there is no repository configuration that
 * renames or relocates these files — vercel.json only references the handler
 * and sets framework/headers):
 *   api/app.js        (this file, entrypoint)
 *   api/telemetry.js  (the endpoint handler, required as ./telemetry.js)
 *
 * The live deployment carries the same two files under Vercel's service
 * layout (src/app.js + src/api/telemetry.js); that src/ mapping is applied by
 * the files-based deployment call itself and is documented, with the live
 * verification transcript, in
 * audit/v100/stable-rebuild/evidence/session-2026-11-27/live-infra-hardening.md.
 *
 * Live verification (read-only, 2026-11-27): OPTIONS /api/telemetry → 204
 * with the CORS preflight headers; GET /api/telemetry → 405 with Allow:
 * POST, OPTIONS. The endpoint contract itself is pinned by
 * tests/telemetry-api.test.js (19 tests) against this exact handler file.
 */

const http = require('node:http');
const handler = require('./telemetry.js');

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
