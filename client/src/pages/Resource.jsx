import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, pretty } from '../lib/api';
import { keys, pushRecent } from '../lib/store';
import { useOpener, useToast } from '../providers';
import { BlurFade, Empty, Skeleton } from '../components/magic';
import { ResourceCard, highlight } from '../components/cards';
import { useSaved } from '../components/cards';

export default function Resource() {
  const { id } = useParams();
  const open = useOpener();
  const toast = useToast();
  const { saved, toggle } = useSaved();
  const [v, setV] = useState(null);
  const [related, setRelated] = useState([]);
  const [missing, setMissing] = useState(false);
  const [repOpen, setRepOpen] = useState(false);
  const [reason, setReason] = useState('broken');
  const [detail, setDetail] = useState('');
  const [aiHtml, setAiHtml] = useState(null);
  const [aiCards, setAiCards] = useState(null);

  useEffect(() => {
    let live = true;
    setV(null);
    setMissing(false);
    setRelated([]);
    api
      .byIds([id])
      .then((j) => {
        if (!live) return;
        if (!j.results?.length) {
          setMissing(true);
          return;
        }
        const r = j.results[0];
        setV(r);
        pushRecent(r.id, r.displayTitle || r.title);
        document.title = `${r.displayTitle || r.title} — SEHS Study`;
        const words = (r.displayTitle || r.title || '').split(/\s+/).slice(0, 3).join(' ');
        api
          .search({ q: words, per: 7 })
          .then((s) => live && setRelated((s.results || []).filter((x) => x.id !== r.id).slice(0, 6)))
          .catch(() => {});
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [id]);

  const sendReport = async (e) => {
    e.preventDefault();
    try {
      await api.report(id, reason, detail);
      setRepOpen(false);
      setDetail('');
      toast('Thanks — report received');
    } catch (err) {
      toast(err.message || 'Could not send report');
    }
  };

  const flashcards = async () => {
    setAiHtml('<p>Making cards…</p>');
    setAiCards(null);
    try {
      const j = await api.aiFlashcards((v.displayTitle || v.title || '').slice(0, 120));
      setAiCards(j.cards);
      setAiHtml(`<p><strong>${j.cards.length} cards</strong>${j.cached ? ' (instant)' : ''}</p>`);
    } catch (e) {
      setAiHtml(`<p>AI unavailable: ${e.message}</p>`);
    }
  };

  const [quiz, setQuiz] = useState(null);
  const [quizPick, setQuizPick] = useState({});
  const quizMe = async () => {
    setQuiz(null);
    setQuizPick({});
    setAiHtml('<p>Writing a quiz…</p>');
    try {
      const j = await api.aiQuestions('verbal', (v.displayTitle || v.title || '').slice(0, 120), 4);
      setQuiz(j.questions);
      setAiHtml(null);
    } catch (e) {
      setAiHtml(`<p>AI unavailable: ${e.message}</p>`);
    }
  };

  const saveDeck = () => {
    if (!aiCards) return;
    try {
      const decks = JSON.parse(localStorage.getItem(keys.decks) || '[]');
      decks.push({ title: 'AI: ' + (v.displayTitle || v.title || '').slice(0, 60), cards: aiCards });
      localStorage.setItem(keys.decks, JSON.stringify(decks));
      toast('Saved — see Study hub');
    } catch {
      toast('Could not save');
    }
  };

  if (missing)
    return (
      <div className="mx-auto max-w-[900px] px-5 py-10">
        <Empty title="Resource not found" msg="It may have been moved, hidden, or the link is incorrect.">
          <div className="mt-4">
            <Link to="/search" className="inline-flex min-h-[42px] items-center rounded-[11px] bg-[#2f49e5] px-[18px] py-2.5 text-sm font-bold text-white">
              Clear search &amp; filters
            </Link>
          </div>
        </Empty>
      </div>
    );
  if (!v)
    return (
      <div className="mx-auto max-w-[900px] px-5 py-5">
        <Skeleton />
      </div>
    );

  const title = v.displayTitle || v.title;
  return (
    <div className="mx-auto max-w-[900px] px-5 py-5">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>
          Home
        </Link>{' '}
        › <Link to={'/search?cat=' + encodeURIComponent(v.category)} className="hover:underline" style={{ color: 'var(--acc)' }}>{pretty(v.category)}</Link> › {title.slice(0, 60)}
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{highlight(title, [])}</h1>
      <div className="mb-4 mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-md border px-2 py-[3px] text-[11px] font-bold" style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)', color: 'var(--acc)' }}>
          {pretty(v.category)}
        </span>
        {v.provider && (
          <span className="rounded-md border border-dashed px-2 py-[3px] text-[11px] font-bold" style={{ borderColor: 'var(--line)', color: 'var(--mut)' }}>
            {pretty(v.provider)}
          </span>
        )}
        <span className="rounded-md border px-2 py-[3px] text-[11px] font-bold" style={{ background: 'var(--bg2)', borderColor: 'var(--line)' }}>
          {pretty(v.fileType)}
        </span>
        {v.answersIncluded && (
          <span className="rounded-md px-2 py-[3px] text-[11px] font-bold" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
            Answers included
          </span>
        )}
      </div>
      {v.description && (
        <p className="max-w-[70ch] text-[15px]" style={{ color: 'var(--mut)' }}>
          {v.description}
        </p>
      )}
      <div className="mb-[18px] mt-1.5 flex flex-wrap gap-1.5">
        {(v.tags || []).slice(0, 10).map((t) => (
          <Link
            key={t}
            to={'/search?q=' + encodeURIComponent(t)}
            className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-all hover:-translate-y-px"
            style={{ borderColor: 'var(--line2)', color: 'var(--mut)' }}
          >
            {pretty(t)}
          </Link>
        ))}
      </div>
      <div className="mb-7 flex flex-wrap gap-2.5">
        <button onClick={() => open(v.id)} className="inline-flex min-h-[42px] items-center rounded-[11px] bg-[#2f49e5] px-[18px] py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-[#2235b8] active:scale-[.98]">
          {v.fileType === 'pdf' ? 'Open PDF →' : 'Open resource →'}
        </button>
        <button
          onClick={() => toggle(v.id)}
          aria-pressed={String(saved.has(v.id))}
          className="inline-flex min-h-[42px] items-center rounded-[11px] border px-[18px] py-2.5 text-sm font-bold shadow-sm"
          style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
        >
          {saved.has(v.id) ? '★ Saved' : '☆ Save'}
        </button>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
            } catch {
              /* noop */
            }
            toast('Link copied');
          }}
          className="inline-flex min-h-[42px] items-center rounded-[11px] border px-[18px] py-2.5 text-sm font-bold shadow-sm"
          style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
        >
          Copy link
        </button>
        <button
          onClick={() => setRepOpen(true)}
          className="inline-flex min-h-[42px] items-center rounded-[11px] border px-[18px] py-2.5 text-sm font-bold shadow-sm"
          style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
        >
          Report issue
        </button>
      </div>

      <div className="mb-7 rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h3 className="mt-0 font-display text-[15.5px] font-bold">Study this properly</h3>
        <p className="mb-2.5 mt-0 text-[13.5px]" style={{ color: 'var(--mut)' }}>
          Turn this resource into flashcards or a short quiz. Made on the spot, saved to your browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={flashcards} className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
            Make flashcards
          </button>
          <button onClick={quizMe} className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
            Quiz me on this
          </button>
        </div>
        {(aiHtml || aiCards || quiz) && (
          <div className="mt-2">
            {aiHtml && <div className="text-sm" dangerouslySetInnerHTML={{ __html: aiHtml }} />}
            {aiCards && (
              <>
                <div className="mt-1 flex flex-col gap-1.5">
                  {aiCards.slice(0, 5).map((c, i) => (
                    <p key={i} className="text-[13.5px]">
                      Q: {c.front}
                      <br />
                      A: {c.back}
                    </p>
                  ))}
                </div>
                <p className="mt-2">
                  <button onClick={saveDeck} className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
                    Save as personal deck
                  </button>
                </p>
              </>
            )}
            {quiz && (
              <div className="mt-1 flex flex-col gap-2">
                {quiz.map((qq, i) => (
                  <div key={i} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                    <p className="text-sm">
                      <strong>Q{i + 1}</strong> {qq.stem}
                    </p>
                    <div className="mt-2 grid gap-1.5">
                      {qq.options.map((o, k) => {
                        const sel = quizPick[i] === k;
                        const done = quizPick[i] !== undefined;
                        return (
                          <button
                            key={k}
                            disabled={done}
                            onClick={() => setQuizPick((p) => ({ ...p, [i]: k }))}
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
                    {quizPick[i] !== undefined && (
                      <p className="mt-1 text-[13px]" style={{ color: quizPick[i] === qq.answer ? 'var(--ok)' : 'var(--bad)' }}>
                        {quizPick[i] === qq.answer ? '✓ Correct. ' : `✗ Correct: ${qq.options[qq.answer]}. `}
                        {qq.explain}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {repOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4" onClick={() => setRepOpen(false)}>
          <div
            className="w-full max-w-[480px] rounded-2xl border p-6 shadow-2xl"
            style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
            role="dialog"
            aria-modal="true"
            aria-label="Report an issue"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold">Report an issue</h2>
            <form onSubmit={sendReport} className="mt-2 grid gap-2">
              <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" className="rounded-lg border p-2.5" style={{ borderColor: 'var(--line2)', background: 'var(--panel)', color: 'inherit' }}>
                <option value="broken">Link is broken</option>
                <option value="wrong-details">Wrong title/details</option>
                <option value="other">Something else</option>
              </select>
              <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={500} placeholder="Optional details…" className="rounded-lg border p-2.5" style={{ borderColor: 'var(--line2)', background: 'var(--panel)', color: 'inherit' }} />
              <div>
                <button type="submit" className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
                  Send report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!!related.length && (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">Related resources</h2>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {related.map((r, i) => (
              <BlurFade key={r.id} delay={i * 0.04}>
                <ResourceCard v={r} showDesc={false} />
              </BlurFade>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
