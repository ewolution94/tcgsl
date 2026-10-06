<!--
  Every set, newest first, one row each, grouped by year. The year rail is a sticky column on
  desktop and a scrubber along the left edge on phones (drag along it to fly through the years;
  left, because the scroll indicator runs down the right). Settings can hide the rail and the
  card previews.

  Speed: every row is in the DOM (176 is cheap), but off-screen years skip layout and paint
  (content-visibility), images load about a screen ahead (lib/images.ts), and only the first rows
  load at once.
-->
<script lang="ts">
  import type { Index, Listed } from '../lib/data.ts';
  import { day, t, tn } from '../lib/i18n/index.svelte.ts';
  import { img, load } from '../lib/images.ts';
  import { prefs } from '../lib/prefs.svelte.ts';
  import { openSet } from '../lib/router.svelte.ts';

  let { index, query }: { index: Index; query: string } = $props();

  const years = $derived.by(() => {
    const out: { y: string; sets: Listed[] }[] = [];
    for (const s of index.sets) {
      const y = s.date.slice(0, 4);
      if (out.at(-1)?.y !== y) out.push({ y, sets: [] });
      out.at(-1)!.sets.push(s);
    }
    return out;
  });

  const term = $derived(query.trim().toLowerCase());
  const hit = (s: Listed) => !term || s.hay.includes(term);
  const anyHit = $derived(index.sets.some(hit));

  // Off-screen years skip rendering; a close guess of their height keeps the scrollbar honest
  // and year jumps on target.
  const rowH = matchMedia('(min-width: 600px)').matches ? 85 : 77;

  // The first rows are above the fold on any screen: they load at once, the first logos at high
  // priority. Everything else waits until it comes near.
  const order = $derived(new Map(index.sets.map((s, i) => [s.id, i])));

  let list: HTMLElement;
  let rail = $state<HTMLElement>();
  let current = $state('');
  let bubble = $state('');

  $effect(() => {
    void term;
    scrollTo({ top: 0 });
  });

  // The rail follows the scroll: the year whose header is stuck at the top wins.
  $effect(() => {
    void years;
    const pick = () => {
      const top = [...list.querySelectorAll<HTMLElement>('.year:not([hidden])')].find((sec) => sec.getBoundingClientRect().bottom > 120);
      if (top) current = top.dataset.y!;
    };
    const io = new IntersectionObserver(pick, { rootMargin: '-56px 0px -60% 0px', threshold: [0, 1] });
    list.querySelectorAll('.year').forEach((sec) => io.observe(sec));
    pick();
    return () => io.disconnect();
  });

  function jump(y: string) {
    const sec = document.getElementById(`y${y}`);
    if (!sec || sec.hidden) return;
    const bar = document.querySelector<HTMLElement>('.bar')?.offsetHeight ?? 0;
    const go = () => scrollTo(0, sec.getBoundingClientRect().top + scrollY - bar + 1);
    go();
    // Sections rendered on arrival can differ from their guess: correct once.
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 120); // rAF doesn't run in a hidden tab
  }

  // Phone scrubber: drag along the edge to fly through the years.
  let scrubbing = false;
  const desktop = () => matchMedia('(min-width: 960px)').matches;
  function scrubAt(event: PointerEvent) {
    if (!rail) return;
    const box = rail.getBoundingClientRect();
    const a = document.elementFromPoint(box.left + box.width / 2, event.clientY)?.closest<HTMLElement>('a[data-y]');
    if (!a) return;
    bubble = a.dataset.y!;
    jump(a.dataset.y!);
  }
  function scrubStart(event: PointerEvent) {
    if (desktop()) return;
    scrubbing = true;
    try {
      rail?.setPointerCapture(event.pointerId);
    } catch {}
    scrubAt(event);
    event.preventDefault();
  }
  function scrubEnd() {
    scrubbing = false;
    bubble = '';
  }

  function open(event: MouseEvent, id: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    openSet(id);
  }
</script>

<div class="wrap" class:no-rail={!prefs.yearBar} class:no-peek={!prefs.previews}>
  {#if prefs.yearBar}
    <ol class="rail shifts" aria-label={t('list.years')} bind:this={rail} onpointerdown={scrubStart} onpointermove={(e) => scrubbing && scrubAt(e)} onpointerup={scrubEnd} onpointercancel={scrubEnd}>
      {#each years as { y, sets } (y)}
        <li hidden={!sets.some(hit)}>
          <a href="#y{y}" data-y={y} aria-current={current === y ? 'true' : undefined} onclick={(e) => { e.preventDefault(); jump(y); }}>
            <em class="full">{y}</em><em class="short">’{y.slice(2)}</em><span>{sets.length}</span>
          </a>
        </li>
      {/each}
    </ol>
  {/if}

  <div class="list shifts" bind:this={list}>
    {#each years as { y, sets } (y)}
      {@const shown = sets.filter(hit).length}
      <section class="year" id="y{y}" data-y={y} hidden={!shown} style:contain-intrinsic-size="auto {80 + sets.length * rowH}px">
        <div class="year-h"><h2>{y}</h2><span class="mono muted">{tn('list.sets', sets.length)}</span></div>
        <ol class="rows">
          {#each sets as s (s.id)}
            {@const i = order.get(s.id) ?? 99}
            {@const eager = i < 8}
            {@const d = day(s.date)}
            <li class="row" data-set-row={s.id} hidden={!hit(s)}>
              <a href="#/set/{s.id}" onclick={(e) => open(e, s.id)}>
                <time class="d" datetime={s.date}><b>{d.day}</b><span class="mono muted">{d.month}</span></time>
                {#if s.logo === false}
                  <!-- No logo found for this (Japanese) set: its printed code stands in. -->
                  <span class="logo code"><span class="mono">{s.code}</span></span>
                {:else}
                  <span class="logo ph-box"><ewo-skeleton class="ph ph--bar" width="100%" height="100%" radius="sm"></ewo-skeleton><img class="f set-logo" use:load={{ src: img.logo(s.id), eager }} alt="" width="160" height="64" decoding="async" fetchpriority={i < 4 ? 'high' : undefined} /></span>
                {/if}
                <span class="txt">
                  <b>{s.name}</b>
                  <small>{#if s.logo !== false}<img class="f" use:load={{ src: img.symbol(s.id), eager }} alt="" width="14" height="14" decoding="async" />{/if}<span>{tn('list.cards', s.total)} · {s.series}</span></small>
                </span>
                {#if prefs.previews}
                  <span class="peek" aria-hidden="true">
                    {#each s.top as c, ci (c.k)}
                      <!-- Only the front card loads eagerly: the other two are hidden on phones. -->
                      <i class="ph-box" style:--c={c.c}><ewo-skeleton class="ph" width="100%" height="100%" radius="none"></ewo-skeleton><img class="f" use:load={{ src: img.card(s.id, c.k, 120), eager: eager && ci === 0 }} alt="" width="42" height="58" decoding="async" /></i>
                    {/each}
                  </span>
                {/if}
              </a>
            </li>
          {/each}
        </ol>
      </section>
    {/each}
    {#if !anyHit}<p class="empty">{t('list.empty')}</p>{/if}
  </div>
</div>
{#if prefs.yearBar}<div class="bubble" class:on={bubble} aria-hidden="true">{bubble}</div>{/if}

<style>
  .wrap {
    max-width: 68rem;
    margin: 0 auto;
    padding: 0 var(--ewo-gutter);
    display: grid;
    /* minmax(0, …): an auto column would grow to the longest set name (learnings/css-and-layout.md). */
    grid-template-columns: minmax(0, 1fr);
  }

  @media (min-width: 960px) {
    .wrap:not(.no-rail) {
      grid-template-columns: 8.5rem minmax(0, 1fr);
      gap: var(--ewo-space-6);
    }
  }

  .rail {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .rail a {
    display: block;
    font: 500 var(--ewo-text-2xs) / 1 var(--ewo-mono);
    color: var(--ewo-fg-3);
  }

  .rail a[aria-current] {
    color: var(--ewo-fg);
  }

  .rail em {
    font-style: normal;
  }

  .rail .short {
    display: none;
  }

  @media (min-width: 960px) {
    .rail {
      position: sticky;
      top: calc(var(--ewo-bar-h) + var(--ewo-space-5));
      align-self: start;
      padding-top: var(--ewo-space-5);
      max-height: calc(100dvh - var(--ewo-bar-h) - var(--ewo-space-6));
      overflow-y: auto;
      scrollbar-width: none;
    }

    .rail a {
      display: flex;
      justify-content: space-between;
      padding: 6px 10px;
      border-radius: var(--ewo-r-xs);
      font-size: var(--ewo-text-xs);
    }

    .rail a span {
      color: var(--ewo-fg-4);
    }

    .rail a[aria-current] {
      background: var(--ewo-fill-2);
    }

    .rail a[aria-current] span {
      color: var(--ewo-fg-3);
    }
  }

  @media (max-width: 959.98px) {
    .rail {
      position: fixed;
      z-index: 15;
      left: 0;
      top: calc(var(--ewo-bar-h) + 6px);
      bottom: calc(12px + env(safe-area-inset-bottom));
      width: 36px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 4px 0;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .rail li {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }

    /* As large as 28 years allow in the height there is: 12.5px on a tall phone, 10px on the
       smallest. */
    .rail a {
      font-size: clamp(10px, 1.5dvh, 12.5px);
      letter-spacing: 0;
      padding: 2px 5px;
    }

    .rail a span,
    .rail .full {
      display: none;
    }

    .rail .short {
      display: inline;
    }

    .rail a[aria-current] {
      color: var(--ewo-invert-ink);
      background: var(--ewo-invert);
      border-radius: 4px;
    }

    .wrap:not(.no-rail) .list {
      padding-left: 26px;
    }
  }

  .bubble {
    position: fixed;
    z-index: 30;
    left: 52px;
    top: 50%;
    translate: 0 -50%;
    padding: 10px 16px;
    border-radius: var(--ewo-r-md);
    background: var(--ewo-invert);
    color: var(--ewo-invert-ink);
    font: 650 var(--ewo-text-2xl) / 1 var(--ewo-sans);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    opacity: 0;
  }

  .bubble.on {
    opacity: 1;
  }

  .year {
    content-visibility: auto;
  }

  .year-h {
    position: sticky;
    top: var(--ewo-bar-h);
    z-index: 5;
    background: var(--ewo-bg);
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: var(--ewo-space-5) 0 var(--ewo-space-2);
  }

  .year-h h2 {
    font-size: var(--ewo-text-2xl);
    font-weight: 650;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .rows {
    list-style: none;
    margin: 0 0 var(--ewo-space-3);
    padding: 0;
  }

  .row a {
    position: relative;
    display: grid;
    align-items: center;
    column-gap: 12px;
    grid-template-columns: 2.25rem 6.25rem minmax(0, 1fr) auto;
    min-height: 76px;
    padding: 10px 0;
    border-bottom: 1px solid var(--ewo-line-2);
  }

  .row:last-child a {
    border-bottom: 0;
  }

  .no-peek .row a {
    grid-template-columns: 2.25rem 6.25rem minmax(0, 1fr);
  }

  .d {
    display: grid;
    justify-items: start;
    line-height: 1;
  }

  .d b {
    font-size: var(--ewo-text-lg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .d span {
    margin-top: 4px;
    text-transform: uppercase;
  }

  .logo {
    height: 44px;
    display: flex;
    align-items: center;
  }

  .logo.code span {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 9px;
    border: 1px solid var(--ewo-line-strong);
    border-radius: var(--ewo-r-xs);
    color: var(--ewo-fg-2);
    font-size: var(--ewo-text-xs);
  }

  .logo img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
  }

  .txt {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .txt b {
    /* As wide as its text, so it morphs into the set page's title without stretching. */
    justify-self: start;
    font-weight: 550;
    font-size: var(--ewo-text-md);
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .txt small {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--ewo-fg-3);
    min-width: 0;
  }

  .txt small img {
    width: 14px;
    height: 14px;
    object-fit: contain;
    flex: none;
  }

  .txt small span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The set's three most valuable cards, fanned; one on phones (the hidden two never come into
     view, so they never load there). */
  .peek {
    position: relative;
    width: 38px;
    height: 53px;
  }

  /* The card's own colour, softened (a dominant colour is often its black, white or silver
     border), under the skeleton's sheen until the image is in. */
  .peek i.ph-box {
    position: absolute;
    inset: 0;
    border-radius: 3px;
    overflow: hidden;
    background: color-mix(in oklab, var(--c, transparent) 40%, var(--ewo-fill-2));
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.18);
  }

  .peek img {
    width: 100%;
    height: 100%;
  }

  .peek i:nth-child(n + 2) {
    display: none;
  }

  @media (min-width: 600px) {
    .row a {
      grid-template-columns: 2.5rem 8.5rem minmax(0, 1fr) auto;
      column-gap: 18px;
      min-height: 84px;
    }

    .no-peek .row a {
      grid-template-columns: 2.5rem 8.5rem minmax(0, 1fr);
    }

    .logo {
      height: 52px;
    }

    .peek {
      width: 98px;
      height: 58px;
    }

    .peek i {
      width: 42px;
      height: 58px;
      inset: 0 auto auto 0;
    }

    .peek i:nth-child(n + 2) {
      display: block;
    }

    .peek i:nth-child(1) {
      z-index: 3;
      translate: 56px 0;
    }

    .peek i:nth-child(2) {
      z-index: 2;
      translate: 28px 0;
    }

    .peek i:nth-child(3) {
      z-index: 1;
      translate: 0 0;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .row a::before {
      content: '';
      position: absolute;
      inset: 0 -12px;
      border-radius: var(--ewo-r-sm);
      background: var(--ewo-fill);
      opacity: 0;
    }

    .row a:hover::before {
      opacity: 1;
      transition: opacity var(--ewo-dur-1);
    }

    .row a:hover .peek i:nth-child(1) {
      transform: translateX(6px) rotate(6deg);
      transition: transform var(--ewo-dur-2) var(--ewo-ease);
    }

    .row a:hover .peek i:nth-child(3) {
      transform: translateX(-6px) rotate(-6deg);
      transition: transform var(--ewo-dur-2) var(--ewo-ease);
    }
  }

  .empty {
    padding: var(--ewo-space-8) 0;
    text-align: center;
    color: var(--ewo-fg-3);
  }

  [hidden] {
    display: none !important;
  }
</style>
