<!--
  The snapshot's size and date, and the credits. In dev builds, how many image bytes the page has
  pulled so far: a check on the loading strategy, never shipped.
-->
<script lang="ts">
  import type { Index } from '../lib/data.ts';
  import { date, t } from '../lib/i18n/index.svelte.ts';

  let { index }: { index: Index } = $props();

  let weight = $state('');
  if (import.meta.env.DEV) {
    $effect(() => {
      let n = 0;
      let bytes = 0;
      let queued = false;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          if (!entry.name.includes('/img/')) continue;
          n++;
          bytes += entry.encodedBodySize || entry.transferSize || 0;
        }
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          weight = `${n} images, ${bytes < 1e6 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`}`;
        });
      });
      observer.observe({ type: 'resource', buffered: true });
      return () => observer.disconnect();
    });
  }
</script>

<footer class="shifts">
  <div class="row">
    <span>{t('foot.count', { count: index.sets.length, date: date(index.built.slice(0, 10)) })}</span>
    {#if weight}<span class="mono">{weight}</span>{/if}
  </div>
  <p>{t('foot.legal')}</p>
</footer>

<style>
  footer {
    max-width: 68rem;
    margin: 0 auto;
    /* Room for Safari's floating toolbar (learnings/ios-and-webkit.md). */
    padding: var(--ewo-space-6) var(--ewo-gutter) calc(var(--ewo-space-6) + 76px);
    display: grid;
    gap: var(--ewo-space-3);
    color: var(--ewo-fg-3);
    font-size: var(--ewo-text-xs);
    border-top: 1px solid var(--ewo-line-2);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ewo-space-3);
    justify-content: space-between;
  }

  .mono {
    font-variant-numeric: tabular-nums;
  }
</style>
