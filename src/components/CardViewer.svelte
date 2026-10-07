<!--
  One card, large, with stepping through the set. The thumbnail the grid already loaded shows at
  once; the large image fades in over it, and the neighbours are warmed so stepping feels instant.
  The way out is a visible button (learnings/dialogs-and-overlays.md); backdrop and Escape are extras.
-->
<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import type { Card, Listed } from '../lib/data.ts';
  import { euro, t } from '../lib/i18n/index.svelte.ts';
  import { img } from '../lib/images.ts';
  import { tilt } from '../lib/tilt.ts';

  let { set: s, cards, at = $bindable() }: { set: Listed; cards: Card[]; at: number | null } = $props();

  let dialog: HTMLDialogElement;
  let loaded = $state(false);
  const card = $derived(cards[at ?? 0]);
  const [key, number, name, rarity, price] = $derived(card);

  $effect(() => {
    dialog.showModal();
    // Safari rings the first button otherwise (learnings/ios-and-webkit.md).
    dialog.focus();
  });

  $effect(() => {
    void key;
    loaded = false;
    for (const step of [1, -1]) new Image().src = img.hd(s.id, cards[(index() + step + cards.length) % cards.length][0]);
  });

  const index = () => at ?? 0;
  const step = (d: number) => (at = (index() + d + cards.length) % cards.length);

  // Out the way it came in: the card and the backdrop fade (260 ms, as every sheet's backdrop
  // in the family), then the viewer unmounts.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let closing = $state(false);
  function close() {
    if (closing) return;
    if (reduced.matches) return void (at = null);
    closing = true;
    setTimeout(() => (at = null), 260);
  }
</script>

<dialog
  class="viewer"
  bind:this={dialog}
  tabindex="-1"
  class:closing
  aria-label={t('viewer.label')}
  oncancel={(e) => {
    e.preventDefault();
    close();
  }}
  onclose={() => (at = null)}
  onclick={(e) => e.target === dialog && close()}
  onkeydown={(e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  }}
>
  <div class="panel">
    <div class="big" use:tilt style:background-image="url('{img.card(s.id, key)}')">
      {#key key}
        <img class="f" class:in={loaded} src={img.hd(s.id, key)} alt={name} onload={() => (loaded = true)} />
      {/key}
      <div class="glare" aria-hidden="true"></div>
    </div>
    <div class="info">
      <b>{name || `#${number}`}</b>
      <span class="mono muted">{[`${number}/${s.printed}`, rarity, euro(price)].filter(Boolean).join(' · ')}</span>
    </div>
    <div class="nav">
      <button type="button" onclick={() => step(-1)} aria-label={t('viewer.prev')}><ChevronLeft size={18} /></button>
      <button type="button" class="close" onclick={close}>{t('viewer.close')}</button>
      <button type="button" onclick={() => step(1)} aria-label={t('viewer.next')}><ChevronRight size={18} /></button>
    </div>
  </div>
</dialog>

<style>
  .viewer {
    border: 0;
    padding: 0;
    margin: auto;
    background: none;
    color: var(--ewo-fg);
    width: min(100vw, 30rem);
    max-height: 100dvh;
    overflow: visible;
  }

  /* Focused on open so Safari doesn't ring the first button; the dialog itself never shows the
     ring (WebKit counted that focus as visible and drew a white frame round the card). */
  .viewer:focus-visible {
    outline: none;
  }

  /* Every sheet's backdrop in the family (Cantina's, plans/settings-alignment.md). */
  .viewer::backdrop {
    background: oklch(0.1 0.01 270 / 0.5);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    animation: v-fade 300ms var(--ewo-ease);
  }

  .viewer.closing::backdrop {
    animation: v-fade 260ms var(--ewo-ease) reverse forwards;
  }

  .viewer[open] {
    animation: v-in 220ms var(--ewo-ease);
  }

  .viewer.closing {
    animation: v-in 260ms var(--ewo-ease) reverse forwards;
  }

  @keyframes v-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }

  @keyframes v-fade {
    from {
      opacity: 0;
    }
  }

  .panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ewo-space-3);
    padding: var(--ewo-space-4);
  }

  .big {
    position: relative;
    width: min(100%, calc((100dvh - 210px) * 734 / 1024));
    aspect-ratio: 734 / 1024;
    border-radius: 4.5% / 3.2%;
    overflow: hidden;
    background: var(--ewo-fill-2) center / cover no-repeat;
    box-shadow: var(--ewo-shadow);
  }

  .big img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  /* Tilted by lib/tilt.ts (transform only); the glare is a soft light that slides across. */
  .big {
    will-change: transform;
  }

  .glare {
    position: absolute;
    inset: -50%;
    background: radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.42), transparent 42%);
    opacity: 0;
    pointer-events: none;
  }

  /* On its own surface: the backdrop lets the page show through, too busy to read text on. */
  .info {
    text-align: center;
    padding: var(--ewo-space-2) var(--ewo-space-4);
    border: 1px solid var(--ewo-line);
    border-radius: var(--ewo-r-md);
    background: var(--ewo-bg-raised);
  }

  .info b {
    display: block;
    font-size: var(--ewo-text-lg);
    font-weight: 600;
  }

  .nav {
    display: flex;
    gap: var(--ewo-space-2);
    align-items: center;
  }

  .nav button {
    height: 44px;
    min-width: 44px;
    padding: 0 16px;
    border-radius: var(--ewo-r-pill);
    border: 1px solid var(--ewo-line-strong);
    background: var(--ewo-bg-raised);
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .nav .close {
    padding: 0 20px;
    background: var(--ewo-invert);
    color: var(--ewo-invert-ink);
    border-color: transparent;
  }
</style>
