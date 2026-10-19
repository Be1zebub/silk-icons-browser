<script lang="ts">
  import { Monitor, Moon, Sun } from '@lucide/svelte';

  import SearchField from './lib/components/SearchField.svelte';
  import CategoryBar from './lib/components/CategoryBar.svelte';
  import IconGrid from './lib/components/IconGrid.svelte';
  import RelatedBar from './lib/components/RelatedBar.svelte';
  import EmptyState from './lib/components/EmptyState.svelte';
  import Toaster from './lib/components/Toaster.svelte';
  import Button from './lib/components/ui/Button.svelte';
  import Segmented from './lib/components/ui/Segmented.svelte';
  import Kbd from './lib/components/ui/Kbd.svelte';

  import { catalogState } from './lib/state/catalog.svelte';
  import { prefs, TILE_SIZES, type ThemePreference, type TileSize } from './lib/state/prefs.svelte';
  import { toasts } from './lib/state/toast.svelte';
  import { urlState } from './lib/state/url';
  import { copyIconPng, copyText } from './lib/core/clipboard';
  import type { CategoryId, IconDoc } from './lib/core/types';

  const THEME_ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];
  const THEME_LABEL: Record<ThemePreference, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  };

  const ARROW_KEYS: Record<string, 'left' | 'right' | 'up' | 'down'> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
  };

  /** Grid cell width grows with the preview size so labels always fit. */
  const TILE_MIN: Record<TileSize, number> = { 16: 88, 24: 104, 32: 128, 48: 156 };

  let search = $state<ReturnType<typeof SearchField> | null>(null);
  let grid = $state<ReturnType<typeof IconGrid> | null>(null);
  let selectedName = $state<string | null>(null);
  let copiedName = $state<string | null>(null);

  let flashTimer = 0;

  const tileMin = $derived(TILE_MIN[prefs.tileSize]);
  const sizeOptions = $derived(
    TILE_SIZES.map((size) => ({ value: String(size), label: String(size), title: `${size}px preview` })),
  );
  const selected = $derived(
    selectedName ? (catalogState.entries.find((icon) => icon.name === selectedName) ?? null) : null,
  );
  const hasQuery = $derived(catalogState.query.trim().length > 0);

  // Theme + URL bootstrap.
  $effect(() => prefs.syncTheme());

  $effect(() => {
    const initial = urlState.read();
    catalogState.query = initial.query;
    catalogState.category = initial.category;
    selectedName = initial.icon;

    const onPopState = () => {
      const next = urlState.read();
      catalogState.query = next.query;
      catalogState.category = next.category;
      selectedName = next.icon;
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  });

  $effect(() => {
    urlState.write({ query: catalogState.query, category: catalogState.category, icon: selectedName });
  });

  // Keep the selection valid as the result set changes.
  $effect(() => {
    if (!selectedName) return;
    if (catalogState.hits.some((hit) => hit.icon.name === selectedName)) return;

    selectedName = catalogState.hits[0]?.icon.name ?? null;
  });

  async function copy(text: string, label: string): Promise<void> {
    const ok = await copyText(text);
    toasts.show(ok ? `${label} copied` : 'Clipboard unavailable', ok ? 'success' : 'default');
  }

  function activate(name: string): void {
    void copy(name, name);
    copiedName = name;
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => (copiedName = null), 850);
  }

  function reset(): void {
    catalogState.query = '';
    catalogState.category = 'all';
    selectedName = null;
    search?.focus(false);
  }

  function cycleTheme(): void {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(prefs.theme) + 1) % THEME_ORDER.length];
    prefs.setTheme(next);
    toasts.show(`Theme: ${THEME_LABEL[next]}`, 'default', 1200);
  }

  function handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const onButton = target?.tagName === 'BUTTON';

    const arrow = ARROW_KEYS[event.key];
    // Up/Down drive the grid even while the search field has focus; left/right
    // stay in the text so the caret keeps working. When the grid already owns
    // the focus, the DOM focus follows the selection so Enter hits the
    // highlighted tile rather than the last one that was clicked.
    if (arrow && (!typing || arrow === 'up' || arrow === 'down')) {
      event.preventDefault();
      grid?.move(arrow, !typing);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search?.focus();
      return;
    }

    if (event.key === '/' && !typing) {
      event.preventDefault();
      search?.focus();
      return;
    }

    if (event.key === 'Escape' && !typing) {
      if (selectedName) selectedName = null;
      else reset();
      return;
    }

    if (event.key === 'Enter' && onButton) {
      // Enter on a focused tile copies instead of the default click, which
      // would only select.
      if (target?.closest?.('.grid .tile')) {
        event.preventDefault();
        if (selectedName) activate(selectedName);
      }
      return;
    }

    if (event.key === 'Enter' && !onButton) {
      // Enter copies the highlighted icon, or the top hit when nothing is
      // highlighted yet — the single most common "find and grab it" flow.
      const name = selectedName ?? catalogState.hits[0]?.icon.name;
      if (name) {
        event.preventDefault();
        selectedName = name;
        activate(name);
      }
      return;
    }

    if (typing || onButton) return;

    if (event.key.toLowerCase() === 'c' && selectedName) {
      event.preventDefault();
      activate(selectedName);
    }
  }

  function selectRelated(name: string): void {
    selectedName = name;
  }

  async function copyPng(icon: IconDoc): Promise<void> {
    const ok = await copyIconPng(icon.position);
    toasts.show(ok ? 'PNG copied' : 'This browser cannot copy images', ok ? 'success' : 'default');
  }

  const entry = $derived<IconDoc | null>(selected);

  // Keep the toast clear of the related strip.
  $effect(() => {
    document.documentElement.style.setProperty('--toast-offset', entry ? '4.25rem' : '1.25rem');
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="shell">
  <header class="topbar">
    <div class="search-slot">
      <SearchField
        bind:this={search}
        bind:value={catalogState.query}
        resultCount={catalogState.hits.length}
        total={catalogState.total}
        fuzzy={catalogState.outcome().fuzzy}
        oninput={() => undefined}
        onclear={() => {
          catalogState.query = '';
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
            <i class="silk accept" style="--silk-size: {Math.min(14, Number(value) / 3 + 2)}px"></i>
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
        {#if prefs.theme === 'system'}
          <Monitor size={14} />
        {:else if prefs.theme === 'light'}
          <Sun size={14} />
        {:else}
          <Moon size={14} />
        {/if}
      </Button>
    </div>
  </header>

  <div class="filters">
    <CategoryBar
      categories={catalogState.categories}
      counts={catalogState.counts}
      total={catalogState.total}
      value={catalogState.category}
      onchange={(value: CategoryId | 'all') => {
        catalogState.category = value;
      }}
    />
  </div>

  <main class="results">
    <div class="statusbar">
      <p class="status">
        {#if hasQuery}
          <strong>{catalogState.hits.length.toLocaleString('en-US')}</strong> result{catalogState.hits.length === 1 ? '' : 's'}
          <span class="dot">·</span>
          {catalogState.outcome().duration.toFixed(1)} ms
        {:else if catalogState.category !== 'all'}
          <strong>{catalogState.hits.length.toLocaleString('en-US')}</strong> in category
        {:else}
          <strong>{catalogState.total.toLocaleString('en-US')}</strong> icons
        {/if}
      </p>

      <p class="hints">
        <Kbd keys="/" /> search <span class="dot">·</span>
        <Kbd keys="↑↓" /> browse <span class="dot">·</span>
        <Kbd keys="⏎" /> select <span class="dot">·</span>
        <Kbd keys="C" /> copy
      </p>
    </div>

    {#if catalogState.hits.length === 0}
      <EmptyState query={catalogState.query} onreset={reset} />
    {:else}
      <IconGrid
        bind:this={grid}
        hits={catalogState.hits}
        tileSize={prefs.tileSize}
        selected={selectedName}
        copied={copiedName}
        {tileMin}
        onselect={(name) => (selectedName = name)}
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
    align-items: center;
    margin: 0;
    font-size: var(--text-2xs);
    color: color-mix(in oklab, var(--muted-foreground) 80%, transparent);
  }

  @media (max-width: 60rem) {
    .hints {
      display: none;
    }
  }

  @media (max-width: 52rem) {
    .topbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        'search search'
        'tools tools';
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
      justify-self: end;
    }

    .filters,
    .statusbar {
      padding-inline: 0.75rem;
    }
  }
</style>