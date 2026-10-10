import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, pretty } from '../lib/api';
import { keys, pushRecent } from '../lib/store';
import { useToast } from '../providers';
import { AuroraText, BlurFade, DeckCard, Empty, Marquee, Meteors, NumberTicker, Particles, ShimmerButton, ShinyBadge, Skeleton, WordRotate, AnimatedGrid } from '../components/magic';
import { ResourceCard, highlight } from '../components/cards';

function useApi(fn, deps) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let live = true;
    fn()
      .then((d) => live && setData(d))
      .catch((e) => live && setErr(e));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [data, err];
}

function Hero({ total }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <section className="mhero relative" aria-label="Search" style={{ padding: '56px 24px 10px', maxWidth: 1060 }}>
      <Particles />
      <Meteors count={5} />
      <div className="mhero-inner relative">
        <BlurFade>
          <ShinyBadge>
            ✦ {Number(total || 0).toLocaleString()} resources · flashcards · mocks · free forever
          </ShinyBadge>
        </BlurFade>
        <BlurFade delay={0.08}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(38px,6vw,64px)', lineHeight: 1.04, letterSpacing: '-.025em', margin: '18px 0 14px', fontWeight: 700 }}>
            Study <AuroraText>anything</AuroraText>.<br />
            Master <WordRotate words={['maths', 'verbal reasoning', 'reading', 'writing', 'vocabulary']} />.
          </h1>
        </BlurFade>
        <BlurFade delay={0.16}>
          <p className="lede" style={{ color: 'var(--mut)', fontSize: 17, maxWidth: '62ch', margin: '0 0 22px' }}>
            Past papers, flashcards and timed mocks for selective-entry exams — plus infinite drills and an AI tutor. No account, just study.
          </p>
        </BlurFade>
        <BlurFade delay={0.22}>
          <div className="mhero-ctas" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 26 }}>
            <ShimmerButton onClick={() => navigate('/study')}>Start studying →</ShimmerButton>
            <Link
              to="/mocks"
              className="inline-flex min-h-[42px] items-center rounded-xl border px-5 py-2.5 text-sm font-bold transition-all hover:-translate-y-px"
              style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
            >
              Take a timed mock
            </Link>
          </div>
        </BlurFade>
        <BlurFade delay={0.28}>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) navigate('/search?q=' + encodeURIComponent(q.trim()));
            }}
            className="searchbox flex min-h-[60px] items-center gap-2.5 rounded-2xl border py-0 pl-[18px] pr-2 shadow-lg transition-all"
            style={{ background: 'var(--panel)', borderColor: 'var(--line2)' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ color: 'var(--faint)', flex: 'none' }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder="Search papers, decks, topics — try “fractions”…"
              aria-label="Search study resources"
              className="min-w-0 flex-1 bg-transparent py-4 text-[17px] outline-none"
            />
            <kbd className="hidden rounded-md border px-2 py-0.5 text-xs sm:block" style={{ borderColor: 'var(--line2)', background: 'var(--bg2)', color: 'var(--mut)' }} title="Press / to focus">
              /
            </kbd>
          </form>
        </BlurFade>
      </div>
    </section>
  );
}

function LearnPreview() {
  const [q, setQ] = useState(null);
  const [picked, setPicked] = useState(null);
  useEffect(() => {
    let live = true;
    api
      .mocks()
      .then((j) => (j.mocks?.[0] ? api.mock(j.mocks[0].id) : null))
      .then((j) => {
        if (!live || !j?.mock?.questions?.length) return;
        setQ(j.mock.questions[Math.floor(Math.random() * j.mock.questions.length)]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="beam-card rounded-2xl border p-[26px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }} aria-label="Sample learn question">
      <p className="text-xs font-bold" style={{ color: 'var(--faint)' }}>
        LEARN · SAMPLE
      </p>
      {!q ? (
        <p className="mt-2 font-display text-xl">Loading a sample question…</p>
      ) : (
        <>
          <p className="mb-4 mt-1.5 font-display text-xl">{q.stem}</p>
          <div className="flex flex-col gap-2.5">
            {q.options.map((o, k) => {
              const isAns = k === q.answer;
              const sel = picked === k;
              return (
                <button
                  key={k}
                  disabled={picked !== null}
                  onClick={() => setPicked(k)}
                  className="min-h-[52px] w-full rounded-xl border-[1.5px] px-4 py-3.5 text-left text-[14.5px] font-semibold transition-all hover:-translate-y-px disabled:cursor-default"
                  style={{
                    background: picked !== null && isAns ? 'var(--ok-bg)' : sel ? 'var(--bad-bg)' : 'var(--bg)',
                    borderColor: picked !== null && isAns ? 'var(--ok)' : sel ? 'var(--bad)' : 'var(--line2)',
                  }}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <p className="mt-1 text-[13.5px]" style={{ color: picked === q.answer ? 'var(--ok)' : 'var(--mut)' }}>
              {picked === q.answer ? 'Correct. ' : 'Not quite — the answer is highlighted. '}
              {q.explain || ''}
            </p>
          )}
        </>
      )}
      <p className="mt-3.5 flex flex-wrap gap-2">
        <Link to="/study" className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
          Open flashcards
        </Link>
        <Link to="/mocks" className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
          Take a timed mock
        </Link>
      </p>
    </section>
  );
}

export default function Home() {
  const toast = useToast();
  const [stats] = useApi(() => api.stats(), []);
  const [fresh] = useApi(() => api.fresh().catch(() => ({ results: [] })), []);
  const [trending] = useApi(() => api.trending().catch(() => ({ results: [] })), []);
  const [search] = useApi(() => api.search({ q: '', per: 24 }).catch(() => null), []);
  const [recents, setRecents] = useState([]);
  const [next, setNext] = useState({ text: 'Take the free diagnostic to find your gaps.', href: '/mocks' });

  useEffect(() => {
    try {
      const rec = JSON.parse(localStorage.getItem(keys.recent) || '[]');
      if (rec.length) {
        api.byIds(rec.map((x) => x.id)).then((j) => setRecents(j.results || [])).catch(() => {});
      }
    } catch {
      /* noop */
    }
    try {
      const misses = JSON.parse(localStorage.getItem(keys.mistakes) || '[]');
      const by = {};
      misses.forEach((m) => {
        by[m.strand] = (by[m.strand] || 0) + 1;
      });
      const top = Object.keys(by).sort((a, b) => by[b] - by[a])[0];
      if (top && by[top] >= 2) setNext({ text: `Your misses pile up in ${top} — hit drills or a mock.`, href: '/drills' });
      else if (misses.length) setNext({ text: `Review ${misses.length} logged misses in the study hub.`, href: '/study' });
    } catch {
      /* noop */
    }
    document.title = 'SEHS Study — flashcards, mocks & past papers';
  }, []);

  const subjects = useMemo(() => {
    const m = new Map();
    for (const r of search?.results || []) {
      const s = r.subject || r.category;
      if (s) m.set(s, (m.get(s) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [search]);

  const practice = (search?.results || []).filter((r) => r.category === 'practice-test').slice(0, 6);
  const answers = (search?.results || []).filter((r) => r.answersIncluded).slice(0, 6);

  return (
    <div className="mx-auto max-w-[1060px] px-4 pb-12 sm:px-6">
      <Hero total={stats?.publicResources} />

      <BlurFade className="mt-6">
        <Marquee>
          {['VSSE', 'Maths + answers', 'Numerical reasoning', 'Reading comprehension', 'Verbal analogy', 'Writing prompts', 'Exam guide', 'Vocabulary'].map((t) => (
            <Link
              key={t}
              to={'/search?q=' + encodeURIComponent(t === 'Maths + answers' ? 'maths' : t)}
              className="inline-flex min-h-[38px] shrink-0 items-center rounded-full border px-4 text-[13px] font-bold transition-all hover:-translate-y-px"
              style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
            >
              {t}
            </Link>
          ))}
        </Marquee>
      </BlurFade>

      <dl className="mt-5 flex flex-wrap gap-2.5" aria-label="Collection statistics">
        {[
          ['Resources', stats?.publicResources || 0],
          ['Timed mocks', 4],
          ['Flashcard decks', 8],
          ['Writing prompts', 80],
        ].map(([l, n]) => (
          <div key={l} className="flex min-w-[118px] flex-col rounded-xl border px-4 py-2.5 shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <dd className="order-1 font-display text-[23px] font-bold tabular-nums">
              <NumberTicker value={n} />
            </dd>
            <dt className="order-2 text-[11px] font-bold uppercase tracking-[.07em]" style={{ color: 'var(--faint)' }}>
              {l}
            </dt>
          </div>
        ))}
      </dl>

      <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">Recents</h2>
      {recents.length ? (
        <AnimatedGrid className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {recents.slice(0, 6).map((v, i) => (
            <BlurFade key={v.id} delay={i * 0.05}>
              <ResourceCard v={v} showDesc={false} />
            </BlurFade>
          ))}
        </AnimatedGrid>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          <div className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <h3 className="font-display text-[15.5px] font-bold">{next.text}</h3>
            <p className="mb-3 mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
              Your recent decks and papers appear here.
            </p>
            <Link to={next.href} className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
              Continue →
            </Link>
          </div>
          <div className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <h3 className="font-display text-[15.5px] font-bold">Question of the day</h3>
            <Qotd />
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">Study modes</h2>
      <div className="bento grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Link to="/mocks" className="bento-card beam-card span-2 col-span-2">
          <span className="bico">◷</span>
          <h3>Timed mocks</h3>
          <p>Full-length blocks with real timing, instant scoring and explanations. Fresh questions every attempt.</p>
          <span className="text-[13.5px] font-bold" style={{ color: 'var(--acc)' }}>
            Generate a mock →
          </span>
        </Link>
        <Link to="/study" className="bento-card">
          <span className="bico">▢</span>
          <h3>Flashcards</h3>
          <p>775+ cards with smart repetition.</p>
        </Link>
        <Link to="/writing" className="bento-card">
          <span className="bico">✒</span>
          <h3>Writing studio</h3>
          <p>80 prompts, timer, AI feedback.</p>
        </Link>
        <Link to="/drills" className="bento-card">
          <span className="bico">▦</span>
          <h3>Maths drills</h3>
          <p>Infinite Year-8 problem sets.</p>
        </Link>
        <Link to="/reading" className="bento-card">
          <span className="bico">☰</span>
          <h3>Reading room</h3>
          <p>Passages with questions.</p>
        </Link>
        <Link to="/exam-guide" className="bento-card">
          <span className="bico">≡</span>
          <h3>Exam guide</h3>
          <p>Format, pacing, 12-week plan.</p>
        </Link>
        <Link to="/search" className="bento-card">
          <span className="bico">⚲</span>
          <h3>Library</h3>
          <p>1,600+ papers and notes.</p>
        </Link>
      </div>

      <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">
        For your next session <small className="ml-1 text-xs font-semibold" style={{ color: 'var(--faint)' }}>from the library</small>
      </h2>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3" style={{ gridAutoFlow: 'row' }}>
        {subjects.map(([s, c], i) => (
          <BlurFade key={s} delay={i * 0.04}>
            <DeckCard to={'/search?q=' + encodeURIComponent(s)} icon="▢" title={pretty(s)} sub={`${c} resources · flashcards + papers`} badge={`${c} resources`} />
          </BlurFade>
        ))}
      </div>

      <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">
        Learn questions <small className="ml-1 text-xs font-semibold" style={{ color: 'var(--faint)' }}>try one now</small>
      </h2>
      <LearnPreview />

      <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">New arrivals</h2>
      {!fresh ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {(fresh.results || []).map((v) => (
            <ResourceCard key={v.id} v={v} showDesc={false} />
          ))}
        </div>
      )}

      {!!trending?.results?.length && (
        <>
          <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">Trending this week</h2>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {trending.results.map((v) => (
              <ResourceCard key={v.id} v={v} showDesc={false} />
            ))}
          </div>
        </>
      )}

      <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">Practice tests</h2>
      {!search ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {practice.map((v) => (
            <ResourceCard key={v.id} v={v} />
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">Resources with answers</h2>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {answers.map((v) => (
          <ResourceCard key={v.id} v={v} />
        ))}
      </div>
    </div>
  );
}

function Qotd() {
  const [item, setItem] = useState(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    api
      .aiQuestions('verbal', 'question of the day ' + day, 3)
      .then((j) => j.questions?.length && setItem(j.questions[0]))
      .catch(() => {});
  }, []);
  if (!item) return <p className="text-sm" style={{ color: 'var(--mut)' }}>Warming up…</p>;
  return (
    <div>
      <p className="text-sm" style={{ color: 'var(--mut)' }}>
        {item.stem} — {item.options.join(' / ')}
      </p>
      {show && (
        <p className="mt-1 text-[13.5px]">
          Answer: {item.options[item.answer]}. {item.explain}
        </p>
      )}
      {!show && (
        <button
          onClick={() => setShow(true)}
          className="mt-2 inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold"
          style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
        >
          Show answer
        </button>
      )}
    </div>
  );
}
