// Packaging smoke test for the telemetry service entrypoint (INFRA-4 / ChatGPT
// round-2 P1). The Vercel project deploys a plain Node service whose documented
// layout is `src/app.js` (entrypoint) + `src/api/telemetry.js` (handler), while
// the repository stores the pair as siblings under `api/`. This test performs
// the exact deterministic packaging step the deployment applies — copies the
// committed files into that layout — then boots the PACKAGED entrypoint and
// proves it loads the exact committed handler bytes and serves the pinned
// contract. A layout/import regression therefore fails here, not in production.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const ENTRYPOINT = join(REPO, 'api', 'app.js');
const HANDLER = join(REPO, 'api', 'telemetry.js');

async function freePort() {
  const net = await import('node:net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function request(port, method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    import('node:http').then(({ request: httpRequest }) => {
      const req = httpRequest({ host: '127.0.0.1', port, method, path, headers }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, allow: res.headers.allow, body }));
      });
      req.on('error', reject);
      req.end();
    }, reject);
  });
}

test('the packaged src/ layout boots the committed entrypoint and serves the pinned contract', async () => {
  const work = await mkdtemp(join(tmpdir(), 'telemetry-package-'));
  try {
    // The exact packaging mapping documented in live-infra-hardening.md §4:
    //   api/app.js        -> src/app.js          (entrypoint)
    //   api/telemetry.js  -> src/api/telemetry.js (the endpoint handler)
    const srcRoot = join(work, 'src');
    const srcApi = join(srcRoot, 'api');
    await mkdir(srcApi, { recursive: true });
    await copyFile(ENTRYPOINT, join(srcRoot, 'app.js'));
    await copyFile(HANDLER, join(srcApi, 'telemetry.js'));

    // The packaged handler is byte-identical to the committed one.
    const committed = await readFile(HANDLER);
    const packaged = await readFile(join(srcApi, 'telemetry.js'));
    assert.equal(createHash('sha256').update(packaged).digest('hex'),
      createHash('sha256').update(committed).digest('hex'),
      'the packaged handler must be the exact committed handler bytes');

    const port = await freePort();
    const child = spawn(process.execPath, [join(srcRoot, 'app.js')], {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stderr = [];
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
    try {
      // Wait for the service to listen (or fail fast on a resolve error).
      await new Promise((resolve, reject) => {
        const started = Date.now();
        const probe = () => {
          request(port, 'OPTIONS', '/api/telemetry', { Origin: 'https://coderunknow.github.io' })
            .then(resolve)
            .catch(() => {
              if (child.exitCode !== null) return reject(new Error(`entrypoint exited: ${stderr.join('')}`));
              if (Date.now() - started > 15000) return reject(new Error('entrypoint never listened'));
              setTimeout(probe, 100);
            });
        };
        probe();
      });

      const preflight = await request(port, 'OPTIONS', '/api/telemetry', { Origin: 'https://coderunknow.github.io' });
      assert.equal(preflight.status, 204, 'OPTIONS preflight must answer 204');
      const methodProbe = await request(port, 'GET', '/api/telemetry', { Origin: 'https://coderunknow.github.io' });
      assert.equal(methodProbe.status, 405, 'GET must answer 405');
      assert.equal(methodProbe.allow, 'POST, OPTIONS', 'GET must advertise Allow: POST, OPTIONS');
      const badOrigin = await request(port, 'POST', '/api/telemetry', { Origin: 'https://evil.example', 'Content-Type': 'application/json' });
      assert.equal(badOrigin.status, 403, 'a disallowed origin must be refused before any body handling');
      assert.deepEqual(JSON.parse(badOrigin.body), { ok: false, error: 'origin-not-allowed' });
    } finally {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.on('exit', resolve));
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('the entrypoint refuses to boot when no handler exists next to it (fails loudly, not 500s)', async () => {
  const work = await mkdtemp(join(tmpdir(), 'telemetry-nohandler-'));
  try {
    const srcRoot = join(work, 'src');
    await mkdir(srcRoot, { recursive: true });
    await copyFile(ENTRYPOINT, join(srcRoot, 'app.js'));
    const child = spawn(process.execPath, [join(srcRoot, 'app.js')], {
      env: { ...process.env, PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const code = await new Promise((resolve) => child.on('exit', (c) => resolve(c)));
    assert.notEqual(code, 0, 'a handler-less deployment must exit non-zero at boot');
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test('the repository sibling layout still resolves (sibling handler preferred)', async () => {
  // Boot the committed entrypoint straight from the repository layout: the
  // sibling handler (api/telemetry.js) must win over the nested guess.
  const work = await mkdtemp(join(tmpdir(), 'telemetry-repolayout-'));
  try {
    const port = await freePort();
    const child = spawn(process.execPath, [ENTRYPOINT], {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stderr = [];
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
    try {
      await new Promise((resolve, reject) => {
        const started = Date.now();
        const probe = () => {
          request(port, 'GET', '/api/telemetry')
            .then(resolve)
            .catch(() => {
              if (child.exitCode !== null) return reject(new Error(`entrypoint exited: ${stderr.join('')}`));
              if (Date.now() - started > 15000) return reject(new Error('entrypoint never listened'));
              setTimeout(probe, 100);
            });
        };
        probe();
      });
      const methodProbe = await request(port, 'GET', '/api/telemetry');
      assert.equal(methodProbe.status, 405, 'the repository-layout service answers the pinned contract');
    } finally {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.on('exit', resolve));
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
