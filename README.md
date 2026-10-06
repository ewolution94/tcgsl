# TCGSL (TCG Setlist)

Every Pokémon TCG set, English and Japanese (the EN | JP switch in the header), newest first, with
real set logos, symbols and card images: one row per set, grouped by year, with a year scrubber on
phones. Tapping a set opens its page with the most
valuable cards (Cardmarket trend prices) and the full card list. Settings (the gear, or `,`) has the
family's theme and language switches; the UI is in English and German.

## Run it

```bash
cd ~/Documents/private/development/tcgsl && npm install && NODE_USE_SYSTEM_CA=1 npm run data
```

Then `tcgsl-dev` (Vite, port 5610) from the browser pane, or `npm run build` and `tcgsl-prod`
(the production server, port 5611). `npm run check` type-checks, `npm test` runs the unit tests.

## How it works

**Data.** `server/refresh.mjs` snapshots pokemontcg.io: one index (`sets.json`, 12 KB gzipped,
every set with its three top cards by Cardmarket trend price, by rarity where a set has no prices
yet) and one file per set with its full card list, loaded when the set is opened. The repo carries
a snapshot in `data/` (`npm run data` rebuilds it, reusing the API answers in `cache/api/`;
`--refresh` fetches them again). On the NAS the server refreshes its own copy once a day, so new
sets and prices appear without a deploy; a failed run keeps the last good snapshot.

**Japanese sets.** The sets, dates and cards come from TCGdex (free, no key); the pictures from
Scrydex's public image server (its API is paid, so it isn't used). Scrydex's ids aren't published
without the API, so each set's is found by trying the spellings TCGdex's id suggests (`M3` →
`m3_ja`, `CS3.5` → `cs3pt5_ja`) until card 1 is a real picture: Scrydex answers an unknown id with a
placeholder, which `images.mjs` recognises by its bytes. Found ids are kept in `upstream.json`, so
only new sets are tried again. Where Scrydex has none, TCGdex's own card images stand in (it has no
Japanese logos). On 2026-10-06: 111 of 181 sets with Scrydex pictures, 11 more with TCGdex's, 92
with a real logo; a set without one shows the code printed on its cards, and a set without card
pictures lists its cards as plain text. Japanese sets have no prices, so their top cards are the
highest-numbered ones, secret rares first.

English names come from Limitless TCG's Japanese set list (one request per refresh; its robots.txt
allows it), matched by set code when the release dates are within 120 days. The split sets released
on one day are pinned by their Japanese names, since the two sites letter them differently (TCGdex's
`XY8b` is the red half, Limitless's the blue). Limitless starts at Black & White, so older sets keep
their Japanese names: 128 of 181 had English ones. The series names are a fixed table. The search
still finds the Japanese names. TCGdex lists the Sun & Moon "plus" sets twice (`SM1+` and `SM1p`);
only the `p` spelling is kept.

**Images.** `server/images.mjs` fetches each upstream PNG once, resizes it to a fixed width the UI
actually draws, encodes WebP and keeps both on disk (`cache/`). `server/routes.mjs` serves `/img/…`
immutable (the Vite dev server uses the same code); unknown sizes and hosts are refused, so it's not
an open resizer.

| | Original | Served |
|---|---|---|
| Set logo | ~99 KB PNG | ~12 KB at 320 px |
| Card thumbnail | ~167 KB PNG | ~18 KB at 240 px, ~7 KB at 120 px |
| Every list image, all 176 sets | 103.6 MB | 11.4 MB |

**Loading.** Images load about one screen ahead with one IntersectionObserver (`src/lib/images.ts`;
native `loading="lazy"` fetched 186 images at the top of the page in Chrome), off-screen years skip
rendering with `content-visibility`, every image's box is reserved, and each card shows its
dominant colour until it arrives. The first phone screen costs about 270 KB of images.

**Slow connections.** Folio's skeletons stand in for what's on its way: the list (same grid as the
real rows, so nothing jumps), a set's card grid, and every logo and card image, with the card's
softened colour under the sheen. A skeleton goes the moment its image is in (`display: none` in
`app.css`, which also stops the sheen), so a loaded page never animates.

## Deploy (NAS)

CI on `release` (typecheck, tests, build, a smoke test of the production server) publishes
`ghcr.io/ewolution94/tcgsl:latest` for amd64 and arm64; the shared Watchtower pulls it into the
stack from `deploy/portainer-stack.yml` (port 5700, the `tcgsl-data` volume, Census over the
`ewolution` network). A push to `release` is the whole deploy. `/healthz` answers `ok`.

| Variable | Default | |
|---|---|---|
| `PORT`, `HOST` | `8080`, `0.0.0.0` | where the server listens |
| `TCGSL_DATA` | `<project>/data` (`/data/snapshot` in the image) | the snapshot the app serves |
| `TCGSL_SEED` | `<project>/data` | copied into `TCGSL_DATA` when that is empty |
| `TCGSL_CACHE` | `<project>/cache` (`/data/cache` in the image) | resized images |
| `TCGSL_ORIGINALS` | kept (`off` in the image) | `off` keeps only the resized images |
| `TCGSL_REFRESH` | `24` | hours between data refreshes; `off` never refreshes |
| `TCGSL_CENSUS` | off | Census's ingest origin, e.g. `http://census:4901` |

## Layout

```
server/        server.mjs (static, headers, /healthz), routes.mjs (/data, /img), images.mjs,
               refresh.mjs (the snapshot), census.mjs (the visit counter's forwarder)
scripts/       build-data.mjs (the snapshot in data/)
tests/         unit tests (ranking, the image guard, the Census forwarder)
deploy/        portainer-stack.yml
src/           App.svelte, components/, lib/ (data, images, router, prefs, theme, i18n)
vendor/ewo/    Folio's tokens and elements (`npm run vendor -- tcgsl` in Folio)
data/          the snapshot
```
