/**
 * A tiny, privacy-first usage counter.
 *
 * Every copy is counted per icon name. Nothing else is recorded: no
 * identifier, no IP, no referrer, no timestamp. The counts stay in
 * localStorage, so the ranking is per browser.
 *
 * Sending them somewhere is the job of the reactive wrapper, which batches
 * the copies and posts them in one request.
 *
 * `popular()` is the hook for the "Popular" category.
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

	constructor(storage: UsageStorage) {
		this.#storage = storage
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

/**
 * Fetches the global ranking from the Pages Function. Returns an empty map
 * when there is no endpoint, it is not deployed, or the network is down.
 */
export async function fetchGlobalCounts(
	endpoint: string,
	fetchImpl: typeof fetch = fetch,
): Promise<Record<string, number>> {
	try {
		const response = await fetchImpl(endpoint, {
			headers: { accept: "application/json" },
			cache: "no-store",
		})
		if (!response.ok) return {}

		const body = (await response.json()) as { counts?: unknown }
		const counts = body.counts
		if (!counts || typeof counts !== "object") return {}

		const result: Record<string, number> = {}
		for (const [icon, count] of Object.entries(counts as Record<string, unknown>)) {
			if (typeof count === "number" && Number.isFinite(count) && count > 0) {
				result[icon] = Math.floor(count)
			}
		}

		return result
	} catch {
		return {}
	}
}

/** Sends the copies made since the last flush. */
export async function postCounts(
	endpoint: string,
	counts: Record<string, number>,
	fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
	if (Object.keys(counts).length === 0) return true

	try {
		await fetchImpl(endpoint, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ counts }),
			keepalive: true,
		})
		return true
	} catch {
		return false
	}
}

/** Ranks the counts, most copied first. */
export function rankCounts(counts: Record<string, number>, limit = 64): string[] {
	return Object.entries(counts)
		.filter(([, count]) => count > 0)
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		.slice(0, limit)
		.map(([name]) => name)
}
