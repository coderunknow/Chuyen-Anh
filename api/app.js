'use strict';

/**
 * Chuyên Anh telemetry — plain Node service entrypoint.
 *
 * The Vercel project uses framework "node", so the deployment is one Node
 * service: this file is the entrypoint (src/app.js) and every request is
 * delegated to the endpoint handler in src/api/telemetry.js. Nothing here
 * reads or logs request data — the privacy rules live in the handler and the
 * less this wrapper touches, the better they hold.
 *
 * Deployment mapping (reproducible from the repository):
 *   api/app.js        → src/app.js           (this file, entrypoint)
 *   api/telemetry.js  → src/api/telemetry.js (the endpoint handler)
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
