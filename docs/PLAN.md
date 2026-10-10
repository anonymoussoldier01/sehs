# Plan — premium selective-entry prep platform

Run mode: FULL (autonomous; blanks discovered by audit). Time budget: single extended run; protect priorities in §5 order if cut short.
Branch: `feat/premium-redesign` (never force-push; never touch `main`).

## Inputs discovered by audit (blanks filled)
- Site name / tone: **SEHS Study** — premium, calm, confident, trustworthy. Australian English throughout.
- Brand colours: none supplied → default palette (Phase 1 / DESIGN.md), tokens in OKLCH.
- Target students: Year 8 students sitting Year 9 selective entry in Victoria (ACER exam).
- Stack: Node ≥22 plain-`http` server (`server.mjs`); SQLite via `node:sqlite` locally, Postgres via `DATABASE_URL` in prod; React 19 + Vite + Tailwind v4 + framer-motion + Radix (shadcn-style) client in `client/`; no TypeScript; npm; Node host with persistent disk (VPS/Render/Fly/Railway).
- Data source: `data/links.json` (seed, server-side only) → SQLite `resources` table via `scripts/migrate.mjs`. 1,641 records. Clients never receive raw storage URLs or folder IDs (grant-token gateway `/open/:token`, `/embed/:token`).
- Drive redistribution rights: **unsure / mixed** — all 1,641 URLs are `drive.google.com` links; no licence field per record. Treat as unlicensed third-party material: never re-host, preview via Drive embed, attribute source, provide report/request-removal flow, list in final report.
- Auth today: no user accounts; single admin password → per-tab bearer token (sessionStorage, 12h). All persistence is local-first (localStorage/cookies).
- Live with real users: unknown (no analytics available to this run) → assume yes; additive, reversible changes only.
- Design references: Linear / Vercel / Stripe craft + Readwise Reader / Notion reading polish (study the craft, do not copy).
- Run mode: FULL. GATED stops skipped (no reviewer available); gates recorded in PROGRESS.md instead.

## Phase status
- [x] Phase 0 — audit + baseline (this run). Records: 1,641 before (links.json + SQLite agree).
- [ ] Phase 1 — design direction (DESIGN.md + tokens + `/design` style guide).
- [ ] Phase 2 — UI craft standards on every key screen.
- [ ] Phase 3 — motion system (MOTION.md + shared motion layer + profiles).
- [ ] Phase 4 — library + viewer (search kept; answer-key links; import/enrich/validate-urls scripts; branded viewer as default open path with compliant Drive-embed fallback).
- [ ] Phase 5 — assessment engine (`client/src/lib/assessment.js`, Zod-style validation in plain JS, unit tests, timer on absolute timestamps, accommodations, deterministic seeds, labelled sample seed).
- [ ] Phase 6 — EXAM_FORMAT.md (ACER-official) + 5–8 original study guides with fixed structure + verification pipeline.
- [ ] Phase 7 — dashboard/retention (repository interface, review queue, export/delete, first-run, no fake data).
- [ ] Phase 8 — pages/nav/trust/SEO/security/perf/error logging.
- [ ] Phase 9 — visual + motion QA (nit unavailable → Playwright/manual fallback, honest report).
- [ ] Phase 10 — verification + adversarial review + final report.

## Priority guard (if time/context runs short)
1. Library (1,641 records preserved) → 2. PDF viewer → 3. Assessment scoring correctness → 4. Design system applied everywhere → 5. Dashboard persisted → 6. 5–8 guides → 7. Stretch (admin curation, offline guides, print).
