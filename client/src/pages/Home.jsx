import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, pretty } from '../lib/api';
import { keys } from '../lib/store';
import { Button } from '../components/ui/button';
import { AuroraText, BlurFade, DeckCard, Marquee, Meteors, NumberTicker, Particles, ShimmerButton, ShinyBadge, Skeleton, WordRotate, AnimatedGrid, AnimatedList, SparklesText, DotPattern, Magnet, ClickSpark, StarBorder, TextGenerate, BlurText, SpotlightCard } from '../components/magic';
import { ResourceCard } from '../components/cards';
import { BoxReveal, SpinningText, VanishInput, Typewriter, ScrollVelocity, Ripple, InteractiveHover, OrbitingCircles } from '../components/bits';
import { BentoGrid, BentoCard, MiniTimer, MiniViewer, MiniDeck, MiniPen, MiniBars, MiniLines, ContainerScroll, AuroraBg, SnapCarousel, Evervault } from '../components/ace';

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

function Hero() {
  const navigate = useNavigate();
  return (
    <section className="mhero relative overflow-hidden" aria-label="Search" style={{ padding: '56px 24px 10px', maxWidth: 1060 }}>
      <DotPattern />
      <Particles />
      <Meteors count={5} />
      <div className="mhero-inner relative">
        <BlurFade>
          <span className="flex flex-wrap items-center gap-3">
            <ShinyBadge>
              <SparklesText count={5}>✦ Victorian selective entry · Year 8 → Year 9 · ACER format</SparklesText>
            </ShinyBadge>
            <SpinningText text="FREE FOREVER • NO ACCOUNT • " size={92}>
              ✦
            </SpinningText>
          </span>
        </BlurFade>
        <BlurFade delay={0.08}>
          <BoxReveal delay={0.1}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(38px,6vw,64px)', lineHeight: 1.04, letterSpacing: '-.025em', margin: '18px 0 14px', fontWeight: 700 }}>
              Study <AuroraText>anything</AuroraText>.<br />
              <span className="hl-stroke">Master <WordRotate words={['maths', 'verbal reasoning', 'reading', 'writing', 'vocabulary']} />.
                <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8 C 60 2, 140 2, 198 7" /></svg>
              </span>
            </h1>
          </BoxReveal>
        </BlurFade>
        <BlurFade delay={0.16}>
          <p className="lede" style={{ color: 'var(--mut)', fontSize: 17, maxWidth: '62ch', margin: '0 0 22px' }}>
            Past papers, flashcards and timed mocks for Victoria&apos;s selective entry exam — the ACER test Year 8 students sit for Year 9 entry into Melbourne High, Mac.Rob, Nossal and Suzanne Cory. No account, just study.
          </p>
        </BlurFade>
        <BlurFade delay={0.22}>
          <div className="mhero-ctas" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 26 }}>
            <Magnet>
              <ClickSpark>
                <ShimmerButton onClick={() => navigate('/study')}>Start studying →</ShimmerButton>
              </ClickSpark>
            </Magnet>
            <Magnet strength={12}>
              <Link
                to="/mocks"
                className="lift inline-flex min-h-[42px] items-center rounded-xl border px-5 py-2.5 text-sm font-bold"
                style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
              >
                Take a timed mock
              </Link>
            </Magnet>
          </div>
        </BlurFade>
        <BlurFade delay={0.28}>
          <VanishInput onSearch={(v) => navigate('/search?q=' + encodeURIComponent(v))} />
          <p className="mt-2 text-xs" style={{ color: 'var(--faint)' }}>Press <kbd className="kbd">/</kbd> anywhere to jump here</p>
        </BlurFade>
      </div>
    </section>
  );
}

function LearnPreview() {
  const navigate = useNavigate();
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
        <Button size="sm" variant="default" onClick={() => navigate('/study')}>
          Open flashcards
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate('/mocks')}>
          Take a timed mock
        </Button>
      </p>
    </section>
  );
}

export default function Home() {
  const [stats] = useApi(() => api.stats(), []);
  const [deckCount, setDeckCount] = useState(null);
  useEffect(() => {
    api
      .decks()
      .then((j) => setDeckCount((j.decks || []).length))
      .catch(() => {});
  }, []);
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
  const pdfs = (search?.results || []).filter((r) => r.fileType === 'pdf').slice(0, 6);

  return (
    <div className="mx-auto max-w-[1060px] px-4 pb-12 sm:px-6">
      <Hero />

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
          ['Resources', stats?.publicResources ?? '–'],
          ['Timed mocks', 4],
          ['Flashcard decks', deckCount ?? '–'],
          ['Writing prompts', 80],
        ].map(([l, n]) => (
          <div key={l} className="flex min-w-[118px] flex-col rounded-xl border px-4 py-2.5 shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <dd className="order-1 font-display text-[23px] font-bold tabular-nums">
              {typeof n === 'number' ? <NumberTicker value={n} /> : <span aria-label="loading">–</span>}
            </dd>
            <dt className="order-2 text-[11px] font-bold uppercase tracking-[.07em]" style={{ color: 'var(--faint)' }}>
              {l}
            </dt>
          </div>
        ))}
      </dl>

      <BlurFade className="mt-4">
        <Link
          to="/exam-guide"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border px-4 py-3 text-[13.5px] shadow-sm transition-all hover:-translate-y-px"
          style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
        >
          <strong>The selective entry test:</strong>
          <span style={{ color: 'var(--mut)' }}>Maths + Quant 60 min</span>
          <span style={{ color: 'var(--faint)' }}>·</span>
          <span style={{ color: 'var(--mut)' }}>Reading + Verbal 55 min</span>
          <span style={{ color: 'var(--faint)' }}>·</span>
          <span style={{ color: 'var(--mut)' }}>Writing 40 min</span>
          <span className="ml-auto font-bold" style={{ color: 'var(--acc)' }}>
            Exam guide →
          </span>
        </Link>
      </BlurFade>

      <section aria-label="Where you could be in Year 9" className="mt-10">
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--acc)' }}>
              Victorian selective entry · Year 9 intake
            </p>
            <h2 className="mt-1 font-display text-[26px] font-bold">
              <TextGenerate words="Four schools. One exam. Walk in ready." />
            </h2>
            <p className="mt-2 max-w-[58ch] text-[15px]" style={{ color: 'var(--mut)' }}>
              Around 1,000 Year 9 places across Melbourne High, Mac.Robertson Girls&apos;, Nossal and Suzanne Cory.
              Offers come from the official selection process — this site exists so you meet exam day prepared, not surprised.
            </p>
          </div>
          <OrbitingCircles core="✦" items={['MHS', 'MRG', 'NHS', 'SCS']} radius={72} duration={20} />
        </div>
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Melbourne High', 'MHS', 'Boys · South Yarra', 'The academic powerhouse on the hill — generations of high achievers.'],
            ['Mac.Robertson Girls’', 'MRG', 'Girls · Melbourne', 'A storied inner-city school for high-achieving girls.'],
            ['Nossal', 'NHS', 'Co-ed · Berwick', 'Modern co-ed excellence in the south-east.'],
            ['Suzanne Cory', 'SCS', 'Co-ed · Werribee', 'Purpose-built selective schooling in the west.'],
          ].map(([name, short, facts, line], k) => (
            <BlurFade key={name} delay={k * 0.06}>
              <SpotlightCard className="h-full rounded-2xl border shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
                <div className="flex h-full flex-col p-[18px]">
                  <span className="tnum grid h-11 w-11 place-items-center rounded-xl border text-sm font-extrabold" style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)', color: 'var(--acc)' }}>
                    {short}
                  </span>
                  <h3 className="mt-2.5 font-display text-[16px] font-bold">{name}</h3>
                  <p className="text-xs font-semibold" style={{ color: 'var(--faint)' }}>{facts}</p>
                  <p className="mb-3 mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>{line}</p>
                  <Link to="/exam-guide" className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--acc)' }}>
                    How to prepare <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </SpotlightCard>
            </BlurFade>
          ))}
        </div>
      </section>

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
            <Link to={next.href} className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[var(--primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--primary-foreground)]">
              Continue →
            </Link>
          </div>
          <div className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <h3 className="font-display text-[15.5px] font-bold">Question of the day</h3>
            <p className="text-xs" style={{ color: 'var(--faint)' }}>AI-generated sample — practise only, not official material.</p>
            <Qotd />
          </div>
        </div>
      )}

      {recents.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">Your activity</h2>
          <AnimatedList
            className="flex flex-col gap-2"
            items={recents.slice(0, 5).map((v) => ({ key: v.id, v }))}
            renderItem={({ v }) => (
              <Link
                to={'/r/' + v.id}
                className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-sm transition-all hover:-translate-y-px"
                style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
              >
                <span className="grid h-8 w-8 flex-none place-items-center rounded-lg border text-sm" style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)' }}>
                  ▢
                </span>
                <span className="truncate font-semibold">{v.displayTitle || v.title}</span>
                <span className="ml-auto flex-none text-xs" style={{ color: 'var(--faint)' }}>
                  Recently opened →
                </span>
              </Link>
            )}
          />
        </>
      )}

      <ScrollVelocity className="mt-8 border-y py-2.5" base={60}>
        {['maths', 'verbal reasoning', 'quantitative reasoning', 'reading', 'writing', 'vocabulary', 'timed mocks', 'past papers'].map((w) => (
          <span key={w} className="mx-5 font-display text-lg font-bold" style={{ color: 'var(--faint)' }}>
            {w} <span style={{ color: 'var(--acc)' }}>✦</span>
          </span>
        ))}
      </ScrollVelocity>

      <BlurText as="h2" className="mb-3 mt-7 font-display text-[22px] font-bold">Study modes</BlurText>
      <BentoGrid>
        <StarBorder className="sm:col-span-2">
          <BentoCard
            to="/mocks"
            title="Timed mocks"
            desc="Full-length blocks with real timing, instant scoring and explanations. Fresh questions every attempt."
            badge="Most loved"
            header={<MiniTimer />}
          />
        </StarBorder>
        <BentoCard to="/study" title="Flashcards" desc="800+ cards with smart repetition." header={<MiniDeck />} />
        <BentoCard to="/writing" title="Writing studio" desc="80 prompts, timer, rubric feedback." header={<MiniPen />} />
        <BentoCard to="/drills" title="Maths drills" desc="Infinite Year-8 problem sets." header={<MiniBars />} />
        <BentoCard to="/reading" title="Reading room" desc="Passages with questions." header={<MiniLines />} />
        <BentoCard
          to="/search"
          title="Library"
          desc={stats?.publicResources ? `${Number(stats.publicResources).toLocaleString()} papers and notes.` : 'Papers and notes.'}
          header={<MiniViewer />}
        />
      </BentoGrid>

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

      <ContainerScroll
        title="Read inside the site — no new tabs"
        sub="Every paper opens in the built-in viewer with your notes, progress and related material alongside. One tap from any card."
      >
        <div style={{ background: 'var(--ok-paper, #FBFAF6)' }}>
          <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--line)' }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--bad)' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--warn)' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--ok)' }} />
            <span className="ml-2 text-xs font-bold">Document viewer</span>
            <span className="ml-auto flex gap-1.5">
              <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: 'var(--bg2)' }}>⛶</span>
              <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>Read here ↓</span>
            </span>
          </div>
          <div className="space-y-2.5 p-5">
            <div className="h-3.5 w-2/3 rounded" style={{ background: 'var(--txt)', opacity: 0.85 }} />
            <div className="h-2.5 w-1/3 rounded" style={{ background: 'var(--mark-bg)' }} />
            {[95, 99, 90, 97, 70].map((w, k) => (
              <div key={k} className="h-2 rounded" style={{ width: `${w}%`, background: 'var(--line)' }} />
            ))}
            <div className="flex gap-2 pt-1">
              <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>✓ Answers included</span>
              <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--bg2)', color: 'var(--mut)' }}>My note — saved ✓</span>
            </div>
          </div>
        </div>
      </ContainerScroll>

      <BlurText as="h2" className="mb-3 mt-7 font-display text-[22px] font-bold">New arrivals</BlurText>
      {!fresh ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <SnapCarousel label="new arrivals">
          {(fresh.results || []).map((v) => (
            <div key={v.id} className="w-[300px] flex-none snap-start sm:w-[340px]">
              <ResourceCard v={v} showDesc={false} />
            </div>
          ))}
        </SnapCarousel>
      )}

      {!!trending?.results?.length && (
        <>
          <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">Trending this week</h2>
          <SnapCarousel label="trending">
            {trending.results.map((v) => (
              <div key={v.id} className="w-[300px] flex-none snap-start sm:w-[340px]">
                <ResourceCard v={v} showDesc={false} />
              </div>
            ))}
          </SnapCarousel>
        </>
      )}

      <BlurText as="h2" className="mb-3 mt-7 font-display text-[22px] font-bold">Practice tests</BlurText>
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

      <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">Resources with answers <small className="ml-1 text-xs font-semibold" style={{ color: 'var(--faint)' }}><Link to="/search?answers=1" style={{ color: 'var(--acc)' }}>View all</Link></small></h2>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {answers.map((v) => (
          <ResourceCard key={v.id} v={v} />
        ))}
      </div>

      <h2 className="mb-3 mt-7 font-display text-[22px] font-bold">PDF papers <small className="ml-1 text-xs font-semibold" style={{ color: 'var(--faint)' }}><Link to="/search?type=pdf" style={{ color: 'var(--acc)' }}>View all</Link></small></h2>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {pdfs.map((v) => (
          <ResourceCard key={v.id} v={v} />
        ))}
      </div>

      <AuroraBg className="mt-10 px-6 py-10 text-center sm:px-10">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--acc)' }}>Not sure where to start?</p>
        <h2 className="mx-auto mt-2 max-w-[24ch] font-display text-2xl font-bold sm:text-3xl">
          <TextGenerate words="Take the short diagnostic." />
        </h2>
        <p className="mx-auto mt-2 max-w-[52ch] text-[15px]" style={{ color: 'var(--mut)' }}>
          <Typewriter lines={['Ten minutes. Real timing.', 'Find your gaps in maths, reasoning, reading.', 'Get a concrete next step — no account.']} />
        </p>
        <p className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Ripple>
            <InteractiveHover to="/mocks" primary>Take the diagnostic</InteractiveHover>
          </Ripple>
          <InteractiveHover to="/exam-guide">Read the exam guide</InteractiveHover>
        </p>
      </AuroraBg>
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
          Answer: <Evervault text={`${item.options[item.answer]}`} />. {item.explain}
        </p>
      )}
      {!show && (
        <Button size="sm" variant="secondary" onClick={() => setShow(true)} className="mt-2">
          Show answer
        </Button>
      )}
    </div>
  );
}
