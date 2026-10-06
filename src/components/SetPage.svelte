<!--
  One set: its logo and facts, the most valuable cards, and every card. A page, not an overlay
  (learnings/dialogs-and-overlays.md). The card list is fetched when the set opens; thumbnails
  load about a screen ahead.
-->
<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import { loadCards, type Card, type Listed } from '../lib/data.ts';
  import { date, euro, t, tn } from '../lib/i18n/index.svelte.ts';
  import { img, load } from '../lib/images.ts';
  import { closeSet } from '../lib/router.svelte.ts';
  import CardViewer from './CardViewer.svelte';

  let { set: s }: { set: Listed } = $props();

  let cards = $state<Card[] | null>(null);
  let failed = $state(false);
  let viewing = $state<number | null>(null);
  const priced = $derived(s.top.some((c) => c.p));

  $effect(() => {
    const id = s.id;
    cards = null;
    failed = false;
    loadCards(id).then(
      (list) => id === s.id && (cards = list),
      () => id === s.id && (failed = true),
    );
  });

  const openKey = (key: string) => {
    const i = cards?.findIndex((c) => c[0] === key) ?? -1;
    if (i >= 0) viewing = i;
  };
</script>

<div class="detail">
  <button class="back" type="button" onclick={closeSet}><ChevronLeft size={16} />{t('set.back')}</button>

  <header class="hero">
    <div class="logo ph-box"><ewo-skeleton class="ph ph--bar" width="100%" height="100%" radius="md"></ewo-skeleton><img class="f set-logo" use:load={{ src: img.logo(s.id, 480), eager: true }} alt="" width="260" height="104" fetchpriority="high" /></div>
    <h1>{s.name}</h1>
    <div class="facts">
      <span><img class="f" use:load={{ src: img.symbol(s.id), eager: true }} alt="" width="16" height="16" />{s.series}</span>
      <span>{t('set.released', { date: date(s.date) })}</span>
      <span>{tn('set.printed', s.printed)}{#if s.secret}&nbsp;{t('set.secret', { count: s.secret })}{/if}</span>
      {#if s.code}<span class="mono">{s.code}</span>{/if}
    </div>
  </header>

  {#if s.top.length}
    <div class="grid-h"><h2>{priced ? t('set.mostValuable') : t('set.rarest')}</h2><span class="mono muted">{priced ? t('set.trend') : t('set.noPrices')}</span></div>
    <ol class="cards top3">
      {#each s.top as c (c.k)}
        <li>
          <button type="button" onclick={() => openKey(c.k)}>
            <div class="thumb ph-box tinted" style:--c={c.c}><ewo-skeleton class="ph" width="100%" height="100%" radius="none"></ewo-skeleton><img class="f" use:load={{ src: img.card(s.id, c.k), eager: true }} alt={c.name} width="245" height="342" /></div>
            <div class="cap"><span>{c.name}</span></div>
            {#if c.p}<div class="price">{euro(c.p)}</div>{/if}
          </button>
        </li>
      {/each}
    </ol>
  {/if}

  <div class="grid-h"><h2>{t('set.allCards')}</h2><span class="mono muted">{s.total}</span></div>
  {#if failed}
    <p class="muted">{t('list.error')}</p>
  {:else if !cards}
    <!-- The card list is on its way: a screen of skeleton cards in the same grid. -->
    <p class="sr" role="status">{t('set.loading')}</p>
    <ol class="cards all" aria-hidden="true">
      {#each Array(Math.min(12, s.total)) as _, i (i)}
        <li>
          <div class="thumb ph-box"><ewo-skeleton class="ph" width="100%" height="100%" radius="none"></ewo-skeleton></div>
          <div class="cap"><ewo-skeleton width="72%" height="0.75rem"></ewo-skeleton></div>
        </li>
      {/each}
    </ol>
  {:else}
    <ol class="cards all">
      {#each cards as [key, number, name], i (key)}
        <li>
          <button type="button" onclick={() => (viewing = i)}>
            <div class="thumb ph-box"><ewo-skeleton class="ph" width="100%" height="100%" radius="none"></ewo-skeleton><img class="f" use:load={{ src: img.card(s.id, key), eager: i < 6 }} alt={name} width="245" height="342" decoding="async" /></div>
            <div class="cap"><span class="mono">{number}</span><span>{name}</span></div>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</div>

{#if cards && viewing !== null}
  <CardViewer set={s} {cards} bind:at={viewing} />
{/if}

<style>
  .detail {
    max-width: 68rem;
    margin: 0 auto;
    padding: var(--ewo-space-4) var(--ewo-gutter) 0;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 14px 0 10px;
    margin-left: -4px;
    border: 1px solid var(--ewo-line);
    border-radius: var(--ewo-r-pill);
    background: none;
    font-weight: 500;
    font-size: var(--ewo-text-sm);
  }

  .hero {
    display: grid;
    gap: var(--ewo-space-4);
    padding: var(--ewo-space-6) 0 var(--ewo-space-5);
    justify-items: start;
  }

  .hero .logo {
    width: min(260px, 70vw);
    aspect-ratio: 5 / 2;
  }

  .hero .logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: left center;
  }

  .hero h1 {
    font-size: var(--ewo-text-2xl);
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    color: var(--ewo-fg-2);
  }

  .facts > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .facts img {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .grid-h {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: var(--ewo-space-4) 0 var(--ewo-space-3);
    border-top: 1px solid var(--ewo-line);
  }

  .grid-h h2 {
    font-size: var(--ewo-text-lg);
    font-weight: 600;
  }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0 0 var(--ewo-space-7);
    display: grid;
    gap: var(--ewo-space-4) var(--ewo-space-3);
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  }

  @media (min-width: 720px) {
    .cards {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: var(--ewo-space-5) var(--ewo-space-4);
    }
  }

  .cards.all li {
    content-visibility: auto;
    contain-intrinsic-size: auto 190px;
  }

  .top3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-width: 36rem;
    padding-bottom: var(--ewo-space-6);
  }

  .cards button {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
  }

  .thumb {
    aspect-ratio: 245 / 342;
    border-radius: 4.5% / 3.2%;
    overflow: hidden;
    background: var(--ewo-fill-2);
  }

  /* A top card shows its own colour, softened, under the sheen until it's in (see SetList). */
  .thumb.tinted {
    background: color-mix(in oklab, var(--c, transparent) 40%, var(--ewo-fill-2));
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cap {
    display: flex;
    gap: 6px;
    padding-top: 6px;
    min-width: 0;
  }

  .cap span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ewo-fg-2);
    font-size: var(--ewo-text-xs);
  }

  .cap .mono {
    color: var(--ewo-fg-3);
    padding-top: 1px;
  }

  .top3 .cap span {
    color: var(--ewo-fg);
    font-weight: 500;
  }

  .price {
    font: 600 var(--ewo-text-sm) / 1.2 var(--ewo-sans);
    font-variant-numeric: tabular-nums;
    padding-top: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    .cards button:hover .thumb {
      transform: translateY(-3px) scale(1.03);
      transition: transform var(--ewo-dur-2) var(--ewo-ease);
    }
  }
</style>
