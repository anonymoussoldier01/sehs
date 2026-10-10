# Design direction

## 1. Design thesis
**A calm, precise study instrument: ink on deep navy, with the warmth of a well-marked exam paper.**

Every decision serves it: quiet chrome, one confident accent, paper-warm reading surfaces, tabular figures for anything timed or scored, and a single hand-drawn-feeling highlighter motif used sparingly where a marker would actually mark.

## 2. Three directions (written specs + coded hero/app-screen prototypes)
Prototypes were built as the existing Home hero + Search/Library screen re-skinned in code spikes (kept out of the tree; decisions below are what shipped).

- **A. "Exam desk" (chosen).** Deep-navy chrome, warm paper reading surfaces, ink text, cyan/blue accent, highlighter-stroke under key words, margin-annotation details (small caps kickers, ruled dividers, question-grid navigator as both tool and motif). Serif display (Fraunces) for editorial headings, Inter for UI, mono with tabular numerals for timers/scores/question numbers. Feels like the test itself, minus the stress.
- **B. "Laboratory" (rejected).** Bright white, hairline grids, spectrum accents per subject, dense data readouts. Looked clever but cold; colour-per-subject fought the one-accent rule and felt like analytics software, not study. Rejected: fails "calm", weakens focal hierarchy.
- **C. "Playground" (rejected).** Rounded, gamified, confetti, streak flames, gradient hero. Tested as actively stressful for exam-anxious Year 8 students and invited fake urgency — directly against engagement ethics. Rejected: wrong emotion, dishonest affordances.

Why A won: it is the only direction tied to the domain (exam paper + marker), it stays calm under time pressure (exam/viewer use the Calm profile), and it lets dense app screens and generous reading screens share one system.

## 3. Signature ideas (domain-tied, used consistently)
1. **Highlighter-stroke accent** — a soft-yellow (`#FDE68A`) hand-drawn underline that draws across key words (hero headline keyword, score reveal, "next best step"). Implemented as an SVG stroke with `stroke-dashoffset` draw, respecting reduced motion (renders statically). Used at most once per screen.
2. **Question-grid-as-navigation** — the exam navigator grid (answered/unanswered/flagged/current with icon + shape, never colour alone) is the visual motif echoed in library skeletons and dashboard review queues. One component, three contexts.

## 4. Tone + benchmarks
Premium, calm, confident, trustworthy. Craft benchmarks: Linear/Vercel/Stripe (spacing, restraint, motion discipline) + Readwise Reader/Notion (reading comfort). Studied, not copied: no gradient heroes, no glassmorphism, no emoji icons (Lucide, one stroke width).

## 5. Palette (tokens in OKLCH; hex = starting intent)
Dark (default): bg `#0B1220`, raised `#111A2E`, overlay `#172238`, borders `#243049`, text `#E8EDF7`, muted `#8A97B2`, accent cyan `#38BDF8`.
Light: bg `#F7F8FB`, surface `#FFFFFF`, ink `#0F172A`, accent `#2563EB`.
Semantic (icon + label, never colour alone): correct `#10B981` + tick, incorrect `#F43F5E` + cross, flagged `#F59E0B` + flag.
Specials: reading paper `#FBFAF6`; highlighter `#FDE68A`.
All text/UI pairs verified against WCAG AA in both themes (Phase 9 re-checks; token — not intent — adjusts on failure).

## 6. Typography
- UI: Inter (variable, 400–800). Editorial/display: Fraunces (600–700). Timers/scores/question numbers: monospace stack with tabular numerals (`"IBM Plex Mono"`, ui-monospace fallback), `font-variant-numeric: tabular-nums`.
- Self-hosted later; now Google Fonts with `display=swap`, preconnect, preload critical weights only, `size-adjust` fallbacks to prevent layout shift.
- Fluid scale via `clamp()`; headings `text-wrap: balance`, paragraphs `pretty`; reading text ≤ 65ch (study guides) / 70ch (resource descriptions); line-height 1.6–1.75 for passages.

## 7. Colour, depth, surface
Layered surfaces (background → raised → overlay); neutral ramp with slight brand tint. Depth via hairline borders, soft layered shadows, subtle inner highlights, at most faint grain. Glow/blur are rare accents. Both themes fully designed; system default + manual toggle persisted.

## 8. Layout + components
8px grid; 12-col desktop; page templates (marketing, app-with-sidebar, full-focus, reading, form/settings, empty/error); three emphasis levels max per screen; optical alignment; nested radii; 3 radii + 4 elevations. One polished inventory (buttons, inputs, selects, palette, chips, tags, sliding tabs, tables, tooltips, popovers, dialogs, mobile drawers, toasts, layout-matching skeletons, empty/error states, progress rings/bars, shortcut hints) with default/hover/focus-visible/active/disabled/loading/error/selected states. Internal noindex `/design` route is the visual-QA target.
