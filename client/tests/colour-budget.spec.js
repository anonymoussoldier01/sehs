// Playwright colour-budget test: home page + app shell.
// Collects computed colours of every visible element, converts to HSL, and
// FAILS if any hue falls outside {neutral navy 200-250°, sky accent, ivory/cream}
// except inside [data-feedback] (success/error). Also FAILS if more than one
// chromatic hue family is visible in a viewport screenshot.
// Run: npx playwright test tests/colour-budget.spec.js
// Static fallback (no browser): node ../scripts/colour-budget.mjs
import { test, expect } from '@playwright/test';

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s * 100, l * 100];
}

function isNeutral(h, s, l) {
  if (s < 12) return true; // greys, white, black
  if (l > 92 || l < 6) return true; // ivory/paper/ink extremes
  // Neutral navy range 200-250°
  if (h >= 200 && h <= 250) return true;
  return false;
}

function isSkyAccent(h, s, l) {
  // Sky: ~210-225° saturated, plus light-mode deep blue ~222°
  if (h >= 205 && h <= 228 && s >= 25) return true;
  // Teal alt #4FD1B5 ~165° / brass #C9AB6B ~40° only when ?accent preview is active
  return false;
}

function isCream(h, s, l) {
  // Ivory/cream paper ~40-55° low saturation light
  if (h >= 35 && h <= 60 && l >= 85) return true;
  return false;
}

async function collectViolations(page) {
  return page.evaluate(() => {
    function rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      if (max === min) return [0, 0, l * 100];
      const d = max - min;
      const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      let h = 0;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
      return [h, s * 100, l * 100];
    }
    const els = [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      if (r.bottom < 0 || r.top > innerHeight) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
      return true;
    });
    const bad = [];
    for (const el of els.slice(0, 4000)) {
      if (el.closest('[data-feedback]')) continue;
      const cs = getComputedStyle(el);
      for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
        const v = cs[prop];
        const m = v && v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) continue;
        if (m[4] !== undefined && Number(m[4]) === 0) continue;
        const [h, s, l] = rgbToHsl(+m[1], +m[2], +m[3]);
        const neutral = s < 12 || l > 92 || l < 6 || (h >= 200 && h <= 250);
        const sky = h >= 205 && h <= 228 && s >= 25;
        const cream = h >= 35 && h <= 60 && l >= 85;
        if (!(neutral || sky || cream)) {
          bad.push(`${el.tagName}.${String(el.className).slice(0, 40)} ${prop}=${v} hsl=${h.toFixed(0)},${s.toFixed(0)},${l.toFixed(0)}`);
          break;
        }
      }
      if (bad.length >= 20) break;
    }
    return bad;
  });
}

for (const route of ['/', '/study']) {
  test(`colour budget: ${route} uses one hue family`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const bad = await collectViolations(page);
    expect(bad, `chromatic hues outside budget on ${route}:\n` + bad.join('\n')).toEqual([]);
  });
}

test('colour budget: single hue family per viewport', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const families = await page.evaluate(() => {
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[data-feedback]')) continue;
      const cs = getComputedStyle(el);
      const m = cs.backgroundColor && cs.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) continue;
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn < 30) continue;
      const sat = (mx - mn) / 255;
      if (sat < 0.18) continue;
      let hue = 0;
      if (mx === r) hue = ((g - b) / (mx - mn) + 6) % 6 * 60;
      else if (mx === g) hue = ((b - r) / (mx - mn) + 2) * 60;
      else hue = ((r - g) / (mx - mn) + 4) * 60;
      if (hue >= 200 && hue <= 250) continue;
      if (hue >= 35 && hue <= 60) continue;
      seen.add(Math.round(hue / 30) * 30);
    }
    return [...seen];
  });
  expect(families.length, `expected ≤1 chromatic family, saw ${families.join(', ')}`).toBeLessThanOrEqual(1);
});
