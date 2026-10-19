/**
 * The global copy counter.
 *
 * A Durable Object, so the counts are globally consistent and need no
 * provisioning: the binding is declared in wrangler.toml and the class is
 * created with the first deploy. The client batches its copies and posts
 * them in one request, so a visitor costs one write per batch.
 *
 * Only the icon name and a count are stored. No identifier, no IP, no
 * referrer, no timestamp.
 */

interface Storage {
	get<T>(key: string): Promise<T | undefined>
	put<T>(key: string, value: T): Promise<void>
}

interface DurableObjectState {
	storage: Storage
}

const KEY = "counts"
/** Keep the value small: the tail of the ranking is noise anyway. */
const MAX_ICONS = 512

export class Counters {
	#state: DurableObjectState

	constructor(state: DurableObjectState) {
		this.#state = state
	}

	async fetch(request: Request): Promise<Response> {
		if (request.method === "POST") return this.#add(request)
		return this.#ranking()
	}

	async #read(): Promise<Record<string, number>> {
		const stored = await this.#state.storage.get<Record<string, number>>(KEY)
		if (!stored || typeof stored !== "object") return {}

		const counts: Record<string, number> = {}
		for (const [icon, count] of Object.entries(stored)) {
			if (typeof count === "number" && Number.isFinite(count) && count > 0) {
				counts[icon] = Math.floor(count)
			}
		}

		return counts
	}

	async #add(request: Request): Promise<Response> {
		const body = (await request.json().catch(() => null)) as {
			counts?: Record<string, unknown>
		} | null

		const counts = body?.counts
		if (!counts || typeof counts !== "object") {
			return Response.json({ error: "counts is required" }, { status: 400 })
		}

		const stored = await this.#read()

		for (const [icon, count] of Object.entries(counts)) {
			if (!/^[a-z0-9_]{1,64}$/.test(icon)) continue
			if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) continue

			stored[icon] = (stored[icon] ?? 0) + Math.floor(count)
		}

		const names = Object.keys(stored)
		if (names.length > MAX_ICONS) {
			for (const name of names
				.sort((left, right) => (stored[left] ?? 0) - (stored[right] ?? 0))
				.slice(0, names.length - MAX_ICONS)) {
				delete stored[name]
			}
		}

		await this.#state.storage.put(KEY, stored)

		return new Response(null, { status: 204 })
	}

	async #ranking(): Promise<Response> {
		const counts = await this.#read()

		const ranked = Object.entries(counts)
			.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
			.slice(0, MAX_ICONS)

		return Response.json({ counts: Object.fromEntries(ranked) })
	}
}
