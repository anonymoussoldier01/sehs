import { sleep } from './store.mjs';
import { log } from './log.mjs';

// Calls Gemini generateContent with retries + backoff. Returns parsed JSON or throws.
export async function geminiJson({ apiKey, model, prompt, maxRetries = 4, timeoutMs = 60000 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let lastErr = '';
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' },
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
      });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) {
        lastErr = `gemini-http-${res.status}`;
        const wait = Math.min(15000, 1000 * 2 ** attempt);
        log('warn', `Gemini ${res.status}, retry ${attempt}/${maxRetries} in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`gemini-http-${res.status}: ${txt.slice(0, 500)}`);
      }
      const j = await res.json();
      const text = j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      if (!text) throw new Error('gemini-empty-response');
      // strip code fences if present
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        return JSON.parse(cleaned);
      } catch (e) {
        // try to extract first {...} block
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) return JSON.parse(m[0]);
        throw new Error(`gemini-bad-json: ${cleaned.slice(0, 300)}`);
      }
    } catch (e) {
      clearTimeout(t);
      lastErr = String(e?.message || e);
      if (/abort/i.test(lastErr)) lastErr = 'gemini-timeout';
      if (attempt < maxRetries && /429|5\d\d|timeout|network|fetch failed/i.test(lastErr)) {
        const wait = Math.min(15000, 1000 * 2 ** attempt);
        log('warn', `Gemini error (${lastErr}), retry ${attempt}/${maxRetries} in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw new Error(lastErr);
    }
  }
  throw new Error(lastErr || 'gemini-failed');
}

export function buildEnrichPrompt({ url, driveName, mimeType, fetched }) {
  const f = fetched || {};
  const evidence = {
    url,
    driveName: driveName || undefined,
    mimeType: mimeType || undefined,
    pageTitle: f.pageTitle || undefined,
    metaDescription: f.metaDescription || undefined,
    ogTitle: f.ogTitle || undefined,
    ogDescription: f.ogDescription || undefined,
    ogSiteName: f.ogSiteName || undefined,
    author: f.author || undefined,
    datePublished: f.datePublished || undefined,
    keywords: f.keywords || undefined,
    canonical: f.canonical || f.finalUrl || undefined,
    lang: f.lang || undefined,
    jsonLdSummary: f.jsonLd ? JSON.stringify(f.jsonLd).slice(0, 2000) : undefined
  };
  return `You enrich a link-directory record. Ground ONLY in the evidence below. Never invent titles, authors, dates, or site names.
Distinguish explicit (directly in evidence) vs inferred (reasonable from filename/domain) vs unknown (omit field).

EVIDENCE JSON:
${JSON.stringify(evidence, null, 2)}

Return STRICT JSON only, no markdown, with exactly these keys (omit unknown instead of guessing):
{
  "title": "short human title, prefer pageTitle/ogTitle/driveName cleaned",
  "description": "1-2 sentence factual description",
  "summary": "one-line summary for cards",
  "category": "one of: exam-prep, maths, english, reading, writing, verbal-reasoning, numerical-reasoning, quantitative, past-paper, practice-test, study-guide, reference, tutorial, tool, document, other (never use folder)",
  "subcategory": "free text, e.g. VSSE, selective-entry",
  "tags": ["max 8, lowercase-hyphen"],
  "subjects": ["topics"],
  "contentType": "e.g. pdf, docx, image, archive, webpage, video, spreadsheet (never folder)",
  "audience": "e.g. students, parents, tutors",
  "difficulty": "e.g. beginner, intermediate, advanced (omit if N/A)",
  "technology": "e.g. google-drive, pdf",
  "siteName": "organisation/site, explicit only",
  "creator": "author/owner, explicit only",
  "language": "e.g. en",
  "keywords": ["max 8"],
  "confidence": 0.0-1.0,
  "evidenceLevel": "explicit|inferred|fallback"
}`;
}
