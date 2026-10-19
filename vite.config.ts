import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const root = process.cwd();

/**
 * Regenerates the vendored sprite and the compiled search index before Vite
 * starts, so `vite` and `vite build` always run against fresh assets.
 *
 * The generators only write when the output actually changed, which keeps the
 * dev server from looping on its own watcher.
 */
function silkAssets(): Plugin {
  let generated = false;

  const generate = () => {
    if (generated) return;
    generated = true;

    for (const script of ['scripts/build-sprite.mjs', 'scripts/build-catalog.mjs']) {
      const file = path.join(root, script);
      if (!existsSync(file)) continue;

      execFileSync(process.execPath, [file], { cwd: root, stdio: 'inherit' });
    }
  };

  return {
    name: 'silk-assets',
    buildStart() {
      generate();
    },
    configureServer() {
      generate();
    },
  };
}

export default defineConfig({
  // Relative asset paths, so the build works from a domain root and from a
  // sub path (Cloudflare Pages projects, GitHub Pages, a preview branch).
  base: './',
  plugins: [silkAssets(), svelte()],
  server: {
    host: true,
    port: 5178,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    cssTarget: 'chrome111',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 700,
  },
});
