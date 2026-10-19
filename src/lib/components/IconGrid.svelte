<script lang="ts">
	import type { SearchHit } from "../core/types"
	import IconTile from "./IconTile.svelte"

	/** Rows rendered above and below the viewport. */
	const OVERSCAN = 2
	/** Grid gap, must match the stylesheet. */
	const GAP = 2
	/** Fallback row height before the first measurement (px). */
	const FALLBACK_ROW_HEIGHT = 116
	/** Fallback viewport height before the first measurement (px). */
	const FALLBACK_VIEWPORT_HEIGHT = 800

	interface Props {
		hits: readonly SearchHit[]
		tileSize: number
		selected: string | null
		copied: string | null
		/** Minimum tile width derived from the current preview size. */
		tileMin: number
		/** Name of the temporary related icon, rendered first. */
		pinnedName?: string | null
		onselect: (name: string) => void
	}

	let {
		hits,
		tileSize,
		selected,
		copied,
		tileMin,
		pinnedName = null,
		onselect,
	}: Props = $props()

	let viewport = $state<HTMLDivElement | null>(null)
	let grid = $state<HTMLDivElement | null>(null)
	let scrollTop = $state(0)
	let viewportHeight = $state(FALLBACK_VIEWPORT_HEIGHT)
	let gridWidth = $state(0)
	let rowHeight = $state(FALLBACK_ROW_HEIGHT)

	/**
	 * The grid is windowed: only the rows around the scroll position exist in
	 * the DOM, and a spacer of the full height keeps the scrollbar honest.
	 *
	 * The previous version appended items as you scrolled, which grew the
	 * content and made the scrollbar thumb shrink while you moved down.
	 */
	const columns = $derived(
		gridWidth > 0
			? Math.max(1, Math.floor((gridWidth + GAP) / (tileMin + GAP)))
			: 1,
	)

	const rowCount = $derived(Math.max(1, Math.ceil(hits.length / columns)))
	const totalHeight = $derived(rowCount * rowHeight)
	const firstRow = $derived(
		Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN),
	)
	const visibleRows = $derived(
		Math.ceil(viewportHeight / rowHeight) + OVERSCAN * 2 + 1,
	)

	const startIndex = $derived(Math.min(hits.length, firstRow * columns))
	const endIndex = $derived(
		Math.min(hits.length, (firstRow + visibleRows) * columns),
	)
	const shown = $derived(hits.slice(startIndex, endIndex))
	const offsetY = $derived(firstRow * rowHeight)

	/** Keeps the measured row height in sync with the real layout. */
	let measuredRowHeight = FALLBACK_ROW_HEIGHT

	$effect(() => {
		const element = grid
		if (!element) return

		const measure = () => {
			const children = element.children
			const template = getComputedStyle(element).gridTemplateColumns
			const columnCount = template.split(" ").filter(Boolean).length

			// The cell one row down is the one that tells us the row pitch.
			if (children.length <= columnCount) return

			const first = children[0] as HTMLElement
			const below = children[columnCount] as HTMLElement
			const pitch = below.offsetTop - first.offsetTop

			if (pitch > 0 && pitch !== measuredRowHeight) {
				measuredRowHeight = pitch
				rowHeight = pitch
			}
		}

		measure()

		const observer = new ResizeObserver(measure)
		observer.observe(element)
		return () => observer.disconnect()
	})

	function handleScroll(): void {
		if (!viewport) return
		scrollTop = viewport.scrollTop
	}

	/**
	 * Moves the selection. `focus` also moves the DOM focus, so Enter activates
	 * the highlighted tile instead of whatever button was last clicked.
	 */
	export function move(
		direction: "left" | "right" | "up" | "down",
		focus = false,
	): void {
		if (hits.length === 0) return

		const step =
			direction === "left"
				? -1
				: direction === "right"
					? 1
					: direction === "up"
						? -columns
						: columns
		const current = selected
			? hits.findIndex((hit) => hit.icon.name === selected)
			: -1
		const next =
			current === -1
				? 0
				: Math.min(hits.length - 1, Math.max(0, current + step))

		if (next === current) return

		onselect(hits[next].icon.name)
		scrollToIndex(next)

		if (focus) focusTile(hits[next].icon.name)
	}

	function scrollToIndex(index: number): void {
		if (!viewport) return

		const row = Math.floor(index / columns)
		const target = row * rowHeight
		const top = viewport.scrollTop
		const bottom = top + viewport.clientHeight

		if (target < top) viewport.scrollTop = target
		else if (target + rowHeight > bottom)
			viewport.scrollTop = target + rowHeight - viewport.clientHeight
	}

	/** Scrolls a result into view, used when a related icon is picked. */
	export function reveal(name: string): void {
		const index = hits.findIndex((hit) => hit.icon.name === name)
		if (index === -1) return
		scrollToIndex(index)
	}

	function focusTile(name: string): void {
		requestAnimationFrame(() => {
			const tile = grid?.querySelector<HTMLElement>(
				`[data-name="${CSS.escape(name)}"] .tile`,
			)
			tile?.focus({ preventScroll: true })
		})
	}
</script>

<div
	class="viewport"
	bind:this={viewport}
	bind:clientHeight={viewportHeight}
	onscroll={handleScroll}
>
	<div class="sizer" style="height: {totalHeight}px">
		<div class="window" style="transform: translateY({offsetY}px)">
			<div
				class="grid"
				bind:this={grid}
				bind:clientWidth={gridWidth}
				role="listbox"
				aria-label="Icon results"
				tabindex="-1"
				style="--columns: {columns}"
			>
				{#each shown as hit (hit.icon.name)}
					<div
						class="cell"
						class:pinned={hit.icon.name === pinnedName}
						data-name={hit.icon.name}
						role="presentation"
					>
						<IconTile
							name={hit.icon.name}
							ranges={hit.ranges}
							size={tileSize}
							selected={selected === hit.icon.name}
							copied={copied === hit.icon.name}
							tabbable={selected === hit.icon.name ||
								(!selected && hit.icon.name === hits[0]?.icon.name)}
							title={hit.icon.name}
							onclick={() => onselect(hit.icon.name)}
						/>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.viewport {
		position: relative;
		min-height: 0;
		flex: 1;
		overflow-y: auto;
		/* Room for the related strip, which floats over the grid. */
		padding: 0.5rem 1rem 3.75rem;
		scroll-padding-block: 1rem;
	}

	.sizer {
		position: relative;
		width: 100%;
	}

	.window {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		will-change: transform;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--columns, 1), minmax(0, 1fr));
		gap: 2px;
		outline: none;
	}

	.cell {
		display: flex;
		min-width: 0;
	}

	.cell :global(.tile) {
		width: 100%;
	}

	/* The temporary related icon: dashed, to show it is not a search result. */
	.cell.pinned :global(.tile) {
		border-style: dashed;
		border-color: color-mix(in oklab, var(--primary) 45%, transparent);
	}
</style>
