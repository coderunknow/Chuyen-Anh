import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function generateMeta() {
  const vocabPath = path.resolve('data/vocabulary.json');
  let count = 0;
  try {
    const data = JSON.parse(fs.readFileSync(vocabPath, 'utf-8'));
    count = Array.isArray(data) ? data.length : 0;
  } catch {}
  const now = new Date();
  const commit = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0,7) : 'local';
  return {
    count,
    updated: now.toISOString().split('T')[0],
    commit,
    buildTime: now.toISOString()
  };
}

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    cors: true,
    hmr: { clientPort: 443 },
    allowedHosts: true
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    cors: true,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2018',
    cssCodeSplit: true,
    minify: 'esbuild',
    sourcemap: false
  },
  publicDir: 'public',
  plugins: [
    {
      name: 'vocab-meta',
      buildStart() {
        const meta = generateMeta();
        const dataDir = path.resolve('data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'meta.json'), JSON.stringify(meta, null, 2));
        console.log(`[vocab-meta] ${meta.count} words, updated ${meta.updated}`);
      },
      closeBundle() {
        // Copy data folder to dist/data for static serving
        const srcData = path.resolve('data');
        const destData = path.resolve('dist/data');
        if (!fs.existsSync(destData)) fs.mkdirSync(destData, { recursive: true });
        for (const file of fs.readdirSync(srcData)) {
          if (file.endsWith('.json')) {
            fs.copyFileSync(path.join(srcData, file), path.join(destData, file));
          }
        }
        console.log('[vocab-meta] Copied data to dist/data');
      }
    }
  ],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    globals: true
  }
});
