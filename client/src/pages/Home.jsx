import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, pretty } from '../lib/api';
import { keys } from '../lib/store';
import { Layers } from 'lucide-react';
import { Button } from '../components/ui/button';
import { DeckCard, Marquee, NumberTicker, Skeleton, WordRotate, AnimatedGrid, AnimatedList, StarBorder } from '../components/magic';
import { ResourceCard } from '../components/cards';
import { VanishInput, InteractiveHover } from '../components/bits';
import { BentoGrid, BentoCard, MiniTimer, MiniViewer, MiniDeck, MiniPen, MiniBars, MiniLines, AuroraBg, SnapCarousel, Evervault, Lamp } from '../components/ace';

const TYPE_LABEL = { pdf: 'PDF', docx: 'Word', image: 'Image', archive: 'Archive', webpage: 'Web page', code: 'Support file', other: 'File' };

function useApi(fn, deps) {  const [data, setData] = useState(null);
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

function Hero({ stats, telemetry, deckCount }) {
  const navigate = useNavigate();
  return (
    <section className="hero-ledger hero-home dot-grid" aria-label="Search">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="min-w-0">
          <p className="kicker">Victorian selective entry · Year 8 → Year 9 · ACER format</p>
          <h1>
            Walk in ready.
            <br />
            <span className="hl-stroke">Master <WordRotate words={['maths', 'verbal reasoning', 'reading', 'writing', 'vocabulary']} />.
              <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8 C 60 2, 140 2, 198 7" /></svg>
            </span>
          </h1>
          <p className="lede">
            Past papers, flashcards and timed mocks for the ACER test Victorian Year 8 students sit for Year 9 entry into Melbourne High, Mac.Rob, Nossal and Suzanne Cory. Free forever, no account, everything saved in this browser.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0 22px' }}>
            <button
              onClick={() => navigate('/study')}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold transition-colors hover:brightness-110 active:translate-y-px"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Start studying →
            </button>
            <Link
              to="/mocks"
              className="inline-flex min-h-[44px] items-center rounded-[10px] border px-5 py-2.5 text-sm font-bold transition-colors"
              style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
            >
              Take a timed mock
            </Link>
          </div>
          <VanishInput onSearch={(v) => navigate('/search?q=' + encodeURIComponent(v))} />
          <p className="mt-2 text-xs" style={{ color: 'var(--faint)' }}>Press <kbd className="kbd">/</kbd> anywhere to jump here · free forever, no account</p>
          <p className="telemetry mt-2" aria-label="Live collection readout">
            lib <strong>{stats?.publicResources ? Number(stats.publicResources).toLocaleString() : '…'}</strong>
            {' · '}mocks <strong>{telemetry ? telemetry.mocks : '…'}</strong>
            {' · '}decks <strong>{deckCount ?? '…'}</strong>
            {' · '}prompts <strong>{telemetry ? telemetry.writing : '…'}</strong>
          </p>
        </div>
        <div className="hero-live min-w-0">
          <LearnPreview />
          <p className="mt-2 text-center text-xs" style={{ color: 'var(--faint)' }}>
            A real question from the timed mocks. Try it, then <Link to="/mocks" className="font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>take the full block</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ['01', 'Find the exact paper', 'Search 1,600+ past papers, notes and guides by topic, provider or file type. Answers included where available.', '/search', 'Search the library'],
    ['02', 'Practise under real time', 'Run 60, 55 and 40 minute blocks with instant scoring, explanations and a calm exam screen.', '/mocks', 'Take a timed mock'],
    ['03', 'Fix what you missed', 'Misses return on a spaced schedule in drills and the review queue until they stick.', '/study', 'Open the study hub'],
  ];
  return (
    <section aria-label="How it works">
      <h2 className="section-title">How it works</h2>
      <hr className="section-rule" />
      <div>
        {steps.map(([n, t, p, to, cta]) => (
          <div key={n} className="method-row">
            <span className="method-num">{n}</span>
            <span className="min-w-0">
              <span className="block font-display text-[16px] font-bold">{t}</span>
              <span className="block text-[14px]" style={{ color: 'var(--mut)' }}>{p}</span>
            </span>
            <Link to={to} className="link-slide flex-none text-[13.5px] font-bold" style={{ color: 'var(--acc)' }} aria-label={`${cta}: ${t}`}>
              {cta} →
            </Link>
          </div>
        ))}
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
    <section className="quiet-card beam-feature p-[26px]" aria-label="Sample learn question">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: 'var(--faint)' }}>
        Learn · sample
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
                  className="min-h-[52px] w-full rounded-[10px] border-[1.5px] px-4 py-3.5 text-left text-[14.5px] font-semibold transition-colors disabled:cursor-default"
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
              {picked === q.answer ? 'Correct. ' : 'Not quite. The answer is highlighted. '}
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
  const [telemetry, setTelemetry] = useState(null);
  useEffect(() => {
    api
      .nativeStats()
      .then((j) => setTelemetry(j.counts))
      .catch(() => {});
  }, []);
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
      if (top && by[top] >= 2) setNext({ text: `Your misses pile up in ${top}, hit drills or a mock.`, href: '/drills' });
      else if (misses.length) setNext({ text: `Review ${misses.length} logged misses in the study hub.`, href: '/study' });
    } catch {
      /* noop */
    }
    document.title = 'SEHS Study · flashcards, mocks & past papers';
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
    <div className="page-browse pb-12">
      <Hero stats={stats} telemetry={telemetry} deckCount={deckCount} />

      <div className="mt-6">
        <Marquee>
          {['VSSE', 'Maths + answers', 'Numerical reasoning', 'Reading comprehension', 'Verbal analogy', 'Writing prompts', 'Exam guide', 'Vocabulary'].map((t) => (
            <Link
              key={t}
              to={'/search?q=' + encodeURIComponent(t === 'Maths + answers' ? 'maths' : t)}
              className="inline-flex min-h-[38px] shrink-0 items-center rounded-full border px-4 text-[13px] font-bold transition-colors"
              style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
            >
              {t}
            </Link>
          ))}
        </Marquee>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Collection statistics">
        {[
          ['Resources', stats?.publicResources ?? '–'],
          ['Timed mocks', 4],
          ['Flashcard decks', deckCount ?? '–'],
          ['Writing prompts', 80],
        ].map(([l, n]) => (
          <div key={l} className="quiet-card flex min-w-0 flex-col px-4 py-2.5">
            <dd className="tnum order-1 font-display text-[23px] font-bold tabular-nums">
              {typeof n === 'number' ? <NumberTicker value={n} /> : <span aria-label="loading">–</span>}
            </dd>
            <dt className="order-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--faint)' }}>
              {l}
            </dt>
          </div>
        ))}
      </dl>

      <h2 className="section-title">Pick up where you left off</h2>
      <hr className="section-rule" />
      {recents.length ? (
        <AnimatedGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recents.slice(0, 6).map((v) => (
            <ResourceCard key={v.id} v={v} showDesc={false} />
          ))}
        </AnimatedGrid>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="quiet-card p-[18px]">
            <h3 className="font-display text-[15.5px] font-bold">{next.text}</h3>
            <p className="mb-3 mt-1 text-[14px]" style={{ color: 'var(--mut)' }}>
              Your recent decks and papers appear here.
            </p>
            <Link to={next.href} className="inline-flex min-h-[44px] items-center rounded-[10px] bg-[var(--primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--primary-foreground)]">
              Continue →
            </Link>
          </div>
          <div className="quiet-card p-[18px]">
            <h3 className="font-display text-[15.5px] font-bold">Question of the day</h3>
            <p className="text-xs" style={{ color: 'var(--faint)' }}>AI-generated sample, practise only, not official material.</p>
            <Qotd />
          </div>
        </div>
      )}

      {recents.length > 0 && (
        <AnimatedList
          className="quiet-card mt-3 divide-y overflow-hidden"
          items={recents.slice(0, 5).map((v) => ({ key: v.id, v }))}
          renderItem={({ v }) => (
            <Link
              to={'/r/' + v.id}
              className="index-row text-sm transition-colors hover:bg-[var(--acc-soft)]"
            >
              <span className="tnum grid h-8 w-8 flex-none place-items-center rounded-lg border text-xs font-extrabold tabular-nums" style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)', color: 'var(--acc)' }}>
                {String(v.fileType || 'F').slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate font-semibold" title={v.displayTitle || v.title}>{v.displayTitle || v.title}</span>
              <span className="ml-auto flex-none text-xs" style={{ color: 'var(--faint)' }}>
                Recently opened →
              </span>
            </Link>
          )}
        />
      )}

      <Link
        to="/exam-guide"
        className="quiet-card mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[14px]"
      >
        <strong>The selective entry test:</strong>
        <span className="tnum" style={{ color: 'var(--mut)' }}>Maths + Quant 60 min</span>
        <span style={{ color: 'var(--faint)' }} aria-hidden="true">·</span>
        <span className="tnum" style={{ color: 'var(--mut)' }}>Reading + Verbal 55 min</span>
        <span style={{ color: 'var(--faint)' }} aria-hidden="true">·</span>
        <span className="tnum" style={{ color: 'var(--mut)' }}>Writing 40 min</span>
        <span className="ml-auto font-bold" style={{ color: 'var(--acc)' }}>
          Exam guide →
        </span>
      </Link>

      <section aria-label="Where you could be in Year 9" className="mt-10">
        <Lamp
          kicker="Victorian selective entry · Year 9 intake"
          title="Four schools. One exam. Walk in ready."
          sub="Around 1,000 Year 9 places across Melbourne High, Mac.Robertson Girls', Nossal and Suzanne Cory. Offers come from the official selection process. This site exists so you meet exam day prepared, not surprised."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Melbourne High', 'MHS', 'Boys · South Yarra', 'The academic powerhouse on the hill, generations of high achievers.'],
            ['Mac.Robertson Girls’', 'MRG', 'Girls · Melbourne', 'A storied inner-city school for high-achieving girls.'],
            ['Nossal', 'NHS', 'Co-ed · Berwick', 'Modern co-ed excellence in the south-east.'],
            ['Suzanne Cory', 'SCS', 'Co-ed · Werribee', 'Purpose-built selective schooling in the west.'],
          ].map(([name, short, facts, line]) => (
            <div key={name} className="quiet-card flex h-full flex-col p-[18px]">
              <span className="tnum grid h-10 w-10 place-items-center rounded-[10px] border text-[13px] font-extrabold tabular-nums" style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)', color: 'var(--acc)' }}>
                {short}
              </span>
              <h3 className="mt-2.5 font-display text-[16px] font-bold">{name}</h3>
              <p className="text-xs font-semibold" style={{ color: 'var(--faint)' }}>{facts}</p>
              <p className="mb-3 mt-1 text-[13.5px] leading-relaxed" style={{ color: 'var(--mut)' }}>{line}</p>
              <Link to="/exam-guide" className="link-slide mt-auto inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: 'var(--acc)' }}>
                How to prepare <span aria-hidden="true">→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <h2 className="section-title">Study modes</h2>
      <hr className="section-rule" />
      <BentoGrid>
        <StarBorder className="sm:col-span-2">
          <BentoCard
            to="/mocks"
            title="Timed mocks"
            desc="Full-length blocks with real timing, instant scoring and explanations. Fresh questions every attempt."
            badge="Timed · auto-scored"
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

      <h2 className="section-title">
        For your next session <small>from the library</small>
      </h2>
      <hr className="section-rule" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map(([s, c]) => (
          <DeckCard key={s} to={'/search?q=' + encodeURIComponent(s)} icon={<Layers className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />} title={pretty(s)} sub={`${c} resources · flashcards + papers`} badge={`${c} resources`} />
        ))}
      </div>

      <HowItWorks />

      <h2 className="section-title">Read inside the site <small>no new tabs</small></h2>
      <hr className="section-rule" />
      <div className="quiet-card overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--line)' }}>
          <span className="text-xs font-bold">Document viewer</span>
          <span className="tnum ml-auto text-xs tabular-nums" style={{ color: 'var(--faint)' }}>notes · progress · related alongside</span>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2.5" aria-hidden="true">
            <div className="h-3.5 w-2/3 rounded" style={{ background: 'var(--txt)', opacity: 0.85 }} />
            <div className="h-2.5 w-1/3 rounded" style={{ background: 'var(--mark-bg)' }} />
            {[95, 99, 90, 97, 70].map((w, k) => (
              <div key={k} className="h-2 rounded" style={{ width: `${w}%`, background: 'var(--line)' }} />
            ))}
          </div>
          <div className="flex flex-col gap-2 text-[13px]">
            <span className="rounded-lg px-2.5 py-1.5 text-[12px] font-bold" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>✓ Answers included</span>
            <span className="rounded-lg px-2.5 py-1.5 text-[12px] font-bold" style={{ background: 'var(--bg2)', color: 'var(--mut)' }}>My note · saved ✓</span>
            <Link to="/search?type=pdf" className="mt-auto font-bold" style={{ color: 'var(--acc)' }}>Open a paper →</Link>
          </div>
        </div>
      </div>

      <h2 className="section-title">New arrivals</h2>
      <hr className="section-rule" />
      {!fresh ? (
        <div className="grid gap-3 sm:grid-cols-2">
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
          <h2 className="section-title">Trending this week</h2>
          <hr className="section-rule" />
          <div className="quiet-card divide-y overflow-hidden">
            {trending.results.slice(0, 6).map((v) => (
              <Link key={v.id} to={'/r/' + v.id} className="index-row text-sm transition-colors hover:bg-[var(--acc-soft)]">
                <span className="tnum text-xs font-bold tabular-nums" style={{ color: 'var(--acc)' }}>{v.opens ?? '·'}</span>
                <span className="truncate font-semibold">{v.displayTitle || v.title}</span>
                <span className="ml-auto text-xs" style={{ color: 'var(--faint)' }} aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Practice tests</h2>
      <hr className="section-rule" />
      {!search ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {practice.map((v) => (
            <ResourceCard key={v.id} v={v} />
          ))}
        </div>
      )}

      <h2 className="section-title">Resources with answers <small><Link to="/search?answers=1" style={{ color: 'var(--acc)' }}>View all</Link></small></h2>
      <hr className="section-rule" />
      <div className="quiet-card overflow-x-auto">
        <table className="ledger-table">
          <caption className="sr-only">Recent resources that include answers</caption>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Type</th>
              <th scope="col"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {answers.slice(0, 5).map((v) => (
              <tr key={v.id}>
                <td>
                  <Link to={'/r/' + v.id} className="link-slide font-semibold hover:text-[var(--acc)]">
                    {v.displayTitle || v.title}
                  </Link>
                </td>
                <td className="tnum">{TYPE_LABEL[v.fileType] || v.fileType}</td>
                <td><Link to={'/r/' + v.id} aria-label={`Read ${v.displayTitle || v.title}`} className="font-bold" style={{ color: 'var(--acc)' }}>→</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">PDF papers <small><Link to="/search?type=pdf" style={{ color: 'var(--acc)' }}>View all</Link></small></h2>
      <hr className="section-rule" />
      <div className="quiet-card divide-y overflow-hidden">
        {pdfs.slice(0, 6).map((v) => (
          <Link key={v.id} to={'/r/' + v.id} className="index-row text-sm transition-colors hover:bg-[var(--acc-soft)]">
            <span className="tnum rounded-md border px-1.5 py-0.5 text-[10.5px] font-extrabold tabular-nums" style={{ color: 'var(--acc)', borderColor: 'var(--acc-line)' }}>PDF</span>
            <span className="truncate font-semibold">{v.displayTitle || v.title}</span>
            <span className="ml-auto text-xs" style={{ color: 'var(--faint)' }} aria-hidden="true">→</span>
          </Link>
        ))}
      </div>

      <AuroraBg className="mt-10 px-6 py-10 text-center sm:px-10">
        <p className="kicker" style={{ justifyContent: 'center' }}>Not sure where to start?</p>
        <h2 className="mx-auto mt-2 max-w-[24ch] font-display text-2xl font-bold sm:text-3xl">
          Take the short diagnostic.
        </h2>
        <p className="mx-auto mt-2 max-w-[52ch] text-[15.5px]" style={{ color: 'var(--mut)' }}>
          Ten minutes. Real timing. Find your gaps in maths, reasoning and reading, then get a concrete next step. No account.
        </p>
        <p className="mt-5 flex flex-wrap justify-center gap-2.5">
          <InteractiveHover to="/mocks" primary>Take the diagnostic</InteractiveHover>
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
        {item.stem}: {item.options.join(' / ')}
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
