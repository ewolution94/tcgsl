// Deutsche Texte. Namen von Sets, Serien, Karten und Seltenheiten kommen aus den Daten und
// bleiben englisch (es sind die englischen Sets).

import type { MessageKey } from './en.ts';

export const de: Record<MessageKey, string> = {
  'search.label': 'Sets suchen',

  'list.years': 'Jahre',
  'region.label': 'Welche Sets',
  'region.en': 'Englische Sets',
  'region.ja': 'Japanische Sets',
  'list.sets.one': '{count} Set',
  'list.sets.other': '{count} Sets',
  'list.cards.one': '{count} Karte',
  'list.cards.other': '{count} Karten',
  'list.empty': 'Kein Set passt.',
  'list.loading': 'Die Sets werden geladen …',
  'list.error': 'Die Sets wurden nicht geladen.',
  'list.retry': 'Nochmal versuchen',

  'set.back': 'Alle Sets',
  'set.released': 'Erschienen am {date}',
  'set.printed.one': '{count} Karte',
  'set.printed.other': '{count} Karten',
  'set.secret': '+ {count} Secret',
  'set.mostValuable': 'Am wertvollsten',
  'set.rarest': 'Am seltensten',
  'set.trend': 'Cardmarket-Trend',
  'set.noPrices': 'noch keine Preise',
  'set.byNumber': 'höchste Nummern',
  'set.allCards': 'Alle Karten',
  'set.loading': 'Die Karten werden geladen …',

  'viewer.label': 'Karte',
  'viewer.close': 'Schließen',
  'viewer.prev': 'Vorherige Karte',
  'viewer.next': 'Nächste Karte',

  'foot.count': '{count} Sets, Stand {date}',
  'foot.legal': 'Daten und Bilder: pokemontcg.io; japanische Sets von TCGdex, ihre englischen Namen von Limitless TCG, Bilder von Scrydex und TCGdex. Pokémon © Nintendo, Creatures, GAME FREAK. Fanprojekt, nicht mit den Rechteinhabern verbunden.',

  'settings.title': 'Einstellungen',
  'settings.list': 'Liste',
  'settings.previews': 'Kartenvorschau',
  'settings.previewsHint': 'Die wertvollsten Karten jedes Sets daneben.',
  'settings.yearBar': 'Jahresleiste',
  'settings.yearBarHint': 'Zu einem Jahr springen; auf dem Handy am Rand entlangziehen.',
  'settings.general': 'Allgemein',
  'settings.keys': 'Tastatur',
  'keys.search': 'Sets suchen',
  'keys.settings': 'Einstellungen öffnen',
  'keys.cards': 'Vorherige oder nächste Karte, in der Kartenansicht',
};
