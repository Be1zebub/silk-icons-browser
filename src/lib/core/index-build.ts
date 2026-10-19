import type { CategoryId, IconDoc, RawCatalog, SearchIndex } from './types';

/** Derives the per-icon fields the runtime needs, once, at module load. */
function buildDocs(source: RawCatalog): IconDoc[] {
  return source.icons.map((icon, id) => {
    const parts = icon.n.split('_');
    const segments: string[] = [];
    const ranges: [number, number][] = [];

    let cursor = 0;
    for (const part of parts) {
      segments.push(part.toLowerCase());
      ranges.push([cursor, cursor + part.length]);
      cursor += part.length + 1;
    }

    return {
      id,
      name: icon.n,
      category: (source.categories[icon.c]?.id ?? 'misc') as CategoryId,
      position: [icon.p[0], icon.p[1]] as const,
      segments,
      ranges,
      compact: segments.join(''),
      normalized: segments.join(' '),
    };
  });
}

function buildCategoryIcons(docs: readonly IconDoc[]): Map<CategoryId, number[]> {
  const map = new Map<CategoryId, number[]>();

  for (const doc of docs) {
    const bucket = map.get(doc.category);
    if (bucket) bucket.push(doc.id);
    else map.set(doc.category, [doc.id]);
  }

  return map;
}

function buildCategoryCounts(icons: ReadonlyMap<CategoryId, readonly number[]>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [category, ids] of icons) counts[category] = ids.length;
  return counts;
}

/** Compiles the raw catalog into the structure the search engine runs on. */
export function buildIndex(source: RawCatalog): SearchIndex {
  const docs = buildDocs(source);
  const categoryIcons = buildCategoryIcons(docs);

  return {
    docs,
    categories: source.categories,
    vocab: source.vocab,
    vocabIndex: new Map(source.vocab.map((term, position) => [term, position])),
    exact: source.exact,
    synonyms: source.synonyms,
    categoryWords: source.categoryWords,
    categoryIcons,
    categoryCounts: buildCategoryCounts(categoryIcons),
  };
}