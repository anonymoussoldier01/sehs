# SEHS Study Directory — secure study-resource platform

Searchable collection of selective-entry study resources with a smart local
search engine, study tools, and an admin console. Server is dependency-light
(plain Node 22+ with `node:sqlite`); the React client builds with Vite +
Tailwind. No accounts required — open to anyone studying.

Live dataset: 1,641 resources served from SQLite — clients never receive raw
storage URLs or folder IDs.

## What it does

- **Smart search** (`search.js`, zero-dep): BM25-lite rarity scoring, typo-ranked
  fuzzy matching, last-term prefix, `field:value` syntax, drop-one-token gating,
  concept expansion (`algebra` → maths), TF-IDF related resources, synonyms,
  on-device interest tuning with visible reset, command palette (`Cmd/Ctrl+K`).
- **Study hub** (`/study`): auto-generated flashcard decks (provider / subject /
  practice recognition), admin-authored decks, personal decks (import/export),
  Flashcards + Learn (Leitner) + Test (timed mock) modes, exam countdown,
  day streaks, mastered counts — all on-device.
- **Library**: bookmarks, named studylists with shareable encoded links
  (`/list/…`), saved hub, recently viewed, print packs, RSS (`/feed.xml`).
- **Community queues**: anonymous broken-link reports + resource requests flow
  into an admin triage queue (rate-limited, IP-hashed).
- **Admin** (`/admin`, single password): dashboard with charts, resource CRUD +
  bulk import, decks manager, triage, audit log + sessions, announcements,
  Terms publishing, retention + purge, DB backup, health check.
- **Privacy**: no accounts, no third-party ads. Cookies + local storage
  remember the visitor's theme, library, decks and progress. Raw analytics
  auto-purge after 30 days (configurable). Admin auth is a per-tab bearer token.

## Frontend (React + Vite + Tailwind)

```
client/                     # Vite + React 19 + Tailwind v4 + framer-motion
client/src/pages/           # routed pages (Home, Search, Resource, Study…)
client/src/components/      # shell (sidebar/topbar/palette) + magic effects
client/src/lib/             # API client + browser-storage state
client/dist/                # production build (gitignored, built by npm start)
```

```powershell
npm run build:client   # install + production build into client/dist
npm run client:dev     # Vite dev server (:5173, proxies /api + /open to :8080)
npm start              # build client + migrate + seed + serve (http://localhost:8080)
```

`server.mjs` serves `client/dist` for all app routes (with SPA fallback) once
built; `/api/*`, `/open/*` and `/admin*` always stay on the server. If `dist`
is missing, the server falls back to the legacy server-rendered pages.

## Project structure

```
server.mjs                  # platform server: API + access gateway + static/SPA host
client/                     # React + Vite + Tailwind frontend (see Frontend above)
server/db.mjs               # SQLite schema (auto-migrates on boot)
server/crypto.mjs           # scrypt passwords, tokens, rate limits, lockouts
server/content.mjs          # search index + strict public serializers
server/templates.mjs        # shared SSR layout + components (escaped)
server/pages.mjs            # /, /search, /r/:id, /study, /saved, /list, taxonomy…
server/decks.mjs            # auto-deck generation from the collection
server/admin.mjs            # admin API + dashboard/resources/triage/audit/settings
search.js                   # relevance engine (browser + server + tests)
theme.js gate.js open.js    # theme, per-tab Terms gate, grant open flow
ux.js suggest.js profile.js palette.js  # QoL, autocomplete, tuning, palette
study.js lists.js request.js admin.js unlock.js  # page clients
scripts/migrate.mjs         # links.json → SQLite (new 128-bit public IDs)
scripts/relevance.mjs       # graded relevance fixture (42 checks)
scripts/smoke.mjs           # dataset + engine + wiring checks (17 checks)
source-data/                # original Drive inputs + expansion output
scripts/expand-drive.mjs …  # ingestion pipeline (unchanged, see below)
data/links.json             # seed dataset (server-side only, never shipped)
data/app.db*                # runtime DB (gitignored — password hashes + sessions)
state/id-map.json           # old→new ID map (gitignored, server-only)
```

## Quick start

```powershell
cd C:\sehs
npm install   # server deps; Node >= 22 required (node:sqlite)

# First run only: build the database (generates the admin password once,
# or set SEHS_ADMIN_PASSWORD beforehand)
$env:SEHS_ADMIN_PASSWORD="..."
node scripts/migrate.mjs [--reset]

npm start      # builds the React client + serves http://localhost:8080
```

Open `http://localhost:8080`, search, open `/unlock` for admin. Re-running
`migrate.mjs` without `--reset` keeps the admin password.

Terms & Conditions are versioned in the `terms` table. After migrating a fresh
database, publish the current version:

```powershell
node scripts/terms-v2.mjs   # additive; revert by setting terms_version back to '1'
```

## Routes

- `/`, `/search?q=&cat=&provider=&type=&year=&sort=&page=&per=&view=&aff=`,
  `/r/:id`, `/study`, `/study/:deck`, `/saved`, `/list/:code`
- `/subjects`, `/providers`, `/about`, `/unlock`, `/request`, `/feed.xml`
- `/api/search`, `/api/suggest`, `/api/by-ids`, `/api/decks`, `/api/trending`,
  `/api/new`, `/api/announcement`, `/api/me`, `/api/stats`
- `/api/unlock`, `/api/logout`, `/api/terms`, `/api/access/:id` → `/open/:token`
- `/api/ai/chat` (free AI tutor via Pollinations anonymous tier — no key; per-IP + shared throttles, prompts never logged)
- `/api/ai/grade` (writing band + auto-checks), `/api/ai/questions` (validated MCQ sets), `/api/ai/flashcards` (topic → cards), `/api/ai/passage` (reading passage + Qs), `/api/ai/prompt` (writing prompts), `/api/ai/plan` (study plan from local stats), `/api/ai/variants` (fresh variants of misses)
- `/api/reports`, `/api/requests`
- `/admin`, `/admin/resources`, `/admin/triage`, `/admin/audit`,
  `/admin/settings` + `/api/admin/*` (bearer-gated, uniform 404 otherwise)

## Security model (summary)

- Single generated admin password, `scrypt` hash + salt, `timingSafeEqual`.
- Per-tab bearer token (`Authorization` header, sessionStorage); admin actions
  never rely on ambient credentials, so CSRF is impossible by construction
  (header check retained).
- Server checks on every privileged request; uniform 404s (no oracle).
- Unlock rate-limited + escalating lockouts; 100KB payload caps (500KB bulk);
  security headers incl. same-origin CSP (no inline scripts anywhere).
- Single-use 15-min grant tokens for opens; all opens logged.
- Members tier removed: everything public, admin gate is the only lock.
- Never commit: `.env`, `data/app.db*`, `state/`. No secrets in responses/bundles.

## Validate & test

```powershell
npm run validate    # dataset schema checks
npm test            # 17 smoke checks
npm run relevance   # 42 graded relevance checks (gates ranking changes)
node scripts/assessment.test.mjs  # 13 assessment-engine checks (scoring, timer, seeds, review queue)
node scripts/answer-links.mjs     # answer-key candidates report (records unchanged)
node scripts/validate-urls.mjs            # dry run (all unchecked)
node scripts/validate-urls.mjs --live     # rate-limited live check (default first 50; --all for full)
```

## Adding practice questions

Native banks live in `data/native/*.json`. Each question follows the schema in
`client/src/lib/assessment.js` (`validateQuestion`): `id`, `type`
(`single` | `numeric` | `passage` | `visual` | `writing`), `stem`, `options` +
`answer` index (choice types) or numeric `answer` + `tolerance`, `explanation`,
strand tags, `verification` (`draft` until it passes the pipeline in
`docs/PLAN.md` Phase 6: author → independently re-solve → one-defensible-answer
check → wording review → record method + date). Never copy proprietary banks or
imply a question is official. Run `node scripts/assessment.test.mjs` after edits.

## Ingestion (unchanged legacy pipeline)

```powershell
npm run ingest:local   # expand → fetch → enrich → build data/links.json
```

After re-ingestion, re-run `node scripts/migrate.mjs --reset` (set the admin
password env again — `--reset` rebuilds credentials). Drive API notes: the
build-time key supplied earlier is Drive-only (project `1069633021613`);
Gemini enrichment needs Generative Language API enabled. Never commit keys.

## Deploy notes

Needs a Node host with persistent disk (VPS / Render / Fly / Railway) — GitHub
Pages cannot host the backend. Set `PORT`, `APP_SECURE=1` (behind TLS),
`APP_DB` (optional path). Reverse-proxy should forward real client IPs
(`X-Forwarded-For` is honoured for rate limits).
