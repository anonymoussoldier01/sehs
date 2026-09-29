# SEHS Study Directory — Link/Data Directory

Vanilla static searchable directory built from Google Drive folders. Dataset is generated locally and embedded as static JSON — the deployed site makes **zero** Gemini/API calls.

Live data: `data/links.json` (1,641 records) + `data/categories.json`. Open `index.html` or `npm run serve`.

## Project structure

```
source-data/drive-folders.txt   # 1. SOURCE: 11 supplied Drive URLs
source-data/drive-files.json    # expanded file listing (generated)
source-data/urls.txt            # deduped URLs (generated)
scripts/expand-drive.mjs        # 2a. INGESTION: recurse Drive folders via Drive API
scripts/fetch-meta.mjs          # 2b. HTTP reachability + title/meta/OG/JSON-LD
scripts/enrich-gemini.mjs       # 2c. Gemini classification/summary (needs Generative Language API)
scripts/enrich-local.mjs        # 2c-alt. No-key heuristic enrichment from Drive filenames
scripts/build-data.mjs          # 3. GENERATED: data/links.json + data/categories.json
scripts/validate.mjs            # checks duplicates, URLs, schema
scripts/ingest.mjs              # orchestrator with --initial/--update/--refresh/--retry-failed
state/fetch.json, state/enriched.json  # checkpoints for resume (not committed)
index.html, styles.css, app.js, search.js  # 4. FRONTEND: relevance search engine + filters/sort/paginate/discovery
data/                           # committed production dataset
```

## Install

```powershell
cd C:\sehs
npm install   # no deps currently; Node >= 18 required
```

## API keys (important)

- The key supplied during build (`AIza...`, project `1069633021613`) is a **Drive API key**, not Gemini-enabled. Drive expansion works; Gemini returns `403 generativelanguage.googleapis.com ... PERMISSION_DENIED / API_KEY_SERVICE_BLOCKED`.
- To enable AI summaries: enable **Generative Language API** in that GCP project, or create a Gemini key in Google AI Studio, then rotate the old key (it was exposed in chat).
- Never commit keys. Ingestion reads env only:

```powershell
$env:GEMINI_API_KEY="YOUR_NEW_GEMINI_KEY"
$env:DRIVE_API_KEY=$env:GEMINI_API_KEY   # or a separate Drive key
$env:GEMINI_MODEL="gemini-2.0-flash"
```

`.env` is gitignored; see `.env.example`.

## Run ingestion

```powershell
# Full local pipeline (no Gemini needed) — what built the current dataset:
npm run ingest:local

# Full Gemini pipeline (needs Generative Language API enabled):
npm run expand
npm run fetch
npm run enrich -- --limit=50        # test batch
npm run enrich                      # all remaining (checkpointed)
npm run build:data
npm run validate

# Or orchestrated:
npm run ingest -- --update          # default: only new URLs
npm run ingest -- --initial         # reprocess all
npm run ingest -- --refresh         # refresh stale (>30d) + new
npm run ingest -- --retry-failed    # retry Gemini failures only
```

What each step logs (no secrets in logs): total, expanded, success, gemini failures, inaccessible, duplicates, redirects, invalid, remaining → `logs/*-summary.json`.

## Update dataset

- Add URLs to `source-data/drive-folders.txt`, run `npm run ingest -- --update`.
- Refresh AI summaries after enabling Gemini: `$env:GEMINI_API_KEY="..."; node scripts/enrich-gemini.mjs --refresh; npm run build:data`.

## Validate

```powershell
npm run validate
# checks: invalid URLs, duplicate id/url, bad confidence/status/date, placeholder text
```

## Build / deploy (GitHub Pages)

Site is fully static — no build step.

```powershell
npm run serve   # http://localhost:8080
```

Deploy:
1. `git init; git add .; git commit -m "link directory"; gh repo create --public --source=. --push`
2. Repo Settings → Pages → Deploy from branch → `main` / `(root)`.
3. Ensure `data/links.json` is committed; `.env`, `state/`, `node_modules/`, `logs/*.log` stay ignored.

## Where data lives

- Generated + committed: `data/links.json`, `data/categories.json`
- Raw: `source-data/drive-files.json`
- Checkpoints (gitignored): `state/fetch.json`, `state/enriched.json`

Each record keeps `url` (original), `driveId/driveName`, `status` (`active/redirected/unavailable/timeout/blocked/unknown`), `metadataSource` (`extracted+heuristic` vs `gemini` vs `fallback`), `confidence`, `lastChecked`. Failed URLs are never deleted.
