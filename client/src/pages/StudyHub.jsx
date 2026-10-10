import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { keys, touchStreak, useLocal, useSyncedLocal } from '../lib/store';
import { useToast } from '../providers';
import { BlurFade, ShinyBadge, Skeleton, AnimatedGrid } from '../components/magic';

function useExam() {
  const [date, setDate] = useLocal(keys.examDate, null);
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    setStreak(touchStreak());
    document.title = 'Study hub — SEHS Study';
  }, []);
  const diff = date ? Math.ceil((new Date(date + 'T00:00:00') - Date.now()) / 86400000) : null;
  return { date, setDate, streak, diff };
}

export default function StudyHub() {
  const toast = useToast();
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
      setAiMsg(`Made ${j.cards.length} cards — find them under Your decks.`);
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
    <div className="mx-auto max-w-[1000px] px-5 py-7">
      <h1 className="font-display text-3xl font-bold">Study hub</h1>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Flashcards, quizzes and goals — stored in this browser.
      </p>

      <h2 className="mb-3 mt-6 font-display text-[20px] font-bold">Your exam</h2>
      <div className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <div className="flex flex-wrap items-center gap-4">
          {[
            ['Countdown', diff === null ? '—' : diff >= 0 ? `${diff} day${diff === 1 ? '' : 's'}` : 'Done 🎉'],
            ['Day streak', `${streak} 🔥`],
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
          <button type="submit" className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
            Set exam date
          </button>
          <button
            type="button"
            onClick={() => {
              setDate(null);
              toast('Exam date cleared');
            }}
            className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold"
            style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
          >
            Clear
          </button>
        </form>
      </div>

      <h2 className="mb-3 mt-6 font-display text-[20px] font-bold">Built-in prep</h2>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {[
          ['/exam-guide', 'Exam guide', '3 blocks, pacing, schools, plans.'],
          ['/mocks', 'Timed mocks', '60 / 55 / 40 min blocks + diagnostic.'],
          ['/writing', 'Writing studio', '80 prompts + timer + rubric.'],
          ['/drills', 'Maths drills', 'Infinite Year-8 drills.'],
        ].map(([to, t, p]) => (
          <div key={to} className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <h3 className="font-display text-[15.5px] font-bold">{t}</h3>
            <p className="mb-3 mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
              {p}
            </p>
            <Link to={to} className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
              Open →
            </Link>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-6 font-display text-[20px] font-bold">AI study tools</h2>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <h3 className="font-display text-[15.5px] font-bold">Flashcards from any topic</h3>
          <div className="mt-2 flex gap-2">
            <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} maxLength={120} placeholder="e.g. analogies, fractions…" aria-label="Deck topic" className={`${inputCls} min-w-0 flex-1`} style={inputStyle} />
            <button onClick={makeAiDeck} className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
              Make deck
            </button>
          </div>
          {!!aiMsg && (
            <p className="mt-1.5 text-[13px]" style={{ color: 'var(--mut)' }}>
              {aiMsg}
            </p>
          )}
        </div>
        <div className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <h3 className="font-display text-[15.5px] font-bold">My study plan</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <select value={planWeeks} onChange={(e) => setPlanWeeks(e.target.value)} aria-label="Weeks" className={inputCls} style={inputStyle}>
              <option value="4">4 weeks</option>
              <option value="8">8 weeks</option>
              <option value="12">12 weeks</option>
            </select>
            <button onClick={buildPlan} className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
              Build my plan
            </button>
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
          <div className="whitespace-pre-wrap text-sm">{aiOut}</div>
        </div>
      )}

      <h2 className="mb-3 mt-6 font-display text-[20px] font-bold">Flashcard decks</h2>
      {!decks ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <AnimatedGrid className="grid gap-3.5 sm:grid-cols-2">
          {decks.map((d) => (
            <BlurFade key={d.id}>
              <div className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
                <h3 className="font-display text-[15.5px] font-bold">{d.title}</h3>
                <p className="mb-1 mt-0.5 text-[13px]" style={{ color: 'var(--mut)' }}>
                  {d.description || ''}
                </p>
                <p className="mb-3 text-xs" style={{ color: 'var(--faint)' }}>
                  {d.count} cards · {d.source}
                </p>
                <Link to={'/study/' + encodeURIComponent(d.id)} className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
                  Study →
                </Link>
              </div>
            </BlurFade>
          ))}
        </AnimatedGrid>
      )}

      <h2 className="mb-3 mt-6 flex flex-wrap items-center gap-2 font-display text-[20px] font-bold">
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
      <div className="grid gap-3.5 sm:grid-cols-2">
        {localDecks.length ? (
          localDecks.map((d, i) => (
            <div key={i} className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
              <h3 className="font-display text-[15.5px] font-bold">{d.title}</h3>
              <p className="mb-3 text-[13px]" style={{ color: 'var(--mut)' }}>
                {d.cards.length} cards · yours
              </p>
              <span className="flex gap-2">
                <Link to={'/study/local-' + i} className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
                  Study →
                </Link>
                <button
                  onClick={() => setLocalDecks((x) => x.filter((_, k) => k !== i))}
                  className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold"
                  style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
                >
                  Delete
                </button>
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm" style={{ color: 'var(--mut)' }}>
            No personal decks yet — create one below.
          </p>
        )}
      </div>
      <div className="mt-3 rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h3 className="font-display text-[15.5px] font-bold">New deck</h3>
        <form onSubmit={createDeck} className="mt-2 flex flex-wrap gap-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required maxLength={80} placeholder="Deck title" className={`${inputCls} min-w-[200px] flex-1`} style={inputStyle} />
          <button type="submit" className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
            Create
          </button>
        </form>
        {!!localDecks.length && (
          <form onSubmit={addCard} className="mt-2 flex flex-wrap gap-2">
            <select value={cardDeck} onChange={(e) => setCardDeck(e.target.value)} aria-label="Deck" className={inputCls} style={inputStyle}>
              {localDecks.map((d, i) => (
                <option key={i} value={i}>
                  {d.title}
                </option>
              ))}
            </select>
            <input value={front} onChange={(e) => setFront(e.target.value)} required maxLength={500} placeholder="Front" className={`${inputCls} min-w-[140px] flex-1`} style={inputStyle} />
            <input value={back} onChange={(e) => setBack(e.target.value)} required maxLength={2000} placeholder="Back" className={`${inputCls} min-w-[140px] flex-1`} style={inputStyle} />
            <button type="submit" className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
              Add card
            </button>
          </form>
        )}
      </div>

      <div className="mt-6">
        <ShinyBadge>Streaks, Leitner boxes and plans — all on-device</ShinyBadge>
      </div>
    </div>
  );
}
