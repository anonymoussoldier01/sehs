// Landing "/" — marketing surface only (no sidebar, no app chrome).
// One message, one primary button per section, product visible in hero.
// App state (Your path, Continue, countdown, target chip) lives in /study + /app.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { api } from '../lib/api';
import {
  FourDoors,
  ScarcityBand,
  SampleQuestion,
  HowItWorks,
  FaqSection,
  ClosingCta,
  ProofStrip,
  TopicRibbon,
  Reveal,
  FeatureRows,
  TrustCards,
  FounderNote,
  useTargetSchool,
} from '../components/landing';
import { getH1Variant, track, trackH1Exposure } from '../lib/analytics';

function useApi(fn, deps) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    fn()
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}

// ---------- Hero demo: browser window with auto-cycling product tabs ----------
// launch-ui MockupFrame + Aceternity hero-with-tabs, re-skinned: traffic
// dots, live URL bar, Sample / Mocks / Flashcards tabs. Auto-rotates every
// 10s, pauses on hover/focus, static first tab under reduced-motion. Every
// tab shows the real thing (live sample) or honest whats-inside copy with
// one real link — no mock timers, no fake scores.
const HERO_TABS = [
  { id: 'sample', label: 'Sample', url: 'sehs.study — try it live', status: 'Live sample · instant feedback, no account' },
  { id: 'mocks', label: 'Mocks', url: 'sehs.study/mocks', status: 'Best scores stay in this browser' },
  { id: 'flashcards', label: 'Flashcards', url: 'sehs.study/study', status: 'Spaced review until misses stick' },
];

function HeroDemo() {
  const [tab, setTab] = useState('sample');
  const [cycle, setCycle] = useState(0);
  const [held, setHeld] = useState(false);
  const active = HERO_TABS.find((t) => t.id === tab) || HERO_TABS[0];

  useEffect(() => {
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    } catch { return; }
    if (held) return;
    const t = setTimeout(() => {
      setTab((cur) => {
        const i = HERO_TABS.findIndex((x) => x.id === cur);
        return HERO_TABS[(i + 1) % HERO_TABS.length].id;
      });
    }, 10000);
    return () => clearTimeout(t);
  }, [tab, cycle, held]);

  const pick = (id) => {
    setTab(id);
    setCycle((c) => c + 1);
    track('hero_tab', { tab: id });
  };

  return (
    <div
      className="browser-frame"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div className="browser-bar" aria-hidden="true">
        <span className="browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="browser-url">{active.url}</span>
      </div>
      <div className="hero-tablist" role="tablist" aria-label="Product preview">
        {HERO_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={String(t.id === tab)}
            aria-controls={`hero-panel-${t.id}`}
            id={`hero-tab-${t.id}`}
            tabIndex={t.id === tab ? undefined : -1}
            onClick={() => pick(t.id)}
            className="hero-tab"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        key={active.id}
        className="hero-panel hero-swap"
        role="tabpanel"
        id={`hero-panel-${active.id}`}
        aria-labelledby={`hero-tab-${active.id}`}
      >
        {active.id === 'sample' ? (
          <SampleQuestion hero />
        ) : active.id === 'mocks' ? (
          <div style={{ padding: 6 }}>
            <p className="telemetry">
              Timed mocks · <strong>ACER format</strong>
            </p>
            <p style={{ margin: '8px 0', fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              Exam mode, real timing
            </p>
            <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
              <li>4 full mocks · 60 / 55 / 40-minute blocks</li>
              <li>Flag, skip, review before submitting</li>
              <li>Misses return to your review queue</li>
            </ul>
            <Link to="/mocks" className="hero-primary" style={{ textDecoration: 'none' }}>
              Start a free mock
            </Link>
          </div>
        ) : (
          <div style={{ padding: 6 }}>
            <p className="telemetry">
              Flashcards · <strong>spaced repetition</strong>
            </p>
            <p style={{ margin: '8px 0', fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              Review that sticks
            </p>
            <ul style={{ margin: '0 0 12px', paddingLeft: 18, color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
              <li>14 decks plus your own cards</li>
              <li>Rate Again / Hard / Good / Easy</li>
              <li>Works offline in this browser</li>
            </ul>
            <Link to="/study" className="hero-primary" style={{ textDecoration: 'none' }}>
              Review flashcards
            </Link>
          </div>
        )}
      </div>
      <p className="hero-status" role="status">
        <span className="dot" aria-hidden="true" />
        {active.status}
      </p>
    </div>
  );
}

// ---------- Hero: text 6 / visual 6. Product (live demo) is the visual. ----------
// Eyebrow pill secondary, H1 max 2 lines, subhead one sentence 18-20px 46ch,
// ONE ivory primary + ghost, three ticks. Single masked spotlight, no edges.
function Hero() {
  const navigate = useNavigate();
  const variant = useMemo(() => getH1Variant(), []);
  useEffect(() => {
    trackH1Exposure(variant.id);
    document.title = 'SEHS Study · selective entry test prep (papers, flashcards, mocks)';
  }, [variant.id]);

  const goMock = () => {
    track('cta_hero_mock', { variant: variant.id });
    navigate('/mocks');
  };
  const goLibrary = () => track('cta_hero_library', { variant: variant.id });

  return (
    <section className="hero-landing" aria-label="What is this and is it for me?">
      <div className="hero-spotlight" aria-hidden="true" />
      <div className="hero-dots" aria-hidden="true" />
      <div className="hero-landing-inner">
        <div className="hero-copy">
          <p
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', color: 'var(--text-2)' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', flex: 'none' }} aria-hidden="true" />
            Victorian selective entry · ACER format
          </p>
          <h1 className="hero-h1" style={{ marginTop: 14 }}>
            {variant.id === 'A' ? (
              <>
                <span className="sent">Prepare for Melbourne High, Mac.Rob, Nossal and Suzanne Cory. </span>
                <span className="hl-stroke">
                  <span className="hl-text">One exam.</span>
                </span>
              </>
            ) : (
              <>
                <span className="sent">Four doors. </span>
                <span className="hl-stroke">
                  <span className="hl-text">One exam.</span>
                </span>
              </>
            )}
          </h1>
          <p className="hero-sub" style={{ fontSize: 19, maxWidth: '46ch' }}>
            Free past papers, timed mocks and flashcards for Victoria&apos;s selective entry exam.
          </p>
          <div className="hero-ctas">
            <button type="button" onClick={goMock} className="hero-primary" data-analytics="cta-hero-mock">
              Start a free mock <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <Link to="/search?type=pdf" className="hero-ghost" onClick={goLibrary} data-analytics="cta-hero-library">
              Browse past papers
            </Link>
          </div>
          <ul
            aria-label="Free forever, no account, saved in this browser"
            style={{ display: 'flex', gap: 14, flexWrap: 'wrap', listStyle: 'none', margin: '12px 0 0', padding: 0, fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}
          >
            {['Free forever', 'No account', 'Saved in this browser'].map((t) => (
              <li key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" style={{ color: 'var(--accent)' }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroDemo />

      </div>
    </section>
  );
}

// ---------- Home (landing only — no app chrome) ----------
export default function Home() {
  const stats = useApi(() => api.stats(), []);
  const telemetry = useApi(() => api.nativeStats().catch(() => null), []);
  const [deckCount, setDeckCount] = useState(null);
  const { school } = useTargetSchool();

  useEffect(() => {
    api
      .decks()
      .then((j) => setDeckCount((j.decks || []).length))
      .catch(() => {});
  }, []);

  const writingCount = telemetry?.counts?.writing ?? 80;

  return (
    <div className="page-browse home-landing pb-12">
      <Hero />
      <ProofStrip stats={stats} deckCount={deckCount} writingCount={writingCount} />
      <TopicRibbon />

      <section id="four-doors" aria-label="Which school am I aiming for?" className="home-section home-doors">
        <Reveal>
          <p className="kicker">Which school am I aiming for</p>
          <h2 className="section-title" style={{ fontSize: 'clamp(2rem,3.5vw,2.75rem)', letterSpacing: '-0.02em' }}>
            The Four Doors
          </h2>
        </Reveal>
        <p className="section-sub">
          {school ? (
            <>
              Target set: {school.shortName}.{' '}
              <Link to="/study" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                Go to my study hub
              </Link>
            </>
          ) : (
            'One exam opens four government-school gates. Pick a door — then go to your study hub.'
          )}
        </p>
        <FourDoors />
        {school ? (
          <p role="status" style={{ marginTop: 12, fontSize: 14, fontWeight: 700 }}>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3.5 py-2"
              style={{ borderColor: 'var(--accent-line)', background: 'var(--accent-soft)', color: 'var(--text)' }}
              data-feedback="info"
            >
              ✓ Target set: {school.shortName}.{' '}
              <Link to="/study" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                Go to my study hub
              </Link>
            </span>
          </p>
        ) : null}
      </section>

      <ScarcityBand />

      <section aria-label="What will I actually do?" className="home-section">
        <Reveal>
          <p className="kicker">What will I actually do</p>
          <h2 className="section-title" style={{ fontSize: 'clamp(2rem,3.5vw,2.75rem)' }}>
            How it works
          </h2>
          <hr className="section-rule" />
        </Reveal>
        <HowItWorks />
      </section>

      <section aria-label="What's inside?" className="home-section home-band">
        <Reveal>
          <p className="kicker">What&apos;s inside</p>
          <h2 className="section-title" style={{ fontSize: 'clamp(2rem,3.5vw,2.75rem)' }}>
            Practise, review, write
          </h2>
          <hr className="section-rule" />
        </Reveal>
        <FeatureRows />
      </section>

      <section aria-label="Why trust it?" className="home-section home-band">
        <Reveal>
          <p className="kicker">Why trust it</p>
          <h2 className="section-title" style={{ fontSize: 'clamp(2rem,3.5vw,2.75rem)' }}>
            For students and parents
          </h2>
          <hr className="section-rule" />
        </Reveal>
        <TrustCards />
        <FounderNote />
      </section>

      <section aria-label="Questions, answered" className="home-section">
        <Reveal>
          <p className="kicker">Questions, answered</p>
          <h2 className="section-title" style={{ fontSize: 'clamp(2rem,3.5vw,2.75rem)' }}>
            FAQ
          </h2>
          <hr className="section-rule" />
        </Reveal>
        <FaqSection />
      </section>

      <ClosingCta onPrimary={() => track('cta_closing_mock', {})} />
    </div>
  );
}
