# SEHS Study — DESIGN.md (premium redesign, master brief)

> All work must conform to this file. Reference from AGENTS.md.
> Priority when conflicted: (1) honesty + no data loss, (2) accessibility,
> (3) beauty + distinctiveness, (4) completeness.

## 1. Thesis

**Four doors, one desk.** A calm deep-ink study instrument, near-monochrome,
with the warmth of a well-marked exam paper. Quiet chrome, ONE quiet sky
accent, ivory/ink CTA, tabular figures for anything timed or scored, and a
single accent-soft highlight bar where a marker would actually mark.

Audience: Year 8 students (12–14) AND parents deciding. Tone: aspirational,
warm, never shaming. No "don't fall behind", no peer comparison, no outcome
promises.

## 2. Colour tokens (CSS vars, no hard-coded hex in components)

> COLOUR SYSTEM REPLACEMENT (Oct 2026) overrides every earlier colour
> instruction — amber accent, per-school crest colours, red glows, blue
> buttons all retired. One calm hue family, near-monochrome, single quiet
> accent. Colour is rare so it means something.

Dark (default):
- `--bg: #0B1020` deep ink navy, never pure black
- `--surface-1: #111832` · `--surface-2: #172041`
- `--border: rgba(255,255,255,0.08)` · `--border-strong: rgba(255,255,255,0.16)`
- `--text: #EEF0F6` (16.6:1) · `--text-2: #A7B0C6` (8.7:1) · `--text-3: #7C86A2` (5.2:1, captions ≥14px only)
- `--accent: #7DB2FF` (8.7:1) — links, focus ring, selection, progress, small highlights. Never large fills.
- `--accent-soft: rgba(125,178,255,0.14)` · `--accent-line: rgba(125,178,255,0.35)`
- `--cta-bg: #F4F0E6` ivory · `--cta-fg: #0B1020` (16.6:1) · `--cta-hover: #FFFFFF` — single brightest element. Secondary = ghost 1px border. Never coloured fill.
- `--paper: #F4F0E6` cream, sample-exam card ONLY
- `--success: #5CCB97` · `--error: #EE7B86` — quiz/mock feedback, results, validation ONLY (14% tint + border + icon + text). Never glows, never decor.
- Schools: crest + name ONLY, mono crests default (`crestColour: "mono"`), one neutral door palette, selected = accent 1.5px ring + check. Per-school colour fields DELETED.
- 12-step neutral + accent scales (Radix step semantics) in `index.css`; tokens above stay source of truth.
- Alternate accents as token swaps (default sky): teal `--accent #4FD1B5`, brass `--accent #C9AB6B`; preview `?accent=sky|teal|brass` on `/design/colours`. CTA stays ivory/ink.

Light (designed, not inverted):
- `--bg: #FAF7F0` · `--surface-1: #FFFFFF` · `--surface-2: #F3EFE4`
- `--border: rgba(11,16,32,0.10)` · `--text: #0B1020` · `--text-2: #4A5470`
- `--accent: #2A5FD0` (5.4:1) · `--accent-soft: rgba(42,95,208,0.10)`
- `--cta-bg: #0B1020` · `--cta-fg: #FAF7F0`
- `--success: #1B7F55` (4.7:1) · `--error: #B3394A` (5.5:1)

BANNED: amber/yellow/orange, purple/violet, red outside errors, green outside
success, gradients between two hues, multi-colour glows, coloured card
borders, rainbow charts.

Dividers site-wide: `1px at 8% white` (dark) / `1px ink at 10%` (light).
Never 2px white.

## 3. Typography

- Display serif: Fraunces variable (600–700), ONE characterful voice.
  H1 `clamp(3rem,7vw,6rem)`, lh 1.0–1.05, ls -0.02em (never touching),
  `text-wrap: balance`. No widows/orphans.
- UI sans: system stack leaning Instrument Sans/Geist (NOT Inter default).
  Subheads are SANS, never bold serif. Body 17–18px, lh 1.6, 60–68ch.
  Minimum 13px secondary text.
- Mono: tabular numerals for stats/countdown/timers only.
- H1 breaks BETWEEN sentences, never mid-phrase at any width.
- Highlighter underline: SVG stroke BEHIND text, below baseline, ending
  before descenders, scaling with font-size.

## 4. Space, shape, depth

- 8px grid · section padding `clamp(72px,10vw,140px)` · ONE container
  (1200px) + gutter · 12-col grid, everything aligns.
- Radius: 10 buttons/inputs · 16 cards · 999 pills. Never mix others.
- Cards: Surface1 + 1px border + 1px inner top highlight
  `rgba(255,255,255,0.06)` + soft shadow `0 20px 40px -20px rgba(0,0,0,0.5)`.
  Hover/selected: border brightens + faint crest-colour glow. No heavy drops.
- Hero: full-bleed radial spotlight with `mask-image` fade on ALL sides,
  no rectangular edge in either theme. Paper grain SVG feTurbulence 2–3%,
  hero only.
- Buttons: primary amber + dark ink, 48px tall, 10px radius, subtle inner
  highlight, pressed `translateY(1px)`. Secondary: ghost 1px border.
- Sample-question card looks like real exam paper (cream, ruled lines,
  red-pen tick) — deliberate contrast on navy.
- One icon set: Lucide, 1.5 stroke. No emoji icons. No stock photos.

## 5. Motion

- ONE orchestrated moment on load + ONE on school selection. Everything
  else static or 150ms hover/focus.
- Motion library (framer-motion) for signature door swing only; CSS for
  hover/focus. All wrapped in `useReducedMotion` — instant cross-fade fallback.
- NumberTicker only for countdown/stat counts, run once. Looping only for
  optional dust motes (CSS, disabled on reduced-motion).
- No scroll fade-up per section, no hover-lift on every card.

## 6. Component rules

Shared `/components/ui`: Button, Card, Badge, Chip, ProgressRing, StatCard,
EmptyState (always with next action), PageHeader, Skeleton, Toast, Dialog,
Tooltip. ONE primary action per card: resources Open · practice Start ·
decks Review. Real `<button>/<a>`, aria-live on selection, skip link, focus
on route change, 44px targets, 375–2560px, CLS 0.

## 7. Do / Don't (anti-slop)

- Do: left-anchored hero, 7/5 text/card split, crest strip 4-col grid,
  door arches SVG, ledger tables, margin kickers.
- Don't: default blue primary · Inter-on-navy · identical rounded cards ·
  gradient blobs · everything centred · hover-lift everywhere · fade-up
  everywhere · gradient text · glassmorphism everywhere · neon glows.
- Max one focal point per viewport, at most two things animating at once.
- Squint test (hierarchy when blurred) · greyscale test · 5-sec test
  (what is this, what do I click) · template test (not generic SaaS).

## 8. Honesty

Free forever, no account, saved in browser — said ONCE above fold.
Readiness = practice coverage + accuracy, labelled as such. No guaranteed
admission, predicted ranks, fake percentiles, invented testimonials
(component ships behind flag). Footer + About: not affiliated with ACER /
Dept / schools; crests identification-only, removable in one line in
`data/schools.js` (typographic fallback). VCE stats with sourceUrl +
lastChecked, footnote on variance.
