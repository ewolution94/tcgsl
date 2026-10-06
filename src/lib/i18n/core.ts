/**
 * Messages and formatting, without Svelte. Components use the reactive wrappers in
 * `index.svelte.ts`, which pass the current language in and make templates update when it changes.
 */

import { de } from './de.ts';
import { en, type MessageKey } from './en.ts';

export type Locale = 'en' | 'de';
export type { MessageKey };

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, de };

type Param = string | number;

export function translate(key: MessageKey, params: Record<string, Param> | undefined, locale: Locale): string {
  const template = DICTIONARIES[locale][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** The base of the keys that come in `.one` / `.other` pairs. */
export type PluralBase = { [K in MessageKey]: K extends `${infer Base}.other` ? Base : never }[MessageKey];

export function plural(base: PluralBase, count: number, params: Record<string, Param> | undefined, locale: Locale): string {
  const form = new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other';
  return translate(`${base}.${form}` as MessageKey, { count: count.toLocaleString(locale), ...params }, locale);
}

// Month names written out rather than from Intl: English "16 Sep 2026" (Intl's en is US order,
// en-GB says "Sept"), German "16. Sept. 2026", and three uppercase letters for the date column.
const MONTHS: Record<Locale, { short: string[]; long: string[] }> = {
  en: {
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    long: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  de: {
    short: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    long: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
  },
};

/** "2026-09-16" → { day: 16, month: "Sep" } for the list's date column. */
export function dayMonth(iso: string, locale: Locale) {
  const [, m, d] = iso.split('-').map(Number);
  return { day: d, month: MONTHS[locale].short[m - 1] };
}

/** "2026-09-16" → "16 Sep 2026" / "16. Sept. 2026". */
export function longDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTHS[locale].long[m - 1];
  return locale === 'de' ? `${d}. ${month} ${y}` : `${d} ${month} ${y}`;
}

/** Prices read "5,80€" in both languages (the family's format). */
export function euro(value: number): string {
  return value ? `${value.toFixed(2).replace('.', ',')}€` : '';
}
