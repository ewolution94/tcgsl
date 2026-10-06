<!--
  The sticky header: the name, the search and the gear for Settings. Plainly sticky, with a
  hairline once the page has scrolled.
-->
<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { prefs, ui, type Region } from '../lib/prefs.svelte.ts';
  import { route, closeSet } from '../lib/router.svelte.ts';

  let { query = $bindable(''), input = $bindable() }: { query: string; input?: HTMLInputElement } = $props();

  let scrolled = $state(false);
  $effect(() => {
    const onScroll = () => (scrolled = scrollY > 4);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  });

  // English or Japanese releases. From a set page this goes back to the list, since the set
  // belongs to the other one.
  function region(next: Region) {
    prefs.region = next;
    if (route.set) closeSet();
  }

  function home(event: MouseEvent) {
    event.preventDefault();
    if (route.set) closeSet();
    else scrollTo({ top: 0 });
  }
</script>

<header class="bar shifts" class:scrolled>
  <div class="row">
    <a class="brand" href="/" onclick={home}><img src="/icon.svg" alt="" width="26" height="26" /><span class="word">TCGSL</span></a>
    <label class="search">
      <span class="sr">{t('search.label')}</span>
      <Search size={15} aria-hidden="true" />
      <input
        bind:this={input}
        bind:value={query}
        type="search"
        placeholder={t('search.label')}
        autocomplete="off"
        enterkeyhint="search"
        oninput={() => route.set && closeSet()}
      />
    </label>
    <ewo-segmented class="regions" size="sm" label={t('region.label')} title={t('region.label')} value={prefs.region} onchange={(e) => region(e.detail.value as Region)}>
      <option value="en">EN</option>
      <option value="ja">JP</option>
    </ewo-segmented>
    <button class="gear" type="button" onclick={() => (ui.settings = true)} aria-label={t('nav.settings')} title={t('nav.settings')}>
      <SettingsIcon size={19} />
    </button>
  </div>
</header>

<style>
  .bar {
    /* Stays put while the page beneath changes (lib/transition.ts). */
    view-transition-name: bar;
    position: sticky;
    top: 0;
    z-index: 20;
    /* Solid, no backdrop blur: images fading in underneath would make the blur recompute every frame. */
    background: var(--ewo-bg);
    border-bottom: 1px solid transparent;
  }

  .bar.scrolled {
    border-bottom-color: var(--ewo-line);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--ewo-space-3);
    height: var(--ewo-bar-h);
    padding: 0 var(--ewo-gutter);
    max-width: 68rem;
    margin: 0 auto;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 650;
    letter-spacing: -0.01em;
    font-size: var(--ewo-text-lg);
    white-space: nowrap;
  }

  .regions {
    flex: none;
  }

  /* On a phone the icon alone names the app, so the search keeps its room next to the switch. */
  @media (max-width: 479.98px) {
    .brand .word {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  }

  .search {
    flex: 1;
    min-width: 0;
    max-width: 22rem;
    margin-left: auto;
    position: relative;
  }

  .search input {
    width: 100%;
    height: 36px;
    padding: 0 12px 0 34px;
    border: 1px solid var(--ewo-line);
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-fill);
    color: var(--ewo-fg);
    /* 16px: iOS zooms the page into smaller inputs. */
    font: 400 16px/1 var(--ewo-sans);
    -webkit-appearance: none;
    appearance: none;
  }

  .search input::placeholder {
    color: var(--ewo-fg-3);
  }

  .search :global(svg) {
    position: absolute;
    left: 12px;
    top: 50%;
    translate: 0 -50%;
    color: var(--ewo-fg-3);
    pointer-events: none;
  }

  .gear {
    flex: none;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    margin-right: -6px;
    border: 0;
    border-radius: var(--ewo-r-pill);
    background: transparent;
    color: var(--ewo-fg-2);
  }

  @media (hover: hover) and (pointer: fine) {
    .gear:hover {
      background: var(--ewo-fill-2);
      color: var(--ewo-fg);
    }
  }
</style>
