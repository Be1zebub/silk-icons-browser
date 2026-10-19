<script lang="ts">
	import { RefreshCw } from "@lucide/svelte"
	import App from "./App.svelte"
</script>

<svelte:boundary>
	<App />

	{#snippet failed(error, reset)}
		<main class="crash">
			<h1>Silk hit a snag</h1>
			<p>
				The icon catalog could not be loaded. Reloading usually fixes it; if
				not, the browser console has the details.
			</p>
			<button type="button" onclick={reset}>
				<RefreshCw size={14} />
				Try again
			</button>
			<pre>{error instanceof Error ? error.message : String(error)}</pre>
		</main>
	{/snippet}
</svelte:boundary>

<style>
	.crash {
		display: flex;
		min-height: 100dvh;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2rem;
		text-align: center;
	}

	h1 {
		font-size: 1.125rem;
		font-weight: 600;
	}

	p {
		max-width: 30rem;
		color: var(--muted-foreground);
		font-size: 0.875rem;
	}

	button {
		display: inline-flex;
		height: 2rem;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.875rem;
		border: 1px solid color-mix(in oklab, var(--border) 14%, transparent);
		border-radius: var(--radius-lg);
		background-color: color-mix(in oklab, var(--input) 12%, transparent);
		font-size: 0.875rem;
		font-weight: 500;
	}

	button:hover {
		background-color: color-mix(in oklab, var(--input) 20%, transparent);
	}

	pre {
		max-width: min(40rem, 100%);
		overflow-x: auto;
		color: color-mix(in oklab, var(--foreground) 40%, transparent);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
</style>
