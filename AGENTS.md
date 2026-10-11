# AGENTS.md — SEHS Study

Design source of truth: `DESIGN.md`. All UI work must conform to it
(tokens, type, radius, motion, do/don't). Page plan: `docs/design-plan.md`.
Audit reality: `docs/AUDIT.md`. Decisions log: `docs/DECISIONS.md`.

Rules:
- Free forever, no account, local-first. Never lose user data —
  versioned storage (`client/src/lib/storage.js` schema v2) + migration +
  backup/restore. Validate persisted data at load, fail to defaults.
- Honest claims only. No admission guarantees, predicted ranks, fake
  percentiles, invented testimonials (flagged off). Readiness = coverage +
  accuracy, labelled.
- Stack: React 19 + Vite + Tailwind v4 + framer-motion + Radix. No framework
  migration. New deps only with changelog justification, lazy-loaded.
- Tokens as CSS vars, no hard-coded hex in components. Dark/light designed.
- Accessibility WCAG AA, keyboard-complete, reduced-motion, 44px targets,
  375–2560px, CLS 0. Lighthouse a11y ≥ 95.
- One primary action per card: Open / Start / Review.
- No component touches localStorage directly for learner data (use repo/store).
