import { searchIndex } from '../core/index-store';
import { searchIcons } from '../core/search';
import type { CategoryId, IconDoc, SearchHit } from '../core/types';

class CatalogState {
  readonly entries: readonly IconDoc[] = searchIndex.docs;
  readonly categories = searchIndex.categories;
  readonly counts = searchIndex.categoryCounts;

  query = $state('');
  category = $state<CategoryId | 'all'>('all');

  total = $derived(this.entries.length);

  outcome = $derived(() =>
    searchIcons({
      query: this.query,
      category: this.category,
      index: searchIndex,
    }),
  );

  hits = $derived<readonly SearchHit[]>(this.outcome().hits);

  countFor(id: CategoryId): number {
    return this.counts[id] ?? 0;
  }
}

export const catalogState = new CatalogState();