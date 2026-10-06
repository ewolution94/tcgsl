import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank } from '../server/refresh.mjs';
import { parse } from '../server/images.mjs';

const card = (number, name, rarity, trend) => ({ number, name, rarity, cardmarket: trend ? { prices: { trendPrice: trend } } : undefined });

test('the most valuable cards come first', () => {
  const ranked = rank([card('1', 'Pidgey', 'Common', 0.1), card('4', 'Charizard', 'Rare Holo', 4184.6), card('15', 'Venusaur', 'Rare Holo', 841.63)]);
  assert.deepEqual(ranked.map((c) => c.name), ['Charizard', 'Venusaur', 'Pidgey']);
});

test('without prices, rarity decides, Pokémon before Trainers, Megas first', () => {
  const ranked = rank([
    card('118', 'Gwynn', 'Special Illustration Rare'),
    card('120', 'Mega Darkrai ex', 'Mega Hyper Rare'),
    card('117', 'Morpeko ex', 'Special Illustration Rare'),
    card('116', 'Mega Darkrai ex', 'Special Illustration Rare'),
    card('1', 'Pichu', 'Common'),
  ]);
  assert.deepEqual(ranked.map((c) => `${c.number} ${c.name}`), ['116 Mega Darkrai ex', '117 Morpeko ex', '118 Gwynn', '120 Mega Darkrai ex', '1 Pichu']);
});

test('the image route only makes the sizes the UI draws', () => {
  assert.ok(parse('logo', 'sv8', null, 320));
  assert.ok(parse('card', 'me55c', '106p', 240));
  assert.equal(parse('logo', 'sv8', null, 999), null);
  assert.equal(parse('card', 'sv8', '../x', 240), null);
  assert.equal(parse('card', 'SV8', '1', 240), null);
  assert.equal(parse('poster', 'sv8', null, 320), null);
});
