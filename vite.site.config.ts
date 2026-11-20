import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import path from 'node:path';
import { SHOWCASES } from './src/showcase/meta';
import { showcaseCards } from './site/src/cards';

/**
 * The public site (v0.6): the custom landing page, built separately from the
 * editor so it stays small. `npm run build:site` puts it in dist-site/ next to
 * the editor (studio/) and the exported showcase OneFiles (showcase/).
 */
function showcaseCardsPlugin(): Plugin {
  return {
    name: 'ofs-showcase-cards',
    transformIndexHtml(html) {
      return html.replace('<!-- @showcase-cards -->', showcaseCards(SHOWCASES));
    },
  };
}

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'site'),
  base: './',
  publicDir: path.resolve(import.meta.dirname, 'site/public'),
  plugins: [showcaseCardsPlugin()],
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist-site'),
    emptyOutDir: true,
    modulePreload: false,
  },
  server: { port: 5174 },
  preview: { port: 4174 },
});
