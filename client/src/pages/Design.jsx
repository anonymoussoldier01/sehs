// Living style guide (internal, noindex). Visual-QA target for tokens,
// components, states and motion specimens in both themes.
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Progress } from '../components/ui/progress';
import { useMotionProfile, dur } from '../lib/motion';

function Swatch({ name, css, text = '#fff' }) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--line)' }}>
      <div className="h-14" style={{ background: css }} />
      <p className="px-2.5 py-1.5 text-xs font-semibold" style={{ color: text === '#fff' ? undefined : text }}>
        {name} <span style={{ color: 'var(--faint)' }}>{css}</span>
      </p>
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

export default function Design() {
  const motion = useMotionProfile('standard');
  const [tab, setTab] = useState(0);
  useEffect(() => {
    document.title = 'Design system — SEHS Study (internal)';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <div className="mx-auto max-w-[1060px] px-5 py-7">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--faint)' }}>
        Internal · noindex
      </p>
      <h1 className="font-display text-3xl font-bold">
        Design system{' '}
        <span className="hl-stroke">
          specimen
          <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
            <path d="M2 8 C 60 2, 140 2, 198 7" />
          </svg>
        </span>
      </h1>
      <p className="reading mt-2 text-[15px]" style={{ color: 'var(--mut)' }}>
        Thesis: a calm, precise study instrument — ink on deep navy, with the warmth of a well-marked exam paper.
        Motion profile here: <strong>{motion.profile}</strong> (setting: {motion.setting}).
      </p>

      <Row label="Tokens — surfaces & text">
        <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Swatch name="Background" css="var(--bg)" />
          <Swatch name="Raised" css="var(--panel)" />
          <Swatch name="Overlay" css="var(--bg2)" />
          <Swatch name="Primary" css="var(--primary)" />
          <Swatch name="Paper" css="var(--ok-paper, #FBFAF6)" text="#0F172A" />
          <Swatch name="Highlighter" css="var(--mark-bg)" text="#0F172A" />
          <Swatch name="Correct" css="var(--ok)" />
          <Swatch name="Incorrect" css="var(--bad)" />
        </div>
      </Row>

      <Row label="Type scale (fluid, tabular numerals where it counts)">
        <div className="w-full">
          <p style={{ fontSize: 'clamp(38px,6vw,64px)', fontFamily: 'var(--font-display)', fontWeight: 700, lineHeight: 1.05 }}>Display — practise with precision</p>
          <p className="font-display text-2xl font-bold">Heading — organise your week</p>
          <p className="text-[15px]">Body — calm, plain Australian English in sentence case.</p>
          <p className="tnum text-2xl font-semibold">Timer 59:59 · Score 38 / 40 · Q12</p>
        </div>
      </Row>

      <Row label="Buttons — all states">
        <Button variant="default">Start mock exam</Button>
        <Button variant="secondary">Save to my list</Button>
        <Button variant="default" disabled>Disabled</Button>
        <Button variant="destructive">Delete my data</Button>
      </Row>

      <Row label="Badges, tags & progress">
        <Badge variant="accent">Practise test</Badge>
        <Badge variant="success">✓ Correct</Badge>
        <Badge variant="destructive">✗ Incorrect</Badge>
        <Badge variant="warning">⚑ Flagged</Badge>
        <div className="w-48"><Progress value={6} max={10} aria-label="Specimen progress" /></div>
      </Row>

      <Row label="Inputs, selects, checkboxes">
        <Input placeholder="Search papers…" aria-label="Specimen search" className="w-56" />
        <Select aria-label="Specimen sort" defaultValue="relevance" className="w-40">
          <option value="relevance">Best match</option>
          <option value="title-az">A–Z</option>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked aria-label="Specimen checkbox" /> Answers included</label>
      </Row>

      <Row label="Tabs with sliding indicator">
        <div className="relative flex gap-1 rounded-xl border p-1" style={{ borderColor: 'var(--line2)' }} role="tablist" aria-label="Specimen tabs">
          {['Library', 'Practice', 'Review'].map((t, i) => (
            <button key={t} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}
              className="relative min-h-[40px] rounded-lg px-4 text-sm font-bold" style={{ color: tab === i ? 'var(--primary-foreground)' : 'var(--mut)' }}>
              {tab === i && <span className="absolute inset-0 rounded-lg" style={{ background: 'var(--primary)', transition: `transform ${dur.standard}ms var(--ease-standard)` }} />}
              <span className="relative">{t}</span>
            </button>
          ))}
        </div>
      </Row>

      <Row label="Motion specimens (profiles: expressive / standard / calm)">
        <p className="w-full text-sm" style={{ color: 'var(--mut)' }}>
          Durations micro {dur.micro}ms · standard {dur.standard}ms · emphasis {dur.emphasis}ms.
          Exam and viewer always use Calm. Press feedback lands within 100ms and never delays the action.
        </p>
        <Button variant="default" onClick={() => motion.setSetting(motion.setting === 'full' ? 'off' : 'full')}>
          Motion: {motion.setting} (toggle full/off)
        </Button>
      </Row>

      <Row label="States — loading, empty, error, offline">
        <div className="grid w-full gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
            <p className="text-sm font-bold">Loading</p>
            <p className="text-[13px]" style={{ color: 'var(--mut)' }}>Skeletons match the final layout with a subtle shimmer — never a spinner on a blank page.</p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
            <p className="text-sm font-bold">Empty</p>
            <p className="text-[13px]" style={{ color: 'var(--mut)' }}>Explains why and offers a next action. No lorem ipsum, no “coming soon”.</p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
            <p className="text-sm font-bold">Error</p>
            <p className="text-[13px]" style={{ color: 'var(--mut)' }}>Says what happened and what to do next, with retry. Never blames the student.</p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)' }}>
            <p className="text-sm font-bold">Offline</p>
            <p className="text-[13px]" style={{ color: 'var(--mut)' }}>Saved pages and guides keep working; new searches wait politely.</p>
          </div>
        </div>
      </Row>
    </div>
  );
}
