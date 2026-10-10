import { openDb } from '../server/db.mjs';
const db = openDb();
const rows = db.prepare("SELECT data, created_at FROM events WHERE type = 'ai' ORDER BY id DESC LIMIT 12").all();
for (const r of rows) console.log(r.created_at.slice(11, 19), r.data);
db.close();
