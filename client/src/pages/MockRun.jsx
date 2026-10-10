// Timed mock runner — Calm profile. Timer runs on absolute timestamps
// (startedAt/endAt persisted) so it survives backgrounding and refresh.
// Answers/flags/position autosave; refresh resumes. Question order is
// deterministic from the attempt seed (stored; shareable via ?seed=).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api } from '../lib/api';
import { keys, recordMistake } from '../lib/store';
import { repo } from '../lib/repo';
import { useToast } from '../providers';
import { useMotionProfile } from '../lib/motion';
import { Skeleton } from '../components/magic';
import {
  scoreAttempt, seededShuffle, seedToInt, startTimer, remainingMs, isExpired,
  formatMMSS, recordReview, applyAccommodations,
} from '../lib/assessment';

const storeKey = (id) => `sehs-mockrun-${id}`;
function loadSaved(id) {
  try {
    return JSON.parse(localStorage.getItem(storeKey(id)) || 'null');
  } catch {
    return null;
  }
}
function persist(id, state) {
  try {
    localStorage.setItem(storeKey(id), JSON.stringify(state));
  } catch {
    /* ephemeral */
  }
}

export default function MockRun() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const mp = useMotionProfile('exam');
  const [mock, setMock] = useState(null);
  const [order, setOrder] = useState(null); // deterministic question order
  const [seed, setSeed] = useState(null);
  const [missing, setMissing] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [flags, setFlags] = useState({});
  const [times, setTimes] = useState({}); // per-question seconds (answeredAt - shownAt)
  const [endAt, setEndAt] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [done, setDone] = useState(false);
  const [review, setReview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAcc, setShowAcc] = useState(false);
  const [resumeOffer, setResumeOffer] = useState(null);
  const [coach, setCoach] = useState(null);
  const [variants, setVariants] = useState(null);
  const [accomm, setAccomm] = useState(() => repo.settings.get());
  const shownAt = useRef(Date.now());
  const submittedRef = useRef(false);
  const acc = useMemo(() => applyAccommodations(accomm), [accomm]);

  const saveAccomm = (next) => {
    setAccomm(next);
    repo.settings.set(next);
  };

  // Fetch mock once.
  useEffect(() => {
    let live = true;
    setMock(null);
    setMissing(false);
    setDone(false);
    setReview(false);
    submittedRef.current = false;
    api
      .mock(id)
      .then((j) => {
        if (!live || !j.mock) {
          setMissing(true);
          return;
        }
        setMock(j.mock);
        document.title = `${j.mock.title} — SEHS Study`;
        const saved = loadSaved(id);
        if (saved && !saved.submitted && saved.endAt > Date.now() && saved.qids?.length) {
          setResumeOffer(saved);
        } else {
          const s = sp.get('seed') || `${id}-${Date.now().toString(36)}`;
          const shuffled = seededShuffle(j.mock.questions, seedToInt(s));
          setSeed(s);
          setOrder(shuffled);
          const t = startTimer({ minutes: j.mock.minutes, extraTimeMult: applyAccommodations(repo.settings.get()).extraTimeMult });
          setEndAt(t.endAt);
          setAnswers([]);
          setFlags({});
          persist(id, { seed: s, qids: shuffled.map((q) => q.stem), endAt: t.endAt, answers: [], flags: {}, i: 0, submitted: false });
        }
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const resume = useCallback(() => {
    if (!resumeOffer || !mock) return;
    const byStem = new Map(mock.questions.map((q) => [q.stem, q]));
    const restored = (resumeOffer.qids || []).map((stem) => byStem.get(stem)).filter(Boolean);
    // Questions added since the save are appended in seed order.
    const missingQs = mock.questions.filter((q) => !restored.includes(q));
    const full = [...restored, ...missingQs];
    setOrder(full.length ? full : mock.questions);
    setSeed(resumeOffer.seed || 'resumed');
    setAnswers(resumeOffer.answers || []);
    setFlags(resumeOffer.flags || {});
    setI(Math.min(resumeOffer.i || 0, (resumeOffer.qids || []).length - 1));
    setEndAt(resumeOffer.endAt);
    setResumeOffer(null);
    toast('Session restored — welcome back');
  }, [resumeOffer, mock, toast]);

  const discardSaved = useCallback(() => {
    try {
      localStorage.removeItem(storeKey(id));
    } catch {
      /* noop */
    }
    setResumeOffer(null);
    if (mock) {
      const s = `${id}-${Date.now().toString(36)}`;
      const shuffled = seededShuffle(mock.questions, seedToInt(s));
      setSeed(s);
      setOrder(shuffled);
      const t = startTimer({ minutes: mock.minutes, extraTimeMult: acc.extraTimeMult });
      setEndAt(t.endAt);
      setAnswers([]);
      setFlags({});
      setI(0);
    }
  }, [id, mock, acc]);

  // Tick on absolute time (1s interval only re-renders; truth is endAt).
  useEffect(() => {
    if (!mock || done || !endAt || resumeOffer) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mock, done, endAt, resumeOffer]);

  // Track when each question was shown (for time-per-question review).
  useEffect(() => {
    shownAt.current = Date.now();
  }, [i]);

  const finish = useCallback(() => {
    if (submittedRef.current || done || !mock || !order) return;
    submittedRef.current = true;
    setDone(true);
    setConfirming(false);
    const qs = order;
    const r = scoreAttempt(qs, answers);
    qs.forEach((qq, k) => {
      if (answers[k] !== qq.answer) recordMistake({ stem: qq.stem, strand: qq.strand, picked: answers[k], correct: qq.answer });
    });
    // Review queue: missed questions scheduled with the Leitner rule.
    try {
      const queue = repo.reviewQueue.get();
      const today = new Date().toISOString().slice(0, 10);
      const next = [...queue];
      r.details.forEach((d) => {
        if (!d.scored || d.correct) return;
        const q = qs[d.index];
        const prev = next.find((x) => x.stem === q.stem);
        const rec = recordReview(prev?.box || 0, false);
        if (prev) Object.assign(prev, { box: rec.box, nextDue: rec.nextDue, at: today });
        else next.unshift({ stem: q.stem.slice(0, 200), strand: q.strand || 'mixed', box: rec.box, nextDue: rec.nextDue, at: today });
      });
      repo.reviewQueue.set(next);
    } catch {
      /* review queue is best-effort */
    }
    repo.attempts.record(id, { score: r.score, total: r.total, seed });
    persist(id, { seed, qids: order.map((q) => q.stem), endAt, answers, flags, i, submitted: true });
  }, [done, mock, order, answers, flags, i, id, seed, endAt]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  // Auto-submit on expiry.
  useEffect(() => {
    if (!mock || done || !endAt || resumeOffer) return;
    if (isExpired(endAt, nowMs)) finishRef.current();
  }, [nowMs, endAt, mock, done, resumeOffer]);

  // Autosave on every change.
  useEffect(() => {
    if (!mock || done || !order || resumeOffer) return;
    persist(id, { seed, qids: order.map((q) => q.stem), endAt, answers, flags, i, submitted: false });
  }, [answers, flags, i, endAt, mock, done, order, seed, id, resumeOffer]);

  // Warn before leaving an unfinished exam (refresh/close only, not in-app nav).
  useEffect(() => {
    if (!mock || done) return;
    const onBefore = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [mock, done]);

  // Keyboard shortcuts (disabled while typing; never clash with screen readers).
  useEffect(() => {
    if (!mock || done || review || resumeOffer) return;
    const onKey = (e) => {
      const tag = document.activeElement?.tagName || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === '?') {
        setShowHelp(true);
        return;
      }
      if (!order) return;
      const q = order[i];
      const n = q?.options?.length || 0;
      const pickIdx = (k) => {
        if (k < 0 || k >= n) return;
        const spent = Math.round((Date.now() - shownAt.current) / 1000);
        setTimes((t) => ({ ...t, [i]: spent }));
        setAnswers((a) => {
          const next = [...a];
          next[i] = k;
          return next;
        });
        setI((v) => (v + 1 < order.length ? v + 1 : v));
        if (i + 1 >= order.length) setTimeout(() => setReview(true), 250);
      };
      if (e.key >= '1' && e.key <= '9') pickIdx(Number(e.key) - 1);
      else if (/^[a-eA-E]$/.test(e.key) && n <= 5) pickIdx(e.key.toLowerCase().charCodeAt(0) - 97);
      else if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') setI((v) => Math.min(v + 1, order.length - 1));
      else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') setI((v) => Math.max(v - 1, 0));
      else if (e.key === 'f' || e.key === 'F') setFlags((f) => ({ ...f, [i]: !f[i] }));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mock, done, review, resumeOffer, order, i]);

  if (missing) return <div className="mx-auto max-w-[860px] px-5 py-10 text-sm" style={{ color: 'var(--mut)' }}>Mock not found.</div>;
  if (!mock || !order)
    return (
      <div className="mx-auto max-w-[860px] px-5 py-7">
        <Skeleton />
      </div>
    );

  if (resumeOffer) {
    return (
      <div className="mx-auto max-w-[640px] px-5 py-10">
        <h1 className="font-display text-2xl font-bold">Resume your mock?</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
          {mock.title} — {(resumeOffer.answers || []).filter((a) => a !== undefined && a !== -1).length} of {(resumeOffer.qids || []).length} answered,
          {' '}{formatMMSS(Math.max(0, Math.floor((resumeOffer.endAt - Date.now()) / 1000)))} left on the clock.
        </p>
        <p className="mt-3 flex gap-2">
          <Button variant="default" onClick={resume}>Resume where I left off</Button>
          <Button variant="secondary" onClick={discardSaved}>Start fresh</Button>
        </p>
      </div>
    );
  }

  const qs = order;
  const result = scoreAttempt(qs, answers);
  const secsLeft = Math.max(0, Math.floor(remainingMs(endAt, nowMs) / 1000));
  const lowTime = secsLeft <= 60;

  if (done) {
    const misses = qs.map((qq, k) => ({ ...qq, picked: answers[k], secs: times[k] })).filter((m) => m.picked !== m.answer);
    const perfect = result.score === result.total && result.total > 0;
    return (
      <div className="mx-auto max-w-[860px] px-5 py-7">
        <motion.div
          initial={mp.animate ? { scale: 0.96, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl border p-6 text-center"
          style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--faint)' }}>Your next step</p>
          <h3 className="tnum font-display text-3xl font-bold">
            Score: {result.score} / {result.total}
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
            {perfect ? 'A clean set — well done. Try a fresh seed or a different block next.'
              : misses.length ? `Review the ${misses.length} question${misses.length === 1 ? '' : 's'} below, starting with the flagged ones.`
              : 'Review below, then retry with a fresh seed.'}
          </p>
          <p className="mt-3 flex justify-center gap-2">
            <Button size="sm" variant="default" onClick={() => navigate('/mocks')}>All mocks</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/mocks/${id}?seed=${id}-${Date.now().toString(36)}`)}>Retry with fresh questions</Button>
          </p>
        </motion.div>
        {!!misses.length && (
          <MissTools misses={misses} coach={coach} setCoach={setCoach} variants={variants} setVariants={setVariants} />
        )}
        <ResultsReview qs={qs} answers={answers} times={times} />
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
          {unanswered} unanswered · {flagged} flagged · {result.score} correct so far
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10" role="group" aria-label="Question checklist">
          {qs.map((qq, k) => {
            const st = answers[k] === undefined || answers[k] === -1 ? 'todo' : 'ans';
            return (
              <button
                key={k}
                onClick={() => {
                  setI(k);
                  setReview(false);
                }}
                title={'Question ' + (k + 1) + (flags[k] ? ' (flagged)' : '') + (st === 'todo' ? ' (unanswered)' : '')}
                aria-label={'Question ' + (k + 1) + (flags[k] ? ', flagged' : '') + (st === 'todo' ? ', unanswered' : ', answered')}
                className="grid h-10 place-items-center rounded-lg border text-[13px] font-bold tabular-nums"
                style={{
                  borderColor: k === i ? 'var(--acc)' : 'var(--line2)',
                  borderWidth: k === i ? 2 : 1,
                  background: st === 'todo' ? 'var(--panel)' : 'var(--acc-soft)',
                  color: st === 'todo' ? 'var(--mut)' : 'var(--acc)',
                  boxShadow: flags[k] ? 'inset 0 -3px 0 var(--amber, #b45309)' : undefined,
                }}
              >
                {k + 1}{flags[k] ? '⚑' : ''}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setReview(false)}>← Back to questions</Button>
          <Button variant="default" onClick={() => setConfirming(true)}>Submit mock</Button>
        </div>
        {confirming && (
          <Dialog open onOpenChange={(o) => { if (!o) setConfirming(false); }}>
            <DialogContent aria-label="Confirm submission">
              <DialogHeader>
                <DialogTitle>Submit this mock?</DialogTitle>
                <DialogDescription>
                  {unanswered ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. ` : 'Every question has an answer. '}
                  Submission is final for this attempt — your score and review will be saved.
                </DialogDescription>
              </DialogHeader>
              <p className="flex gap-2">
                <Button variant="default" onClick={finish}>Submit now</Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>Keep checking</Button>
              </p>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  const q = qs[i];
  return (
    <div className={`mx-auto max-w-[1080px] px-5 py-7${acc.largerText ? ' text-[17px]' : ''}${acc.dyslexiaFriendly ? ' tracking-wide leading-relaxed' : ''}`}
      style={acc.highContrast ? { filter: 'contrast(1.15)' } : undefined}>
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/mocks" className="hover:underline" style={{ color: 'var(--acc)' }}>Mocks</Link> › {mock.title}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">{mock.title}</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
        {mock.strands.join(' · ')} · {mock.minutes} min{acc.extraTimeMult > 1 ? ` (+${Math.round((acc.extraTimeMult - 1) * 100)}% extra time)` : ''} · {qs.length} questions · seed <span className="tnum">{String(seed).slice(0, 12)}</span>
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3" role="timer" aria-label={`${formatMMSS(secsLeft)} remaining`}>
        <div className="tnum font-display text-[26px] font-extrabold" style={lowTime ? { color: 'var(--bad)' } : undefined}>
          {lowTime ? '⚠ ' : ''}{formatMMSS(secsLeft)}
        </div>
        <span className="text-sm" style={{ color: 'var(--mut)' }}>
          Q{i + 1}/{qs.length} · {q.strand} · {q.verification === 'verified' ? 'verified' : 'draft sample'}
        </span>
        <span className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant={flags[i] ? 'primary' : 'secondary'} onClick={() => setFlags((f) => ({ ...f, [i]: !f[i] }))} aria-pressed={String(!!flags[i])}>
            ⚑ {flags[i] ? 'Flagged' : 'Flag'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setAnswers((a) => { const n = [...a]; n[i] = -1; return n; }); setI((v) => Math.min(v + 1, qs.length - 1)); }}>
            Skip →
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowAcc(true)}>Access</Button>
          <Button size="sm" variant="secondary" onClick={() => setReview(true)}>Review</Button>
          <Button size="sm" variant="secondary" onClick={() => setShowHelp(true)} aria-label="Keyboard shortcuts">?</Button>
        </span>
      </div>
      <Progress value={i} max={qs.length} aria-label="Mock progress" className="mb-1 mt-2.5" />
      <div className="mt-3 grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={mp.animate ? { opacity: 0, x: 16 } : false}
            animate={{ opacity: 1, x: 0 }}
            exit={mp.animate ? { opacity: 0, x: -16 } : undefined}
            transition={{ duration: 0.16 }}
            className="rounded-2xl border p-[18px]"
            style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
          >
            {q.passage && (
              <details className="mb-3 rounded-xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--ok-paper, #FBFAF6)' }}>
                <summary className="cursor-pointer text-sm font-bold">📖 {q.passage.title} — read passage</summary>
                <p className="reading mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap text-sm" style={{ color: 'var(--mut)' }}>
                  {q.passage.text}
                </p>
              </details>
            )}
            <h3 className="font-display text-lg font-bold"><span className="tnum">Q{i + 1}.</span> {q.stem}</h3>
            <div className="mt-3 grid gap-2" role="group" aria-label={`Answers for question ${i + 1}`}>
              {q.options.map((o, k) => {
                const selected = answers[i] === k;
                return (
                  <button
                    key={k}
                    onClick={() => {
                      const spent = Math.round((Date.now() - shownAt.current) / 1000);
                      setTimes((t) => ({ ...t, [i]: spent }));
                      setAnswers((a) => {
                        const n = [...a];
                        n[i] = k;
                        return n;
                      });
                      setI((v) => (v + 1 < qs.length ? v + 1 : v));
                      if (i + 1 >= qs.length) setTimeout(() => setReview(true), 250);
                    }}
                    aria-pressed={String(selected)}
                    className="min-h-[52px] rounded-[10px] border px-4 py-3 text-left text-sm font-semibold transition-all hover:-translate-y-px"
                    style={{
                      borderColor: selected ? 'var(--acc)' : 'var(--line2)',
                      borderWidth: selected ? 2 : 1,
                      background: selected ? 'var(--acc-soft)' : 'var(--panel)',
                    }}
                  >
                    <span className="tnum mr-2" style={{ color: 'var(--faint)' }}>{'ABCDE'[k]}.</span>{o}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--faint)' }}>
              Keys 1–{q.options.length} or A–{'ABCDE'[q.options.length - 1]} select · ←/→ move · F flags · autosaved
            </p>
          </motion.div>
        </AnimatePresence>
        <aside className="hidden grid-cols-5 gap-1.5 lg:grid" aria-label="Question navigator">
          {qs.map((_, k) => {
            const st = answers[k] === undefined || answers[k] === -1 ? 'todo' : 'ans';
            return (
              <button
                key={k}
                onClick={() => setI(k)}
                title={'Question ' + (k + 1) + (flags[k] ? ' (flagged)' : '')}
                aria-label={'Go to question ' + (k + 1)}
                aria-current={k === i ? 'true' : undefined}
                className="grid h-9 place-items-center rounded-lg border text-xs font-bold tabular-nums"
                style={{
                  borderColor: k === i ? 'var(--acc)' : 'var(--line2)',
                  borderWidth: k === i ? 2 : 1,
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
      {showHelp && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowHelp(false); }}>
          <DialogContent aria-label="Keyboard shortcuts">
            <DialogHeader>
              <DialogTitle>Keyboard shortcuts</DialogTitle>
              <DialogDescription>Available during the mock. Shortcuts rest while typing.</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="tnum font-bold">1–4 / A–E</dt><dd>Select an answer</dd>
              <dt className="tnum font-bold">← → / N / P</dt><dd>Move between questions</dd>
              <dt className="tnum font-bold">F</dt><dd>Flag this question</dd>
              <dt className="tnum font-bold">?</dt><dd>Open this help</dd>
            </dl>
          </DialogContent>
        </Dialog>
      )}
      {showAcc && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowAcc(false); }}>
          <DialogContent aria-label="Access settings">
            <DialogHeader>
              <DialogTitle>Access settings</DialogTitle>
              <DialogDescription>Comfort adjustments for practice. Extra time restarts the clock proportionally.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2.5 text-sm">
              <label className="flex items-center justify-between gap-3">
                Extra time
                <select value={String(acc.extraTimeMult)} aria-label="Extra time multiplier"
                  onChange={(e) => {
                    const mult = Number(e.target.value);
                    saveAccomm({ ...accomm, extraTime: mult });
                    if (mock && !done) {
                      const elapsed = mock.minutes * 60 * 1000 - remainingMs(endAt);
                      const t = startTimer({ minutes: mock.minutes, extraTimeMult: mult });
                      const shifted = Date.now() - Math.min(elapsed, t.endAt - t.startedAt);
                      setEndAt(shifted + (t.endAt - t.startedAt));
                    }
                  }}
                  className="min-h-[42px] rounded-lg border px-2.5" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
                  <option value="1">Standard time</option>
                  <option value="1.25">+25% extra time</option>
                  <option value="1.5">+50% extra time</option>
                </select>
              </label>
              {[
                ['largerText', 'Larger text'],
                ['highContrast', 'Higher contrast'],
                ['dyslexiaFriendly', 'Dyslexia-friendly spacing'],
              ].map(([k, label]) => (
                <label key={k} className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
                  <input type="checkbox" checked={!!accomm[k]} onChange={(e) => saveAccomm({ ...accomm, [k]: e.target.checked })} className="h-5 w-5" />
                  {label}
                </label>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ResultsReview({ qs, answers, times }) {
  const [filter, setFilter] = useState('all');
  const items = qs.map((qq, k) => ({ qq, k, picked: answers[k], ok: answers[k] === qq.answer }));
  const visible = items.filter(({ picked, ok }) => {
    if (filter === 'incorrect') return !ok && picked !== undefined;
    if (filter === 'flagged') return false; // flags clear on submit; kept as a labelled empty state
    if (filter === 'skipped') return picked === undefined || picked === -1;
    return true;
  });
  const byStrand = {};
  items.forEach(({ qq, ok }) => {
    byStrand[qq.strand] = byStrand[qq.strand] || { n: 0, ok: 0 };
    byStrand[qq.strand].n++;
    if (ok) byStrand[qq.strand].ok++;
  });
  const strands = Object.entries(byStrand);
  return (
    <div className="mt-4">
      <h2 className="font-display text-xl font-bold">Review</h2>
      {strands.length >= 2 && items.length >= 6 ? (
        <dl className="mt-2 grid gap-1.5">
          {strands.map(([s, v]) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <dt className="w-28 font-semibold">{s}</dt>
              <dd className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--bg2)' }}>
                <span className="block h-full rounded-full" style={{ width: `${Math.round((v.ok / v.n) * 100)}%`, background: 'var(--acc)' }} />
              </dd>
              <dd className="tnum text-xs" style={{ color: 'var(--mut)' }}>{v.ok}/{v.n}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>Not enough data for a topic breakdown yet — finish a full mock to unlock it.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter review">
        {[['all', 'All'], ['incorrect', 'Incorrect'], ['skipped', 'Skipped'], ['flagged', 'Flagged']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} aria-pressed={String(filter === v)}
            className="min-h-[38px] rounded-full border px-3.5 text-[13px] font-bold"
            style={filter === v ? { background: 'var(--txt)', color: 'var(--bg)', borderColor: 'var(--txt)' } : { borderColor: 'var(--line2)', color: 'var(--mut)' }}>
            {l}
          </button>
        ))}
      </div>
      {filter === 'flagged' ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--mut)' }}>Flags are for during the mock — they clear on submit. Use Incorrect or Skipped to revise.</p>
      ) : visible.map(({ qq, k, picked, ok }) => (
        <ResultCard key={k} n={k} q={qq} picked={picked} ok={ok} secs={times[k]} />
      ))}
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
          disabled={busy === 'coach'}
          onClick={async () => {
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
          disabled={busy === 'var'}
          onClick={async () => {
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
          onClick={() => {
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
              const doneQ = pick[i] !== undefined;
              return (
                <button
                  key={k}
                  disabled={doneQ}
                  onClick={() => {
                    setPick((p) => ({ ...p, [i]: k }));
                    if (k !== qq.answer) recordMistake({ stem: qq.stem, strand: qq.strand, picked: k, correct: qq.answer });
                  }}
                  className="min-h-[44px] rounded-lg border px-3 py-2 text-left text-[13px] font-semibold disabled:cursor-default"
                  style={{
                    borderColor: doneQ && k === qq.answer ? 'var(--ok)' : sel ? 'var(--bad)' : 'var(--line2)',
                    background: doneQ && k === qq.answer ? 'var(--ok-bg)' : sel ? 'var(--bad-bg)' : 'var(--panel)',
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

function ResultCard({ n, q, picked, ok, secs }) {
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
        {secs != null && <span className="tnum" style={{ color: 'var(--faint)' }}> · {secs}s</span>}
      </p>
      <p className="text-[13px]" style={{ color: 'var(--mut)' }}>
        {q.explain || ''}
      </p>
      {!ok && (
        <div className="mt-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
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
