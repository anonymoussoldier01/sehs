# Home / landing redesign — changelog (Oct 2026)

Outcome-first landing that sells the destination (the four schools), then shows
SEHS Study as the shortest path. Dark navy kept, serif display kept,
“free forever, no account, saved in this browser” kept. React + Tailwind stack
unchanged; patterns from Magic UI / Aceternity / motion-primitives were ported,
not pasted.

## Why this shape

- Visitors picture the blazer and the gate, not worksheets. Hero → Four Doors →
  taste → path mirrors that mental journey.
- Tone stays aspirational, never shaming. No “don’t fall behind”, no pass-rate
  promises, no invented testimonials.

## What changed (and why)

### Data first — `client/src/data/schools.js` (port of `/data/schools.ts`)

- `SCHOOLS[]` with `{ name, shortName, suburb, tag, crestSrc, wordmarkFallback,
  brandColour, stats, hook, sourceUrl, lastChecked }`.
- Stats are the real VCE 2025 block only: Mac.Rob #4 / 34.7% / 37 · Nossal #6 /
  32.4% / 37 · MHS #10 / 29.9% / 36 + 722 students · SCHS #17 / 25.0% / 35 +
  “44 → 17”. Hooks use only those numbers — no superlatives.
- `crestSrc: null` everywhere, so the UI renders the typographic wordmark
  automatically. One-line change to adopt a licensed crest:
  put the file in `client/public/crests/<slug>.svg` and set `crestSrc`.
  Never hotlink, never redraw, never imply endorsement.
- `EXAM = { date: '2027-06-19', label: 'June 2027 · 2028 intake' }` — copy targets
  the 2028 intake / June 2027 exam. Rendered with “confirm on ACER” always.
  (2027-intake copy removed; those applications are closed.)
- `SCARCITY_FACTS`, `H1_VARIANTS`, `FAQ_ITEMS` live here so copy is reviewable.

### Analytics — `client/src/lib/analytics.js`

- Local-first `track(event, data)` for the primary CTA (`cta_hero_mock`,
  `cta_closing_mock`) and `target_school`, plus `topic_chip`, `sample_*`,
  `chooser_done`, `cta_continue*`.
- H1 A/B: `?h1=a|b` overrides, otherwise random + persisted in
  `sehs-h1-variant`; exposures tracked (`h1_A_exposure`) so click-through can be
  compared. No account, no fingerprint, never uploaded.

### Landing components — `client/src/components/landing.jsx`

- `SchoolCrest`: `<img>` when `crestSrc` exists, wordmark box otherwise.
  Fixed size → no layout shift.
- `CrestStrip`: spotlight/marquee logo cloud (Magic UI marquee pattern).
  Greyscale at rest, full colour on hover, school name always visible beside the
  mark. Pauses on hover; stops under `prefers-reduced-motion` / motion Off.
- `FourDoors`: four large cards — crest + serif name + suburb + Girls/Boys/Co-ed
  tag, VCE stat block (rank / 40+% / median), hook, “Target this school”.
  Brand colour is a subtle border glow + stat tint only; navy stays dominant.
  Hover = lift + soft spotlight, 1px borders, no heavy shadows. Footnote with
  source + lastChecked + “see school and VCAA pages”.
- `useTargetSchool` (`sehs-target-school`): targeting personalises the Topbar
  chip, the countdown line, and the chooser result.
- `Countdown`: days to `EXAM.date` (or the user’s Study-hub override),
  NumberTicker once on first view, reduced-motion safe.
- `ScarcityBand`: the four honest facts only + “no guarantees” note.
- `SampleQuestion`: real stem “Area of a 6×4 rectangle?”, A–D labels, instant
  green/red + one-line explanation, single CTA “Try 5 more →”.
  First correct fires subtle `Confetti` once (respects reduced motion).
- `HowItWorks`: the required 3 steps — Pick a target → Practise by topic →
  Review mistakes — with Lucide icons + plain panels (no scraped imagery).
- `DoorChooser`: 3 questions (co-ed/single-sex, commute area, which stat draws
  you) → recommends from official facts only → “Target this school”.
- `FaqSection`: the six required questions (free? account? real ACER format?
  how early? 20 min/day? private?).
- `Testimonials`: built but `SHOW_TESTIMONIALS = false` — ships hidden until
  real, named/initialled, consented quotes exist.
- `ClosingCta` + `TrustBadges` (“Free forever”, “No account”, “ACER format”).

### Home — `client/src/pages/Home.jsx` (new page order)

Hero + crest strip → Four Doors → Sample demo → Scarcity → How + countdown →
Topics + stats → Continue → FAQ → Closing CTA.

- Hero: H1 A/B (serif), H2 under, 2-line subhead
  (“Past papers, flashcards and timed mocks in ACER format. Free.”),
  dominant “Start your first mock →” + ghost “Browse past papers”.
  Crest strip sits directly under the CTAs with the live
  “{resources} resources · 4 timed mocks · free, no account” line.
  Old mono `LIB … · MOCKS …` telemetry line removed (duplicated the cards).
- Highlighter fixed: SVG brush is now `z-index: 0` behind `.hl-text`
  (`z-index: 1`), lifted to `bottom: 0.08em` so the “g” clears it.
- Background is a faint radial spotlight, not the flat dot grid.
- Hero search box removed (it duplicated the global palette). Replaced with
  suggested-query chips (“verbal analogy”, “simultaneous equations”, …).
  Global cmdk palette + Topbar search stay; “/” hint now lives in the Topbar
  only.
- Stats: four cards, `NumberTicker` once on first view, reduced-motion safe.
- Topics: horizontally scrollable snap rail, no clipped edges, live counts per
  topic (from `/api/search` totals), clear hover/active.
- Continue: one primary action per card, progress bar, “last opened …”,
  first-visit “Recommended start” empty state.
- Removed from Home to keep it focused: study-modes bento, new arrivals,
  trending, practice/answers/PDF tables (all still reachable via Library).

### Shell — `client/src/components/shell.jsx`

- Topbar: added `<kbd>/</kbd>` hint; added “Your target: X” chip (links to
  `#four-doors`) when a target is set. Palette (Cmd/Ctrl+K) unchanged.
- Sidebar: regrouped to Practice / Library / More with collapsible
  `<details>` sections (keyboard native), kept the clear active state
  (accent wash + inset bar + `aria-current`), added a top “Continue”
  shortcut (last opened resource, else diagnostic). All targets ≥44px.

### Layout — `client/src/Layout.jsx`

- Footer now shows the four school wordmarks (identification only) and the
  mandatory line: “Not affiliated with ACER, the Victorian Department of
  Education, or any school. School names and crests are used for identification
  only.” Free/account promise kept.

### Tokens + CSS — `client/src/index.css`

- Added the landing system (hero, crest cloud, doors, sample, scarcity,
  countdown, how, chooser, topics, continue, closing, target chip,
  side-groups, footer schools) on the existing radius/spacing/type tokens.
- Cards: 1px borders (~8% white in dark), soft `--brand` inner glow on hover.
- Motion 150–250ms ease-out; marquee is the only loop (pause on hover, off for
  reduced motion). Spotlight is static.
- Light mode: muted tones pinned to AA (`#3f4756`/`#4b5568` on paper) instead
  of a plain invert. Focus rings + 44px targets throughout.
- Mobile-first: 375px checked; Four Doors becomes a swipeable snap carousel.

### Share + icons — `client/public/`

- `og.svg` (1200×630): navy card, “Four doors. One exam. Walk in ready.”,
  four wordmark boxes with suburbs/tags, trust line. `index.html` OG/twitter
  tags updated with image alt text.
- `icon.svg`: navy rounded square, serif S, gold brush underline.
- `manifest.json`: added to `public/` (was 404) with matching navy theme.

## What was deliberately NOT done

- No official crests shipped (no licensed files available). Wordmarks stand in;
  see the one-line adoption note above.
- No testimonials shipped (none verified). Component exists behind a flag.
- No pass rates, “X% got in”, or guaranteed-admission copy anywhere.
- No school photography / stock scraped; How-it-works uses Lucide + CSS only.

## Verify

- `npm --prefix client run build` ✓, `npm --prefix client run lint` (oxlint).
- Manual: 375px (Doors swipe, no clipping), keyboard-only run
  (Tab → Enter on every CTA/chip/door/FAQ), light + dark, reduced motion on
  (marquee still, confetti silent, tickers jump to final).
- A11y target: Lighthouse a11y ≥95, no CLS (fixed-size crests, tabular numerals
  for tickers/countdowns).
