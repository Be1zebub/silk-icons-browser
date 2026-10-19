<script lang="ts">
	import { ChevronLeft, ChevronRight } from "@lucide/svelte"
	import type { CategoryId, CategoryMeta } from "../core/types"

	const SCROLL_STEP = 240

	interface Props {
		categories: readonly CategoryMeta[]
		counts: Readonly<Record<CategoryId, number>>
		total: number
		value: CategoryId | "all" | "popular"
		/** Number of icons in the global popularity ranking, 0 when there is none. */
		popular: number
		onchange: (value: CategoryId | "all" | "popular") => void
	}

	let { categories, counts, total, value, popular, onchange }: Props = $props()

	let scroller = $state<HTMLElement | null>(null)

	let canScrollLeft = $state(false)
	let canScrollRight = $state(false)

	function measure(): void {
		if (!scroller) return

		const max = scroller.scrollWidth - scroller.clientWidth
		canScrollLeft = scroller.scrollLeft > 2
		canScrollRight = max > 2 && scroller.scrollLeft < max - 2
	}

	function scrollBy(direction: 1 | -1): void {
		if (!scroller) return
		scroller.scrollBy({ left: direction * SCROLL_STEP, behavior: "smooth" })
	}

	$effect(() => {
		if (!scroller) return

		const observer = new ResizeObserver(measure)
		observer.observe(scroller)
		measure()

		return () => observer.disconnect()
	})

	function onWheel(event: WheelEvent): void {
		if (!scroller) return
		if (!canScrollLeft && !canScrollRight) return

		const delta =
			Math.abs(event.deltaX) > Math.abs(event.deltaY)
				? event.deltaX
				: event.deltaY
		if (delta === 0) return

		scroller.scrollLeft += delta
		event.preventDefault()
	}
</script>

<div class="bar">
	{#if canScrollLeft}
		<button
			type="button"
			class="nav"
			aria-label="Scroll categories left"
			title="Scroll left"
			onclick={() => scrollBy(-1)}
		>
			<ChevronLeft size={13} />
		</button>
	{/if}

	<div
		class="track"
		bind:this={scroller}
		onwheel={onWheel}
		onscroll={measure}
		role="group"
		aria-label="Filter by category"
	>
		<button
			type="button"
			class="chip"
			data-active={value === "all"}
			aria-pressed={value === "all"}
			onclick={() => onchange("all")}
		>
			All
			<span class="count">{total}</span>
		</button>

		{#if popular > 0}
			<button
				type="button"
				class="chip popular"
				data-active={value === "popular"}
				aria-pressed={value === "popular"}
				title="The icons everyone copies the most"
				onclick={() => onchange("popular")}
			>
				Popular
				<span class="count">{popular}</span>
			</button>
		{/if}

		{#each categories as category (category.id)}
			<button
				type="button"
				class="chip"
				data-active={value === category.id}
				data-empty={(counts[category.id] ?? 0) === 0}
				aria-pressed={value === category.id}
				onclick={() => onchange(category.id)}
			>
				{category.label}
				<span class="count">{counts[category.id] ?? 0}</span>
			</button>
		{/each}
	</div>

	{#if canScrollRight}
		<button
			type="button"
			class="nav"
			aria-label="Scroll categories right"
			title="Scroll right"
			onclick={() => scrollBy(1)}
		>
			<ChevronRight size={13} />
		</button>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.25rem;
	}

	.nav {
		display: inline-flex;
		flex: none;
		width: 1.5rem;
		height: 1.5rem;
		align-items: center;
		justify-content: center;
		border: 1px solid color-mix(in oklab, var(--border) 12%, transparent);
		border-radius: var(--radius-md);
		background-color: color-mix(in oklab, var(--input) 8%, transparent);
		color: var(--muted-foreground);
		transition:
			background-color var(--duration) var(--ease),
			color var(--duration) var(--ease);
	}

	.nav:hover {
		background-color: color-mix(in oklab, var(--input) 16%, transparent);
		color: var(--foreground);
	}

	.track {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		gap: 0.25rem;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		padding-bottom: 1px;
		scrollbar-width: none;
	}

	.track::-webkit-scrollbar {
		display: none;
	}

	.chip {
		display: inline-flex;
		flex: none;
		height: 1.625rem;
		align-items: center;
		gap: 0.375rem;
		padding: 0 0.5rem 0 0.625rem;
		border: 1px solid transparent;
		border-radius: 999px;
		background-color: transparent;
		color: color-mix(in oklab, var(--foreground) 60%, transparent);
		font-size: var(--text-xs);
		line-height: 1;
		font-weight: 500;
		white-space: nowrap;
		transition:
			background-color var(--duration) var(--ease),
			border-color var(--duration) var(--ease),
			color var(--duration) var(--ease);
	}

	.chip:hover {
		background-color: color-mix(in oklab, var(--input) 12%, transparent);
		color: var(--foreground);
	}

	.chip[data-active="true"] {
		border-color: color-mix(in oklab, var(--border) 14%, transparent);
		background-color: color-mix(in oklab, var(--foreground) 9%, transparent);
		color: var(--foreground);
	}

	.chip.popular .count {
		background-color: color-mix(in oklab, var(--primary) 30%, transparent);
		color: color-mix(in oklab, var(--primary) 85%, var(--foreground));
	}

	/* A category with no results for the current query recedes. */
	.chip[data-empty="true"] {
		opacity: 0.4;
	}

	.chip[data-empty="true"]:hover {
		opacity: 0.8;
	}

	.count {
		display: inline-flex;
		min-width: 1.125rem;
		height: 1rem;
		align-items: center;
		justify-content: center;
		padding: 0 0.25rem;
		border-radius: 999px;
		background-color: color-mix(in oklab, var(--foreground) 8%, transparent);
		font-size: 0.625rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground);
	}
</style>
