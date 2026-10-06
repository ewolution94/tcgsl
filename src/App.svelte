<!--
  The shell: header, the list or one set, the footer, Settings. The list stays mounted while a set
  is open, so coming back lands at the same scroll position with every image still loaded.
-->
<script lang="ts">
  import Footer from './components/Footer.svelte';
  import Header from './components/Header.svelte';
  import ListSkeleton from './components/ListSkeleton.svelte';
  import SetList from './components/SetList.svelte';
  import SetPage from './components/SetPage.svelte';
  import Settings from './components/Settings.svelte';
  import { loadIndex, type Index } from './lib/data.ts';
  import { t } from './lib/i18n/index.svelte.ts';
  import { ui } from './lib/prefs.svelte.ts';
  import { route } from './lib/router.svelte.ts';

  history.scrollRestoration = 'manual';

  let index = $state<Index | null>(null);
  let failed = $state(false);
  let query = $state('');
  let search = $state<HTMLInputElement>();

  function start() {
    failed = false;
    loadIndex().then(
      (loaded) => (index = loaded),
      (error) => {
        console.error(error);
        failed = true;
      },
    );
  }
  start();

  const open = $derived(route.set ? index?.bySet.get(route.set) : undefined);

  // Leaving the list remembers where it was; coming back returns there.
  let listScroll = 0;
  let wasOpen = false;
  $effect.pre(() => {
    const isOpen = !!open;
    if (isOpen && !wasOpen) listScroll = scrollY;
    wasOpen = isOpen;
  });
  $effect(() => {
    if (open) {
      document.title = `${open.name} · TCGSL`;
      scrollTo(0, 0);
    } else {
      document.title = 'TCGSL · TCG Setlist';
      if (index) scrollTo(0, listScroll);
    }
  });

  function keydown(event: KeyboardEvent) {
    const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]');
    if (event.key === ',' && (event.metaKey || event.ctrlKey || !typing)) {
      event.preventDefault();
      ui.settings = true;
    } else if (event.key === '/' && !typing && !ui.settings) {
      event.preventDefault();
      search?.focus();
    }
  }
</script>

<svelte:window onkeydown={keydown} />

<Header bind:query bind:input={search} />

<main>
  {#if index}
    <div hidden={!!open}>
      <SetList {index} {query} />
    </div>
    {#if open}
      {#key open.id}
        <SetPage set={open} />
      {/key}
    {/if}
  {:else if failed}
    <div class="state">
      <p>{t('list.error')}</p>
      <button type="button" onclick={start}>{t('list.retry')}</button>
    </div>
  {:else}
    <ListSkeleton />
  {/if}
</main>

{#if index}<Footer {index} />{/if}

<Settings />

<style>
  main {
    min-height: calc(100dvh - var(--ewo-bar-h));
  }

  .state {
    display: grid;
    justify-items: center;
    gap: var(--ewo-space-4);
    padding: var(--ewo-space-8) var(--ewo-gutter);
    color: var(--ewo-fg-2);
  }

  .state button {
    height: 36px;
    padding: 0 16px;
    border: 1px solid var(--ewo-line-strong);
    border-radius: var(--ewo-r-pill);
    background: var(--ewo-bg-raised);
  }

  [hidden] {
    display: none !important;
  }
</style>
