// Landing sections for the SEHS Study home page.
// Sell the destination (the four schools), then show the shortest path.
// No endorsement implied anywhere; crests are identification-only and fall
// back to wordmarks when crestSrc is null (see data/schools.js).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Gift, Timer, UserX, Target as TargetIcon, Repeat2, MapPin } from 'lucide-react';
import { useToast } from '../providers';
import { useLocal, keys } from '../lib/store';
import { SCHOOLS, SCHOOL_BY_ID, EXAM, SCARCITY_FACTS, FAQ_ITEMS } from '../data/schools';
import { track } from '../lib/analytics';
import { cn } from './cn';

export const TARGET_KEY = 'sehs-target-school';
export const SAMPLE_WIN_KEY = 'sehs-sample-win';

// Lightweight home primitives (no magic/ace bundle in home chunk).
// NumberTicker runs once, tabular, instant under reduced-motion.
function NumberTicker({ value }) {
  const target = Number(value) || 0;
  const [n, setN] = useState(() => {
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return target;
    } catch { /* noop */ }
    return 0;
  });
  useEffect(() => {
    if (n === target) return;
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setN(target);
        return;
      }
    } catch { setN(target); return; }
    let raf;
    const t0 = performance.now();
    const dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      setN(Math.round(target * (1 - Math.pow(2, -10 * k))));
      if (k < 1) raf = requestAnimationFrame(step);
      else setN(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <span className="tnum tabular-nums">{n.toLocaleString()}</span>;
}

// Sample-win reward: static message only (no canvas, no motion lib).
function Confetti({ fire }) {
  if (!fire) return null;
  return (
    <p className="text-[13px] font-bold" style={{ color: 'var(--success)', margin: '8px 0 0' }} role="status">
      Saved in this browser — your first win.
    </p>
  );
}

// Section reveal (motion-primitives in-view pattern, CSS only, no motion lib).
// Wraps section headings: rises once on entry, instant under reduced-motion.
export function Reveal({ children, className }) {
  const [el, setEl] = useState(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (inView || !el) return;
    const show = () => setInView(true);
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        show();
        return;
      }
    } catch { show(); return; }
    if (!('IntersectionObserver' in window)) {
      show();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show();
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, inView]);
  return (
    <div
      ref={setEl}
      className={cn('reveal', inView && 'is-in', className)}
    >
      {children}
    </div>
  );
}

// Topic ribbon (MagicUI Marquee pattern, ledger-restrained): one quiet
// transport row of real topic links. Duplicated for the loop, second copy
// aria-hidden; pause on hover/focus via CSS; static under reduced-motion.
const RIBBON_TOPICS = [
  'verbal analogy',
  'fractions',
  'reading comprehension',
  'vocabulary',
  'algebra',
  'persuasive writing',
  'numerical reasoning',
  'exam timing',
];

export function TopicRibbon() {
  const row = (hidden) => (
    <div className="flex shrink-0 gap-2.5 pr-2.5" aria-hidden={hidden || undefined}>
      {RIBBON_TOPICS.map((t) => (
        <Link
          key={(hidden ? 'b-' : 'a-') + t}
          to={'/search?q=' + encodeURIComponent(t)}
          className="topic-chip"
          tabIndex={hidden ? -1 : undefined}
          aria-hidden={hidden || undefined}
        >
          <span className="dot" aria-hidden="true" />
          {t}
        </Link>
      ))}
    </div>
  );
  return (
    <div className="marquee topic-ribbon" role="navigation" aria-label="Popular topics">
      <div className="marquee-track topic-ribbon-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

// FAQ accordion: native buttons, 44px targets, no animation library.
function Faq({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      {(items || []).map((it, k) => {
        const isOpen = open === k;
        return (
          <div key={k} className="overflow-hidden rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: isOpen ? 'var(--accent-line)' : 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : k)}
              aria-expanded={String(isOpen)}
              aria-controls={`faq-panel-${k}`}
              id={`faq-button-${k}`}
              className="faq-q flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-bold"
            >
              <span className={cn('faq-plus grid h-7 w-7 flex-none place-items-center rounded-full border text-lg leading-none', isOpen && 'is-open')} style={{ borderColor: 'var(--border-strong)', color: 'var(--accent)' }} aria-hidden="true">
                +
              </span>
              {it.q}
            </button>
            {isOpen ? (
              <div id={`faq-panel-${k}`} role="region" aria-labelledby={`faq-button-${k}`} className="faq-a-in px-4 pb-4 pl-[52px] text-sm" style={{ color: 'var(--text-2)' }}>{it.a}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// Human-readable titles: strip codes/underscores/extensions.
// Manual overrides for known cryptic Drive names.
const TITLE_OVERRIDES = {
  'vsse-3': 'VSSE practice set 3',
};
export function cleanTitle(raw, fallback = 'Study resource') {
  if (!raw) return fallback;
  const over = TITLE_OVERRIDES[String(raw).toLowerCase()];
  if (over) return over;
  let t = String(raw);
  t = t.replace(/\.[a-z0-9]{2,5}$/i, '');
  t = t.replace(/[_-]+/g, ' ');
  t = t.replace(/^(pdf|doc|vsse|acer|mhs|pdfs?)\s*\d*[:-]?\s*/i, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  // Title-case short strings, leave sentences alone.
  if (t.length < 60) t = t.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
  return t.slice(0, 90) || fallback;
}

export function useTargetSchool() {
  const [targetId, setTargetId] = useLocal(TARGET_KEY, null);
  const school = targetId ? SCHOOL_BY_ID[targetId] || null : null;
  const target = (id) => {
    setTargetId(id);
    track('target_school', { school: id });
    // Calm system: selecting a school NEVER shifts the page accent.
    // Doors/cards/chips share one neutral treatment + quiet sky accent.
    try {
      const live = document.getElementById('target-live');
      if (live) live.textContent = `Target set: ${SCHOOL_BY_ID[id]?.shortName || id}`;
    } catch { /* noop */ }
  };
  const clear = () => {
    setTargetId(null);
  };
  return { targetId, school, target, clear };
}

// ---------- Crest (official image when licensed, wordmark fallback otherwise) ----------
// MONOCHROME by default (ivory on ink / ink on paper via CSS). No colour-coding.
export function SchoolCrest({ school, size = 44 }) {
  const style = { width: size, height: size };
  if (school.crestSrc) {
    return (
      <img
        src={school.crestSrc}
        alt={school.crestAlt}
        width={size}
        height={size}
        loading="lazy"
        className="crest-img"
        style={style}
      />
    );
  }
  return (
    <span className="crest-fallback" style={style} aria-hidden="true">
      {school.wordmarkFallback}
    </span>
  );
}

// ---------- School strip: crest + name ONLY, neutral treatment ----------
// 4-col grid filling the container; suburb/gender/stats live only in cards.
// All four share the same neutral style; active = accent-soft + accent line.
export function CrestStrip() {
  const { targetId, target, clear } = useTargetSchool();
  const toast = useToast();
  return (
    <div className="crest-strip-wrap">
      <div className="crest-strip crest-grid" role="list" aria-label="Pick your target school">
        {SCHOOLS.map((s) => {
          const on = targetId === s.id;
          return (
            <div key={s.id} role="listitem">
              <button
                type="button"
                onClick={() => {
                  if (on) clear();
                  else {
                    target(s.id);
                    toast(`Target set: ${s.shortName}`);
                  }
                }}
                aria-pressed={String(on)}
                title={`${s.name} — ${on ? 'selected, activate to clear' : 'select as target'}`}
                className={cn('crest-item crest-btn', on && 'is-on')}
              >
                <SchoolCrest school={s} size={36} />
                <span className="crest-text">
                  <strong>{s.shortName}</strong>
                </span>
                {on ? <span className="crest-check" aria-hidden="true">✓</span> : null}
              </button>
            </div>
          );
        })}
      </div>
      <span id="target-live" className="sr-only" aria-live="polite" />
    </div>
  );
}

// ---------- Trust badges ----------
export function TrustBadges() {
  const items = [
    [Gift, 'Free forever'],
    [UserX, 'No account'],
    [Timer, 'ACER format'],
  ];
  return (
    <ul className="trust-badges" aria-label="Why students trust SEHS Study">
      {items.map(([Icon, label]) => (
        <li key={label}>
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}

// ---------- The Four Doors signature art: four tall arches ----------
// ONE palette for all four: arch frame --border-strong, interior transparent
// → rgba(238,240,246,0.10), floor glow accent at 25%, panels 12% white.
// Selected: accent 1.5px ring + check + "Your target", door opens with soft
// accent beam, others dim to 70%. No coloured glow larger than 12px.
// Keyboard accessible, aria-live, reduced-motion = instant cross-fade.
export function FourDoorsArt() {
  const { targetId, target, clear } = useTargetSchool();
  const toast = useToast();
  const heights = [100, 92, 100, 92];
  return (
    <div className="doors-art" role="list" aria-label="The four doors — select your target">
      {SCHOOLS.map((s, i) => {
        const open = targetId === s.id;
        const dim = targetId && !open;
        return (
          <button
            key={s.id}
            role="listitem"
            type="button"
            onClick={() => {
              if (open) clear();
              else {
                target(s.id);
                toast(`Target set: ${s.shortName}`);
              }
            }}
            aria-pressed={String(open)}
            aria-label={`${s.name}, ${s.suburb}. ${open ? 'Selected as target.' : 'Select as target.'}`}
            className={cn('door', open && 'is-open', dim && 'is-dim')}
            style={{ ['--dh']: `${heights[i]}%` }}
          >
            <span className="door-frame" aria-hidden="true">
              <svg viewBox="0 0 120 200" preserveAspectRatio="xMidYMax meet">
                <defs>
                  <linearGradient id={`wash-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EEF0F6" stopOpacity="0.1" />
                    <stop offset="30%" stopColor="#EEF0F6" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#EEF0F6" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id={`beam-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={open ? '0.35' : '0'} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M14 196 V84 A46 46 0 0 1 106 84 V196"
                  fill={`url(#wash-${s.id})`}
                  stroke="var(--border-strong)"
                  strokeWidth="1.5"
                />
                <path d="M14 196 V84 A46 46 0 0 1 106 84 V196" fill={`url(#beam-${s.id})`} />
                <ellipse cx="60" cy="190" rx="42" ry="10" fill="var(--accent)" opacity={open ? '0.3' : '0.18'} className="door-spill" />
                <g className="door-leaf">
                  <path
                    d="M22 196 V86 A38 38 0 0 1 98 86 V196"
                    fill="rgba(255,255,255,0.12)"
                    stroke="var(--border-strong)"
                    strokeWidth="1"
                  />
                  <rect x="30" y="105" width="60" height="38" rx="4" fill="rgba(255,255,255,0.12)" />
                  <rect x="30" y="150" width="60" height="38" rx="4" fill="rgba(255,255,255,0.12)" />
                </g>
                <circle cx="60" cy="52" r="13" fill="var(--paper)" stroke="var(--border-strong)" strokeWidth="1.5" />
                <text x="60" y="57" textAnchor="middle" fontSize="11" fontWeight="800" fill="#0B1020" fontFamily="Fraunces, Georgia, serif">
                  {s.wordmarkFallback}
                </text>
              </svg>
            </span>
            <span className="door-name">{s.shortName}</span>
            <span className="door-hint">{open ? '✓ Your target' : 'Select'}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- The Four Doors cards: neutral, crest + name ONLY ----------
// All four doors, cards and chips share the same neutral treatment.
export function FourDoors() {
  const { targetId, target } = useTargetSchool();
  const toast = useToast();
  return (
    <div>
      <FourDoorsArt />
      <div className="four-doors" role="list" aria-label="The four selective entry schools">
        {SCHOOLS.map((s) => {
          const isTarget = targetId === s.id;
          return (
            <article key={s.id} role="listitem" className={cn('four-door-card', isTarget && 'is-target')}>
              <div className="four-door-top">
                <SchoolCrest school={s} size={48} />
                <div className="min-w-0">
                  <h3>{s.name}</h3>
                  <p className="four-door-sub">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {s.suburb}
                    <span className="four-door-tag">{s.tag}</span>
                  </p>
                </div>
              </div>
              <dl className="four-door-stats" aria-label={`${s.shortName} VCE 2025 results`}>
                <div>
                  <dt>State rank</dt>
                  <dd className="tnum">#{s.stats.rank}</dd>
                </div>
                <div>
                  <dt>40+ scores</dt>
                  <dd className="tnum">{s.stats.pct40.toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>Median</dt>
                  <dd className="tnum">{s.stats.median}</dd>
                </div>
              </dl>
              {s.stats.extra ? <p className="four-door-extra">{s.stats.extra}</p> : null}
              <p className="four-door-hook">{s.hook}</p>
              <button
                type="button"
                onClick={() => {
                  target(s.id);
                  toast(isTarget ? `Still targeting ${s.shortName}` : `Target set: ${s.shortName}`);
                }}
                aria-pressed={String(isTarget)}
                className={cn('four-door-target', isTarget && 'is-on')}
              >
                {isTarget ? (
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Your target
                  </span>
                ) : (
                  'Aim for this school'
                )}
              </button>
            </article>
          );
        })}
      </div>
      <p className="four-doors-foot">
        VCE 2025 results via <a href="https://www.vic.gov.au/selective-entry-high-schools">vic.gov.au</a>, last checked{' '}
        {SCHOOLS[0].lastChecked}. Figures vary slightly between compilers; see school and VCAA pages.
      </p>
    </div>
  );
}

// ---------- Countdown to the next June exam ----------
export function useExamCountdown() {
  const [custom] = useLocal(keys.examDate, null);
  const dateStr = custom || EXAM.date;
  return useMemo(() => {
    const target = new Date(String(dateStr) + 'T09:00:00');
    const now = new Date();
    const days = Math.ceil((target - now) / 86400000);
    return { dateStr, days, isCustom: !!custom };
  }, [dateStr, custom]);
}

export function Countdown() {
  const { targetId, school } = useTargetSchool();
  const { dateStr, days, isCustom } = useExamCountdown();
  const d = new Date(String(dateStr) + 'T09:00:00');
  const pretty = Number.isNaN(d.getTime())
    ? EXAM.label
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="countdown" role="status" aria-live="polite">
      <div className="countdown-num tnum" aria-label={`${days} days to the exam`}>
        {Number.isFinite(days) && days >= 0 ? <NumberTicker value={Math.max(0, days)} /> : '–'}
        <span>days</span>
      </div>
      <div className="min-w-0">
        <p className="countdown-title">
          {school ? `Your target: ${school.shortName} — ` : ''}Next exam {pretty}
        </p>
        <p className="countdown-sub">
          {EXAM.label} · {EXAM.confirmNote}
          {isCustom ? ' · your date from the Study hub' : ''}
          {targetId ? '' : ' · pick a door above to personalise this page'}
        </p>
      </div>
      <Link to="/exam-guide" className="countdown-link">
        Exam guide
      </Link>
    </div>
  );
}

// ---------- Scarcity band (honest, no outcome promises) ----------
export function ScarcityBand() {
  return (
    <section className="scarcity" aria-label="About the selective entry exam">
      <ul>
        {SCARCITY_FACTS.map((f, i) => (
          <li key={i}>
            <strong>{f.title}</strong>
            {f.sub ? <span>{f.sub}</span> : null}
          </li>
        ))}
      </ul>
      <p className="scarcity-note">
        Independent practice only — admission depends on the official selection process. No pass rates, no
        guarantees.
      </p>
    </section>
  );
}

// ---------- Sample question demo (real stem, A–D, instant feedback) ----------
const SAMPLE = {
  stem: 'Area of a 6×4 rectangle?',
  options: ['10 square units', '24 square units', '26 square units', '20 square units'],
  answer: 1,
  explain: 'Area = length × width = 6 × 4 = 24.',
};

export function SampleQuestion({ hero = false } = {}) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState(null);
  const [won, setWon] = useState(false);
  const correct = picked === SAMPLE.answer;

  useEffect(() => {
    if (correct) {
      try {
        if (!localStorage.getItem(SAMPLE_WIN_KEY)) {
          localStorage.setItem(SAMPLE_WIN_KEY, new Date().toISOString());
          setWon(true);
        }
      } catch {
        setWon(true);
      }
      track('sample_correct', {});
    }
  }, [correct]);

  const letters = ['A', 'B', 'C', 'D'];
  return (
    <section className={cn('sample-card', hero && 'sample-hero')} aria-label="Try a sample question">
      <p className="sample-kicker">Try one now · maths</p>
      <h3 className="sample-stem">{SAMPLE.stem}</h3>
      <div className="sample-opts" role="group" aria-label="Answer options">
        {SAMPLE.options.map((o, k) => {
          const isAns = k === SAMPLE.answer;
          const sel = picked === k;
          const state = picked === null ? '' : isAns ? 'is-right' : sel ? 'is-wrong' : 'is-dim';
          return (
            <button
              key={k}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(k)}
              className={cn('sample-opt', state)}
              aria-label={`Option ${letters[k]}: ${o}`}
            >
              <span className="sample-letter" aria-hidden="true">
                {letters[k]}
              </span>
              <span>{o}</span>
              {picked !== null && isAns ? (
                <span className="sample-mark" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {picked !== null ? (
        <p
          className={cn('sample-fb', correct ? 'ok' : 'miss')}
          role="status"
          data-feedback={correct ? 'success' : 'error'}
        >
          {correct ? '✓ Correct. ' : `✗ Not quite — the answer is B. `}
          {SAMPLE.explain}
        </p>
      ) : (
        <p className="sample-hint">Pick an answer — instant feedback, no account.</p>
      )}
      <div className="sample-actions">
        <button
          type="button"
          className="sample-cta"
          onClick={() => {
            track('sample_try_more', {});
            navigate('/drills');
          }}
        >
          Try 5 more
        </button>
        <Link to="/mocks" className="sample-ghost">
          Or take a timed mock
        </Link>
      </div>
      <Confetti fire={won} />
    </section>
  );
}

// ---------- Hero card: sample (no target) vs Your path (target chosen) ----------
function useCoverageRings() {
  const [rings, setRings] = useState([0, 0, 0]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sehs-saved') || '[]').length;
      const mocks = Object.keys(JSON.parse(localStorage.getItem('sehs-mocks') || '{}')).length;
      const notes = Object.keys(JSON.parse(localStorage.getItem('sehs-notes') || '{}')).length;
      setRings([
        Math.min(100, Math.round((saved / 12) * 100)),
        Math.min(100, mocks * 25),
        Math.min(100, Math.round((notes / 8) * 100)),
      ]);
    } catch { /* noop */ }
  }, []);
  return rings;
}

export function HeroCard() {
  const { school, clear } = useTargetSchool();
  const { dateStr, days } = useExamCountdown();
  const rings = useCoverageRings();
  const navigate = useNavigate();
  const labels = ['Saved', 'Mocks', 'Notes'];
  if (!school) return <SampleQuestion hero />;
  return (
    <section className="path-card" aria-label={`Your path to ${school.shortName}`}>
      <div className="path-head">
        <SchoolCrest school={school} size={44} />
        <div className="min-w-0">
          <p className="path-kicker">Your path</p>
          <h3>{school.shortName}</h3>
          <p className="path-sub tnum">
            {Number.isFinite(days) && days >= 0 ? `${days} days` : EXAM.label} · {EXAM.confirmNote}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="hero-primary path-cta"
        onClick={() => {
          track('cta_path_session', { school: school.id });
          navigate('/mocks');
        }}
      >
        Today&apos;s 20-minute session
      </button>
      <div className="path-rings" aria-label="Practice coverage">
        {rings.map((v, i) => (
          <span key={labels[i]} className="path-ring" role="img" aria-label={`${labels[i]} coverage ${v}%`}>
            <svg width="52" height="52" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border-strong)" strokeWidth="7" className="progress-track" />
              <circle
                cx="28" cy="28" r="22" fill="none" stroke="var(--accent)" strokeWidth="7"
                strokeLinecap="round" strokeDasharray={138.2}
                strokeDashoffset={138.2 - (138.2 * v) / 100}
                transform="rotate(-90 28 28)"
              />
              <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--text)">{v}</text>
            </svg>
            <small>{labels[i]}</small>
          </span>
        ))}
      </div>
      <button type="button" onClick={clear} className="path-change">
        Change target
      </button>
      <span className="sr-only" aria-live="polite">Countdown: {dateStr}, {days} days remaining.</span>
    </section>
  );
}

// ---------- How it works (3 steps, simple SVG illustrations) ----------
export function HowItWorks() {
  const steps = [
    {
      n: '01',
      icon: TargetIcon,
      title: 'Pick a target school',
      desc: 'Choose one of the four doors. Your target personalises the countdown and recommended mocks.',
      to: '#four-doors',
      cta: 'Pick your door',
    },
    {
      n: '02',
      icon: Timer,
      title: 'Practise by topic',
      desc: 'Short drills, flashcards and timed 60 / 55 / 40-minute blocks in ACER format.',
      to: '/mocks',
      cta: 'Start your first mock',
    },
    {
      n: '03',
      icon: Repeat2,
      title: 'Review mistakes',
      desc: 'Misses return on a spaced schedule in drills and the review queue until they stick.',
      to: '/study',
      cta: 'Open the study hub',
    },
  ];
  return (
    <ol className="how-list">
      {steps.map((s) => (
        <li key={s.n} className="how-card">
          <span className="how-num" aria-hidden="true">
            {s.n}
          </span>
          <span className="how-ico" aria-hidden="true">
            <s.icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <h3>{s.title}</h3>
          <p>{s.desc}</p>
          {s.to.startsWith('#') ? (
            <a href={s.to} className="how-link">
              {s.cta}
            </a>
          ) : (
            <Link to={s.to} className="how-link">
              {s.cta}
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}

// ---------- Which door fits you? (official facts only) ----------
export function DoorChooser() {
  const { target } = useTargetSchool();
  const toast = useToast();
  const [coed, setCoed] = useState('');
  const [area, setArea] = useState('');
  const [signal, setSignal] = useState('');
  const [done, setDone] = useState(false);

  const result = useMemo(() => {
    if (!done) return [];
    let pool = [...SCHOOLS];
    if (coed === 'coed') pool = pool.filter((s) => s.tag === 'Co-ed');
    if (coed === 'girls') pool = pool.filter((s) => s.tag === 'Girls');
    if (coed === 'boys') pool = pool.filter((s) => s.tag === 'Boys');
    if (area === 'inner') pool = pool.filter((s) => ['Melbourne CBD', 'South Yarra'].includes(s.suburb));
    if (area === 'southeast') pool = pool.filter((s) => s.suburb === 'Berwick');
    if (area === 'west') pool = pool.filter((s) => s.suburb === 'Werribee');
    const rank = { rank: 0, cohort: 1, riser: 2, median: 3 };
    const order = ['macrob', 'mhs', 'suzanne-cory', 'nossal'];
    if (signal === 'rank') return pool.sort((a, b) => a.stats.rank - b.stats.rank);
    if (signal === 'cohort') return pool.sort((a, b) => (b.stats.extra?.includes('722') ? 1 : 0) - (a.stats.extra?.includes('722') ? 1 : 0));
    if (signal === 'riser') return pool.sort((a, b) => (b.stats.extra?.includes('riser') ? 1 : 0) - (a.stats.extra?.includes('riser') ? 1 : 0));
    void rank;
    return pool.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [done, coed, area, signal]);

  const groups = [
    {
      legend: '1 · Co-ed or single-sex?',
      value: coed,
      set: setCoed,
      options: [
        ['coed', 'Co-ed'],
        ['girls', 'Girls'],
        ['boys', 'Boys'],
        ['any', 'No preference'],
      ],
    },
    {
      legend: '2 · Which commute suits you?',
      value: area,
      set: setArea,
      options: [
        ['inner', 'Inner city'],
        ['southeast', 'South-east · Berwick'],
        ['west', 'West · Werribee'],
        ['any', 'No preference'],
      ],
    },
    {
      legend: '3 · What draws you right now?',
      value: signal,
      set: setSignal,
      options: [
        ['rank', 'Highest rank (Mac.Rob #4)'],
        ['median', 'Median 37 (Mac.Rob, Nossal)'],
        ['cohort', 'Largest cohort (MHS · 722)'],
        ['riser', 'Fastest riser (SCHS 44→17)'],
      ],
    },
  ];

  return (
    <section className="chooser" aria-label="Which door fits you?">
      <h3>Which door fits you?</h3>
      <p className="chooser-sub">Three quick questions, official facts only. No quiz score, no verdict — just a nudge.</p>
      {groups.map((g) => (
        <fieldset key={g.legend} className="chooser-group">
          <legend>{g.legend}</legend>
          <div className="chooser-opts">
            {g.options.map(([v, label]) => (
              <label key={v} className={cn('chooser-opt', g.value === v && 'is-on')}>
                <input
                  type="radio"
                  name={g.legend}
                  value={v}
                  checked={g.value === v}
                  onChange={() => {
                    g.set(v);
                    setDone(false);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="chooser-actions">
        <button
          type="button"
          className="chooser-go"
          disabled={!coed || !area || !signal}
          onClick={() => {
            setDone(true);
            track('chooser_done', { coed, area, signal });
            document.getElementById('chooser-result')?.scrollIntoView({ block: 'nearest' });
          }}
        >
          See my door
        </button>
        {(coed || area || signal) && (
          <button
            type="button"
            className="chooser-reset"
            onClick={() => {
              setCoed('');
              setArea('');
              setSignal('');
              setDone(false);
            }}
          >
            Reset
          </button>
        )}
      </div>
      {done && (
        <div id="chooser-result" className="chooser-result" role="status" tabIndex={-1}>
          {result.length === 0 ? (
            <p>No school matches that exact mix — loosen one answer. All four doors stay open.</p>
          ) : (
            <>
              <p className="chooser-pick">
                Start with <strong>{result[0].name}</strong> · {result[0].suburb} · {result[0].tag} · rank #
                {result[0].stats.rank}, median {result[0].stats.median}.
              </p>
              <button
                type="button"
                className="four-door-target is-on"
                onClick={() => {
                  target(result[0].id);
                  toast(`Target set: ${result[0].shortName}`);
                }}
              >
                Aim for this school
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ---------- FAQ (page-ui FaqCollapsible composition: sticky intro + accordion) ----------
export function FaqSection() {
  return (
    <div className="faq-grid">
      <div className="faq-intro">
        <p style={{ marginTop: 0 }}>
          Free forever, no account, saved in this browser. If anything else is
          unclear, the past-papers library is the fastest way to see what this is.
        </p>
        <p>
          <Link to="/search?type=pdf" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>
            Browse past papers
          </Link>
        </p>
      </div>
      <div className="faq-wrap" style={{ maxWidth: 'none' }}>
        <Faq items={FAQ_ITEMS} />
      </div>
    </div>
  );
}

// ---------- Testimonials (hidden until real, consented quotes exist) ----------
const SHOW_TESTIMONIALS = false;

export function Testimonials() {
  if (!SHOW_TESTIMONIALS) return null;
  const items = [
    // { quote: '…', name: 'A. · Year 9, Nossal', outcome: '…' },
  ];
  return (
    <section aria-label="Student stories">
      {items.map((t, i) => (
        <figure key={i}>
          <blockquote>{t.quote}</blockquote>
          <figcaption>
            {t.name} · {t.outcome}
          </figcaption>
        </figure>
      ))}
    </section>
  );
}

// ---------- Closing CTA (launch-ui CTA box: spotlight inside, accent edge) ----------
export function ClosingCta({ onPrimary }) {
  return (
    <section className="closing closing-box" aria-label="Get started">
      <p className="kicker" style={{ justifyContent: 'center' }}>
        Free forever · no account
      </p>
      <h2>Pick your door. Start your first mock.</h2>
      <p>Past papers, flashcards and timed mocks in ACER format — saved in this browser.</p>
      <p className="closing-ctas">
        <Link to="/mocks" className="closing-primary" onClick={onPrimary}>
          Start your first mock
        </Link>
        <Link to="/search?type=pdf" className="closing-ghost">
          Browse past papers
        </Link>
      </p>
      <TrustBadges />
    </section>
  );
}

export function StatFootnote() {
  return (
    <p className="stat-foot">
      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
      Independent practice. Not affiliated with ACER, the Victorian Department of Education, or any school.
    </p>
  );
}

// ---------- Landing top nav (marketing surface only, no sidebar) ----------
// 64px sticky, blurs on scroll, 1px bottom border. Left logo S + "SEHS Study".
// Centre: Mocks · Flashcards · Past papers · Writing · Guides. Right: theme
// toggle, ghost "Open the app", primary "Start a free mock".
export function hasProgress() {
  try {
    const keysToCheck = ['sehs-saved', 'sehs-mocks', 'sehs-recent', 'sehs-started', 'sehs-leitner', 'sehs-notes'];
    return keysToCheck.some((k) => {
      const v = localStorage.getItem(k);
      if (!v) return false;
      if (v === '[]' || v === '{}' || v === 'null') return false;
      return v.length > 2;
    });
  } catch {
    return false;
  }
}

export function WelcomeBackBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(hasProgress());
  }, []);
  if (!show) return null;
  return (
    <div
      className="flex min-h-[40px] items-center justify-center gap-2 px-4 py-1.5 text-center text-[13px]"
      style={{ background: 'var(--accent-soft)', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
      role="status"
    >
      <span>Welcome back — continue where you left off.</span>
      <Link to="/study" className="font-bold underline underline-offset-2" style={{ color: 'var(--accent)' }}>
        Open study hub
      </Link>
    </div>
  );
}

// ---------- Proof strip ("Is it real?") ----------
// launch-ui Stats composition, ledger-restrained: small label → big tabular
// value → one-line description, hairline dividers. Live counts only.
export function ProofStrip({ stats, deckCount, writingCount }) {
  const items = [
    ['Live library', stats?.publicResources ?? null, 'resources, answers where allowed'],
    ['Timed practice', 4, 'full mocks in ACER blocks'],
    ['Spaced review', deckCount, 'flashcard decks + your own'],
    ['Writing reps', writingCount ?? 80, 'prompts with plain-English rubric'],
  ];
  return (
    <section className="quiet-card" aria-label="Is it real?" style={{ marginTop: 20, padding: '16px 18px' }}>
      <p className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: 'var(--text-2)', margin: 0 }}>
        Prepare for · Melbourne High · Mac.Rob · Nossal · Suzanne Cory
      </p>
      <dl className="tnum stat-grid">
        {items.map(([label, n, desc]) => (
          <div key={label} className="stat-cell">
            <dt className="stat-label">{label}</dt>
            <dd className="stat-value">
              {typeof n === 'number' ? <NumberTicker value={n} /> : <span aria-label="loading">–</span>}
            </dd>
            <dd className="stat-desc">{desc}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------- Feature rows ("What's inside?") ----------
// 4 alternating split rows, live components in window frames, one text link each.
export function FeatureRows() {
  const rows = [
    {
      label: 'Timed mocks',
      title: 'Exam mode, real timing',
      copy: 'Four full mocks in 60 / 55 / 40-minute blocks, ACER structure, instant review.',
      bullets: ['Maths + quantitative reasoning', 'Reading + verbal reasoning', 'Mistakes return to your review queue'],
      to: '/mocks',
      link: 'Start a free mock',
    },
    {
      label: 'Flashcards',
      title: 'Spaced repetition that sticks',
      copy: 'Fourteen decks plus your own cards. Leitner boxes schedule misses until they stick.',
      bullets: ['Rate Again / Hard / Good / Easy', 'Review queue with due dates', 'Works offline in this browser'],
      to: '/study',
      link: 'Review flashcards',
    },
    {
      label: 'Writing studio',
      title: 'Eighty prompts + rubric',
      copy: 'Timed editor with word count and a plain-English rubric. No purple prose required.',
      bullets: ['Creative + persuasive prompts', 'Timer + word target', 'Self-check rubric'],
      to: '/writing',
      link: 'Open the writing studio',
    },
    {
      label: 'Maths drills + Reading room',
      title: 'Small reps, every day',
      copy: 'Infinite Year-8 drills and short timed passages. Twenty focused minutes counts.',
      bullets: ['Fractions, algebra, reasoning', 'Comprehension passages', 'Instant explanations'],
      to: '/drills',
      link: 'Try maths drills',
    },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 96, marginTop: 8 }}>
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            alignItems: 'center',
            direction: 'ltr',
          }}
          className="feature-row"
        >
          <div style={{ order: i % 2 ? 2 : 1 }}>
            <p className="kicker">
              <span className="feature-num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')} ·{' '}
              </span>
              {r.label}
            </p>
            <h3 className="font-display" style={{ fontSize: 'clamp(20px,2.6vw,28px)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              {r.title}
            </h3>
            <p style={{ color: 'var(--text-2)', fontSize: 17, lineHeight: 1.6, maxWidth: '46ch', margin: '0 0 10px' }}>{r.copy}</p>
            <ul style={{ margin: '0 0 10px', paddingLeft: 18, color: 'var(--text-2)', fontSize: 14.5, lineHeight: 1.7 }}>
              {r.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <Link to={r.to} style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>
              {r.link}
            </Link>
          </div>
          <div
            className="quiet-card feature-frame"
            style={{ order: i % 2 ? 1 : 2, minHeight: 180, display: 'flex', flexDirection: 'column' }}
            aria-hidden="true"
          >
            <div className="browser-bar">
              <span className="browser-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="browser-url">sehs.study{r.to}</span>
            </div>
            <div className="feature-visual">
              <p className="telemetry">
                Live preview · <strong>{r.label}</strong>
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{r.title}</p>
              <p className="tnum" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-2)' }}>
                {r.to === '/mocks' ? 'Q12 · 59:59 · flag, skip, review' : r.to === '/study' ? 'Due today · rate Again / Hard / Good / Easy' : r.to === '/writing' ? 'Timer + word target · self-check rubric' : 'Fractions, algebra · instant explanations'}
              </p>
              <div className="progress-track" style={{ height: 8, borderRadius: 999, marginTop: 10, border: '1px solid var(--border)' }}>
                <div style={{ width: '62%', height: '100%', borderRadius: 999, background: 'var(--accent)' }} />
              </div>
            </div>
            <p style={{ margin: 0, padding: '0 14px 12px', fontSize: 12.5, color: 'var(--text-3)' }}>Rendered component in a window frame — not stock art.</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- For students / For parents ----------
export function TrustCards() {
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', marginTop: 8 }} className="trust-grid">
      <div className="quiet-card pad">
        <p className="kicker">For students</p>
        <h3 className="font-display" style={{ fontSize: 20, margin: '0 0 8px' }}>Practise like the real exam</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', fontSize: 14.5, lineHeight: 1.7 }}>
          <li>Timed blocks in ACER format</li>
          <li>Mistake bank that reschedules misses</li>
          <li>No account, gentle streaks</li>
        </ul>
      </div>
      <div className="quiet-card pad">
        <p className="kicker">For parents</p>
        <h3 className="font-display" style={{ fontSize: 20, margin: '0 0 8px' }}>Free, private, honest</h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', fontSize: 14.5, lineHeight: 1.7 }}>
          <li>Free forever, no account or data collection</li>
          <li>Progress summary you can print</li>
          <li>Sourced school facts, no outcome promises</li>
        </ul>
      </div>
    </div>
  );
}

// ---------- Founder note (real only) ----------
export function FounderNote() {
  return (
    <section className="quiet-card pad" aria-label="Why it's free" style={{ marginTop: 40 }}>
      <p className="kicker">Why it&apos;s free · who made it</p>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 999,
            background: 'var(--text)',
            color: 'var(--bg)',
            fontWeight: 800,
          }}
        >
          S
        </span>
        <div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, maxWidth: '65ch' }}>
            SEHS Study is a small independent practice site. It stays free because it runs in your browser — no
            accounts, no servers to feed. School names and crests are used for identification only and can be
            removed in one line.
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            No invented testimonials. No predicted ranks. Readiness here means coverage + accuracy, labelled as such.
          </p>
        </div>
      </div>
    </section>
  );
}
