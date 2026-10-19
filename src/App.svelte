<script lang="ts">
  import SearchField from './lib/components/SearchField.svelte';
  import CategoryBar from './lib/components/CategoryBar.svelte';
  import IconGrid from './lib/components/IconGrid.svelte';
  import Inspector from './lib/components/Inspector.svelte';
  import EmptyState from './lib/components/EmptyState.svelte';
  import Toaster from './lib/components/Toaster.svelte';
  import Button from './lib/components/ui/Button.svelte';
  import Segmented from './lib/components/ui/Segmented.svelte';
  import Kbd from './lib/components/ui/Kbd.svelte';
  import Glyph from './lib/components/Glyph.svelte';

  import { catalogState } from './lib/state/catalog.svelte';
  import { prefs, TILE_SIZES, type ThemePreference, type TileSize } from './lib/state/prefs.svelte';
  import { toasts } from './lib/state/toast.svelte';
  import { urlState } from './lib/state/url';
  import { copyText } from './lib/core/clipboard';
  import type { CategoryId, IconEntry } from './lib/core/types';

  const THEME_ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];
  const THEME_LABEL: Record<ThemePreference, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  };
  const THEME_GLYPH = { system: 'monitor', light: 'sun', dark: 'moon' } as const;

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

    const first = catalogState.hits[0]?.icon.name ?? null;
    selectedName = first;
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

  function copyResults(): void {
    const names = catalogState.hits.map((hit) => hit.icon.name);
    if (names.length === 0) return;
    void copy(names.join('\n'), `${names.length} names`);
  }

  function handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    const arrow = ARROW_KEYS[event.key];
    // Up/Down drive the grid even while the search field has focus; left/right
    // stay in the text so the caret keeps working.
    if (arrow && (!typing || arrow === 'up' || arrow === 'down')) {
      event.preventDefault();
      grid?.move(arrow);
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

    if (event.key === 'Enter' && typing) {
      // Enter copies the highlighted icon, or the top hit when nothing is
      // highlighted yet — the single most common "find and grab it" flow.
      const target = selectedName ?? catalogState.hits[0]?.icon.name;
      if (target) {
        event.preventDefault();
        selectedName = target;
        activate(target);
      }
      return;
    }

    if (typing) return;

    if (event.key.toLowerCase() === 'c' && selectedName) {
      event.preventDefault();
      activate(selectedName);
    }
  }

  function selectRelated(name: string): void {
    selectedName = name;
    catalogState.query = name;
  }

  const entry = $derived<IconEntry | null>(selected);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Silk home">
      <span class="brand-mark" aria-hidden="true"><i class="silk application_view_gallery"></i></span>
      <span class="brand-text">
        <strong>Silk</strong>
        <small>FamFamFam icon search</small>
      </span>
    </a>

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
        <Glyph name={THEME_GLYPH[prefs.theme]} size={14} />
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

  <div class="body" data-inspector={selected !== null}>
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
            <strong>{catalogState.total.toLocaleString('en-US')}</strong> icons · <span class="dot">·</span> click to copy
          {/if}
        </p>

        <div class="status-actions">
          <p class="hints">
            <Kbd keys="/" /> search <span class="dot">·</span>
            <Kbd keys="↑↓" /> browse <span class="dot">·</span>
            <Kbd keys="⏎" /> copy
          </p>
          <Button
            variant="ghost-muted"
            size="xs"
            label="Copy every result name"
            disabled={catalogState.hits.length === 0}
            onclick={copyResults}
          >
            <Glyph name="copy-all" size={12} />
            Copy all
          </Button>
        </div>
      </div>

      {#if catalogState.hits.length === 0}
        <EmptyState query={catalogState.query} onreset={reset} />
      {:else}
        <IconGrid
          bind:this={grid}
          hits={catalogState.hits}
          tileSize={prefs.tileSize}
          pixelated={prefs.pixelated}
          selected={selectedName}
          copied={copiedName}
          {tileMin}
          onselect={(name) => (selectedName = name)}
          onactivate={activate}
        />
      {/if}
    </main>

    {#if entry}
      <button
        type="button"
        class="sheet-backdrop"
        aria-label="Close details"
        onclick={() => (selectedName = null)}
      ></button>
      <Inspector
        icon={entry}
        entries={catalogState.entries}
        categories={catalogState.categories}
        pixelated={prefs.pixelated}
        oncopy={copy}
        ontogglepixelated={() => prefs.togglePixelated()}
        onselect={selectRelated}
        onclose={() => (selectedName = null)}
      />
    {/if}
  </div>
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
    display: grid;
    flex: none;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    height: 3.5rem;
    padding: 0 1rem;
    border-bottom: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-self: start;
    color: inherit;
    text-decoration: none;
  }

  .brand-mark {
    display: inline-flex;
    width: 1.75rem;
    height: 1.75rem;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in oklab, var(--border) 14%, transparent);
    border-radius: var(--radius-lg);
    background-color: color-mix(in oklab, var(--primary) 14%, transparent);
  }

  .brand-mark :global(.silk) {
    --silk-size: 16px;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.125rem;
  }

  .brand-text strong {
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .brand-text small {
    font-size: var(--text-2xs);
    color: var(--muted-foreground);
  }

  .search-slot {
    display: flex;
    justify-content: center;
    min-width: 0;
  }

  .search-slot :global(.field),
  .search-slot :global(.summary) {
    width: 100%;
    max-width: 26rem;
  }

  .tools {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-self: end;
  }

  .size-option {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    line-height: 1;
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

  .body {
    display: flex;
    min-height: 0;
    flex: 1;
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

  .status-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .hints {
    display: flex;
    align-items: center;
    margin: 0;
    font-size: var(--text-2xs);
    color: color-mix(in oklab, var(--muted-foreground) 80%, transparent);
  }

  :global(.body > :global(.inspector)) {
    overflow-y: auto;
  }

  @media (max-width: 60rem) {
    .brand-text small {
      display: none;
    }

    .hints {
      display: none;
    }
  }

  .sheet-backdrop {
    display: none;
  }

  @keyframes silk-sheet {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (max-width: 52rem) {
    .topbar {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas:
        'brand tools'
        'search search';
      gap: 0.5rem 0.75rem;
      height: auto;
      padding: 0.5rem 0.75rem;
    }

    .brand {
      grid-area: brand;
    }

    .search-slot {
      grid-area: search;
    }

    .tools {
      grid-area: tools;
    }

    .brand-text {
      display: none;
    }

    .filters,
    .statusbar {
      padding-inline: 0.75rem;
    }

    .body {
      position: relative;
    }

    .sheet-backdrop {
      position: absolute;
      inset: 0;
      z-index: 25;
      display: block;
      border: 0;
      background: rgb(0 0 0 / 0.45);
      animation: silk-fade-in 160ms var(--ease);
    }

    .body :global(.inspector) {
      position: absolute;
      inset: auto 0 0 0;
      z-index: 30;
      max-height: 78%;
      padding-bottom: calc(1rem + env(safe-area-inset-bottom));
      border-top: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
      border-left: 0;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      background-color: color-mix(in oklab, var(--popover) 98%, transparent);
      backdrop-filter: blur(16px);
      box-shadow: 0 -12px 32px -20px rgb(0 0 0 / 0.8);
      animation: silk-sheet 200ms var(--ease);
    }
  }
</style>