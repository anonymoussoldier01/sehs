import { sleep } from './store.mjs';

// Fetch page, extract title/meta/OG/JSON-LD/canonical/favicon. Never throws fatally.
export async function fetchPageMeta(url, { timeoutMs = 15000 } = {}) {
  const started = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let status = 'unknown';
  let finalUrl = url;
  let html = '';
  let httpStatus = 0;
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkDirectoryBot/1.0; +https://example.com)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    httpStatus = res.status;
    finalUrl = res.url || url;
    if (finalUrl !== url) status = 'redirected';
    else if (res.ok) status = 'active';
    else if (res.status === 404 || res.status === 410) status = 'unavailable';
    else if (res.status === 403 || res.status === 401) status = 'blocked';
    else status = 'unavailable';
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('html')) {
      html = await res.text();
      html = html.slice(0, 500_000); // cap
    } else if (res.ok) {
      status = 'active';
    }
  } catch (e) {
    const m = String(e?.message || e);
    if (/abort/i.test(m)) status = 'timeout';
    else if (/ENOTFOUND|EAI_AGAIN/i.test(m)) status = 'unavailable';
    else status = 'unknown';
    return { url, finalUrl: url, status, httpStatus, error: m.slice(0, 300), ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
  const meta = parseHtmlMeta(html, url);
  return { url, finalUrl, status: html ? 'active' : status, httpStatus, ms: Date.now() - started, ...meta };
}

export function parseHtmlMeta(html, baseUrl) {
  if (!html) return {};
  const out = {};
  const pick = (re) => { const m = html.match(re); return m ? decodeEnt(m[1].trim()).slice(0, 500) : undefined; };
  out.pageTitle = pick(/<title[^>]*>([\s\S]{1,300})<\/title>/i);
  out.metaDescription = pick(/<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]{1,500})["']/i)
    || pick(/<meta[^>]+content=["']([\s\S]{1,500})["'][^>]*name=["']description["']/i);
  const og = (prop) => pick(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([\\s\\S]{1,500})["']`, 'i'))
    || pick(new RegExp(`<meta[^>]+content=["']([\\s\\S]{1,500})["'][^>]*property=["']${prop}["']`, 'i'));
  out.ogTitle = og('og:title');
  out.ogDescription = og('og:description');
  out.ogImage = og('og:image');
  out.ogSiteName = og('og:site_name');
  out.canonical = pick(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  out.favicon = pick(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
  out.lang = pick(/<html[^>]+lang=["']([^"']+)["']/i);
  out.author = pick(/<meta[^>]+name=["']author["'][^>]*content=["']([^"']+)["']/i);
  const pub = pick(/<meta[^>]+(?:property|name)=["'](?:article:published_time|date|publish_date|og:updated_time)["'][^>]*content=["']([^"']+)["']/i);
  if (pub) out.datePublished = pub;
  // JSON-LD blocks
  const ldBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]{1,20000})<\/script>/gi)].map(m => m[1]);
  const ld = [];
  for (const b of ldBlocks) {
    try { ld.push(JSON.parse(b)); } catch {}
  }
  if (ld.length) out.jsonLd = ld.slice(0, 5);
  // keywords
  const kw = pick(/<meta[^>]+name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
  if (kw) out.keywords = kw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
  return out;
}

function decodeEnt(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}
