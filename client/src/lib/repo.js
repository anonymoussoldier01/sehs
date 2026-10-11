// Repository interface: all persisted learner data lives behind these functions.
// Today the adapter is localStorage (no accounts by design; see docs/DECISIONS.md D2).
// Migration path to accounts: implement the same function names against a REST
// backend (e.g. /api/me/*) and swap this module's internals. UI code must not
// touch localStorage directly for learner data (UI prefs like theme/view/motion
// may keep using localStorage via useLocal).
import { keys } from './store';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: callers treat as ephemeral */
  }
}

export const repo = {
  // Reading progress: { [resourceId]: { at, secondsRead } }
  readingProgress: {
    get: () => read('sehs-progress', {}),
    touch: (id) => {
      if (!id) return;
      const p = read('sehs-progress', {});
      p[id] = { at: new Date().toISOString(), secondsRead: (p[id]?.secondsRead || 0) + 1 };
      write('sehs-progress', p);
    },
  },
  // Bookmarks (saved resources): string[] of public ids
  bookmarks: {
    get: () => read(keys.saved, []),
    set: (ids) => write(keys.saved, [...new Set(ids)].slice(0, 500)),
  },
  // Per-resource notes: { [resourceId]: { text, updatedAt } } (autosaved)
  notes: {
    getAll: () => read('sehs-notes', {}),
    get: (id) => read('sehs-notes', {})[id]?.text || '',
    set: (id, text) => {
      const all = read('sehs-notes', {});
      if (!text) delete all[id];
      else all[id] = { text: String(text).slice(0, 8000), updatedAt: new Date().toISOString() };
      write('sehs-notes', all);
    },
  },
  // Annotations: highlight boxes + margin pins placed over the document frame.
  // Positions are fractions (0-1) of the viewer box, so they survive resize.
  // They live alongside the document. They are NOT embedded in the file and
  // do not travel with downloads or inside-frame zoom.
  // { [resourceId]: [{ id, kind: 'highlight'|'pin', x, y, w, h, color, text, at }] }
  annotations: {
    get: (id) => read('sehs-annotations', {})[id] || [],
    add: (id, ann) => {
      const all = read('sehs-annotations', {});
      const list = [...(all[id] || []), { ...ann, id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`, at: new Date().toISOString() }].slice(-120);
      all[id] = list;
      write('sehs-annotations', all);
      return list;
    },
    remove: (id, annId) => {
      const all = read('sehs-annotations', {});
      all[id] = (all[id] || []).filter((a) => a.id !== annId);
      if (!all[id].length) delete all[id];
      write('sehs-annotations', all);
      return all[id] || [];
    },
  },
  // Attempts: { [mockId]: { score, total, at, seed } }
  attempts: {
    get: () => read(keys.mocks, {}),
    record: (id, { score, total, seed }) => {
      const best = read(keys.mocks, {});
      if (!best[id] || score > best[id].score) {
        best[id] = { score, total, seed, at: new Date().toISOString() };
        write(keys.mocks, best);
      }
      return best[id];
    },
  },
  // Review queue items: [{ stem, strand, box, nextDue, at }]
  reviewQueue: {
    get: () => read('sehs-review', []),
    set: (items) => write('sehs-review', (items || []).slice(0, 200)),
  },
  settings: {
    get: () => read('sehs-settings', { extraTime: 1, largerText: false, highContrast: false, dyslexiaFriendly: false }),
    set: (s) => write('sehs-settings', s),
  },
  // Folders v2: [{ id, name, items, colour, tags, order, updatedAt }]
  folders: {
    get: () => read(keys.lists, []),
    set: (lists) => write(keys.lists, (lists || []).slice(0, 50)),
  },
  // Writing drafts with 5-deep version history: { [key]: { text, updatedAt, history[] } }
  drafts: {
    getAll: () => read('sehs-drafts', {}),
    get: (key) => read('sehs-drafts', {})[key]?.text || '',
    set: (key, text) => {
      const all = read('sehs-drafts', {});
      if (!key) return;
      if (!text) delete all[key];
      else {
        const prev = all[key];
        const history = [...(prev?.history || [])];
        if (prev?.text && prev.text !== text) history.unshift({ text: prev.text.slice(0, 20000), at: prev.updatedAt });
        all[key] = { text: String(text).slice(0, 20000), updatedAt: new Date().toISOString(), history: history.slice(0, 5) };
      }
      write('sehs-drafts', all);
    },
  },
  // Writing self-assessment grades (unversioned legacy key, now channelled here).
  grades: {
    get: () => read('sehs-grades', []),
    add: (entry) => {
      const all = read('sehs-grades', []);
      write('sehs-grades', [...all, { ...entry, at: new Date().toISOString() }].slice(-100));
    },
  },
  // Append-only mock history (v2) alongside best-only attempts (v1, kept).
  history: {
    get: () => read('sehs-mock-history', {}),
    append: (id, { score, total, seed, durationSecs }) => {
      const all = read('sehs-mock-history', {});
      const list = [...(all[id] || []), { score, total, seed: seed || null, durationSecs: durationSecs ?? null, at: new Date().toISOString() }].slice(-50);
      all[id] = list;
      write('sehs-mock-history', all);
      return list;
    },
  },
};

/** Export learner data (JSON). Nothing leaves the browser unless the user saves the file.
 *  Kept for compatibility; new code should use storage.buildBackup() which
 *  covers every key plus the schema stamp. */
export function exportData() {
  return {
    exportedAt: new Date().toISOString(),
    version: 2,
    saved: repo.bookmarks.get(),
    progress: repo.readingProgress.get(),
    notes: repo.notes.getAll(),
    annotations: read('sehs-annotations', {}),
    attempts: repo.attempts.get(),
    history: repo.history.get(),
    review: repo.reviewQueue.get(),
    mistakes: read(keys.mistakes, []),
    lists: repo.folders.get(),
    decks: read(keys.decks, []),
    grades: repo.grades.get(),
    drafts: repo.drafts.getAll(),
  };
}

/** Delete all local learner data (irreversible: callers must confirm first). */
export function deleteAllData() {
  for (const k of ['sehs-progress', 'sehs-notes', 'sehs-annotations', 'sehs-review', 'sehs-drafts', 'sehs-grades', 'sehs-fsrs', 'sehs-mock-history', keys.saved, keys.mocks, keys.mistakes, keys.lists, keys.decks, keys.leitner, keys.recent, keys.insights, keys.profile, keys.streak])
    try {
      localStorage.removeItem(k);
    } catch {
      /* noop */
    }
}
