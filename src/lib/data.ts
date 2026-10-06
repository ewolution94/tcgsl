// The snapshot from scripts/build-data.mjs: one small index for the list, and one file per set
// with its full card list, fetched when the set is opened.

export interface TopCard {
  /** The card's key: its id suffix, unique within the set ("106p"), which the printed number isn't. */
  k: string;
  name: string;
  /** Dominant colour, the placeholder while the image loads. */
  c: string | null;
  /** Cardmarket trend price in euros; 0 when unknown. */
  p: number;
}

export interface CardSet {
  id: string;
  name: string;
  series: string;
  /** Release date, "2026-09-16". */
  date: string;
  printed: number;
  total: number;
  code: string | null;
  /** False for a Japanese set whose pictures couldn't be found (no logo, no card images). */
  pics?: boolean;
  top: TopCard[];
}

export interface Listed extends CardSet {
  secret: number;
  /** Lower-cased text the search matches. */
  hay: string;
}

export interface Index {
  built: string;
  sets: Listed[];
  bySet: Map<string, Listed>;
}

/** [key, printed number, name, rarity, price] */
export type Card = [string, string, string, string, number];

/** Japanese set ids end in _ja (Scrydex's), so a link alone says which list it belongs to. */
export const regionOf = (id: string) => (id.endsWith('_ja') ? 'ja' : 'en');

export async function loadIndex(region: 'en' | 'ja' = 'en'): Promise<Index> {
  const file = region === 'ja' ? 'sets-ja.json' : 'sets.json';
  const res = await fetch(`/data/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const { built, sets } = (await res.json()) as { built: string; sets: CardSet[] };
  const listed = sets.map((s) => ({
    ...s,
    secret: Math.max(0, s.total - s.printed),
    hay: `${s.name} ${s.series} ${s.code ?? ''} ${s.id}`.toLowerCase(),
  }));
  return { built, sets: listed, bySet: new Map(listed.map((s) => [s.id, s])) };
}

const cards = new Map<string, Promise<Card[]>>();

export function loadCards(id: string): Promise<Card[]> {
  let job = cards.get(id);
  if (!job) {
    job = fetch(`/data/sets/${id}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`${id}.json: HTTP ${res.status}`);
        return res.json() as Promise<{ cards: Card[] }>;
      })
      .then((data) => data.cards);
    job.catch(() => cards.delete(id));
    cards.set(id, job);
  }
  return job;
}
