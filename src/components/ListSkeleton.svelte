<!--
  The list before its data has arrived: a year and a screen of rows in Folio's skeletons, laid out
  on SetList's grid (keep the two in step), so the real rows land where these were. Only shown
  while the index loads; on a fast connection it's gone before it's seen.
-->
<script lang="ts">
  import { t } from '../lib/i18n/index.svelte.ts';
  import { prefs } from '../lib/prefs.svelte.ts';
</script>

<div class="wrap shifts" class:no-rail={!prefs.yearBar} class:no-peek={!prefs.previews} aria-busy="true">
  <p class="sr" role="status">{t('list.loading')}</p>
  <div class="rail" aria-hidden="true">
    {#each Array(10) as _, i (i)}<ewo-skeleton width="100%" height="0.75rem"></ewo-skeleton>{/each}
  </div>
  <div class="list" aria-hidden="true">
    <div class="year-h">
      <ewo-skeleton width="5.25rem" height="1.75rem"></ewo-skeleton>
      <ewo-skeleton width="3rem" height="0.6875rem"></ewo-skeleton>
    </div>
    {#each Array(8) as _, i (i)}
      <div class="row">
        <span class="d"><ewo-skeleton width="1.25rem" height="1rem"></ewo-skeleton><ewo-skeleton width="1.6rem" height="0.6rem"></ewo-skeleton></span>
        <span class="logo"><ewo-skeleton width="100%" height="100%" radius="sm"></ewo-skeleton></span>
        <span class="txt"><ewo-skeleton width="72%" height="0.875rem"></ewo-skeleton><ewo-skeleton width="48%" height="0.6875rem"></ewo-skeleton></span>
        {#if prefs.previews}<span class="peek"><ewo-skeleton width="100%" height="100%" radius="xs"></ewo-skeleton></span>{/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .wrap {
    max-width: 68rem;
    margin: 0 auto;
    padding: 0 var(--ewo-gutter);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .rail {
    display: none;
  }

  .no-rail .rail {
    display: none !important;
  }

  @media (min-width: 960px) {
    .wrap:not(.no-rail) {
      grid-template-columns: 8.5rem minmax(0, 1fr);
      gap: var(--ewo-space-6);
    }

    .rail {
      display: grid;
      gap: 16px;
      align-content: start;
      padding: calc(var(--ewo-space-5) + 6px) 10px 0;
    }
  }

  @media (max-width: 959.98px) {
    .wrap:not(.no-rail) .list {
      padding-left: 26px;
    }
  }

  .year-h {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: var(--ewo-space-5) 0 var(--ewo-space-2);
  }

  .row {
    display: grid;
    align-items: center;
    column-gap: 12px;
    grid-template-columns: 2.25rem 6.25rem minmax(0, 1fr) auto;
    min-height: 76px;
    padding: 10px 0;
    border-bottom: 1px solid var(--ewo-line-2);
  }

  .no-peek .row {
    grid-template-columns: 2.25rem 6.25rem minmax(0, 1fr);
  }

  .d,
  .txt {
    display: grid;
    gap: 6px;
  }

  .logo {
    height: 44px;
    display: flex;
    align-items: center;
  }

  .logo ewo-skeleton {
    height: 60%;
  }

  .peek {
    display: block;
    width: 38px;
    height: 53px;
  }

  .peek ewo-skeleton {
    height: 100%;
  }

  @media (min-width: 600px) {
    .row {
      grid-template-columns: 2.5rem 8.5rem minmax(0, 1fr) auto;
      column-gap: 18px;
      min-height: 84px;
    }

    .no-peek .row {
      grid-template-columns: 2.5rem 8.5rem minmax(0, 1fr);
    }

    .logo {
      height: 52px;
    }

    .peek {
      width: 42px;
      height: 58px;
      margin-left: 56px;
    }
  }
</style>
