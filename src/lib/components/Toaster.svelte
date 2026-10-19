<script lang="ts">
	import { toasts } from "../state/toast.svelte"
</script>

<div class="stack" role="status" aria-live="polite">
	{#each toasts.items as toast (toast.id)}
		<button
			type="button"
			class="toast"
			data-tone={toast.tone}
			onclick={() => toasts.dismiss(toast.id)}
			title="Dismiss"
		>
			<span class="dot" aria-hidden="true"></span>
			{toast.message}
		</button>
	{/each}
</div>

<style>
	.stack {
		position: fixed;
		bottom: var(--toast-offset, 1.25rem);
		left: 50%;
		z-index: 40;
		display: flex;
		transform: translateX(-50%);
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		pointer-events: none;
	}

	.toast {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid color-mix(in oklab, var(--border) 14%, transparent);
		border-radius: 999px;
		background-color: color-mix(in oklab, var(--popover) 94%, transparent);
		backdrop-filter: blur(12px);
		box-shadow: 0 8px 24px -12px rgb(0 0 0 / 0.6);
		font-size: var(--text-xs);
		line-height: var(--text-xs-lh);
		color: color-mix(in oklab, var(--foreground) 85%, transparent);
		animation: silk-pop 180ms var(--ease);
		pointer-events: auto;
	}

	.dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 999px;
		background-color: var(--muted-foreground);
	}

	.toast[data-tone="success"] .dot {
		background-color: var(--success);
	}
</style>
