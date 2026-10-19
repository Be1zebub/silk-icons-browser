import {
	LocalUsageStorage,
	UsageCounter,
	type UsageStorage,
} from "../core/usage"

const ENDPOINT = import.meta.env.VITE_USAGE_ENDPOINT as string | undefined

function createStorage(): UsageStorage {
	if (typeof localStorage === "undefined") return new LocalUsageStorage()
	return new LocalUsageStorage()
}

/**
 * Reactive wrapper around the usage counter. The counter itself is plain
 * TypeScript so it can be unit tested; this layer only adds reactivity.
 */
class UsageState {
	#counter = new UsageCounter(createStorage(), ENDPOINT)
	/** Bumped on every write so the derived values refresh. */
	#version = $state(0)

	recordCopy(name: string): void {
		this.#counter.record(name)
		this.#version += 1
	}

	countOf(name: string): number {
		this.#version
		return this.#counter.countOf(name)
	}

	/** The most copied icons, most copied first. The hook for "Popular". */
	popular(limit = 24): string[] {
		this.#version
		return this.#counter.popular(limit)
	}

	total = $derived.by(() => {
		this.#version
		return this.#counter.total
	})

	hasData = $derived.by(() => {
		this.#version
		return this.#counter.total > 0
	})
}

export const usage = new UsageState()
