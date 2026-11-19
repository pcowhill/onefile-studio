import { build as esbuild } from 'esbuild';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Escapes JavaScript so it can be placed inside an inline <script> element
 * without prematurely closing it or entering the HTML "escaped script" state.
 * The replacements are no-ops for JS semantics (inside strings, template
 * literals, regexes and comments).
 */
export function escapeInlineScript(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

const RUNTIME_ID = 'virtual:ofs-runtime';
const RESOLVED_RUNTIME_ID = '\0' + RUNTIME_ID;

/**
 * Exposes the standalone playback runtime as a string (`virtual:ofs-runtime`).
 * The editor embeds this string in every exported HTML file. The same source
 * modules are imported directly by the editor for Preview, so the editor and
 * the exported document always execute the same playback engine.
 */
export function runtimePlugin(entry: string): Plugin {
  return {
    name: 'ofs-runtime',
    resolveId(id) {
      if (id === RUNTIME_ID) return RESOLVED_RUNTIME_ID;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED_RUNTIME_ID) return null;
      const result = await esbuild({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'iife',
        minify: true,
        target: 'es2020',
        metafile: true,
        legalComments: 'none',
        charset: 'utf8',
        logLevel: 'silent',
      });
      for (const input of Object.keys(result.metafile.inputs)) {
        this.addWatchFile(path.resolve(input));
      }
      const code = escapeInlineScript(result.outputFiles[0].text);
      return `export default ${JSON.stringify(code)};`;
    },
  };
}

/**
 * Inlines all generated JS and CSS into index.html so the production build is
 * a single file that also works when opened directly from disk (file://).
 */
export function singleFilePlugin(): Plugin {
  return {
    name: 'ofs-single-file',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAsset = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.html'));
      if (!htmlAsset || htmlAsset.type !== 'asset') return;
      let html = String(htmlAsset.source);
      for (const [fileName, file] of Object.entries(bundle)) {
        if (file.type === 'chunk' && fileName.endsWith('.js')) {
          const re = new RegExp(`<script[^>]*src="[^"]*${escapeRe(fileName)}"[^>]*></script>`);
          if (re.test(html)) {
            const code = escapeInlineScript(file.code);
            html = html.replace(re, () => `<script type="module">${code}</script>`);
            delete bundle[fileName];
          }
        } else if (file.type === 'asset' && fileName.endsWith('.css')) {
          const re = new RegExp(`<link[^>]*href="[^"]*${escapeRe(fileName)}"[^>]*>`);
          if (re.test(html)) {
            const css = String(file.source).replace(/<\/(style)/gi, '<\\/$1');
            html = html.replace(re, () => `<style>${css}</style>`);
            delete bundle[fileName];
          }
        }
      }
      htmlAsset.source = html;
    },
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
