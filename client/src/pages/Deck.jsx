import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { keys, useSyncedLocal } from '../lib/store';
import { useToast } from '../providers';
import { Skeleton } from '../components/magic';
import { Button } from '@heroui/react/button';
import { Tabs } from '@heroui/react/tabs';

const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

export default function Deck() {
  const { deckId } = useParams();
  const toast = useToast();
  const [deck, setDeck] = useState(null);
  const [missing, setMissing] = useState(false);
  const [mode, setMode] = useState('flip');
  const [order, setOrder] = useState([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [leitner, setLeitner] = useSyncedLocal(keys.leitner, {});
  const [test, setTest] = useState(null);

  useEffect(() => {
    let live = true;
    setDeck(null);
    setMissing(false);
    if (deckId.startsWith('local-')) {
      try {
        const d = JSON.parse(localStorage.getItem(keys.decks) || '[]')[Number(deckId.slice(6))];
        if (!d) {
          setMissing(true);
          return;
        }
        if (live) {
          setDeck({ title: d.title, description: '', cards: d.cards.map((c) => ({ front: c.front, back: c.back, resourceId: null })) });
        }
      } catch {
        live && setMissing(true);
      }
      return;
    }
    api
      .deck(deckId)
      .then((j) => {
        if (!live) return;
        if (!j.deck) {
          setMissing(true);
          return;
        }
        setDeck(j.deck);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [deckId]);

  const cards = deck?.cards || [];
  useEffect(() => {
    if (!cards.length) return;
    setOrder(shuffle(cards.map((_, i) => i)));
    setPos(0);
    setFlipped(false);
    setTest(null);
  }, [deckId, cards.length]);

  const box = (i) => (leitner[deckId] || {})[cards[i]?.front] || 1;
  const setBox = (i, b) => {
    const front = cards[i]?.front;
    if (!front) return;
    setLeitner((l) => ({ ...l, [deckId]: { ...(l[deckId] || {}), [front]: b } }));
  };

  useEffect(() => {
    if (deck) document.title = `${deck.title} — SEHS Study`;
  }, [deck]);

  const switchMode = (m) => {
    setMode(m);
    setPos(0);
    setFlipped(false);
    if (m === 'learn' && cards.length) setOrder(cards.map((_, i) => i).sort((a, b) => box(a) - box(b)));
    else if (m === 'test' && cards.length) {
      setOrder(shuffle(cards.map((_, i) => i)));
      setTest({ i: 0, score: 0, total: Math.min(10, cards.length), answers: [] });
    } else if (cards.length) setOrder(shuffle(cards.map((_, i) => i)));
  };

  const learnOpts = useMemo(() => {
    if (mode !== 'learn' || !cards.length) return [];
    const j = order[pos % order.length];
    const cc = cards[j];
    if (!cc) return [];
    return shuffle([cc.back, ...shuffle(cards.filter((_, k) => k !== j)).slice(0, 3).map((x) => x.back)]);
  }, [mode, cards, order, pos]);

  if (missing) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm" style={{ color: 'var(--mut)' }}>Deck not found.</div>;
  if (!deck) return <div className="mx-auto max-w-[760px] px-5 py-7"><Skeleton /></div>;

  return (
    <div className="mx-auto max-w-[760px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/study" className="hover:underline" style={{ color: 'var(--acc)' }}>Study hub</Link> › {deck.title}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">{deck.title}</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
        {deck.description} · {cards.length} cards
      </p>
      <Tabs selectedKey={mode} onSelectionChange={(k) => switchMode(String(k))} aria-label="Study mode" className="my-3">
        <Tabs.ListContainer>
          <Tabs.List>
            <Tabs.Tab id="flip">Flashcards</Tabs.Tab>
            <Tabs.Tab id="learn">Learn</Tabs.Tab>
            <Tabs.Tab id="test">Test</Tabs.Tab>
            <Tabs.Indicator />
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {!cards.length && <p className="text-sm" style={{ color: 'var(--mut)' }}>This deck is empty.</p>}

      {!!cards.length && mode === 'flip' && <Flip cards={cards} order={order} pos={pos} setPos={setPos} flipped={flipped} setFlipped={setFlipped} box={box} setBox={setBox} />}
      {!!cards.length && mode === 'learn' && (
        <Learn cards={cards} order={order} pos={pos} setPos={setPos} opts={learnOpts} setBox={setBox} box={box} />
      )}
      {!!cards.length && mode === 'test' && test && (
        <Test cards={cards} order={order} test={test} setTest={setTest} />
      )}
    </div>
  );
}

function Flip({ cards, order, pos, setPos, flipped, setFlipped, box, setBox }) {
  const i = order[pos % order.length];
  const c = cards[i];
  const swiped = useRef(false);
  if (!c) return null;
  const go = (d) => {
    setPos((p) => (p + d + order.length) % order.length);
    setFlipped(false);
  };
  return (
    <>
      <div style={{ perspective: 1200 }}>
        <motion.div
          key={i}
          role="button"
          tabIndex={0}
          aria-label="Flashcard — activate to flip, swipe right if you knew it, left if not"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={(_, info) => {
            if (info.offset.x > 90) {
              swiped.current = true;
              setBox(i, Math.min(4, box(i) + 1));
              go(1);
            } else if (info.offset.x < -90) {
              swiped.current = true;
              setBox(i, 1);
              go(1);
            }
          }}
          onClick={(e) => {
            if (swiped.current) {
              swiped.current = false;
              return;
            }
            if (e.target.closest('a')) return;
            setFlipped((f) => !f);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.7, 0.25, 1] }}
          style={{ transformStyle: 'preserve-3d', cursor: 'pointer' }}
          className="relative"
        >
          <div
            className="flex min-h-[230px] flex-col justify-center gap-2.5 rounded-2xl border p-8 text-center shadow-sm"
            style={{ background: 'var(--panel)', borderColor: 'var(--line)', backfaceVisibility: 'hidden' }}
          >
            <p className="m-0 text-xs" style={{ color: 'var(--faint)' }}>
              Card {(pos % order.length) + 1} of {order.length}
              {box(i) >= 3 ? ' · mastered ✓' : ''}
            </p>
            <p className="m-0 text-xl font-bold">{flipped ? '' : c.front}</p>
            {!flipped && (
              <p className="m-0 text-[13px]" style={{ color: 'var(--faint)' }}>
                Front — tap to reveal
              </p>
            )}
            {flipped && <div style={{ transform: 'rotateY(180deg)' }} className="flex flex-col gap-2.5" />}
          </div>
          {flipped && (
            <div
              className="absolute inset-0 flex min-h-[230px] flex-col justify-center gap-2.5 overflow-auto rounded-2xl border p-8 text-center shadow-sm"
              style={{ background: 'var(--panel)', borderColor: 'var(--line)', transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
            >
              <p className="m-0 text-xs" style={{ color: 'var(--faint)' }}>
                Answer
              </p>
              <p className="m-0 text-xl font-bold">{c.back}</p>
              <p className="m-0 text-[13px]" style={{ color: 'var(--faint)' }}>
                Back — tap to flip
                {c.resourceId && (
                  <>
                    {' '}
                    <Link to={'/r/' + c.resourceId} style={{ color: 'var(--acc)' }}>
                      Open source →
                    </Link>
                  </>
                )}
              </p>
            </div>
          )}
        </motion.div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {[
          ['← Prev', () => go(-1)],
          ['I knew it ✓', () => { setBox(i, Math.min(4, box(i) + 1)); go(1); }],
          ['Still learning', () => { setBox(i, 1); go(1); }],
          ['Next →', () => go(1)],
        ].map(([l, fn]) => (
          <Button key={l} size="sm" variant="secondary" onPress={fn}>
            {l}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs" style={{ color: 'var(--faint)' }}>
        Tip: swipe the card → if you knew it, ← if you&apos;re still learning
      </p>
    </>
  );
}

function Learn({ cards, order, pos, setPos, opts, setBox, box }) {
  const toast = useToast();
  const j = order[pos % order.length];
  const cc = cards[j];
  if (!cc) return null;
  return (
    <>
      <p className="text-sm" style={{ color: 'var(--mut)' }}>
        Card {(pos % order.length) + 1} of {order.length}
      </p>
      <div className="rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h3 className="font-display text-lg font-bold">{cc.front}</h3>
        <div className="mt-3 grid gap-2">
          {opts.map((o) => (
            <button
              key={o}
              onClick={() => {
                const right = o === cc.back;
                setBox(j, right ? Math.min(4, box(j) + 1) : 1);
                toast(right ? 'Correct ✓' : 'Not quite — answer: ' + cc.back);
                setPos((p) => (p + 1) % order.length);
              }}
              className="rounded-[10px] border px-4 py-3 text-left text-sm font-semibold transition-all hover:-translate-y-px"
              style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Test({ cards, order, test, setTest }) {
  if (test.i >= test.total) {
    const perfect = test.score === test.total && test.total > 0;
    return (
      <>
        <div className="rounded-2xl border p-6 text-center" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <h3 className="font-display text-2xl font-bold">
            Score: {test.score} / {test.total}
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
            {perfect ? 'Perfect. 🎉' : test.score >= test.total * 0.7 ? 'Solid — review the misses below.' : 'Keep practising — review below.'}
          </p>
          <button
            onClick={() => setTest({ i: 0, score: 0, total: Math.min(10, cards.length), answers: [] })}
            className="mt-3 inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white"
          >
            Retake
          </button>
        </div>
        {perfect && <PerfectBurst />}
        {test.answers.map((a, i) => (
          <div key={i} className="mt-2 rounded-2xl border p-4" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <p>
              <strong>{a.front}</strong>
            </p>
            <p style={{ color: a.ok ? 'var(--ok)' : 'var(--bad)' }}>
              {a.ok ? '✓ ' : '✗ '}
              {a.picked}
              {a.ok ? '' : ' — correct: ' + a.back}
            </p>
          </div>
        ))}
      </>
    );
  }
  const k = order[test.i];
  const ck = cards[k];
  const distract = shuffleArr(cards.filter((_, x) => x !== k)).slice(0, 3).map((x) => x.back);
  const oo = shuffleArr([ck.back, ...distract]);
  return (
    <>
      <p className="text-sm" style={{ color: 'var(--mut)' }}>
        Question {test.i + 1} of {test.total} · score {test.score}
      </p>
      <div className="rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h3 className="font-display text-lg font-bold">{ck.front}</h3>
        <div className="mt-3 grid gap-2">
          {oo.map((o) => (
            <button
              key={o}
              onClick={() => {
                const okk = o === ck.back;
                setTest((t) => ({
                  ...t,
                  score: t.score + (okk ? 1 : 0),
                  answers: [...t.answers, { front: ck.front, back: ck.back, picked: o, ok: okk }],
                  i: t.i + 1,
                }));
              }}
              className="rounded-[10px] border px-4 py-3 text-left text-sm font-semibold transition-all hover:-translate-y-px"
              style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function shuffleArr(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function PerfectBurst() {
  useEffect(() => {
    window.__sehsConfetti?.(100);
  }, []);
  return null;
}
