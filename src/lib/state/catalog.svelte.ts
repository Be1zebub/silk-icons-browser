import { searchIndex } from "../core/index-store"
import { searchIcons } from "../core/search"
import type { CategoryId, IconDoc, SearchHit } from "../core/types"

class CatalogState {
	readonly entries: readonly IconDoc[] = searchIndex.docs
	readonly categories = searchIndex.categories

	query = $state("")
	category = $state<CategoryId | "all" | "popular" | "recent">("all")

	total = $derived(this.entries.length)

	/**
	 * The search without the category filter. The grid uses the filtered
	 * result, the category chips count the unfiltered one, so a chip always
	 * says how many of the current results it would show.
	 */
	all = $derived(() =>
		searchIcons({
			query: this.query,
			category: "all",
			index: searchIndex,
		}),
	)

	outcome = $derived(() => {
		// "Popular" and "Recent" are not real categories, the app fills those
		// hits itself from the usage counter.
		if (this.category === "all" || this.category === "popular" || this.category === "recent") {
			return this.all()
		}

		return searchIcons({
			query: this.query,
			category: this.category,
			index: searchIndex,
		})
	})

	hits = $derived<readonly SearchHit[]>(this.outcome().hits)

	/** Result count per category for the current query. */
	counts = $derived.by<Readonly<Record<CategoryId, number>>>(() => {
		const counts = {} as Record<CategoryId, number>

		for (const hit of this.all().hits) {
			counts[hit.icon.category] = (counts[hit.icon.category] ?? 0) + 1
		}

		return counts
	})

	/** Number of results for the current query, across every category. */
	matched = $derived(this.all().hits.length)

	countFor(id: CategoryId): number {
		return this.counts[id] ?? 0
	}
}

export const catalogState = new CatalogState()
