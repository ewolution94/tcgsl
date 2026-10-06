// Builds the data snapshot: every English set from pokemontcg.io and every Japanese set from
// TCGdex, each with its cards, its three top cards, and where each image lives. Used by
// `npm run data` (scripts/build-data.mjs) and by the server, which refreshes its snapshot once a
// day so new sets appear on their own.
//
//   <data>/sets.json        the English index: every set and its three top cards
//   <data>/sets-ja.json     the Japanese index, the same shape (set ids end in _ja)
//   <data>/sets/<id>.json   one set's full card list, fetched when it's opened
//   <data>/upstream.json    where each image really lives (read by routes.mjs), and which Scrydex
//                           id each Japanese set turned out to have
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

  const previous = await readFile(path.join(data, 'upstream.json'), 'utf8').then(JSON.parse, () => null);
  const upstream = { sets: {}, cards: {}, ja: {} };
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
  const ja = await japanese({ next, upstream, known: previous?.ja ?? {}, cached, log });
  const built = new Date().toISOString();
  await writeFile(path.join(next, 'upstream.json'), JSON.stringify(upstream));
  await writeFile(path.join(next, 'sets.json'), JSON.stringify({ built, sets: index }));
  await writeFile(path.join(next, 'sets-ja.json'), JSON.stringify({ built, sets: ja }));

  // The swap: the old snapshot steps aside, the new one takes its name.
  const old = `${data}.old`;
  await rm(old, { recursive: true, force: true });
  await rename(data, old).catch(() => {});
  await rename(next, data);
  await rm(old, { recursive: true, force: true });
  configure(upstream);
  log(`refreshed ${index.length} English and ${ja.length} Japanese sets in ${Math.round((Date.now() - started) / 1000)} s`);
  return index.length + ja.length;
}

// --- Japanese ---------------------------------------------------------------------------------
//
// The sets, their dates and their cards come from TCGdex (free, no key); the images from Scrydex,
// whose image server is public while its API is paid. Scrydex's ids aren't published without the
// API, so each set's is found by trying the spellings TCGdex's id suggests (`M3` → `m3_ja`,
// `CS3.5` → `cs3pt5_ja`) until card 1 comes back as a real picture; Scrydex answers an unknown id
// with a placeholder, which images.mjs recognises. A set's id is found once and kept in
// upstream.json; only new sets are tried on later runs.

const TCGDEX = 'https://api.tcgdex.net/v2/ja';
const SCRYDEX = 'https://images.scrydex.com/pokemon';
const LIMITLESS = 'https://limitlesstcg.com/cards/jp';

// English names: Limitless TCG lists the Japanese sets from Black & White on with their English
// names (robots.txt allows it; one request per refresh). Its codes mostly equal TCGdex's, and a
// match only counts when the release dates are within 120 days (the two sites disagree by up to
// three months on a few sets; a code reused across eras would be years out). Split sets released on one day can't be
// told apart by date, and the two sites letter them differently (TCGdex's XY8b is the red one,
// Limitless's the blue), so those are pinned here by their Japanese names.
const LIMITLESS_CODE = {
  XY1a: 'XY1x', // コレクションX
  XY1b: 'XY1y', // コレクションY
  XY5a: 'XY5g', // ガイアボルケーノ
  XY5b: 'XY5t', // タイダルストーム
  XY8a: 'XY8b', // 青い衝撃
  XY8b: 'XY8r', // 赤い閃光
  XY11a: 'XY11b', // 爆熱の闘士
  XY11b: 'XY11r', // 冷酷の反逆者
  // Promo collections run for years; their "release dates" differ between the sites.
  'M-P': 'MP',
  'SV-P': 'SVP',
};
const PINNED = new Set(Object.keys(LIMITLESS_CODE));
const limitlessCode = (id) => LIMITLESS_CODE[id] ?? id.replace(/\+$/, 'p').replace(/-/g, '');

// TCGdex's Japanese series, in English.
const SERIES = {
  M: 'Mega Evolution',
  SV: 'Scarlet & Violet',
  S: 'Sword & Shield',
  SM: 'Sun & Moon',
  XYb: 'XY BREAK',
  XY: 'XY',
  L: 'LEGEND',
  PCG: 'PCG',
  ADV: 'ADV',
  e: 'Pokémon Card e',
  web: 'web',
  VS: 'VS',
  neo: 'neo',
  PMCG: 'Pocket Monsters Card Game',
};

const MONTH = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Limitless's Japanese set list: lower-cased code → { name, date } (date '' when it shows none). */
export function parseLimitless(html) {
  const out = {};
  for (const [, row] of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cell = /<td><a href="\/cards\/jp\/([^"]+)">([\s\S]*?)<\/a><\/td>/.exec(row);
    if (!cell) continue;
    const [, code, raw] = cell;
    const when = /<td><a[^>]*>(\d{1,2}) (\w{3}) (\d{2})<\/a>/.exec(row);
    const date = when && MONTH[when[2]] ? `20${when[3]}-${MONTH[when[2]]}-${when[1].padStart(2, '0')}` : '';
    const name = unescape(raw.replace(/<span class="code annotation">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '')).trim();
    const key = code.toLowerCase();
    if (name && !out[key]) out[key] = { name, date };
  }
  return out;
}

const scrydex = (sid) => ({
  logo: `${SCRYDEX}/${sid}-logo/logo`,
  symbol: `${SCRYDEX}/${sid}-symbol/symbol`,
  card: `${SCRYDEX}/${sid}-{n}/small`,
  hd: `${SCRYDEX}/${sid}-{n}/large`,
});

/** The Scrydex ids a TCGdex id might stand for, most likely first; all valid set keys here. */
export function candidates(id) {
  const base = id.toLowerCase().replace(/\+/g, 'p');
  const tries = [base.replace(/-/g, ''), base.replace(/\./g, 'pt').replace(/-/g, ''), base.replace(/[.-]/g, '')];
  return [...new Set(tries)].map((c) => `${c}_ja`).filter((c) => /^[a-z0-9]{1,16}_ja$/.test(c));
}

/** "001" → "1": TCGdex pads numbers, Scrydex doesn't. */
const unpad = (n) => n.replace(/^0+(?=\d)/, '');

async function japanese({ next, upstream, known, cached, log }) {
  const getTcgdex = (url) => getJSON(url, 6);
  const all = await cached('ja-sets', () => getTcgdex(`${TCGDEX}/sets`));
  // TCGdex lists the Sun & Moon "plus" sets twice, as SM1+ and SM1p: keep the p spelling.
  const plain = (id) => id.toLowerCase().replace(/\+/g, 'p');
  const list = all.filter((b) => !(b.id.includes('+') && all.some((o) => o !== b && !o.id.includes('+') && plain(o.id) === plain(b.id))));
  // English names are a nicety: if Limitless can't be read, the Japanese names stay.
  const english = await cached('ja-limitless', async () => {
    const res = await fetch(LIMITLESS, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`limitless: HTTP ${res.status}`);
    return parseLimitless(await res.text());
  }).catch((err) => {
    log(`Limitless unreadable (${err.message}); Japanese names only`);
    return {};
  });
  if (list.length < 50) throw new Error(`only ${list.length} Japanese sets: refusing to replace the snapshot`);


  const out = await pool(list, 3, async (brief) => {
    const d = await cached(`ja-set-${brief.id}`, () => getTcgdex(`${TCGDEX}/sets/${encodeURIComponent(brief.id)}`));
    const date = d.releaseDate;
    if (!date) return null;
    const official = d.cardCount?.official ?? d.cardCount?.total ?? 0;
    const total = d.cardCount?.total ?? official;
    let cards = (d.cards ?? []).map((c) => ({ key: unpad(c.localId), number: c.localId, name: c.name, image: c.image }));

    // Which Scrydex id: the one found before, else the first spelling whose card 1 is real.
    const first = cards[0]?.key ?? '1';
    let sid = known[brief.id];
    if (sid === undefined) {
      sid = null;
      for (const c of candidates(brief.id)) {
        upstream.sets[c] = scrydex(c);
        if (await getImage('card', c, first, 240).catch(() => null)) {
          sid = c;
          break;
        }
        delete upstream.sets[c];
      }
    }
    upstream.ja[brief.id] = sid;
    const id = sid ?? candidates(brief.id)[0];
    if (!id) return null;
    if (sid) upstream.sets[sid] = scrydex(sid);

    // No Scrydex pictures: TCGdex's own card images where it has them (no logos there).
    const fallback = !sid && cards.some((c) => c.image);
    if (fallback) {
      for (const c of cards) {
        if (c.image) upstream.cards[`${id}/${c.key}`] = { card: `${c.image}/low.webp`, hd: `${c.image}/high.webp` };
      }
    }
    const pics = !!sid || fallback;

    // TCGdex lists no cards for some sets; with Scrydex's pictures they can still be numbered.
    if (!cards.length && sid && total) {
      cards = Array.from({ length: total }, (_, i) => ({ key: String(i + 1), number: String(i + 1).padStart(3, '0'), name: '', image: undefined }));
    }

    await writeFile(path.join(next, 'sets', `${id}.json`), JSON.stringify({ id, cards: cards.map((c) => [c.key, c.number, c.name, '', 0]) }));

    // No prices or rarities here: the top cards are the highest-numbered, the secret rares past
    // the printed count first, and only ones with a real picture.
    const top = [];
    let logo = false;
    if (pics) {
      const ordered = [...cards].sort((a, b) => byNumber(b.number, a.number));
      const secret = ordered.filter((c) => Number.parseInt(c.number, 10) > official);
      let misses = 0;
      for (const c of new Set([...secret, ...ordered])) {
        if (top.length >= 3 || misses >= 12) break;
        if (await getImage('card', id, c.key, 240).catch(() => null)) top.push(c);
        else misses++;
      }
    }
    // A logo only from Scrydex, and only a real one: old sets often have cards but just the
    // placeholder logo, which images.mjs refuses.
    if (sid) {
      const [mark] = await Promise.all([getImage('logo', sid, null, 320).catch(() => null), getImage('symbol', sid, null, 64).catch(() => null)]);
      logo = !!mark;
    }
    const topOut = await Promise.all(
      top.map(async (c) => ({
        k: c.key,
        name: c.name,
        c: await getImage('card', id, c.key, 120).then(() => dominant('card', id, c.key, 240)).catch(() => null),
        p: 0,
      })),
    );
    // The English name where Limitless has the set on the same day (or pinned); else Japanese.
    const en = english[limitlessCode(brief.id).toLowerCase()];
    const apart = en?.date ? Math.abs(Date.parse(en.date) - Date.parse(date)) / 86_400_000 : Infinity;
    const name = en && (PINNED.has(brief.id) || apart <= 120) ? en.name : d.name;
    const series = SERIES[d.serie?.id] ?? d.serie?.name ?? '';
    // The TCGdex id is the code printed on the cards ("SV8a"). `pics`: card pictures (Scrydex's,
    // else TCGdex's); `logo`: a real Scrydex logo and symbol. Either missing, the app makes do.
    // `ja`: the Japanese name, which the search still finds.
    return { id, name, ja: d.name, series, date, printed: official, total, code: brief.id, pics, logo, top: topOut };
  });

  // One set per id, the one with pictures first: two TCGdex entries for one set must never reach
  // the app as twins (its list is keyed by id).
  const seen = new Set();
  const sets = out
    .filter(Boolean)
    .sort((a, b) => Number(b.pics) - Number(a.pics))
    .filter((s) => (seen.has(s.id) ? (log(`Japanese: dropped a second ${s.id} (${s.code})`), false) : seen.add(s.id)));
  sets.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const found = Object.values(upstream.ja).filter(Boolean).length;
  const tcgdex = sets.filter((s) => s.pics && !upstream.ja[s.code]).length;
  const named = sets.filter((s) => s.name !== s.ja).length;
  log(`Japanese: ${sets.length} sets, ${found} with Scrydex pictures, ${tcgdex} more with TCGdex's, ${named} with English names`);
  return sets;
}
