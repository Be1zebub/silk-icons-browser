const STORAGE_KEY = "silk.prefs.v1"

export type ThemePreference = "system" | "dark" | "light"
export type TileSize = 16 | 24 | 32 | 48

export const TILE_SIZES: readonly TileSize[] = [16, 24, 32, 48]

interface Prefs {
	theme: ThemePreference
	tileSize: TileSize
}

const DEFAULTS: Prefs = {
	theme: "system",
	tileSize: 48,
}

function isTileSize(value: unknown): value is TileSize {
	return (
		typeof value === "number" &&
		(TILE_SIZES as readonly number[]).includes(value)
	)
}

function readStored(): Partial<Prefs> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return {}
		const parsed: unknown = JSON.parse(raw)
		if (typeof parsed !== "object" || parsed === null) return {}
		const value = parsed as Record<string, unknown>
		const result: Partial<Prefs> = {}

		if (
			value["theme"] === "system" ||
			value["theme"] === "dark" ||
			value["theme"] === "light"
		) {
			result.theme = value["theme"]
		}
		if (isTileSize(value["tileSize"])) result.tileSize = value["tileSize"]

		return result
	} catch {
		return {}
	}
}

function writeStored(prefs: Prefs): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
	} catch {
		// Storage can be unavailable in private modes; preferences stay in memory.
	}
}

function systemTheme(): "dark" | "light" {
	return window.matchMedia("(prefers-color-scheme: light)").matches
		? "light"
		: "dark"
}

class PrefsState {
	#prefs = $state<Prefs>({ ...DEFAULTS, ...readStored() })

	get theme(): ThemePreference {
		return this.#prefs.theme
	}

	get resolvedTheme(): "dark" | "light" {
		return this.#prefs.theme === "system" ? systemTheme() : this.#prefs.theme
	}

	get tileSize(): TileSize {
		return this.#prefs.tileSize
	}

	setTheme(theme: ThemePreference): void {
		this.#prefs.theme = theme
		this.#persist()
	}

	setTileSize(size: TileSize): void {
		this.#prefs.tileSize = size
		this.#persist()
	}

	#persist(): void {
		writeStored(this.#prefs)
	}

	/** Keeps the document in sync with the resolved theme. */
	syncTheme(): () => void {
		const apply = () => {
			document.documentElement.dataset["theme"] = this.resolvedTheme
		}

		apply()

		const media = window.matchMedia("(prefers-color-scheme: light)")
		media.addEventListener("change", apply)

		return () => media.removeEventListener("change", apply)
	}
}

export const prefs = new PrefsState()
