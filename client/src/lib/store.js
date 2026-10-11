import { useCallback, useEffect, useState } from 'react';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** useState persisted to localStorage. */
export function useLocal(key, initial) {
  const [val, setVal] = useState(() => read(key, initial));
  const set = useCallback(
    (next) => {
      setVal((prev) => {
        const v = typeof next === 'function' ? next(prev) : next;
        write(key, v);
        return v;
      });
    },
    [key]
  );
  return [val, set];
}

/** Cross-tab sync for a localStorage key. */
export function useSyncedLocal(key, initial) {
  const [val, setVal] = useLocal(key, initial);
  useEffect(() => {
    const on = (e) => {
      if (e.key === key) {
        try {
          setVal(e.newValue ? JSON.parse(e.newValue) : initial);
        } catch {
          /* noop */
        }
      }
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [val, setVal];
}

export const keys = {
  theme: 'sehs-theme',
  name: 'sehs-name',
  saved: 'sehs-saved',
  recent: 'sehs-recent',
  recentSearches: 'sehs-recent-searches',
  lists: 'sehs-lists',
  decks: 'sehs-decks',
  leitner: 'sehs-leitner',
  fsrs: 'sehs-fsrs',
  streak: 'sehs-streak',
  examDate: 'sehs-exam-date',
  targetSchool: 'sehs-target-school',
  mistakes: 'sehs-mistakes',
  mocks: 'sehs-mocks',
  mockHistory: 'sehs-mock-history',
  grades: 'sehs-grades',
  drafts: 'sehs-drafts',
  review: 'sehs-review',
  progress: 'sehs-progress',
  notes: 'sehs-notes',
  annotations: 'sehs-annotations',
  settings: 'sehs-settings',
  insights: 'sehs-insights-v1',
  profile: 'sehs-profile-v1',
  cookieOk: 'sehs-cookie-ok',
  annSeen: 'sehs-ann-seen',
  density: 'sehs-density',
  schema: 'sehs-schema',
};

/** Day streak helpers (consecutive UTC days with activity). */
export function touchStreak() {
  const s = read(keys.streak, { days: [] });
  const today = new Date().toISOString().slice(0, 10);
  if (!s.days.includes(today)) {
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.days = (s.days.includes(y) || !s.days.length ? [...s.days, today] : [today]).slice(-365);
    write(keys.streak, s);
  }
  return s.days.length;
}

export function pushRecent(id, title) {
  if (!id) return;
  const list = read(keys.recent, []);
  write(
    keys.recent,
    [{ id, title: title || id, at: Date.now() }, ...list.filter((x) => x.id !== id)].slice(0, 12)
  );
}

/** Local-first insights ledger. */
export function bumpInsight(kind, n = 1) {
  const s = read(keys.insights, null) || { firstSeen: new Date().toISOString().slice(0, 10), totals: {}, days: {} };
  s.totals[kind] = (s.totals[kind] || 0) + n;
  const d = new Date().toISOString().slice(0, 10);
  s.days[d] = s.days[d] || {};
  s.days[d][kind] = (s.days[d][kind] || 0) + n;
  const ks = Object.keys(s.days).sort();
  if (ks.length > 365) ks.slice(0, ks.length - 365).forEach((k) => delete s.days[k]);
  write(keys.insights, s);
}

export function recordMistake({ stem, strand, picked, correct }) {
  const all = read(keys.mistakes, []);
  write(
    keys.mistakes,
    [
      { stem: String(stem || '').slice(0, 200), strand: String(strand || 'mixed').slice(0, 20), picked, correct, at: new Date().toISOString() },
      ...all,
    ].slice(0, 100)
  );
}
