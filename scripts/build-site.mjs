// Builds the public site into dist-site/:
//   index.html, assets/, media/   the custom landing page (vite.site.config.ts)
//   studio/index.html             the editor — the same single file as dist/index.html
//   showcase/<id>.html            every showcase exported as a genuine OneFile
// Run `npm run build` first (the editor build); `npm run build:site` does both.
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist-site');
const editor = path.join(root, 'dist', 'index.html');
if (!fs.existsSync(editor)) {
  console.error('dist/index.html is missing — run `npm run build` first.');
  process.exit(1);
}

await build({ configFile: path.join(root, 'vite.site.config.ts'), logLevel: 'warn' });

fs.mkdirSync(path.join(out, 'studio'), { recursive: true });
fs.copyFileSync(editor, path.join(out, 'studio', 'index.html'));
console.log('  studio/index.html (editor)');

execFileSync(process.execPath, [path.join(root, 'scripts', 'export-showcases.mjs'), path.join(out, 'showcase')], { stdio: 'inherit', cwd: root });

// GitHub Pages: serve files as-is (no Jekyll processing of the dist-site tree).
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Site ready in ${path.relative(root, out)}/`);
