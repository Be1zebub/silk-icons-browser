import type { CategoryId } from '../core/types';

const PARAM_QUERY = 'q';
const PARAM_CATEGORY = 'cat';
const PARAM_ICON = 'icon';

export interface UrlSnapshot {
  query: string;
  category: CategoryId | 'all' | 'popular' | 'recent';
  icon: string | null;
}

/**
 * Keeps the search state in the address bar so results are shareable and the
 * back button behaves like users expect.
 */
export class UrlState {
  #pending = 0;

  read(): UrlSnapshot {
    const params = new URLSearchParams(window.location.search);
    const rawCategory = params.get(PARAM_CATEGORY);

    return {
      query: params.get(PARAM_QUERY) ?? '',
      category:
        rawCategory === 'popular' || rawCategory === 'recent'
          ? rawCategory
          : rawCategory && rawCategory !== 'all'
            ? (rawCategory as CategoryId)
            : 'all',
      icon: params.get(PARAM_ICON),
    };
  }

  write(state: UrlSnapshot, replace = true): void {
    window.clearTimeout(this.#pending);

    // Coalesce bursts of keystrokes into a single history entry.
    this.#pending = window.setTimeout(() => {
      const url = new URL(window.location.href);

      if (state.query) url.searchParams.set(PARAM_QUERY, state.query);
      else url.searchParams.delete(PARAM_QUERY);

      if (state.category !== 'all') url.searchParams.set(PARAM_CATEGORY, state.category);
      else url.searchParams.delete(PARAM_CATEGORY);

      if (state.icon) url.searchParams.set(PARAM_ICON, state.icon);
      else url.searchParams.delete(PARAM_ICON);

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = `${url.pathname}${url.search}${url.hash}`;
      if (next === current) return;

      if (replace) window.history.replaceState(null, '', next);
      else window.history.pushState(null, '', next);
    }, 180);
  }
}

export const urlState = new UrlState();