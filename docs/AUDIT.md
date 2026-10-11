# SEHS Study — Step 0 Audit (2026-10-11, branch state `feat/premium-redesign`)

Audited by reading code (no browser harness available here). React client
(`client/src`) is the real app; root-level `*.js` + `index.html` + `styles.css`
are the legacy static fallback (still served when `client/dist` is missing).

## 1. What each route does today

| Route | What it does | Verdict |
|---|---|---|
| `/` Home | Redesigned landing: hero + crest strip, Four Doors, sample Q, scarcity band, How-it-works + countdown, topics + live stats, Continue section, FAQ, closing CTA. Target school (`sehs-target-school`) personalises countdown/accents. | Keep. Reference standard. |
| `/search` Browse | Server-backed search (`/api/search`), URL-synced (`q, cat, provider, type, sort, answers, page`). Facets: category / provider / file-type + answers-only. Grid/ledger views, pager, highlight, saved toggle, suggest. | Works. Gaps vs brief: no difficulty, year, saved/not-saved facets; no "newest / most opened / relevance" full sort set (has relevance only + client types filter); no virtualised list (24/page pager instead — fine at this scale, do NOT add virtualization until measured); no preview drawer (navigates to `/r/:id`); no inline report; no saved views. |
| `/search?type=pdf` PDF papers | Same Search page with pre-filter. | NOT a real papers experience. No in-site viewer, no page nav/zoom/thumbnails, no split view, no last-page memory. |
| `/r/:id` Resource (viewer) | Detail + Drive iframe viewer (pdf/image auto-load, terms-gated grant), notes autosave, overlay annotations (highlights + pins), reading progress + resume note, focus mode, related, report flow, answer-key inference panel, open-original + blocked-popup fallback. | Strong chrome. Honest constraint: Drive iframe means no page control / text search / thumbnails — document, don't fake. Missing: last-page memory (only resume note), split notes/answers panel on desktop, Word-doc clean preview notice (handled as details-only — keep). |
| `/saved` Your library | Saved resources (via `/api/by-ids`) + folders (`sehs-lists`: `{name, items[]}`) with create/share/delete, share-code links (`/list/:code`). | Works. Gaps: no drag-drop reorder, no rename / colour / tags, "New folder" is a small anchor (`#list-new` deep-link from sidebar), no starter-folder suggestions, no bulk select, no per-folder progress. |
| `/list/:code` Shared list | Decodes id array from URL, hydrates via by-ids. | Works. No progress, no copy-to-library CTA (check). |
| `/study` Study hub | Exam-date countdown, days-active streak, cards-mastered, deck CRUD + add-card, AI deck/plan tools, first-run guide, review queue, 14-day activity chart, built-in prep cards. | Useful but NOT the dashboard from the brief. Missing: Today card (due + 20-min session + next mock), weekly goal + streak-freeze, minutes studied, weakest topics w/ one-tap practise, coverage map rings, parent summary, Settings backup/restore UI. |
| `/study/:deckId` Flashcards | Server decks + local decks (`local-N`), flip + test modes, shuffle, Leitner boxes (`sehs-leitner`), per-card box display. | Works. NOT FSRS: no due counts, no 1–4 Again/Hard/Good/Easy ratings, no scheduling lib, no mastery % on a deck grid (grid lives in Study hub), no card search/edit/import/export, no example sentences / word roots. |
| `/mocks` Timed mocks lobby | Lists server mocks, best score from `sehs-mocks`, Start + Fresh-seed links. | Thin lobby: no what's-tested / question count / time / rules summary per card, no "I'm ready" step, no history chart. |
| `/mocks/:id` Exam run | Rewritten engine (`lib/assessment.js` + MockRun): deterministic seed in URL, autosave/resume, absolute-timestamp timer, pre-submit checklist + confirm, double-submit guard, review filters, topic breakdown w/ not-enough-data, keyboard (1–4/A–E/arrows/F/?). | Closest to flagship. Missing: per-section timers, time-per-question / slowest-questions stats, one-click "mistakes → Mistake Bank", attempts-over-time chart (best-only stored today), exam-mode calm/distraction-free polish. |
| `/drills` Maths drills | Infinite generated drills (fraction/percent/algebra/bodmas/sequence) + server bank mix, instant feedback + explanation, mistake recording. | Works. Missing: topic picker + difficulty ladder, Untimed/Speed-60s/Exam modes, numeric keypad, KaTeX rendering (plain text today), streak counter + sound toggle, topic-mastery view. |
| `/writing` Writing studio | Server prompts (80 per telemetry) + genre filter, timer, textarea, AI feedback path, self-rubric bands (6 traits × 3 levels), grades history (`sehs-grades`). | Good bones. Missing: Tiptap editor (plain textarea today — do NOT claim rich text), autosave drafts + version history (only grades persist), planning scaffold panel, random-prompt button (check), export copy/.txt/print, difficulty/theme filters. |
| `/reading` Reading room | Passage list + reader + MCQ, AI passage generator, mistake recording, accuracy counters. | Basic. Missing: split passage/questions layout polish, highlighter, notes, timer, evidence markers, tap-word definitions → vocab deck, accuracy-by-type tracking. |
| `/exam-guide` Study guides + Exam guide | Guide reader (Lamp/TextReveal/StickyScroll/TracingBeam/Timeline/FAQ/Vortex CTA per progress log). | Rich. Missing vs brief: sticky ToC + reading progress + estimated time audit, callout-box system (tip/mistake/worked-example) consistency, KaTeX, per-guide "Test yourself" + related-drills/decks/papers links. |
| Topic hubs | DO NOT EXIST as routes. Chips (`verbal analogy`, `vocabulary`, …) deep-link to `/search?q=…`. | Build one reusable template route (e.g. `/topics/:id`) rather than 5 bespoke pages. |
| `/subjects` + `/providers` | Subjects (subject-grouped browse) + Providers (provider cards). | Exist. Audit gaps: verify resource counts live, per-subject progress, provider logo/description/cite/link + licence note per resource, takedown contact on About. |
| `/request` Request | Form → API/mailto + confirmation; "recently added from requests" list. | Verify backend wiring; keep static-friendly. |
| `/about` `/privacy` `/terms` | Mission, who-built, free-model, data sources + last-checked, disclaimers, contact/takedown; plain-language privacy; terms v2 gate. | Present incl. independence statements. Missing: school-data source dates audit, analytics disclosure value, `/whats-new` changelog page + release-notes toast. |
| 404 + error boundary | Designed 404 + route error card. | Keep. Add shared template usage. |

Flashcard decks: server `/api/decks` (+ 14 expected). Topic chips: 8 home chips → search. "New folder": sidebar link → `/saved#list-new`, small form in Saved.

## 2. What's broken or inconsistent (honest list)

1. **CTA labels inconsistent** (brief non-negotiable): cards use "Read here →" / "Details →"; Study hub prep cards use "Open →"; mocks use "Start →". Fix to: resources **Open**, practice **Start**, decks **Review**.
2. **Mobile Dock ≠ spec**: today Home/Search/Study/Mocks; spec wants Home/Practice/Library/Progress. Also numeric "01–04" glyphs instead of Lucide icons.
3. **Palette is search-only**: no actions ("Start a mock"), no pages/decks, no `/` shortcut focus parity (Topbar handles `/`, palette opens on Ctrl/Cmd+K only).
4. **Target chip dead-ends off-home**: clicks scroll to `#four-doors` which only exists on `/`; elsewhere it navigates to `/#four-doors` (hash route, unreliable with BrowserRouter).
5. **Storage unversioned, scattered**: ~25 `sehs-*` keys, shapes documented below; no `version` field anywhere; `repo.js` export covers 11 keys but misses `sehs-grades`, `sehs-target-school`, `sehs-exam-date`, `sehs-recent*`, `sehs-settings`, terms/cookie flags; no import path in UI; no backup reminder. **#1 risk per brief.**
6. **Review systems disagree**: Leitner (`sehs-leitner`) in client, `sehs-review` queue in repo, `sehs-mistakes` flat log, `sehs-drill-strands` in legacy drills. No single Mistake Bank surface.
7. **Attempts store best-only** (`sehs-mocks`: `{[id]: {score,total,seed,at}}` keeps max). History chart impossible without shape change (must migrate, keep best).
8. **No `/topics/:id`, no `/whats-new`**, no parent-summary, no coverage map, no saved views, no DnD folders.
9. **Legacy root app (`app.js` + `search.js`) duplicates search** against `data/links.json` (1,641 records) while client uses `/api/*` over `data/app.db` (1,542 public). Counts differ by design (public vs all) — label which is which; don't "fix" by merging blindly.
10. **Perf/a11y unverified here**: no Playwright/axe/Lighthouse in this env (consistent with PROGRESS.md). Bundle gzip ~283KB and rising; route-splitting + lazy viewer/editor still to do. Focus ring + keyboard + reduced-motion foundations exist; full keyboard-only walkthrough still owed.

## 3. localStorage keys / data shapes (source of truth for migration)

Versioned schema target: **`sehs-schema: 2`** (new key). All v1 keys keep
working; migrator backfills + never deletes user data without export.

| Key | Shape (v1 reality) | Owner |
|---|---|---|
| `sehs-theme` | `"dark"` / `"light"` | UI pref (keep direct) |
| `sehs-view` | `"grid"` / `"list"` / `"ledger"` | UI pref |
| `sehs-density` | `"compact"` / absent | UI pref |
| `sehs-motion` | `"full"` / `"reduced"` / `"off"` | UI pref |
| `sehs-target-school` | `schoolId` / null | personalisation |
| `sehs-exam-date` | `"YYYY-MM-DD"` / null | Study hub |
| `sehs-name` | string ≤24 | profile |
| `sehs-saved` | `string[≤500]` (resource ids) | bookmarks |
| `sehs-recent` | `[{id, title, at}]` ≤12 | recents |
| `sehs-recent-searches` | `string[≤8]` | search |
| `sehs-lists` | `[{name, items: string[≤100]}]` | folders v1 (no id/colour/tags/order) |
| `sehs-decks` | `[{title, cards: [{front, back}]}]` (local decks) | flashcards custom |
| `sehs-leitner` | `{[deckId]: {[front]: box1..5}}` | Leitner state (keep; FSRS adds new fields, never reuses box semantics) |
| `sehs-fsrs` (NEW v2) | `{[deckId]: {[cardKey]: {state, due, reps, lapses}}}` | FSRS scheduling (absent today) |
| `sehs-mistakes` | `[{stem≤200, strand≤20, picked, correct, at}]` ≤100 | Mistake Bank log |
| `sehs-drill-strands` (legacy) | `{[kind]: {seen, ok}}` | drills (merge into mistakes/strands, keep key read-only) |
| `sehs-mocks` | `{[mockId]: {score, total, seed, at}}` best-only | attempts v1 |
| `sehs-mock-history` (NEW v2) | `{[mockId]: [{score,total,seed,at,durationSecs}]}` append-only ≤50/mock | history (migrated seed: one entry per best) |
| `sehs-progress` | `{[id]: {at, secondsRead}}` | reading progress |
| `sehs-notes` | `{[id]: {text≤8000, updatedAt}}` | notes |
| `sehs-annotations` | `{[id]: [{id,kind,x,y,w,h,color,text,at}]}` ≤120/id | annotations |
| `sehs-review` | `[{stem,strand,box,nextDue,at}]` ≤200 | review queue |
| `sehs-grades` | `[{promptId?, scores{6}, at}]` (Writing page, unversioned) | writing self-assessment |
| `sehs-drafts` (NEW v2) | `{[draftKey]: {text≤20000, updatedAt, history[≤5]}}` | writing autosave (absent today) |
| `sehs-settings` | `{extraTime, largerText, highContrast, dyslexiaFriendly}` | accommodations |
| `sehs-profile-v1` | object | profile extras |
| `sehs-insights-v1` | `{firstSeen, totals{}, days{}}` ≤365d | local analytics |
| `sehs-streak` | `{days: ["YYYY-MM-DD"]} ` ≤365 | streak |
| `sehs-cookie-ok` | `"1"` | consent |
| `sehs-ann-seen` | string slice | announcement dedupe |
| `sehs-terms-accepted` | number (version) | terms gate |
| `sehs-sample-win` | ISO date | sample-question win flag |
| `sehs-seen-*` | `"1"` | one-shot intros |
| `sehs-admin-token` (sessionStorage) | bearer | admin only, untouched |

Server counts: `/api/stats publicResources=1542`; static `links.json`=1641 rows
(all indexed incl. non-public). Home fallbacks must keep using live values.

## 4. Build-to-reality decisions

- Migrate, don't rewrite storage. `storage.js` v2 migrator runs once, backs
  up v1 snapshot under `sehs-backup-v1`, appends history, upgrades folders
  `{id, colour, tags[], order}` without losing items.
- Labels + shared components first (cheap, global). FSRS/PDF.js/Tiptap/KaTeX
  are new deps — introduce one per phase behind lazy import, never in the
  main bundle.
- No virtualized lists yet: 24/page pager is fine; virtualization only if a
  measured list (1,542 rows single-view) ships.
- Viewer stays a terms-gated Drive frame; invest in chrome (report, notes,
  resume, related), not fake page controls.
