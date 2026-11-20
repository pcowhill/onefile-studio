// Writes every landing-page showcase as a genuine standalone OneFile:
//   node scripts/export-showcases.mjs <out-dir>
// It loads the editor's own export code through Vite (so `virtual:ofs-runtime`
// and the 3D add-on are bundled exactly as in the editor) and calls
// exportShowcase(), which mirrors the Export dialog's "Original" path.
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'dist-site/showcase');
const server = await createServer({
  configFile: path.resolve('vite.config.ts'),
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'warn',
});
try {
  const { exportShowcase } = await server.ssrLoadModule('/src/showcase/export.ts');
  const { SHOWCASES } = await server.ssrLoadModule('/src/showcase/meta.ts');
  const { default: core } = await server.ssrLoadModule('virtual:ofs-runtime');
  const { default: model3d } = await server.ssrLoadModule('virtual:ofs-runtime-3d');
  fs.mkdirSync(out, { recursive: true });
  for (const s of SHOWCASES) {
    const html = exportShowcase(s.id, { core, model3d });
    const file = path.join(out, `${s.id}.html`);
    fs.writeFileSync(file, html);
    console.log(`  showcase/${s.id}.html  ${(html.length / 1024).toFixed(0)} KB`);
  }
} finally {
  await server.close();
}
