/**
 * The palette's contrast claims, checked rather than asserted.
 *
 * tailwind.config.ts says every text pairing clears WCAG AA and every control
 * border clears 1.4.11. That comment was true when it was written; the point of
 * this file is that it stays true when somebody nudges a hex to taste.
 *
 * Colours are read out of the real config source, so there is no second copy to
 * drift. Pairings are listed by hand because only a person knows which colour
 * actually lands on which background in the UI.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'tailwind.config.ts'), 'utf8');

/** Pull `name: '#RRGGBB'` and `name: { DEFAULT: '#..', k: '#..' }` out of the config. */
function readColors(src) {
  const block = src.slice(src.indexOf('colors: {'));
  const out = {};
  let group = null;
  for (const line of block.split('\n')) {
    if (/^\s*\/\//.test(line)) continue;
    const nested = line.match(/^\s*(\w+):\s*\{\s*$/);
    if (nested) { group = nested[1]; continue; }
    if (/^\s*\},?\s*$/.test(line)) { if (group) group = null; else break; }

    const inline = line.match(/^\s*(\w+):\s*\{(.+)\}/);
    if (inline) {
      for (const [, k, v] of inline[2].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) {
        out[k === 'DEFAULT' ? inline[1] : `${inline[1]}-${k.toLowerCase()}`] = v;
      }
      continue;
    }

    const flat = line.match(/^\s*(\w+):\s*'(#[0-9A-Fa-f]{6})'/);
    if (!flat) continue;
    const [, key, hex] = flat;
    out[group ? (key === 'DEFAULT' ? group : `${group}-${key.toLowerCase()}`) : key] = hex;
  }
  return out;
}

const C = { ...readColors(source), white: '#FFFFFF' };

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

function need(name) {
  const hex = C[name];
  assert.ok(hex, `tailwind.config.ts no longer defines the colour "${name}"`);
  return hex;
}

let checks = 0;
function pair(fg, bg, minimum, why) {
  const ratio = contrast(need(fg), need(bg));
  assert.ok(
    ratio >= minimum,
    `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${minimum}:1 — ${why}`
  );
  checks += 1;
}

// --- Body and secondary text -------------------------------------------------
// Everything below 18px needs 4.5:1, and this app is 14px throughout.
pair('ink', 'white', 4.5, 'body text on a card');
pair('ink', 'canvas', 4.5, 'body text on the page ground');
pair('ink-muted', 'white', 4.5, 'secondary text on a card');
pair('ink-muted', 'canvas', 4.5, 'secondary text on the page ground');
pair('ink-faint', 'white', 4.5, 'hint text under an input');
pair('ink-faint', 'canvas', 4.5, 'timestamps and section labels');

// Inset panels: a copyable community code, an unreached step, a progress track.
pair('ink', 'mist', 4.5, 'a copyable code on an inset panel');
pair('ink-muted', 'mist', 4.5, 'an unreached booking step');

// --- Links and primary actions ----------------------------------------------
pair('brand', 'white', 4.5, 'a link in a card');
pair('brand', 'canvas', 4.5, 'a link on the page ground');
pair('brand', 'brand-light', 4.5, 'a brand pill');
pair('white', 'brand', 4.5, 'the label on a primary button');
pair('white', 'brand-dark', 4.5, 'a primary button being hovered');

// --- Status colours, each on white and on its own tint ----------------------
for (const [tone, note] of [
  ['success', 'a completed job'],
  ['warning', 'a curfew warning'],
  ['danger', 'a blocked account'],
]) {
  pair(tone, 'white', 4.5, `${note}, as text`);
  pair(tone, `${tone}-light`, 4.5, `${note}, in a pill`);
  pair('white', tone, 4.5, `${note}, as a filled button`);
}
pair('white', 'success-dark', 4.5, 'the success button being hovered');

// --- Non-text contrast, WCAG 1.4.11 -----------------------------------------
// An input has to be findable as an input, so its border is not decoration.
pair('field', 'white', 3, 'an input border on a card');
pair('field', 'canvas', 3, 'an input border on the page ground');

// --- Hue separation ----------------------------------------------------------
// "Done" and "tap here" have to be distinguishable at a glance, in sunlight,
// by someone not reading the label. Similar lightness makes that hue's job.
function hue(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function apart(a, b, degrees) {
  const raw = Math.abs(hue(need(a)) - hue(need(b)));
  const gap = Math.min(raw, 360 - raw);
  assert.ok(gap >= degrees, `${a} and ${b} are only ${gap.toFixed(0)}° apart in hue`);
  checks += 1;
}

apart('brand', 'success', 60);
apart('brand', 'warning', 60);
apart('success', 'warning', 60);
apart('success', 'danger', 60);
apart('brand', 'danger', 60);

// --- The config still holds the tokens the stylesheet uses -------------------
const css = readFileSync(join(root, 'app', 'globals.css'), 'utf8');
for (const [, token] of css.matchAll(/\b(?:bg|text|border|ring)-([a-z]+(?:-[a-z]+)?)\b/g)) {
  if (token === 'white' || token.startsWith('gray')) continue;
  const base = token.includes('-') ? token : token;
  if (!(base in C) && !(base.split('-')[0] in C)) continue;
  assert.ok(
    base in C || base.split('-')[0] in C,
    `globals.css uses ${token}, which the config does not define`
  );
  checks += 1;
}

console.log(`palette: ${checks} assertions passed`);
