<script lang="ts">
	import { Search, X } from "@lucide/svelte"
	import Kbd from "./ui/Kbd.svelte"

	interface Props {
		value: string
		resultCount: number
		total: number
		fuzzy: boolean
		oninput: (value: string) => void
		onclear: () => void
	}

	let {
		value = $bindable(),
		resultCount,
		total,
		fuzzy,
		oninput,
		onclear,
	}: Props = $props()

	let input = $state<HTMLInputElement | null>(null)

	export function focus(select = true): void {
		if (!input) return
		input.focus()
		if (select) input.select()
	}

	const hasQuery = $derived(value.trim().length > 0)

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === "Escape" && hasQuery) {
			event.preventDefault()
			event.stopPropagation()
			onclear()
		}
	}
</script>

<div class="field glass-strong" data-active={hasQuery}>
	<span class="lead" aria-hidden="true"><Search size={15} /></span>

	<input
		bind:this={input}
		bind:value
		type="search"
		placeholder="Search {total.toLocaleString('en-US')} icons…"
		aria-label="Search icons by name, keyword or category"
		autocomplete="off"
		autocapitalize="off"
		spellcheck={false}
		enterkeyhint="search"
		oninput={() => oninput(value)}
		onkeydown={handleKeydown}
	/>

	{#if hasQuery}
		<span class="count" class:fuzzy={fuzzy && resultCount > 0}>
			{resultCount.toLocaleString("en-US")}
			{#if fuzzy && resultCount > 0}<span
					class="fuzzy-dot"
					title="Few matches — fuzzy results shown"
				></span>{/if}
		</span>
		<button
			type="button"
			class="action"
			aria-label="Clear search"
			title="Clear search"
			onclick={onclear}
		>
			<X size={13} />
		</button>
	{:else}
		<span class="hint" aria-hidden="true"><Kbd keys="/" /></span>
	{/if}
</div>

<p class="sr-only" aria-live="polite">
	{hasQuery ? `${resultCount} results` : `${total} icons`}
</p>

<style>
	.field {
		position: relative;
		display: flex;
		align-items: center;
		height: 2.25rem;
		border: 1px solid color-mix(in oklab, var(--border) 14%, transparent);
		border-radius: var(--radius-lg);
		background-color: color-mix(in oklab, var(--card) 62%, transparent);
		transition:
			border-color var(--duration) var(--ease),
			background-color var(--duration) var(--ease),
			box-shadow var(--duration) var(--ease);
	}

	.field:hover {
		border-color: color-mix(in oklab, var(--border) 24%, transparent);
	}

	.field:focus-within {
		border-color: color-mix(in oklab, var(--primary) 55%, transparent);
		background-color: color-mix(in oklab, var(--card) 72%, transparent);
		box-shadow:
			0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.055);
	}

	.lead {
		display: inline-flex;
		padding-left: 0.625rem;
		color: var(--muted-foreground);
		pointer-events: none;
	}

	input {
		flex: 1;
		min-width: 0;
		height: 100%;
		padding: 0 0.5rem;
		border: 0;
		background: none;
		font-size: var(--text-base);
		outline: none;
		appearance: none;
	}

	input::-webkit-search-cancel-button {
		display: none;
	}

	input::placeholder {
		color: color-mix(in oklab, var(--muted-foreground) 80%, transparent);
	}

	.action {
		display: inline-flex;
		flex: none;
		width: 1.75rem;
		height: 1.75rem;
		align-items: center;
		justify-content: center;
		margin-right: 0.1875rem;
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: var(--muted-foreground);
		transition:
			background-color var(--duration) var(--ease),
			color var(--duration) var(--ease);
	}

	.action:hover {
		background-color: color-mix(in oklab, var(--foreground) 10%, transparent);
		color: var(--foreground);
	}

	.hint {
		display: inline-flex;
		margin-right: 0.5rem;
		opacity: 0.7;
	}

	.count {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 0.25rem;
		height: 1.125rem;
		margin-right: 0.125rem;
		padding: 0 0.375rem;
		border-radius: 999px;
		background-color: color-mix(in oklab, var(--foreground) 8%, transparent);
		font-size: var(--text-2xs);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: color-mix(in oklab, var(--foreground) 70%, transparent);
	}

	.count.fuzzy {
		background-color: color-mix(in oklab, var(--primary) 22%, transparent);
		color: color-mix(in oklab, var(--primary) 85%, var(--foreground));
	}

	.fuzzy-dot {
		width: 0.25rem;
		height: 0.25rem;
		border-radius: 999px;
		background-color: currentColor;
		opacity: 0.8;
	}
</style>
