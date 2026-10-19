<script lang="ts">
  import { RotateCcw, TriangleAlert } from '@lucide/svelte';
  import Button from './ui/Button.svelte';

  interface Props {
    query: string;
    onreset: () => void;
  }

  let { query, onreset }: Props = $props();
</script>

<div class="empty">
  <span class="mark"><TriangleAlert size={18} strokeWidth={1.5} /></span>
  <h2>No icons match “{query}”</h2>
  <p>Try fewer words, a category instead, or a shorter prefix.</p>
  <Button variant="outline" size="sm" label="Reset search" onclick={onreset}>
    <RotateCcw size={12} />
    Reset search
  </Button>
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 4rem 1rem;
    text-align: center;
    animation: silk-fade-in 200ms var(--ease);
  }

  .mark {
    display: inline-flex;
    width: 2.5rem;
    height: 2.5rem;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;
    border: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
    border-radius: var(--radius-lg);
    background-color: color-mix(in oklab, var(--input) 10%, transparent);
    color: var(--muted-foreground);
  }

  h2 {
    margin: 0;
    font-size: var(--text-base);
    line-height: var(--text-base-lh);
    font-weight: 600;
  }

  p {
    margin: 0 0 0.5rem;
    font-size: var(--text-xs);
    line-height: var(--text-xs-lh);
    color: var(--muted-foreground);
  }
</style>