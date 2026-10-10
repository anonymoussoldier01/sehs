import { openDatabase } from '../server/db.mjs';
try {
  const db = await openDatabase();
  console.log('db kind:', db.kind);
  const r = db.prepare('SELECT COUNT(*) AS n FROM resources WHERE visibility = 1').get();
  console.log('typeof get():', typeof r, r instanceof Promise ? 'PROMISE' : 'value=' + JSON.stringify(r));
  const row = await db.prepare('SELECT COUNT(*) AS n FROM resources WHERE visibility = 1').get();
  console.log('awaited:', JSON.stringify(row));
  await db.close();
} catch (e) { console.error('ERROR:', e.message); console.error(e.stack.split('\n').slice(0, 5).join('\n')); }
