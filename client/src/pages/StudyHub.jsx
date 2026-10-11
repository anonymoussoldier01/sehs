import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';

import { api } from '../lib/api';
import { keys, touchStreak, useLocal, useSyncedLocal } from '../lib/store';
import { repo, exportData, deleteAllData } from '../lib/repo';
import { WobbleCard } from '../components/ace';
import { useToast } from '../providers';
import { ShinyBadge, Skeleton, AnimatedGrid, TypingText, SpotlightCard } from '../components/magic';

function useExam() {
  const [date, setDate] = useLocal(keys.examDate, null);
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    setStreak(touchStreak());
    document.title = 'Study hub · SEHS Study';
  }, []);
  const diff = date ? Math.ceil((new Date(date + 'T00:00:00') - Date.now()) / 86400000) : null;
  return { date, setDate, streak, diff };
}

export default function StudyHub() {
  const toast = useToast();
  const navigate = useNavigate();
  const { date, setDate, streak, diff } = useExam();
  const [decks, setDecks] = useState(null);
  const [localDecks, setLocalDecks] = useSyncedLocal(keys.decks, []);
  const [leitner] = useSyncedLocal(keys.leitner, {});
  const [newTitle, setNewTitle] = useState('');
  const [cardDeck, setCardDeck] = useState('0');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiMsg, setAiMsg] = useState('');
  const [aiOut, setAiOut] = useState('');
  const [planWeeks, setPlanWeeks] = useState('8');
  const [planMsg, setPlanMsg] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    let live = true;
    api
      .decks()
      .then((j) => live && setDecks(j.decks || []))
      .catch(() => live && setDecks([]));
    return () => {
      live = false;
    };
  }, []);

  const mastered = useMemo(() => {
    let n = 0;
    Object.values(leitner || {}).forEach((d) => Object.values(d || {}).forEach((b) => b >= 3 && n++));
    return n;
  }, [leitner]);

  const createDeck = (e) => {
    e.preventDefault();
    const t = newTitle.trim().slice(0, 80);
    if (!t) return;
    setLocalDecks((d) => [...d, { title: t, cards: [] }]);
    setNewTitle('');
    toast('Deck created');
  };

  const addCard = (e) => {
    e.preventDefault();
    const d = [...localDecks];
    const deck = d[Number(cardDeck)];
    if (!deck || !front.trim() || !back.trim()) return;
    deck.cards.push({ front: front.trim().slice(0, 500), back: back.trim().slice(0, 2000) });
    setLocalDecks(d);
    setFront('');
    setBack('');
    toast('Card added');
  };

  const makeAiDeck = async () => {
    if (aiTopic.trim().length < 3) {
      setAiMsg('Name a topic (3+ characters).');
      return;
    }
    setAiMsg('Making cards…');
    try {
      const j = await api.aiFlashcards(aiTopic.trim().slice(0, 120));
      setLocalDecks((d) => [...d, { title: 'AI: ' + aiTopic.trim().slice(0, 60), cards: j.cards }]);
      setAiMsg(`Made ${j.cards.length} cards. Find them under Your decks.`);
      setAiTopic('');
    } catch (e) {
      setAiMsg('AI unavailable: ' + e.message);
    }
  };

  const buildPlan = async () => {
    setPlanMsg('Building…');
    try {
      let weak = [];
      try {
        const m = JSON.parse(localStorage.getItem(keys.mistakes) || '[]');
        const by = {};
        m.forEach((x) => {
          by[x.strand] = (by[x.strand] || 0) + 1;
        });
        weak = Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 4);
      } catch {
        /* noop */
      }
      const j = await api.aiPlan(Number(planWeeks), weak, [], 45);
      setAiOut(j.plan);
      setPlanMsg('');
    } catch (e) {
      setPlanMsg('AI unavailable: ' + e.message);
    }
  };

  const inputCls = 'min-h-[40px] rounded-[10px] border px-3 py-2 text-sm';
  const inputStyle = { borderColor: 'var(--line2)', background: 'var(--panel)', color: 'var(--txt)' };

  return (
    <div className="page-browse py-7">
      <p className="kicker">Study hub · this browser</p>
      <h1 className="font-display text-3xl font-bold" style={{ letterSpacing: '-0.02em' }}>Study hub</h1>
      <p className="lede mt-1">
        Flashcards, quizzes and goals, stored in this browser.
      </p>

      <FirstRun />
      <ReviewQueue />
      <ActivityChart />

      <h2 className="section-title">Your exam</h2>
      <div className="quiet-card p-[18px]">
        <div className="flex flex-wrap items-center gap-4">
          {[
            ['Countdown', diff === null ? 'Not set' : diff >= 0 ? `${diff} day${diff === 1 ? '' : 's'}` : 'Exam week. Good luck'],
            ['Days active', `${streak}`],
            ['Cards mastered', String(mastered)],
          ].map(([l, v]) => (
            <div key={l}>
              <div className="text-[13px]" style={{ color: 'var(--mut)' }}>
                {l}
              </div>
              <div className="font-display text-[28px] font-extrabold">{v}</div>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = e.target.date.value;
            if (v) {
              setDate(v);
              toast('Exam date set');
            }
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input name="date" type="date" aria-label="Exam date" defaultValue={date || ''} className={inputCls} style={inputStyle} />
          <Button type="submit" size="sm" variant="default">
            Set exam date
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDate(null);
              toast('Exam date cleared');
            }}
          >
            Clear
          </Button>
        </form>
      </div>

      <h2 className="section-title">Built-in prep</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['/exam-guide', 'Exam guide', '3 blocks, pacing, schools, plans.'],
          ['/mocks', 'Timed mocks', '60 / 55 / 40 min blocks + diagnostic.'],
          ['/writing', 'Writing studio', '80 prompts + timer + rubric.'],
          ['/drills', 'Maths drills', 'Infinite Year-8 drills.'],
        ].map(([to, t, p]) => (
          <WobbleCard key={to} to={to} className="p-[18px]" style={{ background: 'var(--panel)' }}>
            <h3 className="font-display text-[15.5px] font-bold">{t}</h3>
            <p className="mb-3 mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
              {p}
            </p>
            <span className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[var(--primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--primary-foreground)]">
              Open →
            </span>
          </WobbleCard>
        ))}
      </div>

      <h2 className="section-title">AI study tools</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="quiet-card p-[18px]">
          <h3 className="font-display text-[15.5px] font-bold">Flashcards from any topic</h3>
          <div className="mt-2 flex gap-2">
            <Input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} maxLength={120} placeholder="e.g. analogies, fractions…" aria-label="Deck topic" className="min-w-0 flex-1" />
            <Button size="sm" variant="default" onClick={makeAiDeck}>
              Make deck
            </Button>
          </div>
          {!!aiMsg && (
            <p className="mt-1.5 text-[13px]" style={{ color: 'var(--mut)' }}>
              {aiMsg}
            </p>
          )}
        </div>
        <div className="quiet-card p-[18px]">
          <h3 className="font-display text-[15.5px] font-bold">My study plan</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Select aria-label="Weeks" value={planWeeks} onValueChange={(k) => setPlanWeeks(String(k))} className="w-[130px]">
              <option value="4">4 weeks</option>
              <option value="8">8 weeks</option>
              <option value="12">12 weeks</option>
            </Select>
            <Button size="sm" variant="default" onClick={buildPlan}>
              Build my plan
            </Button>
          </div>
          {!!planMsg && (
            <p className="mt-1.5 text-[13px]" style={{ color: 'var(--mut)' }}>
              {planMsg}
            </p>
          )}
        </div>
      </div>
      {!!aiOut && (
        <div className="mt-3 rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <div className="whitespace-pre-wrap text-sm">
            <TypingText text={aiOut} speed={8} />
          </div>
        </div>
      )}

      <Weaknesses />

      <h2 className="section-title">Flashcard decks</h2>
      {!decks ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <AnimatedGrid className="grid gap-3 sm:grid-cols-2">
          {decks.map((d) => (
            <div key={d.id} className="quiet-card h-full p-[18px]">
              <h3 className="font-display text-[15.5px] font-bold">{d.title}</h3>
              <p className="mb-1 mt-0.5 text-[13.5px]" style={{ color: 'var(--mut)' }}>
                {d.description || ''}
              </p>
              <p className="tnum mb-3 text-xs tabular-nums" style={{ color: 'var(--faint)' }}>
                {d.count} cards · {d.source}
              </p>
              <Link to={'/study/' + encodeURIComponent(d.id)} className="inline-flex min-h-[44px] items-center rounded-[10px] bg-[var(--primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--primary-foreground)]">
                Study →
              </Link>
            </div>
          ))}
        </AnimatedGrid>
      )}

      <h2 className="section-title">
        Your decks
        <span className="ml-auto flex gap-2">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(localDecks)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'sehs-decks.json';
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
            className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 font-sans text-[13px] font-bold"
            style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
          >
            Export
          </button>
          <label className="inline-flex min-h-[38px] cursor-pointer items-center rounded-[10px] border px-3.5 py-2 font-sans text-[13px] font-bold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
            Import
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => {
                  try {
                    const arr = JSON.parse(r.result);
                    if (!Array.isArray(arr)) throw new Error('bad');
                    setLocalDecks((d) => [
                      ...d,
                      ...arr.slice(0, 20).filter((x) => x && x.title && Array.isArray(x.cards)).map((x) => ({ title: String(x.title).slice(0, 80), cards: x.cards.slice(0, 500) })),
                    ]);
                    toast('Decks imported');
                  } catch {
                    toast('Invalid deck file');
                  }
                };
                r.readAsText(f);
                e.target.value = '';
              }}
            />
          </label>
        </span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {localDecks.length ? (
          localDecks.map((d, i) => (
            <div key={i} className="quiet-card p-[18px]">
              <h3 className="font-display text-[15.5px] font-bold">{d.title}</h3>
              <p className="mb-3 text-[13px]" style={{ color: 'var(--mut)' }}>
                {d.cards.length} cards · yours
              </p>
              <span className="flex gap-2">
                <Button size="sm" variant="default" onClick={() => navigate('/study/local-' + i)}>
                  Study →
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setLocalDecks((x) => x.filter((_, k) => k !== i))}
                >
                  Delete
                </Button>
              </span>
            </div>
          ))
        ) : (
            <p className="text-sm" style={{ color: 'var(--mut)' }}>
              No personal decks yet. Create one below.
            </p>
        )}
      </div>
      <div className="quiet-card mt-3 p-[18px]">
        <h3 className="font-display text-[15.5px] font-bold">New deck</h3>
        <form onSubmit={createDeck} className="mt-2 flex flex-wrap gap-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required maxLength={80} placeholder="Deck title" aria-label="Deck title" className="min-w-[200px] flex-1" />
          <Button type="submit" size="sm" variant="default">
            Create
          </Button>
        </form>
        {!!localDecks.length && (
          <form onSubmit={addCard} className="mt-2 flex flex-wrap gap-2">
            <Select aria-label="Deck" value={cardDeck} onValueChange={(k) => setCardDeck(String(k))} className="w-[180px]">
              {localDecks.map((d, i) => (
                <option key={i} value={String(i)}>
                  {d.title}
                </option>
              ))}
            </Select>
            <Input value={front} onChange={(e) => setFront(e.target.value)} required maxLength={500} placeholder="Front" aria-label="Card front" className="min-w-[140px] flex-1" />
            <Input value={back} onChange={(e) => setBack(e.target.value)} required maxLength={2000} placeholder="Back" aria-label="Card back" className="min-w-[140px] flex-1" />
            <Button type="submit" size="sm" variant="default">
              Add card
            </Button>
          </form>
        )}
      </div>

      <div className="mt-6">
        <ShinyBadge>On-device streaks, Leitner boxes and plans</ShinyBadge>
      </div>

      <YourData />
    </div>
  );
}

// ---------- First run: guided start, never an empty chart or fake number ----------
function FirstRun() {
  const navigate = useNavigate();
  const [seen, setSeen] = useState(() => {
    try {
      return !!localStorage.getItem('sehs-started');
    } catch {
      return true;
    }
  });
  if (seen) return null;
  const begin = (href) => {
    try {
      localStorage.setItem('sehs-started', '1');
    } catch {
      /* noop */
    }
    setSeen(true);
    navigate(href);
  };
  return (
    <div className="quiet-card beam-feature mt-6 p-[18px]">
      <h2 className="font-display text-[20px] font-bold">Start here: pick one small step</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
        New here? Choose a goal and do ten focused minutes. Your progress appears on this page. Real numbers only, never samples.
      </p>
      <p className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="default" onClick={() => begin('/mocks')}>Take the short diagnostic</Button>
        <Button size="sm" variant="secondary" onClick={() => begin('/study')}>Meet the flashcards</Button>
        <Button size="sm" variant="secondary" onClick={() => begin('/search')}>Browse the library</Button>
      </p>
    </div>
  );
}

// ---------- Review queue: missed questions due for another look (Leitner rule) ----------
function ReviewQueue() {
  const navigate = useNavigate();
  const [items, setItems] = useState(() => repo.reviewQueue.get());
  useEffect(() => {
    setItems(repo.reviewQueue.get());
  }, []);
  if (!items.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const due = items.filter((it) => !it.nextDue || it.nextDue <= today);
  const later = items.filter((it) => it.nextDue && it.nextDue > today);
  const clear = (stem) => {
    const next = items.filter((x) => x.stem !== stem);
    repo.reviewQueue.set(next);
    setItems(next);
  };
  return (
    <>
      <h2 className="section-title">
        Review queue <span className="text-sm font-semibold" style={{ color: 'var(--faint)' }}>{due.length} due</span>
      </h2>
      <p className="mb-2 text-[13px]" style={{ color: 'var(--mut)' }}>
        Missed mock questions return on a schedule (1 → 3 → 7 → 14 → 30 days). Answering them again in a mock or drill clears them here.
      </p>
      <div className="flex flex-col gap-2">
        {[...due, ...later].slice(0, 8).map((it, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <span className="font-bold" style={{ color: it.nextDue && it.nextDue > today ? 'var(--faint)' : 'var(--warn)' }}>
              {it.nextDue && it.nextDue > today ? '○' : '●'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold" title={it.stem}>{it.stem}</span>
              <span className="text-xs" style={{ color: 'var(--faint)' }}>{it.strand} · box {it.box || 1} · due {it.nextDue || 'now'}</span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => navigate('/drills')}>Practise</Button>
            <button onClick={() => clear(it.stem)} aria-label="Remove from review queue" className="grid h-9 w-9 place-items-center rounded-lg text-sm" style={{ color: 'var(--mut)' }}>✕</button>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Activity: last 14 days from the real on-device ledger ----------
function ActivityChart() {
  const [ledger] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(keys.insights) || 'null');
    } catch {
      return null;
    }
  });
  const days = [];
  for (let back = 13; back >= 0; back--) {
    const d = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
    const entry = ledger?.days?.[d] || {};
    days.push({ d, n: Object.values(entry).reduce((a, b) => a + (Number(b) || 0), 0) });
  }
  const max = Math.max(1, ...days.map((x) => x.n));
  const total = days.reduce((a, b) => a + b.n, 0);
  return (
    <>
      <h2 className="section-title">
        Activity <span className="text-sm font-semibold" style={{ color: 'var(--faint)' }}>last 14 days · {total} events</span>
      </h2>
      {total === 0 ? (
        <p className="text-sm" style={{ color: 'var(--mut)' }}>
          Nothing charted yet. Searches, opens and finished mocks draw bars here, in this browser only.
        </p>
      ) : (
        <div className="quiet-card p-[18px]">
          <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`Study activity, ${total} events in the last 14 days`}>
            {days.map(({ d, n }) => (
              <div key={d} className="flex flex-1 flex-col items-center gap-1" title={`${d}: ${n} events`}>
                <span
                  className="w-full rounded-t-md"
                  style={{ height: `${Math.max(3, Math.round((n / max) * 88))}px`, background: n ? 'var(--primary)' : 'var(--bg2)', border: n ? undefined : '1px solid var(--line)' }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums" style={{ color: 'var(--faint)' }}>
            <span>{days[0].d.slice(5)}</span>
            <span>{days[13].d.slice(5)}</span>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Your data: export and delete (data ownership) ----------
function YourData() {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const doExport = () => {
    try {
      const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sehs-my-data.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Exported your study data');
    } catch {
      toast('Export failed');
    }
  };
  return (
    <>
      <h2 className="section-title">Your data</h2>
      <hr className="section-rule" />
      <div className="quiet-card p-[18px]">
        <p className="text-sm" style={{ color: 'var(--mut)' }}>
          Everything lives in this browser. Export a copy any time, or erase it all. Clearing site data removes it too.
        </p>
        <p className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={doExport}>Export my data (JSON)</Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>Delete my data…</Button>
        </p>
        {confirming && (
          <p className="mt-3 rounded-xl border border-dashed p-3 text-sm" style={{ borderColor: 'var(--bad)' }}>
            Delete saved resources, notes, attempts, decks and progress on this device? This cannot be undone.
            <span className="mt-2 flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => { deleteAllData(); setConfirming(false); toast('All local data deleted'); }}>Delete everything</Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>Keep my data</Button>
            </span>
          </p>
        )}
      </div>
    </>
  );
}

// ---------- My weaknesses: mistakes + mock bests → targeted action ----------
function Weaknesses() {
  const toast = useToast();
  const navigate = useNavigate();
  const [misses, setMisses] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(keys.mistakes) || '[]');
    } catch {
      return [];
    }
  });
  const [bests, setBests] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(keys.mocks) || '{}');
    } catch {
      return {};
    }
  });
  const [vq, setVq] = useState(null);
  const [vqPick, setVqPick] = useState({});
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    try {
      setMisses(JSON.parse(localStorage.getItem(keys.mistakes) || '[]'));
      setBests(JSON.parse(localStorage.getItem(keys.mocks) || '{}'));
    } catch {
      /* noop */
    }
  };

  const byStrand = {};
  misses.forEach((m) => {
    byStrand[m.strand] = byStrand[m.strand] || [];
    byStrand[m.strand].push(m);
  });
  const strands = Object.keys(byStrand).sort((a, b) => byStrand[b].length - byStrand[a].length);
  const bestEntries = Object.entries(bests);
  if (!strands.length && !bestEntries.length) return null;

  const dismissStrand = (s) => {
    try {
      const rest = JSON.parse(localStorage.getItem(keys.mistakes) || '[]').filter((m) => m.strand !== s);
      localStorage.setItem(keys.mistakes, JSON.stringify(rest));
      refresh();
      toast(`Cleared ${s} misses`);
    } catch {
      /* noop */
    }
  };

  const variantQuiz = async (s) => {
    setBusy(s);
    setVq(null);
    setVqPick({});
    try {
      const j = await api.aiVariants(byStrand[s].slice(0, 5));
      setVq({ strand: s, questions: j.questions });
    } catch (e) {
      toast('AI unavailable: ' + e.message);
    }
    setBusy(false);
  };

  return (
    <>
      <h2 className="section-title">My weaknesses</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {!!strands.length && (
          <div className="quiet-card p-[18px]">
            <h3 className="font-display text-[15.5px] font-bold">Most-missed strands</h3>
            <div className="mt-2 flex flex-col gap-2.5">
              {strands.slice(0, 4).map((s) => (
                <div key={s} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                  <p className="text-sm font-bold">
                    {s} <span style={{ color: 'var(--faint)' }}>· {byStrand[s].length} miss{byStrand[s].length === 1 ? '' : 'es'}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px]" style={{ color: 'var(--mut)' }}>
                    e.g. {byStrand[s][0].stem.slice(0, 70)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="default" disabled={busy === s} onClick={() => variantQuiz(s)}>
                      {busy === s ? 'Writing…' : 'Variant quiz'}
                    </Button>
                    {['maths', 'quant'].includes(s) && (
                      <Button size="sm" variant="secondary" onClick={() => navigate('/drills')}>
                        Drill it
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => dismissStrand(s)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {!!vq && (
              <div className="mt-3">
                <h4 className="text-sm font-bold">Fresh {vq.strand} variants: same skills, new questions</h4>
                {vq.questions.map((qq, i) => (
                  <div key={i} className="mt-2 rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                    <p className="text-[13.5px]">
                      <strong>Q{i + 1}</strong> {qq.stem}
                    </p>
                    <div className="mt-1.5 grid gap-1.5">
                      {qq.options.map((o, k) => {
                        const sel = vqPick[i] === k;
                        const done = vqPick[i] !== undefined;
                        return (
                          <button
                            key={k}
                            disabled={done}
                            onClick={() => setVqPick((p) => ({ ...p, [i]: k }))}
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
                    {vqPick[i] !== undefined && (
                      <p className="mt-1 text-[13px]" style={{ color: vqPick[i] === qq.answer ? 'var(--ok)' : 'var(--bad)' }}>
                        {vqPick[i] === qq.answer ? '✓ Correct. ' : `✗ Correct: ${qq.options[qq.answer]}. `}
                        {qq.explain}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!!bestEntries.length && (
          <div className="quiet-card p-[18px]">
            <h3 className="font-display text-[15.5px] font-bold">Mock mastery</h3>
            <div className="mt-2 flex flex-col gap-2">
              {bestEntries.map(([id, b]) => (
                <div key={id}>
                  <p className="flex justify-between text-[13px] font-semibold">
                    <span className="truncate">{id.replace(/-/g, ' ')}</span>
                    <span className="tabular-nums">{b.score}/{b.total}</span>
                  </p>
                  <div className="mt-0.5 h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg2)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((b.score / Math.max(1, b.total)) * 100)}%`, background: 'var(--primary)' }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2">
              <Button size="sm" variant="secondary" onClick={() => navigate('/mocks')}>
                Take another mock
              </Button>
            </p>
          </div>
        )}
      </div>
    </>
  );
}
