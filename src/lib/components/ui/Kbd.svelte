<script lang="ts">
  interface Props {
    keys: string | readonly string[];
  }

  let { keys }: Props = $props();

  const list = $derived(typeof keys === 'string' ? [keys] : keys);
</script>

{#each list as key, index (key)}
  {#if index > 0}<span class="plus">+</span>{/if}
  <kbd>{key}</kbd>
{/each}

<style>
  kbd {
    display: inline-flex;
    height: 1.125rem;
    min-width: 1.125rem;
    align-items: center;
    justify-content: center;
    padding: 0 0.3125rem;
    border: 1px solid color-mix(in oklab, var(--border) 14%, transparent);
    border-radius: var(--radius-xs);
    background-color: color-mix(in oklab, var(--foreground) 6%, transparent);
    font-family: var(--font-sans);
    font-size: 0.625rem;
    font-weight: 500;
    line-height: 1;
    color: color-mix(in oklab, var(--foreground) 60%, transparent);
  }

  .plus {
    font-size: 0.625rem;
    color: color-mix(in oklab, var(--foreground) 30%, transparent);
  }
</style>