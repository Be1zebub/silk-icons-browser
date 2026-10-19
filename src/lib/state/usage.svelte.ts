import {
	LocalUsageStorage,
	RecentBuffer,
	UsageCounter,
	fetchGlobalCounts,
	postCounts,
	rankCounts,
	type UsageStorage,
} from "../core/usage"

/**
 * Where the counter is sent. The Pages Function answers on the same origin, so
 * this works out of the box in production. The Vite dev server has no such
 * endpoint, so there it stays off unless one is set explicitly.
 */
const ENDPOINT =
	(import.meta.env.VITE_USAGE_ENDPOINT as string | undefined) ??
	(import.meta.env.DEV ? null : "/api/usage")

/** How often the pending copies are flushed to the server. */
const SYNC_INTERVAL = 30_000

/** How many icons the global ranking keeps. */
const GLOBAL_LIMIT = 64

function createStorage(): UsageStorage {
	if (typeof localStorage === "undefined") return new LocalUsageStorage()

	// The counters used to live in one flat key. Drop it, it is dead weight.
	try {
		localStorage.removeItem("silk.usage.v1")
	} catch {
		// Storage is unavailable, nothing to clean up.
	}

	return new LocalUsageStorage()
}

/**
 * Reactive wrapper around the usage counter. The counter itself is plain
 * TypeScript so it can be unit tested; this layer only adds reactivity.
 */
class UsageState {
	#counter = new UsageCounter(createStorage())
	#recent = new RecentBuffer(createStorage())
	/** Bumped on every write so the derived values refresh. */
	#version = $state(0)
	/** Copies made since the last flush. */
	#pending = new Map<string, number>()
	/** The ranking from the server, when there is a server. */
	#global = $state<string[]>([])
	#timer = 0

	recordCopy(name: string): void {
		this.#counter.record(name)
		this.#recent.push(name)
		this.#pending.set(name, (this.#pending.get(name) ?? 0) + 1)
		this.#version += 1
	}

	countOf(name: string): number {
		this.#version
		return this.#counter.countOf(name)
	}

	/** The most copied icons on this machine. */
	popular(limit = 24): string[] {
		this.#version
		return this.#counter.popular(limit)
	}

	/** The icons copied on this machine, most recent first. Local only. */
	recent(): string[] {
		this.#version
		return this.#recent.list()
	}

	/**
	 * The most copied icons, from the server when there is one and from this
	 * machine otherwise.
	 */
	popularIcons = $derived.by<string[]>(() => {
		this.#version
		if (this.#global.length > 0) return this.#global
		return this.#counter.popular(24)
	})

	total = $derived.by(() => {
		this.#version
		return this.#counter.total
	})

	hasData = $derived.by(() => {
		this.#version
		return this.#counter.total > 0
	})

	/** Starts the background flush and the first fetch of the global ranking. */
	start(): void {
		if (this.#timer) return

		if (ENDPOINT) {
			this.#timer = window.setInterval(() => {
				void this.sync()
			}, SYNC_INTERVAL)

			// Flush the last copies when the page goes away. `keepalive` lets the
			// request outlive the page.
			const flush = () => {
				if (this.#pending.size === 0) return

				const counts = Object.fromEntries(this.#pending)
				this.#pending.clear()

				void postCounts(ENDPOINT, counts).then((sent) => {
					if (sent) return
					for (const [name, count] of Object.entries(counts)) {
						this.#pending.set(name, (this.#pending.get(name) ?? 0) + count)
					}
				})
			}

			window.addEventListener("pagehide", flush)

			void this.refresh()
		}
	}

	stop(): void {
		if (!this.#timer) return
		window.clearInterval(this.#timer)
		this.#timer = 0
	}

	/** Fetches the ranking from the server. Silently does nothing without one. */
	async refresh(): Promise<void> {
		if (!ENDPOINT) return

		const counts = await fetchGlobalCounts(ENDPOINT)
		if (Object.keys(counts).length === 0) return

		this.#global = rankCounts(counts, GLOBAL_LIMIT)
		this.#version += 1
	}

	/** Sends the copies made since the last flush. */
	async sync(): Promise<void> {
		if (!ENDPOINT || this.#pending.size === 0) return

		const counts = Object.fromEntries(this.#pending)
		this.#pending.clear()

		const sent = await postCounts(ENDPOINT, counts)
		if (sent) return

		// Put the counts back so the next flush tries again.
		for (const [name, count] of Object.entries(counts)) {
			this.#pending.set(name, (this.#pending.get(name) ?? 0) + count)
		}
	}
}

export const usage = new UsageState()
