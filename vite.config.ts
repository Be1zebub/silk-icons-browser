import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: true,
    port: 5178,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    cssTarget: 'chrome111',
  },
});