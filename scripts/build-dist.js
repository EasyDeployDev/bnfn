import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outdir = resolve(root, 'dist', 'src');

rmSync(resolve(root, 'dist'), {
  recursive: true,
  force: true,
});
mkdirSync(outdir, {
  recursive: true,
});

const result = await Bun.build({
  entrypoints: [resolve(root, 'src', 'index.js')],
  format: 'esm',
  minify: true,
  outdir,
  target: 'bun',
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log.message);
  }

  process.exit(1);
}
