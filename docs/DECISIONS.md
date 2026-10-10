# Decisions

Log the smallest sensible change whenever a requirement conflicts with the architecture. Precedence: operating rules > priorities > phase specs > style preferences.

## D1 — No PDF.js direct fetch; Drive-embed viewer stays the retrieval path
- Context: all 1,641 records are `drive.google.com` links (link-shared third-party files). Direct in-app fetch would face Google CORS/rate limits and would sidestep the site's own grant-token access logging; redistribution rights are unsure/mixed.
- Decision: keep the server grant-token gateway (`/api/preview` → single-use `/embed/:token` → Drive `/preview`) as the viewer path, wrapped in a branded viewer (toolbar grouped by function, details/notes panels, distraction-free mode, keyboard shortcuts, prev/next, reading progress, "open original" fallback). No server-side Drive API proxy with a held credential (would need permission confirmation + would concentrate quota/cost risk).
- Consequence: no page thumbnails, in-document text search, or typed page numbers inside the preview (Drive iframe limitation) — documented honestly in the viewer UI and final report instead of faked.

## D2 — No backend rewrite; local-first persistence behind a repository interface
- Context: no user accounts exist; adding accounts would need credentials, email, and legal review (minors' data) — out of scope and high-risk.
- Decision: keep `localStorage`/cookies behind `client/src/lib/repo.js` (resource progress, bookmarks, notes, attempts, answers, review items, settings) with export/delete and a documented migration path to accounts. No new DB tables; no migration needed (backup still snapshotted per rule 2).

## D3 — No TypeScript migration; plain-JS validation module instead of Zod
- Context: repo is JavaScript-only with no build-time type checking; adding TS/Zod mid-run would touch every file and break the "smallest sensible change" rule.
- Decision: assessment engine in plain JS with an explicit `validateQuestion` schema checker (same guarantees, documented), plus `node:test` unit tests. No new paid dependencies (rule 11).

## D4 — Question counts per block are unverified; pace against minutes only
- Context: ACER publishes block minutes but not question counts; third-party sites publish counts that conflict with each other and with ACER's 3-block structure.
- Decision: mocks/time guidance use minutes only; any third-party count shown in UI must be labelled `unverified`. Native question banks are labelled `draft` unless they pass the Phase 6 pipeline, `verified` with method+date when they do.

## D5 — Bundle budget (initial)
- Fonts ≤ 120KB (Inter 400–800 + Fraunces 600–700 + mono 400–600, subset, preload critical only); framer-motion via LazyMotion/`m` where practical — full import retained only where already used (exam/results transitions), new code uses CSS transitions; PDF.js NOT bundled (Drive embed); KaTeX/charts lazy-loaded on guides/dashboard routes only. Target: interactive home < 250KB gz JS on first load (to be measured in Phase 10).

## D6 — Third-party animated components: adopt selectively
- Adopted (re-implemented on repo tokens + motion profiles in `components/magic.jsx`, all static under Reduced/Off, desktop-pointer gating where apt):
  - MagicUI: MagicCard → `SpotlightCard`; ShineBorder/StarBorder → `StarBorder` (one featured surface per screen); DotPattern/GridPattern → `DotPattern`/`GridPattern` (hero, design specimens); PulsatingButton → existing `.btn-pulse` class; Confetti → `Confetti` (perfect mock score ONLY, self-cleaning canvas, never under reduced motion).
  - Aceternity: Spotlight → folded into `SpotlightCard`; TextGenerateEffect → `TextGenerate` (hero/marketing); Tabs → `AnimatedTabs` (results filters, design tabs); AnimatedTooltip → `AnimatedTooltip` (viewer/exam toolbar shortcuts); card Tilt → `Tilt` (subtle, pointer:fine only).
  - React Bits: BlurText → `BlurText` (section headings); Magnet → `Magnet` (marketing CTAs); ClickSpark → `ClickSpark` (marketing buttons; never exam/viewer); CountUp/RotatingText already existed as NumberTicker/WordRotate.
- Rejected: heavy parallax, per-letter headline noise, confetti-everywhere, lamp/wavy backgrounds, cursor-following global effects (perf + calm-profile conflicts). Proxy + PDF.js re-confirmed dead by direct probe (Drive `uc` export → 303 → interstitial/garbage range bytes; no browser CORS) — embedded viewer stays (D1).

## D7 — Streaks kept neutral; no streak-shaming, urgency, locks, or peer comparison
- The existing day-streak counter stays as a neutral fact ("3 days active") with no guilt copy, no artificial locks, no leaderboards.
