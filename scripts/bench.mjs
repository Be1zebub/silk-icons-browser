// Latency benchmark for the compiled search index.
//
//   node scripts/bench.mjs [iterations]
//
// Reports cold (first call, JIT cold) and warm percentiles over a query mix
// that covers exact, prefix, synonym, typo, multi-token and empty queries.
import { readFileSync, statSync } from 'node:fs';

import { buildIndex } from '../src/lib/core/index-build.ts';
import { searchIcons } from '../src/lib/core/search.ts';

const catalogPath = new URL('../src/lib/data/catalog.json', import.meta.url);
const raw = JSON.parse(readFileSync(catalogPath, 'utf8'));
const index = buildIndex(raw);

const QUERIES = [
  '',
  'a',
  'zoom',
  'folder',
  'search',
  'gear',
  'trash',
  'avatar',
  'printer',
  'chart',
  'application',
  'user settings',
  'arrow left',
  'star gold',
  'foder',
  'calender',
  'usre',
  'wernch',
  'monke',
  'baskit',
  'side',
  'view columns',
  'application side',
  'page white',
];

const ITERATIONS = Number(process.argv[2] ?? 2000);

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[position];
}

const cold = searchIcons({ query: 'folder', category: 'all', index });

const samples = [];
let totalHits = 0;

for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
  const query = QUERIES[iteration % QUERIES.length];
  const started = process.hrtime.bigint();
  const outcome = searchIcons({ query, category: 'all', index });
  samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  totalHits += outcome.hits.length;
}

const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
const bytes = statSync(catalogPath).size;

console.log(`index        ${(bytes / 1024).toFixed(1)} KB uncompressed, ${index.vocab.length} tokens, ${index.docs.length} icons`);
console.log(`queries      ${QUERIES.length} (${ITERATIONS} iterations)`);
console.log(`cold call    ${cold.duration.toFixed(3)} ms`);
console.log(`mean         ${mean.toFixed(4)} ms`);
console.log(`p50          ${percentile(samples, 0.5).toFixed(4)} ms`);
console.log(`p95          ${percentile(samples, 0.95).toFixed(4)} ms`);
console.log(`p99          ${percentile(samples, 0.99).toFixed(4)} ms`);
console.log(`max          ${Math.max(...samples).toFixed(4)} ms`);
console.log(`avg hits     ${(totalHits / ITERATIONS).toFixed(1)}`);
