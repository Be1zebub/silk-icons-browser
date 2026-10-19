import raw from '../data/catalog.json';
import { buildCatalog, searchIcons } from '../core/search';
import type {
  CatalogIcon,
  CategoryId,
  CategoryMeta,
  IconEntry,
  RawCatalog,
  SearchHit,
} from '../core/types';

const catalog: RawCatalog = raw as unknown as RawCatalog;

const icons: CatalogIcon[] = catalog.icons.map(({ n, c, p, k }) => ({
  name: n,
  category: c,
  position: [p[0], p[1]] as const,
  keywords: k,
}));

const built = buildCatalog(icons);

/**
 * The catalog is immutable after module load, so it stays outside the reactive
 * graph. Wrapping 1,010 objects in `$state` would proxy every keyword array
 * and make each keystroke an order of magnitude slower.
 */
class CatalogState {
  readonly entries: readonly IconEntry[] = built.entries;
  readonly categories: readonly CategoryMeta[] = catalog.categories;
  readonly counts: Readonly<Record<CategoryId, number>> = catalog.counts;
  readonly aliases: Readonly<Record<string, readonly string[]>> = catalog.aliases;

  query = $state('');
  category = $state<CategoryId | 'all'>('all');

  total = $derived(this.entries.length);

  outcome = $derived(() =>
    searchIcons({
      query: this.query,
      category: this.category,
      aliases: this.aliases,
      entries: this.entries,
    }),
  );

  hits = $derived<readonly SearchHit[]>(this.outcome().hits);
}

export const catalogState = new CatalogState();