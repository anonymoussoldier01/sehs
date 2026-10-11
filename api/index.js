// Vercel serverless entry: reuses the long-lived server's request handler.
// Static routes (/, SPA pages, /assets/*) are served from `client/dist` by
// Vercel's CDN (see vercel.json); only /api/*, /open/*, /embed/*, /feed.xml
// and /admin* reach this function. Requires DATABASE_URL (Supabase/Postgres)
// because serverless filesystems are read-only — SQLite can't persist there.
// First boot against an empty DB also needs SEHS_ADMIN_PASSWORD (see
// server.mjs ensureSeeded). Warm starts reuse the module-level index cache.
import { handleRequest } from '../server.mjs';

export default function handler(req, res) {
  return handleRequest(req, res);
}
