// Publish Terms & Conditions v2 (additive, reversible).
// Inserts the v2 row (ON CONFLICT DO NOTHING) and points terms_version at 2.
// Revert: set terms_version back to '1' (v1 row is untouched).
// Usage: node scripts/terms-v2.mjs
import { openDatabase, setMeta } from '../server/db.mjs';

const SUMMARY = `Independent study site. Materials belong to their owners — personal study use only, never redistribute. Practice content is unofficial: no score predictions, no guaranteed outcomes. Access events are logged for security; raw analytics auto-delete after 30 days. If you are under 18, use this site with a parent or guardian. See the full terms before continuing.`;

const BODY = `# Terms & Conditions — SEHS Study (v2)

**Last updated:** 2026-10-10. These terms were written for students and families to actually read. If any part is unclear, ask a parent, guardian or teacher before continuing.

## 1. Who we are, and agreement to these terms
SEHS Study is an **independent** study resource for Victorian selective-entry preparation. We are **not affiliated with, endorsed by, or connected to** the Victorian Department of Education, ACER, any selective entry high school, or any publisher or provider whose materials appear in the index. By using study features on this site (opening resources, mocks, flashcards, writing tools), you agree to these terms. The current version is always shown before you accept; continued use after an update constitutes acceptance of the new version.

## 2. Who this site is for
The site is designed for Year 8 students preparing for Year 9 selective entry in Victoria, and the adults supporting them. **If you are under 18, please use this site with a parent or guardian**, and let them read these terms and the Privacy page with you.

## 3. What the site is — and is not
We provide an index of study resources plus original practice tools (flashcards, timed mocks, drills, guides, writing prompts). We **link to** third-party files; we do not host them and do not claim ownership of them. Nothing here is official exam material. Practice questions, scores, feedback and study plans are **practice aids only**: they are not marking, not predictions of exam results, and not a promise of selection or any outcome.

## 4. Acceptable use
Use the site for personal study only. You must not: scrape or bulk-download the collection; attempt to bypass access controls, rate limits or the grant system; share admin credentials; upload unlawful content via reports or requests; or use the site in a way that harms other users or breaks the law. Automated access that degrades the service may result in loss of access.

## 5. Copyright and intellectual property
All resource titles, files and provider materials remain the property of their respective owners. Our index records (titles, descriptions, tags) are our own summaries for search.
- **For students:** you may read and download copies for your own study. You must **not** re-upload, re-share, republish, sell or distribute these materials or their links, in whole or in part, on any platform.
- **For rights holders:** if you own material listed here and want it corrected, attributed differently, or removed, use the **Report issue** button on the resource or the **Request** page and include (a) what you own, (b) which listing it concerns, and (c) what you would like done. We review reports through the admin triage queue and act on valid requests, including removal. Accounts that repeatedly disregard rights may lose access.
- We do not copy proprietary question banks and do not present any question as official. Original questions are labelled \`verified\` (method and date recorded) or \`draft\`.

## 6. Privacy
We collect the minimum needed to run the site: access events (resource, time, outcome), rate-limit and security signals (IP addresses are hashed, never stored raw), and anonymous aggregate counts. Raw analytics auto-delete after 30 days. Your library, notes, decks and progress live **in your own browser** (cookies and local storage) unless you export them — clearing site data removes them. There are no accounts, no third-party advertising, and no third-party tracking scripts. See the Privacy page for detail.

## 7. AI-assisted features
Tutors, graders, planners and generated questions are automated aids. They can be wrong. Writing feedback is **practice feedback, not official marking**. Do not rely on AI output for decisions about applications or study pathways. We do not log the content of your AI prompts — only aggregate mode and length counts used to guard shared quotas.

## 8. Accuracy and availability
Study content may contain errors despite review. Linked files live on third-party services and may move, break, change, or refuse embedding. Resources are provided **as-is**, without any guarantee of availability, accuracy, or fitness for any purpose.

## 9. Liability
To the maximum extent permitted by law, we are not liable for loss arising from use of the site, linked files, or reliance on practice content. Nothing in these terms excludes, restricts or modifies any right you have under the **Australian Consumer Law** (or any other law) that cannot be excluded, restricted or modified by agreement.

## 10. Changes to these terms
We may update these terms (for example, when features change). The version number and date appear at the top and are shown before you accept. Material changes will bump the version and ask for acceptance again.

## 11. Contact
For copyright or takedown matters, use the Report issue button or Request page (fastest, goes to the triage queue). For anything else, contact the site operator through the same channels.

## 12. Governing law
These terms are governed by the laws of Victoria, Australia.
`;

const db = await openDatabase();
await db.prepare(`INSERT INTO terms(version, body_md, summary_md, created_at, created_by)
  VALUES (2, ?, ?, ?, 'terms-v2-script') ON CONFLICT(version) DO NOTHING`).run(BODY, SUMMARY, new Date().toISOString());
await setMeta(db, 'terms_version', '2');
const row = await db.prepare('SELECT version FROM terms WHERE version = 2').get();
const meta = await db.prepare("SELECT value FROM meta WHERE key = 'terms_version'").get();
console.log('terms v2 published:', !!row, '| terms_version =', meta && meta.value);
await db.close?.();
