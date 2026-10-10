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

## D8 — Aceternity/MagicUI/Bits full wave (user-directed, gzip budget lifted)
- New files `components/ace.jsx` (BentoGrid + 6 live skeleton headers, ContainerScroll, TracingBeam, StickyScroll, Timeline, FocusCards, DirectionHover, LinkPreview [metadata-only, no external fetch], SnapCarousel, Evervault, WobbleCard, Lamp, AuroraBg, Beams, Faq, MultiStepLoader, StatefulButton, LinkArrow, GlowingCard, StickyBanner) and `components/bits.jsx` (BoxReveal, OrbitingCircles, SpinningText, VanishInput, Typewriter, TextReveal, HyperText, InteractiveHover, FlipTrue, ScrollVelocity, Ripple, Vortex, ShootingStars, FuzzyText).
- Wired: hero (VanishInput, SpinningText, BoxReveal), velocity ribbon, live bento, scroll-unfolding viewer mockup, aurora CTA band, guide (Lamp, TextReveal, StickyScroll, TracingBeam, Timeline, Faq, Vortex CTA), subjects (FocusCards + DirectionHover A–Z), search hover LinkPreviews, home carousels, QOTD Evervault, mocks (Lamp + Spotlight + fresh-seed links), study hub (WobbleCards), deck flip shine, 404 (FuzzyText + ShootingStars), MultiStepLoader on mock assembly, condensing Topbar, hide-on-scroll announcement, footer text-stroke hover.
- Rejected/skipped: Globe/WorldMap (irrelevant), Testimonials blocks (no fabricated social proof), pricing/auth blocks (non-goals), webcam/pixel shaders, compare/lens (iframe limits), parallax-scroll columns (perf), global cursor followers.
- Exam + viewer stay Calm: no sparks/magnets/velocity/confetti there; confetti fires on perfect scores only.

## D9 — Real 404 status with the SPA page
- `server.mjs`: unknown extensionless non-reserved paths serve `client/dist/index.html` with HTTP 404 (no soft-404s). API/admin/grants/feeds/static untouched (verified live).

## D12 — Antislop + pro-max deep pass (R-31 purpose log)
One line per technique, as R-31 demands. Brand core: ink blue (trust, depth for night study) + cyan accent (single action colour) + paper-warm reading surfaces (exam-paper memory) + Fraunces/Inter/Plex Mono (editorial voice, UI clarity, tabular timing).
- Aurora headline tint: hierarchy, makes the H1 verb glow once per page. Spotlight hover: feedback, proves cards are alive. StarBorder (1 surface): hierarchy, marks the single most valuable action (timed mocks). Beam frame (LearnPreview): identity, the "live sample" signature. Dot grid: identity, graph-paper study motif, hero only. Meteors: delight, one sky, hero + 404 only (particles removed from hero to stop trend-stacking). Marquee/velocity: rhythm, scannable topic transport. Orbit: identity, strands circling the work. Spinning badge: identity, free/no-account mark. BlurText/TextGenerate: attention, section entrances in reading order. Magnet/ClickSpark/Tilt: feedback, marketing CTAs only. Tabs pill: orientation, one moving indicator. Tooltips with kbd: recall, shortcut discovery. HUD bezel/readouts: readability under time pressure, exam only. Blueprint grid: context, shows annotate mode is armed. Ledger table: density, scan 24 rows without cards. Highlighter stroke: identity, the marker motif. Confetti: reward, perfect scores only. Timeline/StickyScroll/TracingBeam: narrative, guide pacing. FocusCards/DirectionHover: choice, browse by feel. LinkPreview: confidence, inspect before opening. Carousel: space, browse without paging. Evervault: play, answer reveals. Lamp/Aurora/Beams/Vortex/Stars: place, one backdrop per showpiece page. FuzzyText: humour, the lost page.
- Purged per the filter: em dashes (all UI copy), purple hues, glow stacking, per-card entrance choreography, emoji iconography (Lucide/text), unverified bank claims, "Most loved" puffery. Contrast repaired with measured ratios (light faint 2.56→5.69, destructive badge 3.96→5.30, success badge 4.30→6.11, accent badges→transparent). Coarse-pointer 44px targets via CSS (desktop density kept). `cursor: pointer` on all native buttons.

## D11 — GooseDesigns styles applied as ideas (MIT, inspiration only, no code copied)
- GooseDesigns is a mockup gallery, not a component library, so its 22 style families were applied as design direction: **HUD** → exam instrument bezel, T-minus/Q/strand/seed readouts, FINAL MINUTE caution panel, lamp-lit navigator (Calm preserved: no blinking); **blueprint** → drafting-grid overlay in annotate mode; **ledger** → third library view (hairline index table, sticky header, tabular figures); **editorial** → About manifesto, is/is-not ledger, numbered principles; **terminal-dark** → mono HUD telemetry strip on the hero (live counts only); **data-viz** → StudyHub 14-day activity bars from the real on-device ledger (new `opens`/`mocks` insight kinds; honest empty state).
- Rejected: game-UI excess (no blinking LEDs), invented gauges/scores, logo walls.

## D10 — Thorough first-visit T&C, Drive links removed, overlay annotations
- Terms v2 seeded additively (`scripts/terms-v2.mjs`; v1 row untouched, revert = set `terms_version` back to 1; DB snapshotted to `state/backups/phase-terms-v2/`). Copy covers independence, minors, acceptable use, copyright + takedown procedure, privacy summary, AI limits, as-is availability, Australian Consumer Law savings, VIC governing law. No compliance claims — qualified legal review still required (final report).
- First-visit gate (`FirstVisitTerms`): full scrollable v2 on first site open; Accept records version locally; Decline dismisses and re-asks next visit; per-tab resource gate unchanged. Single-source for Terms page (`/api/terms`); `/privacy` static plain-English page.
- All Google Drive redirect buttons removed (cards ↗, viewer toolbar + fallbacks, O shortcut, card open). Non-previewable types (docx/other/archive/webpage, ~200 records) now show an honest details-only notice + report path — a deliberate, user-directed regression logged here; follow-up is server-side conversion/proxy or per-type original links.
- True in-file highlighting is impossible inside the Drive embed, so annotations are positioned overlays (drag = highlight box in 4 colours, tap = numbered pin, optional note, list with show/delete, persisted per resource, exported/deleted with user data). UI states plainly that marks live with the page, not in the file.
- Cloudflare: the provided token is R2-storage-scoped and cannot deploy this Node+SQLite app; no deployment attempted, token never stored. See final report for hosting options.

## D7 — Streaks kept neutral; no streak-shaming, urgency, locks, or peer comparison
- The existing day-streak counter stays as a neutral fact ("3 days active") with no guilt copy, no artificial locks, no leaderboards.
