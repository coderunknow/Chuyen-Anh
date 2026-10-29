'use strict';

/**
 * Entry point for the Chuyên Anh telemetry deployment.
 *
 * The Vercel project is a plain Node.js service: no dependencies, no build
 * step, and exactly one route — POST /api/telemetry, implemented in
 * ./api/telemetry.js. Every other path answers 404, so this deployment can
 * never be mistaken for a second copy of the application (the app itself is
 * the single index.html served by GitHub Pages).
 *
 * The live deployment is the pair `app.js` + `api/telemetry.js`; that is the
 * file list recorded in AGENTS_LOG.md and pinned by
 * tests/test_telemetry_api.py.
 */

const telemetry = require('./api/telemetry.js');

const NOT_FOUND = JSON.stringify({ ok: false, error: 'not-found' });

async function route(req, res) {
  const path = String(req.url || '').split('?')[0].replace(/\/+$/, '');
  if (path === '/api/telemetry') {
    await telemetry(req, res);
    return;
  }
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(NOT_FOUND);
}

module.exports = route;
