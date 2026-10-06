<!--
  Settings, the family's way (Folio's ewo-sheet and ewo-segmented, laid out like Pinout's and
  Prospekt's): look (theme, language) and, with a keyboard, the keys. Opens from the header's
  gear, or with `,`.
-->
<script lang="ts">
  import { prefs, ui, type Language } from '../lib/prefs.svelte.ts';
  import { theme, type ThemePreference } from '../lib/theme.svelte.ts';
  import { t } from '../lib/i18n/index.svelte.ts';

  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const touchOnly = matchMedia('(hover: none)').matches;

  const close = () => (ui.settings = false);
</script>

<ewo-sheet open={ui.settings} label={t('settings.title')} oncancel={close} onclose={close}>
  <span slot="heading">{t('settings.title')}</span>

  {#if ui.settings}
    <section>
      <h3 class="label">{t('settings.look')}</h3>
      <div class="pair">
        <span>{t('settings.theme')}</span>
        <ewo-segmented size="sm" label={t('settings.theme')} value={theme.preference} onchange={(e) => theme.set(e.detail.value as ThemePreference)}>
          <option value="system">{t('settings.system')}</option>
          <option value="light">{t('settings.light')}</option>
          <option value="dark">{t('settings.dark')}</option>
        </ewo-segmented>
      </div>
      <div class="pair">
        <span>{t('settings.language')}</span>
        <!-- Language names stay in their own language, so they're findable whatever is active. -->
        <ewo-segmented size="sm" label={t('settings.language')} value={prefs.language} onchange={(e) => (prefs.language = e.detail.value as Language)}>
          <option value="system">{t('settings.system')}</option>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </ewo-segmented>
      </div>
    </section>

    {#if !touchOnly}
      <section class="keys">
        <h3 class="label">{t('settings.keys')}</h3>
        <dl>
          <div><dt><kbd>/</kbd></dt><dd>{t('keys.search')}</dd></div>
          <div><dt><kbd>,</kbd> <kbd>{mac ? '⌘' : 'Ctrl'}</kbd><kbd>,</kbd></dt><dd>{t('keys.settings')}</dd></div>
          <div><dt><kbd>←</kbd><kbd>→</kbd></dt><dd>{t('keys.cards')}</dd></div>
        </dl>
      </section>
    {/if}
  {/if}
</ewo-sheet>

<style>
  section {
    display: grid;
    gap: 0.75rem;
    padding-block: 0.25rem 1.1rem;
  }

  section + section {
    padding-top: 1.1rem;
    border-top: 1px solid var(--ewo-line);
  }

  .pair {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.95rem;
  }

  .pair > span {
    min-width: 0;
  }

  .pair ewo-segmented {
    flex: none;
  }

  dl {
    display: grid;
    gap: 0.45rem;
    margin: 0;
  }

  dl > div {
    display: grid;
    grid-template-columns: 7.5rem 1fr;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  dd {
    margin: 0;
    color: var(--ewo-fg-2);
  }

  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.3rem;
    border: 1px solid var(--ewo-line-strong);
    border-radius: 6px;
    font-family: var(--ewo-mono);
    font-size: 0.72rem;
    color: var(--ewo-fg-2);
  }

  @media (max-width: 420px) {
    .pair {
      flex-wrap: wrap;
    }
  }
</style>
