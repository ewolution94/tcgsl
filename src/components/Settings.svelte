<!--
  Settings, the family's way (plans/settings-alignment.md): Folio's ewo-sheet, General first with
  ewo-settings-basics (language, theme), then the list (card previews, the year bar) and, with a
  keyboard, the keys. Opens from the header's settings button, or with `,`.
-->
<script lang="ts">
  import { prefs, ui, type Language } from '../lib/prefs.svelte.ts';
  import { theme, type ThemePreference } from '../lib/theme.svelte.ts';
  import { setLanguage, t } from '../lib/i18n/index.svelte.ts';

  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const touchOnly = matchMedia('(hover: none)').matches;

  const close = () => (ui.settings = false);
</script>

<ewo-sheet open={ui.settings} label={t('settings.title')} oncancel={close} onclose={close}>
  <span slot="heading">{t('settings.title')}</span>

  {#if ui.settings}
    <section>
      <h3 class="label">{t('settings.general')}</h3>
      <!-- Folio's rows, in the same words in every app (it follows <html lang>). It applies
           nothing itself: setLanguage and theme.set run the change under themeShift. -->
      <ewo-settings-basics
        language={prefs.language}
        theme={theme.preference}
        onlanguage-change={(e) => setLanguage(e.detail.value as Language)}
        ontheme-change={(e) => theme.set(e.detail.value as ThemePreference)}
      ></ewo-settings-basics>
    </section>

    <section>
      <h3 class="label">{t('settings.list')}</h3>
      <div class="switches">
        <ewo-switch row checked={prefs.previews} onchange={(e) => (prefs.previews = e.detail.checked)}>
          {t('settings.previews')}
          <span slot="hint">{t('settings.previewsHint')}</span>
        </ewo-switch>
        <ewo-switch row checked={prefs.yearBar} onchange={(e) => (prefs.yearBar = e.detail.checked)}>
          {t('settings.yearBar')}
          <span slot="hint">{t('settings.yearBarHint')}</span>
        </ewo-switch>
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

  .switches {
    display: grid;
    gap: 0.9rem;
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
</style>
