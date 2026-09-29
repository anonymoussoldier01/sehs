# SEHS Study Directory — secure study-resource platform

Searchable directory of SEHS selective-entry study resources with password-gated
access tiers, per-session Terms acceptance, and an admin console. Zero dependencies
(plain Node 22+ with `node:sqlite`), no build step, no client-side secrets.

Live dataset: 1,641 resources (seeded from `data/links.json`, served from SQLite —
clients never receive raw storage URLs or folder IDs).

## Project structure

```
server.mjs                  # platform server: pages + JSON API + access gateway
server/db.mjs               # SQLite schema + open helpers (node:sqlite)
server/crypto.mjs           # scrypt passwords, sessions, rate limits, lockouts
server/content.mjs          # tier-aware index + strict public serializers
server/templates.mjs        # shared SSR layout + components (escaped)
server/pages.mjs            # /, /search, /r/:id, /subjects, /providers, /about, /unlock, /saved
server/admin.mjs            # admin API + dashboard/resources/audit/settings pages
search.js                   # local relevance engine (shared browser + server)
theme.js gate.js open.js    # client: theme, consent/terms gates, grant open flow
ux.js suggest.js            # client: bookmarks/density/recents, autocomplete
search-page.js record.js unlock.js admin.js  # page-specific clients
scripts/migrate.mjs         # links.json → SQLite (new 128-bit public IDs)
scripts/smoke.mjs           # npm test: dataset + engine + wiring checks
source-data/                # original Drive inputs + expansion output
scripts/expand-drive.mjs …  # ingestion pipeline (unchanged, see below)
data/links.json             # seed dataset (server-side only, never shipped to clients)
data/app.db*                # runtime DB (gitignored — holds password hashes + sessions)
state/id-map.json           # old→new ID map (gitignored, server-only)
```

## Quick start

```powershell
cd C:\sehs
npm install   # no deps; Node >= 22 required (node:sqlite)

# First run only: build the database (generates viewer+admin passwords once,
# or set SEHS_VIEWER_PASSWORD / SEHS_ADMIN_PASSWORD beforehand)
$env:SEHS_VIEWER_PASSWORD="..."   # optional; omit to auto-generate
$env:SEHS_ADMIN_PASSWORD="..."
node scripts/migrate.mjs [--reset]

npm run server   # http://localhost:8080
```

Open `http://localhost:8080`, accept cookies, search, open `/unlock` for the
member/admin areas. Re-running `migrate.mjs` without `--reset` keeps passwords.

## Routes

- `/`, `/search?q=&cat=&provider=&type=&year=&sort=&page=&per=&view=`, `/r/:id`
- `/subjects`, `/providers`, `/about`, `/unlock`, `/saved` (local bookmarks)
- `/api/search`, `/api/suggest`, `/api/by-ids`, `/api/session`, `/api/stats`
- `/api/unlock`, `/api/logout`, `/api/consent`, `/api/terms`, `/api/terms/accept`
- `/api/access/:id` → `{openUrl: /open/:token}` → single-use grant → 302
- `/admin`, `/admin/resources`, `/admin/audit`, `/admin/settings` + `/api/admin/*`

## Security model (summary)

- Two generated passwords (viewer/admin), `scrypt` hashes + salts, `timingSafeEqual`.
- HTTPOnly/Secure/SameSite=Lax sessions (viewer 7d, admin 12h); server checks on
  every privileged request; uniform 404s (no enumeration oracle).
- Unlock rate-limited + escalating lockouts; CSRF header on API mutations; 100KB
  payload caps; security headers incl. same-origin CSP.
- Cookie hard block + per-session Terms gate, both enforced server-side on
  unlock/access — not just hidden UI.
- Members-only rows fully omitted from anonymous responses (search, pages,
  suggestions, hydration). Rotation revokes role sessions.
- Analytics: hashed IPs, 30-day raw auto-purge (configurable), aggregates kept.
- Never commit: `.env`, `data/app.db*`, `state/`. No secrets in responses/bundles.

## Validate & test

```powershell
npm run validate   # dataset schema checks
npm test           # 17 smoke checks (dataset + engine + wiring)
```

## Ingestion (unchanged legacy pipeline)

```powershell
npm run ingest:local   # expand → fetch → enrich → build data/links.json
```

After re-ingestion, re-run `node scripts/migrate.mjs --reset` (passwords preserved
only without `--reset`; with `--reset`, set env passwords again). Drive API notes:
the build-time key supplied earlier is Drive-only (project `1069633021613`);
Gemini enrichment needs Generative Language API enabled. Never commit keys.

## Deploy notes

Needs a Node host with persistent disk (VPS / Render / Fly / Railway) — GitHub
Pages cannot host the backend. Set `PORT`, `APP_SECURE=1` (behind TLS),
`APP_DB` (optional path), SMTP later for email (not yet wired). Reverse-proxy
should forward real client IPs (`X-Forwarded-For` is honoured for rate limits).
