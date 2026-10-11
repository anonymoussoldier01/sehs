// /design/colours — calm colour system (internal, noindex).
// Swatches, usage rules, contrast table, before/after, accent previews.
// Preview via ?accent=sky|teal|brass (default sky). ?view=specimen shows old specimens.
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { useTheme } from '../providers';

function Swatch({ name, css, usage, ratio }) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
      <div className="h-14" style={{ background: css }} />
      <div className="px-2.5 py-2">
        <p className="text-xs font-bold" style={{ margin: 0 }}>{name} <span className="tnum" style={{ color: 'var(--text-3)', fontWeight: 600 }}>{css}</span></p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-2)' }}>{usage}</p>
        {ratio ? <p className="tnum" style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-3)' }}>Contrast {ratio}</p> : null}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2.5 font-display text-lg font-bold">{label}</h2>
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </section>
  );
}

const TOKENS_DARK = [
  ['--bg #0B1020', 'var(--bg)', 'Deep ink navy, never pure black. 90% of pixels.', '—'],
  ['--surface-1 #111832', '#111832', 'Cards, nav, raised surfaces.', '—'],
  ['--surface-2 #172041', '#172041', 'Hover, wells, secondary surfaces.', '—'],
  ['--border 8% white', 'var(--border)', 'Hairlines. Strong = 16% white.', '—'],
  ['--text #EEF0F6', '#EEF0F6', 'Primary text.', '16.6:1 on bg'],
  ['--text-2 #A7B0C6', '#A7B0C6', 'Body secondary.', '8.7:1'],
  ['--text-3 #7C86A2', '#7C86A2', 'Captions ≥14px only.', '5.2:1 on bg'],
  ['--accent #7DB2FF', '#7DB2FF', 'Links, focus, selection, progress, small icons. Never large fills.', '8.7:1'],
  ['--accent-soft 14%', 'rgba(125,178,255,0.14)', 'Highlight bar behind “One exam.”, active nav, chips.', '—'],
  ['--cta-bg #F4F0E6', '#F4F0E6', 'Ivory primary CTA (dark). Single brightest element.', '16.6:1 vs ink'],
  ['--paper #F4F0E6', '#F4F0E6', 'Sample-exam card ONLY. Cream paper, ruled lines.', '—'],
  ['--success #5CCB97', '#5CCB97', 'Quiz/mock feedback ONLY (tint + border + icon + text).', '—'],
  ['--error #EE7B86', '#EE7B86', 'Quiz/mock feedback ONLY. Never decor, never glow.', '—'],
];

const TOKENS_LIGHT = [
  ['--bg #FAF7F0', '#FAF7F0', 'Paper base.', '—'],
  ['--surface-1 #FFFFFF', '#FFFFFF', 'Cards.', '—'],
  ['--surface-2 #F3EFE4', '#F3EFE4', 'Wells.', '—'],
  ['--text #0B1020', '#0B1020', 'Primary.', '16.6:1'],
  ['--text-2 #4A5470', '#4A5470', 'Secondary.', '≥4.5:1'],
  ['--accent #2A5FD0', '#2A5FD0', 'Links, focus, progress.', '5.4:1'],
  ['--cta-bg #0B1020', '#0B1020', 'Ink primary CTA (light).', '16.6:1 vs ivory'],
  ['--success #1B7F55', '#1B7F55', 'Feedback only.', '4.7:1'],
  ['--error #B3394A', '#B3394A', 'Feedback only.', '5.5:1'],
];

export default function Design() {
  const { dark, toggle } = useTheme();
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const accent = params.get('accent') || 'sky';
  const view = params.get('view') || (pathname.includes('colours') ? 'colours' : 'colours');
  const [tab, setTab] = useState(0);

  useEffect(() => {
    document.title = 'Design colours · SEHS Study (internal)';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (accent === 'sky') root.removeAttribute('data-accent');
    else root.setAttribute('data-accent', accent);
    return () => root.removeAttribute('data-accent');
  }, [accent]);

  const setAccent = (a) => {
    const next = new URLSearchParams(params);
    if (a === 'sky') next.delete('accent');
    else next.set('accent', a);
    setParams(next, { replace: true });
  };

  if (view === 'specimen') {
    return (
      <div className="page-browse py-7">
        <p><Link to="/design/colours" style={{ color: 'var(--accent)', fontWeight: 700 }}>← Back to colours</Link></p>
        <h1 className="font-display text-3xl font-bold">Design specimen</h1>
        <Row label="Buttons">
          <Button variant="default">Start a free mock</Button>
          <Button variant="secondary">Ghost</Button>
          <Button variant="destructive">Delete my data</Button>
        </Row>
        <Row label="Badges & progress">
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success">✓ Correct + label</Badge>
          <Badge variant="destructive">✗ Incorrect + label</Badge>
          <div className="w-48"><Progress value={6} max={10} aria-label="Specimen progress" /></div>
        </Row>
        <Row label="Tabs">
          <div className="relative flex gap-1 rounded-xl border p-1" style={{ borderColor: 'var(--border-strong)' }} role="tablist" aria-label="Specimen tabs">
            {['Library', 'Practice', 'Review'].map((t, i) => (
              <button key={t} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}
                className="relative min-h-[40px] rounded-lg px-4 text-sm font-bold" style={{ color: tab === i ? 'var(--text)' : 'var(--text-2)' }}>
                {tab === i && <span className="absolute inset-0 rounded-lg" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }} />}
                <span className="relative">{t}</span>
              </button>
            ))}
          </div>
        </Row>
      </div>
    );
  }

  return (
    <div className="page-browse py-7" data-crest="mono">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Internal · noindex · /design/colours</p>
      <h1 className="font-display text-3xl font-bold">Colour system <span className="hl-stroke"><span className="hl-text">replacement</span></span></h1>
      <p className="reading mt-2 text-[15px]" style={{ color: 'var(--text-2)' }}>
        One calm hue family, near-monochrome, single quiet accent. Colour is rare so it means something.
        Banned: amber/yellow/orange, purple/violet, red outside errors, green outside success, gradients between
        two hues, multi-colour glows, coloured card borders, rainbow charts.
      </p>
      <p className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={(e) => toggle(e)}>Theme: {dark ? 'dark' : 'light'} — toggle</Button>
        <Link to="/design/colours?view=specimen" className="inline-flex min-h-[36px] items-center rounded-[10px] border px-3.5 text-[13px] font-bold" style={{ borderColor: 'var(--border-strong)' }}>Specimen →</Link>
      </p>

      <Row label="Accent preview (?accent=sky|teal|brass, default sky)">
        <div className="flex flex-wrap gap-2">
          {['sky', 'teal', 'brass'].map((a) => (
            <button
              key={a}
              onClick={() => setAccent(a)}
              aria-pressed={String(accent === a)}
              className="min-h-[44px] rounded-full border px-4 text-sm font-bold"
              style={{
                borderColor: accent === a ? 'var(--accent-line)' : 'var(--border-strong)',
                background: accent === a ? 'var(--accent-soft)' : 'transparent',
                color: 'var(--text)',
              }}
            >
              {a}{a === 'sky' ? ' (default)' : ''}{a === 'teal' ? ' · #4FD1B5' : ''}{a === 'brass' ? ' · #C9AB6B' : ''}
            </button>
          ))}
        </div>
        <p className="w-full text-[13px]" style={{ color: 'var(--text-2)' }}>
          Teal #4FD1B5 (10.0:1 on bg) — success must show check icon + label so it never blurs with accent.
          Brass #C9AB6B (8.6:1) muted warm highlights only; CTA stays {dark ? 'ivory' : 'ink'}.
        </p>
        <div className="w-full" data-feedback={accent === 'teal' ? 'success' : undefined}>
          <p style={{ fontSize: 13, margin: 0 }}>
            {accent === 'teal' ? '✓ Success example (check + label, distinct from teal accent).' : 'Accent sample: links, focus rings, progress, small icons.'}
          </p>
        </div>
      </Row>

      <Row label={dark ? 'Tokens — dark (default)' : 'Tokens — light'}>
        <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3">
          {(dark ? TOKENS_DARK : TOKENS_LIGHT).map(([name, css, usage, ratio]) => (
            <Swatch key={name} name={name} css={css} usage={usage} ratio={ratio} />
          ))}
        </div>
      </Row>

      <Row label="Usage rules">
        <div className="w-full rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>90% neutrals (bg, surfaces, borders, text). ONE sky accent only.</li>
            <li>Primary CTA = ivory/ink (dark) or ink/ivory (light). Brightest element. Secondary = ghost 1px border. Never coloured fill.</li>
            <li>Accent: links, focus rings, selected, progress, headline highlight bar (accent-soft behind “One exam.”), active-nav 2px bar + soft bg, small icons. Never large fills.</li>
            <li>Success/error: quiz/mock feedback, results, validation ONLY — 14% tint + border + icon + text. Never glows, never decor.</li>
            <li>Schools: crest + name only. Mono crests default. Doors share one neutral palette. Selected: accent 1.5px ring + check.</li>
            <li>Hero: one radial accent ≤9% opacity, masked. No edges. No glow larger than 12px.</li>
          </ul>
        </div>
      </Row>

      <Row label="Contrast table (axe = 0, text ≥4.5:1, large ≥3:1)">
        <div className="w-full overflow-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          <table className="ledger-table">
            <thead><tr><th>Pair</th><th>Ratio</th><th>Pass</th></tr></thead>
            <tbody>
              {[
                ['text #EEF0F6 on bg #0B1020 (dark)', '16.6:1', 'AAA'],
                ['text-2 #A7B0C6 on bg (dark)', '8.7:1', 'AAA'],
                ['text-3 #7C86A2 on bg (dark)', '5.2:1', 'AA (≥14px only)'],
                ['accent #7DB2FF on bg (dark)', '8.7:1', 'AAA'],
                ['cta-fg #0B1020 on cta-bg #F4F0E6', '16.6:1', 'AAA'],
                ['accent #2A5FD0 on bg #FAF7F0 (light)', '5.4:1', 'AA'],
                ['success #1B7F55 on paper (light)', '4.7:1', 'AA'],
                ['error #B3394A on paper (light)', '5.5:1', 'AA'],
              ].map(([pair, ratio, pass]) => (
                <tr key={pair}><td>{pair}</td><td className="tnum">{ratio}</td><td>{pass}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Row>

      <Row label="Before / after (home)">
        <div className="grid w-full gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-bold">Before (retired)</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>Amber CTA + headline underline, per-school blue/green/red/purple crest colours, blue/purple gradients, multi-colour glows, red/green decor, rainbow confetti/charts. Six hues at once.</p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--accent-line)', background: 'var(--accent-soft)' }}>
            <p className="text-sm font-bold">After (this page)</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>Near-monochrome navy, ivory/ink CTA, sky accent only, mono crests, single-palette doors, ≤9% spotlight, success/error in feedback only. Greyscale preserves hierarchy; squint shows ONE brightest element (CTA).</p>
          </div>
        </div>
        <p className="w-full text-[13px]" style={{ color: 'var(--text-3)' }}>Screenshots: capture 1920 / 1440 / 768 / 375 in dark + light before/after for the changelog. Greyscale + squint checks required.</p>
      </Row>

      <Row label="Scales (12-step, Radix semantics)">
        <div className="grid w-full grid-cols-6 gap-1.5 sm:grid-cols-12">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={'n' + i} className="h-10 rounded-lg border" title={'neutral-' + (i + 1)} style={{ background: 'var(--neutral-' + (i + 1) + ')', borderColor: 'var(--border)' }} />
          ))}
        </div>
        <div className="grid w-full grid-cols-6 gap-1.5 sm:grid-cols-12">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={'a' + i} className="h-10 rounded-lg border" title={'accent-' + (i + 1)} style={{ background: 'var(--accent-' + (i + 1) + ')', borderColor: 'var(--border)' }} />
          ))}
        </div>
        <p className="w-full text-[13px]" style={{ color: 'var(--text-2)' }}>Backgrounds 1-2, interactive 3-5, borders 6-7, solid 9, text 11-12. Tokens above stay source of truth.</p>
      </Row>
    </div>
  );
}
