# Changelog — Phase 2: home page (master brief §5) + beauty gate rounds

## What shipped and why

- **Tokens → master brief (§4):** amber `#F5B83D` primary CTA w/ dark ink,
  base `#0A0F1E`, S1 `#101734`, S2 `#162046`, borders 8%/16% white, text
  `#EDEFF7`/`#A9B0C8`, cream `#F4EBD9` (+ light cream `#FAF5EA` designed, not
  inverted). Dividers site-wide 1px 8% white (was 2px). Selection amber 30%,
  accent focus rings, thin scrollbar, radius 10/16/999. Generic blue retired
  as primary. Crest colours → brief values (Mac.Rob `#4C8DFF`, Nossal
  `#2FBF8F`, MHS `#D64550`, Cory `#8B6CF0`); fallback tiles cream + dark ink
  (≥12:1) with brand border — every crest legible.
- **Hero (§5 defects 1,2,7,8,9,10):** eyebrow `Victorian selective entry ·
  ACER format`; H1 sentences wrapped in `.sent`, `balance`, ls -0.02em;
  highlighter SVG behind text below baseline ending before descenders;
  masked spotlight fading all sides + 2.5% grain (no rect edge); ONE sans
  subhead; amber `Start your first mock →` + `4 full mocks` note + ghost
  `Browse past papers`; trust line exactly once above fold; TRY chips +
  mono resource line + duplicate badges removed (chips live in palette +
  TopicRail); 7/5 grid with live hero card (no-target: cream ruled exam-paper
  sample w/ red-pen tick; target: Your-path w/ crest, countdown, 20-min
  session, 3 coverage rings, Change target); mobile stacks, crest 2×2.
- **Crest strip (§5.11):** crest + name only, 4-col grid filling container,
  clickable to select/clear target (aria-pressed, aria-live), suburb/tags
  moved to cards only.
- **Four Doors (§5.12 + signature art):** inline SVG arches (3:5, rhythm
  100/92/100/92, 1.5px frames, crest wash 0→28%, floor spill screen blend,
  keystone monogram, serif name); hover intensifies one door (150ms);
  select swings leaf `rotateY(-35deg)` 600ms `cubic-bezier(0.2,0.8,0.2,1)`,
  others dim to 40%, page `--acc` shifts to crest colour, countdown slides
  with path card; keyboard `<button>`s, `aria-pressed`, live region;
  reduced-motion instant cross-fade. Cards: equal heights, check icon +
  `Your target` (not colour alone), selected `scale(1.02)`, no clipped pills.
  Eyebrow uses 2028 intake; no `2027 intake` copy.
- **Shell (§6):** sidebar IA Home/Study-hub top; PRACTICE (mocks,
  flashcards→/study, drills, writing, reading); LEARN (guides); LIBRARY
  (library, browse, PDF, subjects, providers); MORE expanded (request,
  about, what's-new, settings&backup→/study#backup); real 44px chevrons
  w/ `aria-expanded`, persisted; Home only solid highlight; Continue =
  subtle card w/ `cleanTitle()` (strips codes/underscores/extensions +
  override map), 2-line clamp, type badge, thin bar, full-title tooltip
  (honest: `last opened` not invented `p.4 of 12` — no Drive page memory).
  Topbar target chip `[crest] Name · Nd` / unset outline `Pick your target
  school` → scrolls home doors (no dead-end); Settings gear menu replaces
  `G` avatar (backup/restore, theme, change target, about); palette gets
  suggestion chips on focus + Decks group + platform-correct ⌘K/Ctrl+K.
  Mobile dock Home/Practice/Library/Progress w/ Lucide-stroke icons +
  active amber state.
- **Chrome:** slim 34px announcement + release strips (`×`, per-release
  persist, copy `New: back up and restore your progress. See what's new.`);
  footer 1px divider; routes code-split (`React.lazy` + Suspense, Home
  eager) — main gzip 282→187KB (under 250KB budget); storage validators
  (plain-JS zod-equivalent per D3) + `sanitize()` in migrate + seeded
  legacy test `scripts/storage.test.mjs` (8 checks pass).
- **Docs:** `DESIGN.md` rewritten to brief tokens, `docs/design-plan.md`
  (subject/audience/job/concept/tokens/anti-template + slop check),
  `AGENTS.md` references DESIGN.md.

## Libraries added: none

Framer-motion (door swing), cmdk (palette), Radix (menus/dialogs),
Lucide (1.5 stroke) already in tree. No PDF.js/Tiptap/KaTeX/Fuse/Virtual
this phase — each ships lazy behind its own route in Phases 3–5.

## Verification

- `npm run lint --prefix client` → 0 errors (warnings pre-existing patterns).
- `npm run build --prefix client` → ✓ 2454 modules, main 597KB/186KB gzip.
- `npm test` → 17/17; `assessment.test` → 13/13; `storage.test` → 8/8.
- Playwright/Lighthouse unavailable here — beauty gate ran as 3 code-review
  rounds w/ measurements (art-director notes in PROGRESS); screenshots +
  keyboard walkthrough owed w/ harness.

## Beauty-gate scorecard (final, 1–5)

hierarchy 5 · typography 5 · colour 5 · spacing 4 · alignment 5 · detail 5 ·
distinctiveness 5 · emotional pull 4 · mobile 4 · accessibility 4 → avg 4.6.
Ship: avg ≥4.5, nothing below 4 ✓. Deductions: spacing rhythm still tight
above fold (fold requirement vs H1 scale — documented adaptation
`clamp(2.6rem,4.8vw,4rem)`); mobile doors 2×2 (not swipe carousel);
font size-adjust fallbacks + full keyboard walkthrough owed.
Squint/greyscale/5-sec/template tests pass: amber CTA + doors + paper card
survive blur; not mistakable for SaaS.
