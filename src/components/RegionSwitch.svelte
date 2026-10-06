<!--
  English or Japanese releases, at the top of the list where it can't be missed. Folio's
  segmented control; the choice is remembered on this device (prefs.region). Aligned with the
  list column, beside the year rail on desktop and clear of the scrubber on phones.
-->
<script lang="ts">
  import { t } from '../lib/i18n/index.svelte.ts';
  import { prefs, type Region } from '../lib/prefs.svelte.ts';
</script>

<div class="regions shifts" class:no-rail={!prefs.yearBar}>
  <ewo-segmented label={t('region.label')} value={prefs.region} onchange={(e) => (prefs.region = e.detail.value as Region)}>
    <option value="en">{t('region.en')}</option>
    <option value="ja">{t('region.ja')}</option>
  </ewo-segmented>
</div>

<style>
  .regions {
    max-width: 68rem;
    margin: 0 auto;
    padding: var(--ewo-space-4) var(--ewo-gutter) 0;
  }

  @media (min-width: 960px) {
    .regions:not(.no-rail) {
      padding-left: calc(var(--ewo-gutter) + 8.5rem + var(--ewo-space-6));
    }
  }

  @media (max-width: 959.98px) {
    .regions:not(.no-rail) {
      padding-left: calc(var(--ewo-gutter) + 26px);
    }
  }
</style>
