# Changelog — Phase 1: audit + safe storage + shared system + shell

## What shipped and why

- **Step-0 audit (`docs/AUDIT.md`)** — every route visited on paper: what it does,
  what's broken/inconsistent, and the full `sehs-*` key/shape map. Built to this
  reality: the React client is the app; root `*.js` is the legacy fallback.
- **Versioned storage (`client/src/lib/storage.js`, schema v2)** — additive-only
  `migrate()` runs before first paint: v1 snapshot kept (`sehs-backup-v1`),
  folders gain `{id, colour, tags, order}`, best-only mock records seed an
  append-only `sehs-mock-history`, new `sehs-fsrs` / `sehs-drafts` containers.
  `repo.js` extended (folders, drafts+5-history, grades, history) — the single
  data layer grows, UI code keeps off raw localStorage for learner data.
- **Backup / restore (Study hub → Settings)** — one JSON file, export + import
  with merge (never silently drops newer on-device work), `sehs-backup-done`
  stamp, gentle one-line `BackupNudge` after meaningful progress (≥5 signals).
  Honest copy: cache-clears cost months; this is the #1 risk fix.
- **One verb per surface** — resources **Open**, practice **Start**, decks
  **Review**. Fixed `ResourceCard` ("Read here/Details"), `DeckCard` ("Study"),
  Study-hub prep cards ("Open" → Start, guide keeps Open).
- **Shared components (`components/system.jsx`)** — PageHeader, StatCard,
  ProgressRing, EmptyState, BackupNudge. New code uses these; migration of old
  pages follows per-phase.
- **Shell** — palette (cmdk) gains Actions ("Start a mock", backup…) + Pages
  groups; mobile tab bar is Home / Practice / Library / Progress per spec;
  target-school chip navigates home to pick instead of dead-ending off-home;
  skip-to-content link; release-note banner for returning users (dismiss → flag).
- **Sources of truth** — `data/topics.js` + `data/providers.js` join
  `data/schools.js`. Library gets prominent + New folder with starter
  suggestions (Weak spots, Mocks to redo, Nossal prep).
- **Routes/plumbing** — `/whats-new` page + footer/palette links, server
  `SPA_RE`, sitemap entry. No new dependencies, no new env vars, no DB change.

## What deliberately did NOT ship (next phases)

FSRS scheduling, PDF.js viewer controls, Tiptap editor, KaTeX, virtualised
lists, DnD folders, mock history chart, coverage map, parent summary — each
needs its own dep/route behind lazy import. No predicted ranks, percentiles,
or outcome promises added anywhere.

## Verification

- `npm run lint --prefix client` → 0 errors (warnings pre-existing +1 fixed).
- `npm run build --prefix client` → ✓ 285.33KB gzip (+2.5KB vs 282.84 baseline).
- `npm test` (root) → 17/17 pass.
- Lighthouse axe/Playwright unavailable in this env — owed in Phase 6 pass.
