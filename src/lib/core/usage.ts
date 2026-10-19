/**
 * A tiny, privacy-first usage counter.
 *
 * Every copy is counted per icon name. Nothing else is recorded: no
 * identifier, no IP, no referrer, no timestamp. The counts stay in
 * localStorage, so the ranking is per browser.
 *
 * If an endpoint is configured, the counts are also posted there (fire and
 * forget, no cookies, no identifiers) so the ranking can be global.
 *
 * `popular()` is the hook for the future "Popular" category.
 */

const STORAGE_KEY = "silk.usage.v1"

/** Cap the stored map so a long session cannot grow it without bound. */
const MAX_TRACKED = 512

export interface UsageStorage {
	read(): Record<string, number>
	write(counts: Record<string, number>): void
}

/** In-memory fallback for private mode and other blocked storage. */
export class MemoryUsageStorage implements UsageStorage {
	#counts: Record<string, number> = {}

	read(): Record<string, number> {
		return { ...this.#counts }
	}

	write(counts: Record<string, number>): void {
		this.#counts = { ...counts }
	}
}

export class LocalUsageStorage implements UsageStorage {
	read(): Record<string, number> {
		try {
			const raw = localStorage.getItem(STORAGE_KEY)
			if (!raw) return {}

			const parsed: unknown = JSON.parse(raw)
			if (typeof parsed !== "object" || parsed === null) return {}

			const counts: Record<string, number> = {}
			for (const [name, count] of Object.entries(parsed as Record<string, unknown>)) {
				if (typeof count === "number" && Number.isFinite(count) && count > 0) {
					counts[name] = Math.floor(count)
				}
			}

			return counts
		} catch {
			return {}
		}
	}

	write(counts: Record<string, number>): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
		} catch {
			// Quota or privacy mode: the counter stays in memory.
		}
	}
}

export class UsageCounter {
	#counts: Record<string, number>
	#storage: UsageStorage
	#endpoint: string | undefined

	constructor(storage: UsageStorage, endpoint?: string) {
		this.#storage = storage
		this.#endpoint = endpoint
		this.#counts = storage.read()
	}

	record(name: string): void {
		this.#counts[name] = (this.#counts[name] ?? 0) + 1

		const names = Object.keys(this.#counts)
		if (names.length > MAX_TRACKED) {
			const overflow = names
				.sort((left, right) => (this.#counts[left] ?? 0) - (this.#counts[right] ?? 0))
				.slice(0, names.length - MAX_TRACKED)

			for (const tracked of overflow) delete this.#counts[tracked]
		}

		this.#storage.write(this.#counts)
		this.#send(name)
	}

	#send(name: string): void {
		if (!this.#endpoint || typeof navigator === "undefined") return

		try {
			navigator.sendBeacon(
				this.#endpoint,
				new Blob([JSON.stringify({ icon: name })], { type: "application/json" }),
			)
		} catch {
			// Beacon is best effort.
		}
	}

	countOf(name: string): number {
		return this.#counts[name] ?? 0
	}

	/** The most copied icons, most copied first. */
	popular(limit = 24): string[] {
		return Object.entries(this.#counts)
			.filter(([, count]) => count > 0)
			.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
			.slice(0, limit)
			.map(([name]) => name)
	}

	get total(): number {
		return Object.values(this.#counts).reduce((sum, count) => sum + count, 0)
	}

	reset(): void {
		this.#counts = {}
		this.#storage.write(this.#counts)
	}
}
