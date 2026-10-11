# Landing teardown — Linear, Stripe, Vercel, Duolingo, Khan Academy

Study of structure and craft only. No copy of brand copy, assets, layouts pixel-for-pixel, or code.
Date: Oct 2026. Purpose: derive 10 rules for SEHS Study home.

## 1. Linear
- Nav: 64px sticky, logo left, centre links (Product, Resources, Pricing…), right ghost Sign in + primary CTA. Blurs on scroll, 1px hairline.
- Hero: two-column (text 6 / visual 6), eyebrow pill, H1 2 lines max (~clamp 3-4.5rem, tight tracking), one-sentence subhead, ONE primary + ghost. Product UI visible in hero (app screenshot, live).
- Section order: hero → proof logos → features (alternating rows) → how → quotes → pricing/CTA → footer.
- CTAs: max one primary per section/viewport. Ghost secondaries.
- Spacing: 96-128px section padding desktop, 1200px container, 12-col grid, subtle alt backgrounds.
- Proof: quiet logo/number row directly under hero, tabular figures, no animation beyond count.
- Footer: 4-5 columns + disclaimer + status + socials.
- Motion: one signature moment (hero load), 150ms hovers, reduced-motion safe. No scroll fade-up everywhere.

## 2. Stripe
- Nav: same 64px pattern, docs-first centre links, theme-aware.
- Hero: left-anchored, H1 serif/sans mix, subhead 18-20px max 46ch, code/API preview as visual (real product, not stock).
- Sections answer ONE question each. Generous whitespace, slides read separately via subtle bg shift.
- Proof: press logos + stats row, quiet.
- Footer: dense 4-col, legal + sources + contact, honest disclaimers.
- Motion: restrained, hover states only.

## 3. Vercel
- Nav: minimal, logo + product links + GitHub + CTA.
- Hero: centred or split, huge H1 (5.5vw), mono labels, product deploy preview.
- Proof: customer logos in greyscale, single row.
- Features: bento + alternating rows, live code previews in window frames.
- Footer: 4-col + status + legal.
- Motion: fast micro-interactions, no glow >12px.

## 4. Duolingo
- Hero: playful but ONE message, ONE CTA, mascot/product visual, ticks (free, no account).
- Proof: streaks/counts, social proof behind flag (never invented).
- Steps: 3 steps with real UI previews.
- For students/parents split: two cards side by side, specific, no puffery.
- Footer: learn + company + legal, language selector.
- Motion: one signature (owl/door), gentle load, reduced-motion respected.

## 5. Khan Academy
- Nav: subjects left, search centre, donate/login right.
- Hero: "For every student…" + subhead + CTA, classroom visual.
- Proof: district results, sourced + dated.
- How: 3 steps, teacher/parent/student tabs.
- Trust: students vs parents vs teachers cards, honest, no guarantees.
- FAQ + final CTA band, 4-col footer with disclaimer.

## 10 rules for SEHS Study
1. Top nav 64px sticky + blur + 1px border; no sidebar on "/". Logo S + "SEHS Study".
2. Hero max 640px at 1920x1080, 12-col text 6 / visual 6. Product (live sample question on paper) is the visual.
3. ONE primary CTA per section/viewport (ivory/ink), secondary = ghost 1px border. Never coloured fill.
4. H1 max 2 lines, nowrap per sentence. Subhead one sentence 18-20px max 46ch. Eyebrow pill secondary + 6px accent dot.
5. Proof strip directly under hero: real stats tabular + four crests greyscale "Prepare for". One-time count only.
6. Four Doors is the centrepiece: 4 equal neutral cards, mono crests, single-palette SVG doors, one signature open motion, confirmation chip + "Go to study hub".
7. Sections answer ONE question, 96px apart desktop, alt bg subtly. Feature previews are live components in window frames, not stock.
8. Trust: students vs parents cards, founder note real-only, testimonials flagged off, footer 4-col + "Not affiliated…" + sources/last-checked.
9. Colour rare: 90% neutrals, sky accent only for links/focus/selection/progress/small icons. Success/error only in quiz feedback with icon+label.
10. Motion restraint: one door moment + gentle hero load, 150ms hovers, prefers-reduced-motion safe. LCP <2.5s, CLS 0, a11y ≥95.
