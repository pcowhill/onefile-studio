/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { runtimePlugin, singleFilePlugin } from './build/plugins';

export default defineConfig({
  // Relative base: the build works on GitHub Pages (any sub-path) and from disk.
  base: './',
  plugins: [react(), runtimePlugin(path.resolve(__dirname, 'src/runtime/standalone.ts'), path.resolve(__dirname, 'src/runtime/model3d/addon.ts')), singleFilePlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 4000,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
