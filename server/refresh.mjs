// Builds the data snapshot from pokemontcg.io: every English set, its cards, its three top cards,
// and where each image lives. Used by `npm run data` (scripts/build-data.mjs) and by the server,
// which refreshes its snapshot once a day so new sets appear on their own.
//
//   <data>/sets.json        the index: every set and its three top cards
//   <data>/sets/<id>.json   one set's full card list, fetched when it's opened
//   <data>/upstream.json    where each image really lives (read by routes.mjs)
//
// All or nothing: the files are written to a fresh folder and swapped in at the end, so a
// failed run (the API answers 500 at random) leaves the last good snapshot in place.

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { configure, dominant, getImage } from './images.mjs';

const API = 'https://api.pokemontcg.io/v2';
const UA = 'tcgsl (ewolution.cloud)';

// The two places card images live; a set uses whichever fits most of its cards.
const TEMPLATES = [
  (set) => ({ card: `https://images.pokemontcg.io/${set}/{n}.png`, hd: `https://images.pokemontcg.io/${set}/{n}_hires.png` }),
  (set) => ({ card: `https://images.scrydex.com/pokemon/${set}-{n}/small`, hd: `https://images.scrydex.com/pokemon/${set}-{n}/large` }),
];

// Highest first; decides the top cards when a set has no Cardmarket prices yet (the newest
// sets) and breaks ties otherwise. Special Illustration Rares lead: in priced sets they usually
// top the gold Hyper Rares on value.
const RARITY = [
  'Special Illustration Rare', 'Mega Hyper Rare', 'Hyper Rare', 'Black White Rare', 'Futuristic Rare',
  'Illustration Rare', 'Ultra Rare', 'Shiny Ultra Rare', 'Rare Secret', 'Rare Rainbow', 'Rare Shiny GX',
  'Rare Ultra', 'MEGA_ATTACK_RARE', 'Rare Holo VMAX', 'Holo Rare VMAX', 'Rare Holo VSTAR', 'Holo Rare VSTAR',
  'Rare Holo V', 'Holo Rare V', 'Rare Holo GX', 'Rare Holo EX', 'Rare Holo ex', 'Rare Holo LV.X', 'Rare Prime',
  'LEGEND', 'Rare Holo Star', 'Rare Shining', 'Amazing Rare', 'Radiant Rare', 'Rare Prism Star', 'Rare BREAK',
  'Trainer Gallery Rare Holo', 'Shiny Rare', 'Rare Shiny', 'Classic Collection', 'Double Rare', 'ACE SPEC Rare',
  'Rare ACE', 'Rare Holo', 'Pikachu Rare', 'Promo', 'Rare',
];
export const rarityRank = (r) => {
  const i = RARITY.indexOf(r);
  return i < 0 ? RARITY.length : i;
};
// Among equally rare cards, Pokémon before Trainers, and a set's Megas first.
const POKEMON = /\b(ex|EX|GX|V|VMAX|VSTAR|LV\.X|BREAK|Prime|LEGEND)\b|^(Mega|M|Dark|Light|Shining) /;

const byNumber = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const round = (n) => Math.round(n * 100) / 100;
export const price = (c) => c.cardmarket?.prices?.trendPrice ?? c.cardmarket?.prices?.averageSellPrice ?? 0;

/** Most valuable first; by rarity where there are no prices. */
export function rank(cards) {
  return [...cards].sort(
    (a, b) =>
      price(b) - price(a) ||
      rarityRank(a.rarity) - rarityRank(b.rarity) ||
      POKEMON.test(b.name) - POKEMON.test(a.name) ||
      /^Mega /.test(b.name) - /^Mega /.test(a.name) ||
      byNumber(b.number, a.number),
  );
}

async function getJSON(url, tries = 10) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i >= tries - 1) throw new Error(`${url}: ${err.message}`, { cause: err });
      await new Promise((r) => setTimeout(r, Math.min(8000, 500 * 2 ** i)));
    }
  }
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/**
 * @param {{ data: string, apiCache?: string, log?: (msg: string) => void }} options
 *   data      the snapshot folder to replace
 *   apiCache  keep raw API answers here and reuse them (local runs); omit to always fetch
 */
export async function refresh({ data, apiCache, log = () => {} }) {
  const started = Date.now();
  const cached = async (name, fn) => {
    if (!apiCache) return fn();
    const file = path.join(apiCache, `${name}.json`);
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {}
    const value = await fn();
    await mkdir(apiCache, { recursive: true });
    await writeFile(file, JSON.stringify(value));
    return value;
  };

  const fields = 'id,name,series,printedTotal,total,releaseDate,ptcgoCode,images';
  const sets = await cached('sets', async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((p) => getJSON(`${API}/sets?orderBy=-releaseDate&pageSize=100&page=${p}&select=${fields}`)),
    );
    return pages.flatMap((p) => p.data);
  });
  if (sets.length < 100) throw new Error(`only ${sets.length} sets: refusing to replace the snapshot`);

  const upstream = { sets: {}, cards: {} };
  configure(upstream, { merge: true });
  const next = `${data}.next`;
  await rm(next, { recursive: true, force: true });
  await mkdir(path.join(next, 'sets'), { recursive: true });

  const index = await pool(sets, 2, async (s) => {
    const cards = await cached(`cards-${s.id}`, async () => {
      const out = [];
      for (let page = 1; ; page++) {
        const q = `${API}/cards?q=set.id:${s.id}&select=id,name,number,rarity,images,cardmarket&pageSize=250&page=${page}`;
        const res = await getJSON(q);
        out.push(...res.data);
        if (out.length >= res.totalCount || res.data.length === 0) break;
      }
      return out;
    });
    // The id suffix is unique within a set; the printed number isn't (a Classic Collection has
    // 106, 106m and 106p, all printed "106").
    for (const c of cards) c.key = c.id.startsWith(`${s.id}-`) ? c.id.slice(s.id.length + 1) : c.number;
    cards.sort((a, b) => byNumber(a.number, b.number) || byNumber(a.key, b.key));

    const fits = (t, c) => t.card.replace('{n}', c.key) === c.images?.small;
    const best = TEMPLATES.map((f) => f(s.id)).sort(
      (a, b) => cards.filter((c) => fits(b, c)).length - cards.filter((c) => fits(a, c)).length,
    )[0];
    upstream.sets[s.id] = { logo: s.images.logo, symbol: s.images.symbol, ...best };
    for (const c of cards) {
      if (!fits(best, c) && c.images?.small) upstream.cards[`${s.id}/${c.key}`] = { card: c.images.small, hd: c.images.large };
    }

    // Three different cards by name where the set allows it, and only cards whose image exists
    // upstream (some promo sets have none at all).
    const ranked = rank(cards);
    const top = [];
    const hasImage = async (c) => !!(await getImage('card', s.id, c.key, 240).catch(() => null));
    for (const c of ranked) {
      if (top.length >= 3 || top.some((t) => t.name === c.name)) continue;
      if (await hasImage(c)) top.push(c);
      else break; // the rest of this set is probably missing too; don't fetch them all
    }
    for (const c of ranked) if (top.length < 3 && !top.includes(c) && (await hasImage(c))) top.push(c);

    await writeFile(
      path.join(next, 'sets', `${s.id}.json`),
      JSON.stringify({ id: s.id, cards: cards.map((c) => [c.key, c.number, c.name, c.rarity ?? '', round(price(c))]) }),
    );

    // Warm the cache for the list: logo, symbol and the three top cards.
    await Promise.all([getImage('logo', s.id, null, 320).catch(() => null), getImage('symbol', s.id, null, 64).catch(() => null)]);
    const topOut = await Promise.all(
      top.map(async (c) => ({
        k: c.key,
        name: c.name,
        c: await getImage('card', s.id, c.key, 120).then(() => dominant('card', s.id, c.key, 240)).catch(() => null),
        p: round(price(c)),
      })),
    );

    return {
      id: s.id,
      name: s.name,
      series: s.series,
      date: s.releaseDate.replaceAll('/', '-'),
      printed: s.printedTotal ?? s.total,
      total: s.total,
      code: s.ptcgoCode ?? null,
      top: topOut,
    };
  });

  // Newest first; same-day releases keep a stable order by name.
  index.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  await writeFile(path.join(next, 'upstream.json'), JSON.stringify(upstream));
  await writeFile(path.join(next, 'sets.json'), JSON.stringify({ built: new Date().toISOString(), sets: index }));

  // The swap: the old snapshot steps aside, the new one takes its name.
  const old = `${data}.old`;
  await rm(old, { recursive: true, force: true });
  await rename(data, old).catch(() => {});
  await rename(next, data);
  await rm(old, { recursive: true, force: true });
  configure(upstream);
  log(`refreshed ${index.length} sets in ${Math.round((Date.now() - started) / 1000)} s`);
  return index.length;
}
