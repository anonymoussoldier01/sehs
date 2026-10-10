# Progress

## Done
- Phase 0 audit: stack, routes, auth, persistence, data schema/stats (see below), baseline checks all green:
  - `npm test` → 17 passed, 0 failed.
  - `npm run validate` → total=1641 errors=0 warnings=0.
  - `npm run relevance` → 39 passed, 0 failed (index 1641 docs).
  - `npm run lint` (client oxlint) → 0 errors, 46 warnings (pre-existing style + unused-import notes; none blocking; 4 fewer than baseline).
  - `node scripts/assessment.test.mjs` → 13 passed, 0 failed (new).
  - `node scripts/smoke-native.mjs` → all pass (native banks intact).
  - `npm run build` (client) → ✓ 2446 modules, JS 853.91KB raw / 259.15KB gzip (over the 250KB-gzip budget — D5 follow-up: LazyMotion migration).
  - Server boot check (PORT 18099): `/api/stats` publicResources=1542, `/api/search?q=maths` total=265, `/design` 200, `/robots.txt` 200.
- Follow-up run (viewer + magic): opener rewritten terms-first (no `about:blank`; verified zero occurrences outside a comment); viewer auto-loads for pdf/image with terms-gated grants, fade-in, shimmer skeleton, retry + blocked-popup fallback link; cards navigate in-site (`Read here →` + ↗ original icon); 12 new magic components (Spotlight, StarBorder, TextGenerate, BlurText, Magnet, ClickSpark, AnimatedTabs, AnimatedTooltip, Dot/GridPattern, Tilt, restrained Confetti) all motion-gated; hover system (lift/link-slide/chip-hover/icon-hover/kbd) in CSS.
- Verification (follow-up): lint 0 errors (56 warnings, all pre-existing style/unused notes); build ✓ (JS 871.74KB raw / 263.92KB gzip, +4.8KB for the magic set); smoke 17/17; assessment 13/13; live boot: `/design` 200, search + by-ids round-trip ok.
- Cool wave (user-directed, gzip budget lifted): `components/ace.jsx` + `components/bits.jsx` (~40 patterns) wired across hero (VanishInput, SpinningText, BoxReveal), velocity ribbon, live-skeleton bento, scroll-unfolding viewer mockup, aurora CTA band, guide (Lamp, TextReveal, StickyScroll, TracingBeam, Timeline, Faq, Vortex CTA), subjects (FocusCards + DirectionHover), LinkPreview hovers, carousels, QOTD Evervault, mocks Lamp, wobble prep cards, deck flip shine, fuzzy starfield 404, mock MultiStepLoader, condensing Topbar, sticky hide-on-scroll banner, footer text-stroke hover. Verified: build ✓ (JS 916.38KB / 276.44KB gzip), lint 0 errors, tests 17/17 + 13/13, live routes incl. real-status 404.
- Legal + viewer + landing run: terms v2 seeded (additive script, DB snapshotted, `/api/terms` serves v2); first-visit full-T&C gate + `/terms` (API-sourced) + `/privacy` pages + footer links + sitemap entries; all Drive-open buttons removed (non-previewable types get an honest details-only notice); overlay annotations (highlight boxes + numbered pins, 4 colours, persisted/exported/deleted); VIC-selective hero copy + “Four schools. One exam.” aspiration section (orbiting initials, school spotlight cards, no outcome promises). Verified: build ✓ (JS 932.73KB / 280.93KB gzip), lint 0 errors (75 warnings, pre-existing patterns), smoke 17/17, assessment 13/13, validate 1641/0/0, live: terms v2 + all touched routes 200.
- GooseDesigns wave: exam HUD (bezel, T-minus readouts, caution panel, lamp navigator), blueprint annotate grid, ledger table view, editorial About, hero telemetry, 14-day activity chart. Verified: build ✓ (JS 939.82KB / 282.84KB gzip), lint 0 errors, tests green, live bundle serving.
- Antislop + pro-max deep pass: em dashes purged from all UI copy (client, banks, generators, terms v2 republished), purple purged to blue/cyan, glow dose capped (StarBorder + LearnPreview beam), per-card entrances trimmed to layout-only, emoji iconography replaced (Lucide/text), unverified bank claims corrected, contrast repaired to measured AA (tokens + badge/button variants), coarse-pointer 44px targets, pointer cursors, truncation titles, DeckCard Lucide icon, ShinyBadge simplified, home rhythm varied (ledger strip, PDF carousel), DESIGN.md dials ENERGY 2/RHYTHM 3/MOTION 2 + dark-default reason, R-31 purpose log in DECISIONS.md D12.
- Snapshot before any migration: `state/backups/phase0-baseline/{links.json,app.db}` (gitignored; DB + index untouched; no DB migration needed — D2). Terms v2 snapshot: `state/backups/phase-terms-v2/app.db`.
- Branch `feat/premium-redesign` created from `master` (commit 6665ad7).
- Exam-format research: ACER official pages confirm 3-block format (see EXAM_FORMAT.md with URLs).
- Phase 1: DESIGN.md (thesis, 3 directions, signature, OKLCH tokens, type system) + tokens in `index.css` + IBM Plex Mono + `/design` living style guide (noindex). Rejected directions recorded.
- Phase 2: UI craft applied — grouped viewer toolbar, filter chips + reset, keyboard nav (library ↑↓/Enter/S; viewer O/S/?; exam 1–4/A–E/arrows/F/?), shortcut help dialogs, focus-visible 2px ring, tnum timers/scores, reading measure, print styles, honesty fixes (live counts, AI-sample labels, verified/unverified FAQ, independence statements), mojibake fixed.
- Phase 3: MOTION.md + `lib/motion.js` (tokens, springs, profiles, `useMotionProfile`, Full/Reduced/Off setting + OS preference, Calm for exam/viewer, no-replay intros).
- Phase 4: library kept (1,641 records, validate OK); answer-key heuristic report (`scripts/answer-links.mjs`: 158 auto-linkable ≥0.95, 0 needs-review — report only, records unchanged); `scripts/validate-urls.mjs` (dry-run default; live rate-limited); viewer upgraded (notes autosave + status, reading progress + resume note, focus mode, inferred answer-key panel, related, report flow); retrieval path documented (D1); `/design` added to server SPA routes.
- Phase 5: `lib/assessment.js` (schema validation, scoring per type, absolute-timestamp timer, deterministic seeds, Leitner review queue, accommodations, labelled SAMPLE bank) + 13 unit tests; MockRun rewritten (autosave/resume, expiry auto-submit, pre-submit checklist + confirm, double-submit guard, review filters, topic breakdown with not-enough-data state, seed in URL).
- Phase 6: EXAM_FORMAT.md (ACER-verified + sources, conflicts rejected); Guide FAQ corrected with verified/unverified labels + source links; sample bank labelled draft (pipeline documented in README).
- Phase 7: `lib/repo.js` repository interface (progress, bookmarks, notes, attempts, review queue, settings) + export/delete + first-run guided start + review queue UI + neutral activity wording.
- Phase 8: footer + About independence statements, report/removal surfaced, robots.txt + sitemap.xml (user pages disallowed), OG meta + generated `og.svg`, security headers unchanged, no new secrets (`.env.example` unchanged — no new server vars).

## Baseline facts (Phase 0)
- Framework/router: React 19 + react-router-dom 7 (browser router); server plain Node http + Vite build to `client/dist` with SPA fallback; legacy server-rendered pages as fallback when `dist` missing.
- Package manager: npm. React/Tailwind: Tailwind v4 (CSS-first), Tailwind Vite plugin; no TypeScript in repo (rule 6 vacuous — no suppressions exist).
- shadcn: `client/components.json` + `client/src/components/ui/*` (Radix-based). Animation: framer-motion 14 + Lenis smooth scroll + auto-animate.
- Backend: `server.mjs` + `server/*.mjs`; DB SQLite (`node:sqlite`, `data/app.db`) / Postgres (`DATABASE_URL`); auth single admin password + per-tab bearer token; persistence local-first (localStorage keys `sehs-*`).
- Env vars: `PORT`, `APP_SECURE`, `APP_DB`, `DATABASE_URL`, `SEHS_ADMIN_PASSWORD`, `AI_ENABLED`, `GEMINI_AI_KEY`, `POLLINATIONS_*` (see `.env.example`).
- File index: 1,641 records, IDs stable 128-bit `public_id` (server-mapped; `state/id-map.json` gitignored). All URLs `drive.google.com` (0 malformed, 0 dup URLs). Formats: pdf 938, image 405, docx 133, folder 99, other 56, archive 6, webpage 4.
- Metadata coverage: title/description/summary/category/tags/audience/driveId/driveName/lastChecked/status 100%; contentType 96.6%; dateModified 94.0%; subcategory 19.2%. Categories: other 921, practice-test 233, reference 147, maths 113, folder 99, quantitative 53, writing 42, reading 24, verbal-reasoning 9. answers_included: 151. All access_level public.
- Routes working (code inspection; server boot + client build verified in Phase 10): `/`, `/search`, `/r/:id`, `/study`, `/study/:deckId`, `/mocks`, `/mocks/:id`, `/writing`, `/drills`, `/reading`, `/saved`, `/list/:code`, `/subjects`, `/providers`, `/about`, `/request`, `/unlock`, `/exam-guide`, `/design` (new), 404.
- Accessibility/perf notes (baseline): focus-visible ring exists (3px amber — to be retokenised to 2px offset per spec); tabular numerals used in places; Lenis disabled under reduced-motion; no bundle budget documented yet; heavy modules (framer-motion) bundled globally — lazy-load plan in DECISIONS.md.

## Next
1. Run live URL validation deliberately (`--live --all`) and triage broken/restricted links.
2. LazyMotion migration to bring JS gzip under budget; font subsetting/self-host.
3. Server-side seeded mock assembly + multi-device resume (needs accounts decision).
4. Playwright journeys + axe + Lighthouse when a browser harness is available.
5. Admin curation view for the 158 answer-key candidates + duplicate review.

## Known issues
- MockRun question pool is assembled server-side with Math.random per fetch; the client orders the received set deterministically from the stored seed (seed in URL, reproducible within the attempt pool). True server-side seeded selection is a follow-up.
- Viewer prev/next within a collection is not implemented (no collection context on `/r/:id`); related resources + recent-resume cover navigation. Recorded, not claimed.
- nit / Playwright / axe / Lighthouse were not available in this environment — QA was code review + smoke/build/lint/unit tests + live server spot-checks (honest fallback per spec §9).
- Bundle JS gzip 259KB slightly over the 250KB budget (framer-motion full import); LazyMotion migration is the documented next step.
- URL validation live check not run (would hit 1,641 Drive URLs; dry-run default). Run `node scripts/validate-urls.mjs --live --all` deliberately.
- `providers.jsx` and opener contain mojibake (broken em-dash/popup strings) — fix in Phase 2. — FIXED this run.
- Mock timer uses interval ticks (drifts when tab backgrounded) — replace with absolute-timestamp timer in Phase 5.
- Home fallbacks hardcode numbers (`deckCount ?? 13`, "1,600+", "775+") — replace with live/verified values in Phase 2.
- No `/design` route, no motion profiles, no in-app motion setting — Phase 1–3.
- Viewer is a Drive iframe (no thumbnails/text search/page control) — best compliant path; document + upgrade chrome in Phase 4.
- nit/Playwright/axe/Lighthouse availability unchecked — verify in Phase 9; fall back honestly if missing.

## Resume commands
```powershell
cd C:\sehs
git status; git branch --show-current   # expect feat/premium-redesign
npm test; npm run validate; npm run relevance
npm run lint --prefix client
npm run build:client                    # production client build
node scripts/assessment.test.mjs        # assessment engine unit tests (Phase 5+)
node server.mjs                         # serve http://localhost:8080 (needs client/dist)
```
