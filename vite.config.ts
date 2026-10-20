import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const root = process.cwd();

const mtime = (file: string): number => {
	try {
		return statSync(path.join(root, file)).mtimeMs;
	} catch {
		return 0;
	}
};

/** True when an output is missing or older than any of its inputs. */
function isStale(inputs: readonly string[], outputs: readonly string[]): boolean {
	if (outputs.some((file) => !existsSync(path.join(root, file)))) return true;

	const newestInput = Math.max(...inputs.map(mtime));
	const oldestOutput = Math.min(...outputs.map(mtime));

	return oldestOutput < newestInput;
}

const SPRITE_INPUTS = ['vendor/famfamfam-silk.png', 'vendor/famfamfam-silk.css'];
const SPRITE_OUTPUTS = ['src/assets/famfamfam/sprite.png', 'src/lib/styles/silk.css'];
const CATALOG_INPUTS = ['src/lib/styles/silk.css'];
const CATALOG_OUTPUTS = ['src/lib/data/catalog.json'];

/**
 * Regenerates the vendored sprite and the compiled search index before Vite
 * starts, so `vite` and `vite build` always run against fresh assets.
 *
 * Each step is skipped when its outputs are newer than its inputs: the sprite
 * packer is a pure JS PNG encoder and takes a few seconds, and nobody should
 * pay for it on every dev server start.
 */
function silkAssets(): Plugin {
	let generated = false;

	const generate = () => {
		if (generated) return;
		generated = true;

		const run = (script: string) => {
			execFileSync(process.execPath, [path.join('scripts', script)], {
				cwd: root,
				stdio: 'inherit',
			});
		};

		if (isStale(SPRITE_INPUTS, SPRITE_OUTPUTS)) run('build-sprite.mjs');
		if (isStale(CATALOG_INPUTS, CATALOG_OUTPUTS)) run('build-catalog.mjs');
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
