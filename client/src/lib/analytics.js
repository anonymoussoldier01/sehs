// Local-first analytics for the landing page.
// Tracks primary CTA + "Target this school" so H1 variants can be A/B tested.
// No account, no fingerprinting: counts live in localStorage (sehs-analytics-v1
// + sehs-insights-v1 totals) and are never uploaded. Export via Study hub.

import { H1_VARIANTS } from '../data/schools';

const ANALYTICS_KEY = 'sehs-analytics-v1';
const H1_KEY = 'sehs-h1-variant';

function readAnalytics() {
  try {
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || 'null') || { events: {}, exposures: {} };
  } catch {
    return { events: {}, exposures: {} };
  }
}

function writeAnalytics(next) {
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

function bumpInsight(kind, n = 1) {
  try {
    const KEY = 'sehs-insights-v1';
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') || {
      firstSeen: new Date().toISOString().slice(0, 10),
      totals: {},
      days: {},
    };
    raw.totals[kind] = (raw.totals[kind] || 0) + n;
    const d = new Date().toISOString().slice(0, 10);
    raw.days[d] = raw.days[d] || {};
    raw.days[d][kind] = (raw.days[d][kind] || 0) + n;
    localStorage.setItem(KEY, JSON.stringify(raw));
  } catch {
    /* noop */
  }
}

/** Track a landing event. Keeps the call cheap + offline-safe. */
export function track(event, data = {}) {
  try {
    const next = readAnalytics();
    next.events[event] = (next.events[event] || 0) + 1;
    next.last = { event, at: new Date().toISOString(), ...data };
    const keys = Object.keys(next.events);
    if (keys.length > 40) delete next.events[keys[0]];
    writeAnalytics(next);
  } catch {
    /* noop */
  }
  bumpInsight(event, 1);
  if (data.variant) bumpInsight(`${event}_${data.variant}`, 1);
}

/** H1 variant for A/B testing: ?h1=a|b wins, else persisted random. */
export function getH1Variant() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('h1') || '').toUpperCase();
    if (q === 'A' || q === 'B') {
      localStorage.setItem(H1_KEY, q);
      return H1_VARIANTS[q];
    }
    const saved = (localStorage.getItem(H1_KEY) || '').toUpperCase();
    if (saved === 'A' || saved === 'B') return H1_VARIANTS[saved];
    const pick = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem(H1_KEY, pick);
    return H1_VARIANTS[pick];
  } catch {
    return H1_VARIANTS.A;
  }
}

/** Record an H1 exposure once per page load (for A/B denominators). */
export function trackH1Exposure(variantId) {
  try {
    const next = readAnalytics();
    const key = `h1_${variantId}_exposure`;
    next.exposures[key] = (next.exposures[key] || 0) + 1;
    writeAnalytics(next);
  } catch {
    /* noop */
  }
  bumpInsight(`h1_${variantId}_exposure`, 1);
}

export function getAnalyticsSnapshot() {
  return readAnalytics();
}
