// Renders the iOS launch images (public/splash) and writes their <link> tags into index.html.
//
// An app installed to the iPhone's home screen shows the launch image that matches the phone
// exactly while the page loads; iOS ignores the manifest for this. Each image is the page colour
// with the mark (brand/mark.svg) in the middle of the screen, which is exactly where the splash in
// index.html starts, so the splash takes over without a jump, plays once and fades into the app.
//
// Run after changing the mark, the page colours or the mark's size in index.html:
//
//   npm run splash
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('public/splash/', ROOT);

/** The mark's size in points: `#splash svg` in index.html. */
const MARK = 120;
/** The page colours (src/lib/theme.svelte.ts, public/boot.js). */
const PAGE = { light: '#f5f4f1', dark: '#09090b' };
/** Every iPhone that runs iOS 18 or later: portrait size in points, and the pixel ratio. */
const SCREENS = [
  [440, 956, 3], // 16 Pro Max, 17 Pro Max
  [420, 912, 3], // Air
  [402, 874, 3], // 16 Pro, 17, 17 Pro
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12 Pro Max, 13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 16e
  [375, 812, 3], // X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [375, 667, 2], // SE (2nd and 3rd generation)
];

// The mark's drawing without its outer <svg>, to nest at the right place and size.
const mark = readFileSync(new URL('brand/mark.svg', ROOT), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const links = [];
for (const [scheme, colour] of Object.entries(PAGE)) {
  for (const [w, h, ratio] of SCREENS) {
    const [width, height, size] = [w * ratio, h * ratio, MARK * ratio];
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="${width}" height="${height}" fill="${colour}"/>` +
      `<svg x="${(width - size) / 2}" y="${(height - size) / 2}" width="${size}" height="${size}" viewBox="0 0 1024 1024">${mark}</svg>` +
      `</svg>`;
    const name = `${scheme}-${width}x${height}.png`;
    // Opaque RGB, as the home-screen icons: iOS paints transparency black.
    await sharp(Buffer.from(svg)).flatten({ background: colour }).png({ compressionLevel: 9 }).toFile(new URL(name, OUT).pathname);
    links.push(
      `    <link rel="apple-touch-startup-image" href="/splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})" />`,
    );
  }
}

const index = new URL('index.html', ROOT);
const html = readFileSync(index, 'utf8');
const block = /(<!-- splash:start[^>]*-->)[\s\S]*?(<!-- splash:end -->)/;
if (!block.test(html)) throw new Error('index.html has no <!-- splash:start --> … <!-- splash:end --> block');
writeFileSync(index, html.replace(block, (_, start, end) => `${start}\n${links.join('\n')}\n    ${end}`));
console.log(`${links.length} launch images in public/splash, links written to index.html`);
