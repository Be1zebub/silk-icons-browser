<script lang="ts">
	import { Monitor, Moon, Sun } from "@lucide/svelte"

	import CategoryBar from "./lib/components/CategoryBar.svelte"
	import EmptyState from "./lib/components/EmptyState.svelte"
	import IconGrid from "./lib/components/IconGrid.svelte"
	import RelatedBar from "./lib/components/RelatedBar.svelte"
	import SearchField from "./lib/components/SearchField.svelte"
	import Toaster from "./lib/components/Toaster.svelte"
	import Button from "./lib/components/ui/Button.svelte"
	import Kbd from "./lib/components/ui/Kbd.svelte"
	import Segmented from "./lib/components/ui/Segmented.svelte"

	import { copyIconPng, copyText } from "./lib/core/clipboard"
	import type { CategoryId, IconDoc, SearchHit } from "./lib/core/types"
	import { catalogState } from "./lib/state/catalog.svelte"
	import {
		prefs,
		TILE_SIZES,
		type ThemePreference,
		type TileSize,
	} from "./lib/state/prefs.svelte"
	import { toasts } from "./lib/state/toast.svelte"
	import { urlState } from "./lib/state/url"
	import { usage } from "./lib/state/usage.svelte"

	const THEME_ORDER: readonly ThemePreference[] = ["system", "light", "dark"]
	const THEME_LABEL: Record<ThemePreference, string> = {
		system: "System",
		light: "Light",
		dark: "Dark",
	}

	const ARROW_KEYS: Record<string, "left" | "right" | "up" | "down"> = {
		ArrowLeft: "left",
		ArrowRight: "right",
		ArrowUp: "up",
		ArrowDown: "down",
	}

	/** Grid cell width grows with the preview size so labels always fit. */
	const TILE_MIN: Record<TileSize, number> = {
		16: 88,
		24: 104,
		32: 128,
		48: 156,
	}

	let search = $state<ReturnType<typeof SearchField> | null>(null)
	let grid = $state<ReturnType<typeof IconGrid> | null>(null)
	let selectedName = $state<string | null>(null)
	let copiedName = $state<string | null>(null)
	/**
	 * A related icon that is not part of the current results. It is shown as a
	 * temporary first result so clicking it in the related strip actually does
	 * something visible.
	 */
	let pinned = $state<IconDoc | null>(null)

	let flashTimer = 0

	const tileMin = $derived(TILE_MIN[prefs.tileSize])
	const sizeOptions = $derived(
		TILE_SIZES.map((size) => ({
			value: String(size),
			label: String(size),
			title: `${size}px preview`,
		})),
	)
	const selected = $derived(
		selectedName
			? (catalogState.entries.find((icon) => icon.name === selectedName) ??
					null)
			: null,
	)
	const hasQuery = $derived(catalogState.query.trim().length > 0)

	/** Turns a list of icon names into hits, keeping the given order. */
	const hitsFrom = (names: readonly string[]): SearchHit[] => {
		const hits: SearchHit[] = []

		for (const name of names) {
			const icon = catalogState.entries.find((entry) => entry.name === name)
			if (!icon) continue
			hits.push({ icon, score: 0, ranges: [], matchedTokens: 0, coverage: 0 })
		}

		return hits
	}

	/**
	 * The icons everyone copies the most. With a query the ranking follows the
	 * search, without one it follows the popularity.
	 */
	const popularHits = $derived.by<readonly SearchHit[]>(() => {
		const names = usage.popularIcons
		if (!hasQuery) return hitsFrom(names)

		const allowed = new Set(names)
		return catalogState.hits.filter((hit) => allowed.has(hit.icon.name))
	})

	/** The icons copied on this machine, most recent first. Local only. */
	const recentHits = $derived.by<readonly SearchHit[]>(() => {
		const names = usage.recent()
		if (!hasQuery) return hitsFrom(names)

		const allowed = new Set(names)
		return catalogState.hits.filter((hit) => allowed.has(hit.icon.name))
	})

	/** The results of the current category, before the pinned icon. */
	const baseHits = $derived.by<readonly SearchHit[]>(() => {
		if (catalogState.category === "popular") return popularHits
		if (catalogState.category === "recent") return recentHits
		return catalogState.hits
	})

	/** The results, with the pinned related icon in front. */
	const displayHits = $derived.by<readonly SearchHit[]>(() => {
		if (!pinned) return baseHits
		return [
			{
				icon: pinned,
				score: 0,
				ranges: [],
				matchedTokens: 0,
				coverage: 0,
			},
			...baseHits,
		]
	})

	// Theme + URL bootstrap.
	$effect(() => prefs.syncTheme())

	$effect(() => {
		const initial = urlState.read()
		catalogState.query = initial.query
		catalogState.category = initial.category
		selectedName = initial.icon

		const onPopState = () => {
			const next = urlState.read()
			catalogState.query = next.query
			catalogState.category = next.category
			selectedName = next.icon
		}

		window.addEventListener("popstate", onPopState)
		return () => window.removeEventListener("popstate", onPopState)
	})

	$effect(() => {
		urlState.write({
			query: catalogState.query,
			category: catalogState.category,
			icon: selectedName,
		})
	})

	// Keep the selection valid as the result set changes.
	$effect(() => {
		if (!selectedName) return
		if (displayHits.some((hit) => hit.icon.name === selectedName)) return

		selectedName = displayHits[0]?.icon.name ?? null
	})

	// A new query invalidates the temporary related icon.
	$effect(() => {
		catalogState.query
		catalogState.category
		pinned = null
	})

	// Start the usage counter: fetch the global ranking, flush the local one.
	$effect(() => {
		usage.start()
		return () => usage.stop()
	})

	async function copy(text: string, label: string): Promise<void> {
		const ok = await copyText(text)
		toasts.show(
			ok ? `${label} copied` : "Clipboard unavailable",
			ok ? "success" : "default",
		)
	}

	/** Every copy counts, whatever the format was. */
	function recordCopy(name: string): void {
		copiedName = name
		usage.recordCopy(name)
		window.clearTimeout(flashTimer)
		flashTimer = window.setTimeout(() => (copiedName = null), 850)
	}

	function activate(name: string): void {
		void copy(name, name)
		recordCopy(name)
	}

	function reset(): void {
		catalogState.query = ""
		catalogState.category = "all"
		selectedName = null
		search?.focus(false)
	}

	function cycleTheme(): void {
		const next =
			THEME_ORDER[(THEME_ORDER.indexOf(prefs.theme) + 1) % THEME_ORDER.length]
		prefs.setTheme(next)
		toasts.show(`Theme: ${THEME_LABEL[next]}`, "default", 1200)
	}

	function handleKeydown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null
		const typing =
			!!target &&
			(target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable)
		const onButton = target?.tagName === "BUTTON"

		const arrow = ARROW_KEYS[event.key]
		// Up/Down drive the grid even while the search field has focus; left/right
		// stay in the text so the caret keeps working. When the grid already owns
		// the focus, the DOM focus follows the selection so Enter hits the
		// highlighted tile rather than the last one that was clicked.
		if (arrow && (!typing || arrow === "up" || arrow === "down")) {
			event.preventDefault()
			grid?.move(arrow, !typing)
			return
		}

		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			event.preventDefault()
			search?.focus()
			return
		}

		if (event.key === "/" && !typing) {
			event.preventDefault()
			search?.focus()
			return
		}

		if (event.key === "Escape" && !typing) {
			if (selectedName) selectedName = null
			else reset()
			return
		}

		if (event.key === "Enter" && onButton) {
			// Enter on a focused tile copies instead of the default click, which
			// would only select.
			if (target?.closest?.(".grid .tile")) {
				event.preventDefault()
				if (selectedName) activate(selectedName)
			}
			return
		}

		if (event.key === "Enter" && !onButton) {
			// Enter copies the highlighted icon, or the top hit when nothing is
			// highlighted yet — the single most common "find and grab it" flow.
			const name = selectedName ?? catalogState.hits[0]?.icon.name
			if (name) {
				event.preventDefault()
				selectedName = name
				activate(name)
			}
			return
		}

		if (typing) return

		if (event.key.toLowerCase() === "c" && selectedName) {
			event.preventDefault()
			activate(selectedName)
		}
	}

	function selectRelated(name: string): void {
		// A related icon that is not in the current results becomes a
		// temporary first result, so clicking it actually shows something.
		const inResults = baseHits.some((hit) => hit.icon.name === name)
		pinned = inResults
			? null
			: (catalogState.entries.find((entry) => entry.name === name) ?? null)
		selectedName = name

		// Bring it into view: the pinned icon sits at the very top, a result
		// that is already there just needs scrolling to. Deferred by a frame so
		// the grid has the new list.
		requestAnimationFrame(() => grid?.reveal(name))
	}

	function select(name: string): void {
		selectedName = name
		if (pinned && name !== pinned.name) pinned = null
	}

	async function copyPng(icon: IconDoc): Promise<void> {
		const ok = await copyIconPng(icon.position)

		if (ok) recordCopy(icon.name)

		toasts.show(
			ok ? "PNG copied" : "This browser cannot copy images",
			ok ? "success" : "default",
		)
	}

	const entry = $derived<IconDoc | null>(selected)

	// Keep the toast clear of the related strip.
	$effect(() => {
		document.documentElement.style.setProperty(
			"--toast-offset",
			entry ? "4.25rem" : "1.25rem",
		)
	})
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="shell">
	<header class="topbar">
		<div class="search-slot">
			<SearchField
				bind:this={search}
				bind:value={catalogState.query}
				resultCount={displayHits.length}
				total={catalogState.total}
				fuzzy={catalogState.outcome().fuzzy}
				oninput={() => undefined}
				onclear={() => {
					catalogState.query = ""
				}}
			/>
		</div>

		<div class="tools">
			<Segmented
				options={sizeOptions}
				value={String(prefs.tileSize)}
				label="Preview size"
				size="sm"
				onchange={(value) => prefs.setTileSize(Number(value) as TileSize)}
			>
				{#snippet children(value: string)}
					<span class="size-option">
						<i
							class="silk accept"
							style="--silk-size: {Math.min(14, Number(value) / 3 + 2)}px"
						></i>
						{value}
					</span>
				{/snippet}
			</Segmented>

			<Button
				variant="ghost"
				size="icon-sm"
				label={`Theme: ${THEME_LABEL[prefs.theme]}`}
				hideLabel
				onclick={cycleTheme}
			>
				{#if prefs.theme === "system"}
					<Monitor size={14} />
				{:else if prefs.theme === "light"}
					<Sun size={14} />
				{:else}
					<Moon size={14} />
				{/if}
			</Button>

			<Button
				variant="ghost"
				size="icon-sm"
				label="Star on github"
				hideLabel
				href="https://github.com/Be1zebub/silk-icons-browser"
				target="_blank"
				rel="noreferrer"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="1.1em"
					height="1.1em"
					viewBox="0 0 24 24"
				>
					<path
						fill="currentColor"
						fill-rule="evenodd"
						d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385c.6.105.825-.255.825-.57c0-.285-.015-1.23-.015-2.235c-3.015.555-3.795-.735-4.035-1.41c-.135-.345-.72-1.41-1.23-1.695c-.42-.225-1.02-.78-.015-.795c.945-.015 1.62.87 1.845 1.23c1.08 1.815 2.805 1.305 3.495.99c.105-.78.42-1.305.765-1.605c-2.67-.3-5.46-1.335-5.46-5.925c0-1.305.465-2.385 1.23-3.225c-.12-.3-.54-1.53.12-3.18c0 0 1.005-.315 3.3 1.23c.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23c.66 1.65.24 2.88.12 3.18c.765.84 1.23 1.905 1.23 3.225c0 4.605-2.805 5.625-5.475 5.925c.435.375.81 1.095.81 2.22c0 1.605-.015 2.895-.015 3.3c0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12"
						clip-rule="evenodd"
					/>
				</svg>
			</Button>
		</div>
	</header>

	<div class="filters">
		<CategoryBar
			categories={catalogState.categories}
			counts={catalogState.counts}
			total={catalogState.matched}
			value={catalogState.category}
			popular={{
				matched: popularHits.length,
				total: usage.popularIcons.length,
			}}
			recent={{ matched: recentHits.length, total: usage.recent().length }}
			onchange={(value: CategoryId | "all" | "popular" | "recent") => {
				catalogState.category = value
			}}
		/>
	</div>

	<main class="results">
		<div class="statusbar">
			<p class="status">
				{#if hasQuery}
					<strong>{displayHits.length.toLocaleString("en-US")}</strong>
					result{displayHits.length === 1 ? "" : "s"}
					<span class="dot">·</span>
					{catalogState.outcome().duration.toFixed(1)} ms
				{:else if catalogState.category !== "all"}
					<strong>{displayHits.length.toLocaleString("en-US")}</strong> in category
				{:else}
					<strong>{catalogState.total.toLocaleString("en-US")}</strong> icons
				{/if}
			</p>

			<p class="hints">
				<span><Kbd keys="/" /> search</span>
				<span><Kbd keys="↑↓" /> browse</span>
				<span><Kbd keys="⏎" /> copy</span>
			</p>
		</div>

		{#if displayHits.length === 0}
			<EmptyState query={catalogState.query} onreset={reset} />
		{:else}
			<IconGrid
				bind:this={grid}
				hits={displayHits}
				tileSize={prefs.tileSize}
				selected={selectedName}
				copied={copiedName}
				{tileMin}
				pinnedName={pinned?.name ?? null}
				onselect={select}
			/>
		{/if}

		{#if entry}
			<RelatedBar
				icon={entry}
				onselect={selectRelated}
				oncopy={activate}
				oncopyPng={copyPng}
				onclose={() => (selectedName = null)}
			/>
		{/if}
	</main>
</div>

<Toaster />

<style>
	.shell {
		display: flex;
		height: 100dvh;
		flex-direction: column;
		overflow: hidden;
	}

	.topbar {
		display: flex;
		flex: none;
		align-items: center;
		gap: 1rem;
		height: 3.5rem;
		padding: 0 1rem;
		margin-top: 1rem;
		border-bottom: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
	}

	.search-slot {
		display: flex;
		flex: 1;
		min-width: 0;
		max-width: 42rem;
	}

	.search-slot :global(.field) {
		width: 100%;
	}

	.tools {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.size-option {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		line-height: 1;
	}

	.size-option :global(.silk) {
		image-rendering: pixelated;
	}

	.filters {
		display: flex;
		flex: none;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
	}

	.filters :global(.bar) {
		width: 100%;
	}

	.results {
		position: relative;
		display: flex;
		min-width: 0;
		min-height: 0;
		flex: 1;
		flex-direction: column;
	}

	.statusbar {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid color-mix(in oklab, var(--border) 22%, transparent);
	}

	.status {
		margin: 0;
		font-size: var(--text-2xs);
		line-height: var(--text-2xs-lh);
		color: var(--muted-foreground);
	}

	.status strong {
		color: color-mix(in oklab, var(--foreground) 85%, transparent);
		font-variant-numeric: tabular-nums;
	}

	.dot {
		padding: 0 0.25rem;
		opacity: 0.5;
	}

	.hints {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		margin: 0;
		font-size: var(--text-2xs);
		color: color-mix(in oklab, var(--muted-foreground) 80%, transparent);
	}

	@media (max-width: 52rem) {
		.topbar {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				"search search"
				"tools tools";
			gap: 0.5rem;
			height: auto;
			padding: 0.5rem 0.75rem;
		}

		.search-slot {
			grid-area: search;
			max-width: none;
		}

		.tools {
			grid-area: tools;
			justify-self: start;
			margin-left: 0;
		}

		.filters,
		.statusbar {
			padding-inline: 0.75rem;
		}
	}
</style>
