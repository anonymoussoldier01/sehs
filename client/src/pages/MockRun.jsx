import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@heroui/react/button';
import { ProgressBar } from '@heroui/react/progress-bar';
import { api } from '../lib/api';
import { keys, recordMistake } from '../lib/store';
import { useToast } from '../providers';
import { Skeleton } from '../components/magic';

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function MockRun() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [mock, setMock] = useState(null);
  const [missing, setMissing] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [flags, setFlags] = useState({});
  const [secs, setSecs] = useState(0);
  const [done, setDone] = useState(false);
  const [review, setReview] = useState(false);
  const [coach, setCoach] = useState(null);
  const [variants, setVariants] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let live = true;
    setMock(null);
    setMissing(false);
    setDone(false);
    setReview(false);
    setI(0);
    setAnswers([]);
    setFlags({});
    api
      .mock(id)
      .then((j) => {
        if (!live || !j.mock) {
          setMissing(true);
          return;
        }
        setMock(j.mock);
        setSecs(j.mock.minutes * 60);
        document.title = `${j.mock.title} — SEHS Study`;
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (!mock || done) return;
    timer.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(timer.current);
          finishRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock, done]);

  const finish = () => {
    if (done || !mock) return;
    setDone(true);
    clearInterval(timer.current);
    const qs = mock.questions;
    let score = 0;
    qs.forEach((qq, k) => {
      if (answers[k] === qq.answer) score++;
      else recordMistake({ stem: qq.stem, strand: qq.strand, picked: answers[k], correct: qq.answer });
    });
    try {
      const best = JSON.parse(localStorage.getItem(keys.mocks) || '{}');
      if (!best[id] || score > best[id].score) {
        best[id] = { score, total: qs.length, at: new Date().toISOString() };
        localStorage.setItem(keys.mocks, JSON.stringify(best));
      }
    } catch {
      /* noop */
    }
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  if (missing) return <div className="mx-auto max-w-[860px] px-5 py-10 text-sm" style={{ color: 'var(--mut)' }}>Mock not found.</div>;
  if (!mock)
    return (
      <div className="mx-auto max-w-[860px] px-5 py-7">
        <Skeleton />
      </div>
    );

  const qs = mock.questions;
  const score = qs.filter((qq, k) => answers[k] === qq.answer).length;

  if (done) {
    const misses = qs.map((qq, k) => ({ ...qq, picked: answers[k] })).filter((m) => m.picked !== m.answer);
    const perfect = score === qs.length && qs.length > 0;
    return (
      <div className="mx-auto max-w-[860px] px-5 py-7">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl border p-6 text-center"
          style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
        >
          <h3 className="font-display text-2xl font-bold">
            Score: {score} / {qs.length}
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
            {perfect ? 'Perfect. 🎉' : score >= qs.length * 0.7 ? 'Solid — review misses below.' : 'Review below, then retry.'}
          </p>
          <p className="mt-3 flex justify-center gap-2">
            <Button size="sm" variant="primary" onPress={() => navigate('/mocks')}>
              All mocks
            </Button>
            <Button size="sm" variant="secondary" onPress={() => window.location.reload()}>
              Retry
            </Button>
          </p>
        </motion.div>
        {!!misses.length && (
          <MissTools misses={misses} mockId={id} coach={coach} setCoach={setCoach} variants={variants} setVariants={setVariants} />
        )}
        {qs.map((qq, k) => {
          const picked = answers[k];
          const ok = picked === qq.answer;
          return (
            <ResultCard key={k} n={k} q={qq} picked={picked} ok={ok} />
          );
        })}
      </div>
    );
  }

  if (review) {
    const unanswered = qs.filter((_, k) => answers[k] === undefined || answers[k] === -1).length;
    const flagged = Object.values(flags).filter(Boolean).length;
    return (
      <div className="mx-auto max-w-[860px] px-5 py-7">
        <h1 className="font-display text-2xl font-bold">Review before submitting</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
          {unanswered} unanswered · {flagged} flagged · {score} correct so far
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {qs.map((qq, k) => {
            const st = answers[k] === undefined || answers[k] === -1 ? 'todo' : answers[k] === qq.answer ? 'ok' : 'ans';
            return (
              <button
                key={k}
                onClick={() => {
                  setI(k);
                  setReview(false);
                }}
                title={'Q' + (k + 1) + (flags[k] ? ' (flagged)' : '')}
                className="grid h-10 place-items-center rounded-lg border text-[13px] font-bold tabular-nums"
                style={{
                  borderColor: k === i ? 'var(--acc)' : 'var(--line2)',
                  background: st === 'todo' ? 'var(--panel)' : st === 'ok' ? 'var(--ok-bg)' : 'var(--acc-soft)',
                  color: st === 'todo' ? 'var(--mut)' : st === 'ok' ? 'var(--ok)' : 'var(--acc)',
                  boxShadow: flags[k] ? 'inset 0 -3px 0 var(--amber, #b45309)' : undefined,
                }}
              >
                {k + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onPress={() => setReview(false)}>
            ← Back to questions
          </Button>
          <Button variant="primary" onPress={finish}>
            Submit mock
          </Button>
        </div>
      </div>
    );
  }

  const q = qs[i];
  const pct = Math.round((i / qs.length) * 100);
  return (
    <div className="mx-auto max-w-[1080px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/mocks" className="hover:underline" style={{ color: 'var(--acc)' }}>Mocks</Link> › {mock.title}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">{mock.title}</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
        {mock.strands.join(' · ')} · {mock.minutes} min · {qs.length} questions · fresh set each attempt
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <div className={`font-display text-[26px] font-extrabold tabular-nums ${secs <= 60 ? 'animate-pulse' : ''}`} style={secs <= 60 ? { color: 'var(--bad)' } : undefined}>
          {fmt(secs)}
        </div>
        <span className="text-sm" style={{ color: 'var(--mut)' }}>
          Q{i + 1}/{qs.length} · {q.strand}
        </span>
        <span className="ml-auto flex gap-1.5">
          <Button
            size="sm"
            variant={flags[i] ? 'primary' : 'secondary'}
            onPress={() => setFlags((f) => ({ ...f, [i]: !f[i] }))}
            aria-pressed={String(!!flags[i])}
          >
            ⚑ {flags[i] ? 'Flagged' : 'Flag'}
          </Button>
          <Button size="sm" variant="secondary" onPress={() => { setAnswers((a) => { const n = [...a]; n[i] = -1; return n; }); setI((v) => Math.min(v + 1, qs.length - 1)); }}>
            Skip →
          </Button>
          <Button size="sm" variant="secondary" onPress={() => setReview(true)}>
            Review
          </Button>
        </span>
      </div>
      <ProgressBar value={i} maxValue={qs.length} aria-label="Mock progress" className="mb-1 mt-2.5">
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <div className="mt-3 grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl border p-[18px]"
            style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
          >
            {q.passage && (
              <details className="mb-3 rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                <summary className="cursor-pointer text-sm font-bold">📖 {q.passage.title} — read passage</summary>
                <p className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--mut)' }}>
                  {q.passage.text}
                </p>
              </details>
            )}
            <h3 className="font-display text-lg font-bold">{q.stem}</h3>
            <div className="mt-3 grid gap-2">
              {q.options.map((o, k) => (
                <button
                  key={k}
                  onClick={() => {
                    setAnswers((a) => {
                      const n = [...a];
                      n[i] = k;
                      return n;
                    });
                    setI((v) => (v + 1 < qs.length ? v + 1 : v));
                    if (i + 1 >= qs.length) setTimeout(() => setReview(true), 250);
                  }}
                  className="rounded-[10px] border px-4 py-3 text-left text-sm font-semibold transition-all hover:-translate-y-px"
                  style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
                >
                  {o}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
        <aside className="hidden grid-cols-5 gap-1.5 lg:grid" aria-label="Question navigator">
          {qs.map((_, k) => {
            const st = answers[k] === undefined || answers[k] === -1 ? 'todo' : 'ans';
            return (
              <button
                key={k}
                onClick={() => setI(k)}
                title={'Q' + (k + 1)}
                className="grid h-9 place-items-center rounded-lg border text-xs font-bold tabular-nums"
                style={{
                  borderColor: k === i ? 'var(--acc)' : 'var(--line2)',
                  background: st === 'todo' ? 'var(--panel)' : 'var(--acc-soft)',
                  color: st === 'todo' ? 'var(--mut)' : 'var(--acc)',
                  boxShadow: flags[k] ? 'inset 0 -3px 0 var(--amber, #b45309)' : undefined,
                }}
              >
                {k + 1}
              </button>
            );
          })}
        </aside>
      </div>
    </div>
  );
}

function MissTools({ misses, coach, setCoach, variants, setVariants }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const byStrand = {};
  misses.forEach((m) => {
    byStrand[m.strand] = (byStrand[m.strand] || 0) + 1;
  });
  const summary = Object.keys(byStrand).map((s) => `${s} ×${byStrand[s]}`).join(', ');
  return (
    <div className="mt-2 rounded-2xl border p-4" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
      <p className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          isDisabled={busy === 'coach'}
          onPress={async () => {
            setBusy('coach');
            try {
              const t = await api.aiChat(
                'tutor',
                `I missed these SEHS questions (${summary}): ${misses.slice(0, 4).map((m) => m.stem).join(' | ')}. Tell me my weakest strand, what to drill this week, and one exam tip. Under 150 words.`
              );
              setCoach(t);
            } catch (e) {
              setCoach('AI unavailable: ' + e.message);
            }
            setBusy(null);
          }}
        >
          {busy === 'coach' ? 'Coaching…' : 'Coach my errors'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={busy === 'var'}
          onPress={async () => {
            setBusy('var');
            try {
              const j = await api.aiVariants(misses.slice(0, 5));
              setVariants(j.questions);
            } catch (e) {
              toast('AI unavailable: ' + e.message);
            }
            setBusy(null);
          }}
        >
          {busy === 'var' ? 'Writing…' : 'Variants of my misses'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            try {
              const decks = JSON.parse(localStorage.getItem(keys.decks) || '[]');
              decks.push({ title: 'Mock misses ' + new Date().toISOString().slice(0, 10), cards: misses.map((m) => ({ front: m.stem, back: 'Strand: ' + m.strand })) });
              localStorage.setItem(keys.decks, JSON.stringify(decks));
              toast(`Saved ${misses.length} misses as a deck`);
            } catch {
              toast('Could not save deck');
            }
          }}
        >
          Deck my misses
        </Button>
      </p>
      {coach && <p className="mt-2 whitespace-pre-wrap text-[13.5px]">{coach}</p>}
      {!!variants?.length && (
        <div className="mt-2">
          <h4 className="font-bold">Fresh variants — same skills, new questions</h4>
          <VariantQuiz questions={variants} />
        </div>
      )}
    </div>
  );
}

function VariantQuiz({ questions }) {
  const [pick, setPick] = useState({});
  return (
    <div className="mt-1 flex flex-col gap-2">
      {questions.map((qq, i) => (
        <div key={i} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
          <p className="text-sm">
            <strong>V{i + 1}</strong> {qq.stem}
          </p>
          <div className="mt-2 grid gap-1.5">
            {qq.options.map((o, k) => {
              const sel = pick[i] === k;
              const done = pick[i] !== undefined;
              return (
                <button
                  key={k}
                  disabled={done}
                  onClick={() => {
                    setPick((p) => ({ ...p, [i]: k }));
                    if (k !== qq.answer) recordMistake({ stem: qq.stem, strand: qq.strand, picked: k, correct: qq.answer });
                  }}
                  className="rounded-lg border px-3 py-2 text-left text-[13px] font-semibold disabled:cursor-default"
                  style={{
                    borderColor: done && k === qq.answer ? 'var(--ok)' : sel ? 'var(--bad)' : 'var(--line2)',
                    background: done && k === qq.answer ? 'var(--ok-bg)' : sel ? 'var(--bad-bg)' : 'var(--panel)',
                  }}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {pick[i] !== undefined && (
            <p className="mt-1 text-[13px]" style={{ color: pick[i] === qq.answer ? 'var(--ok)' : 'var(--bad)' }}>
              {pick[i] === qq.answer ? '✓ Correct. ' : `✗ Correct: ${qq.options[qq.answer]}. `}
              {qq.explain}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ResultCard({ n, q, picked, ok }) {
  const toast = useToast();
  const [exp, setExp] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 rounded-2xl border p-4" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
      <p className="text-sm">
        <strong>
          Q{n + 1} ({q.strand})
        </strong>{' '}
        {q.stem}
      </p>
      <p className="mt-0.5 text-sm" style={{ color: ok ? 'var(--ok)' : 'var(--bad)' }}>
        {ok ? '✓ ' : '✗ '}
        {picked >= 0 ? q.options[picked] : '(skipped)'}
        {ok ? '' : ' — correct: ' + q.options[q.answer]}
      </p>
      <p className="text-[13px]" style={{ color: 'var(--mut)' }}>
        {q.explain || ''}
      </p>
      {!ok && (
        <div className="mt-1.5">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={busy}
            onPress={async () => {
              setBusy(true);
              setExp('Asking the tutor…');
              try {
                setExp(await api.aiChat('explain', `Q: ${q.stem} Options: ${q.options.join(' / ')} Correct: ${q.options[q.answer]}`));
              } catch (e) {
                setExp('AI unavailable: ' + e.message);
                toast('AI unavailable');
              }
              setBusy(false);
            }}
          >
            {busy ? 'Thinking…' : 'Explain with AI'}
          </Button>
          {exp && <p className="mt-1 whitespace-pre-wrap text-[13px]">{exp}</p>}
        </div>
      )}
    </div>
  );
}
