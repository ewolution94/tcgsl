// English messages. Set, series, card and rarity names come from the data and stay English.

export const en = {
  'nav.settings': 'Settings',
  'search.label': 'Search sets',

  'list.years': 'Years',
  'list.sets.one': '{count} set',
  'list.sets.other': '{count} sets',
  'list.cards.one': '{count} card',
  'list.cards.other': '{count} cards',
  'list.empty': 'No sets match.',
  'list.error': 'The sets didn’t load.',
  'list.retry': 'Try again',

  'set.back': 'All sets',
  'set.released': 'Released {date}',
  'set.printed.one': '{count} card',
  'set.printed.other': '{count} cards',
  'set.secret': '+ {count} secret',
  'set.mostValuable': 'Most valuable',
  'set.rarest': 'Rarest',
  'set.trend': 'Cardmarket trend',
  'set.noPrices': 'no prices yet',
  'set.allCards': 'All cards',

  'viewer.label': 'Card',
  'viewer.close': 'Close',
  'viewer.prev': 'Previous card',
  'viewer.next': 'Next card',

  'foot.count': '{count} sets, snapshot of {date}',
  'foot.legal': 'Data and images: pokemontcg.io. Pokémon © Nintendo, Creatures, GAME FREAK. Fan project, not affiliated.',

  // Settings
  'settings.title': 'Settings',
  'settings.look': 'Look',
  'settings.theme': 'Theme',
  'settings.system': 'System',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.language': 'Language',
  'settings.keys': 'Keyboard',
  'keys.search': 'Search sets',
  'keys.settings': 'Open settings',
  'keys.cards': 'Previous or next card, in the card view',
} as const;

export type MessageKey = keyof typeof en;
