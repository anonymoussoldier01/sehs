import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { api, pretty } from '../lib/api';
import { keys, pushRecent } from '../lib/store';
import { repo } from '../lib/repo';
import { useOpener, useTerms, useToast } from '../providers';
import { BlurFade, Empty, Skeleton, AnimatedTooltip, SpotlightCard } from '../components/magic';
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
  const [note, setNote] = useState('');
  const [noteState, setNoteState] = useState('saved'); // saved | saving | saved…
  const [distractionFree, setDistractionFree] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [openedBefore, setOpenedBefore] = useState(null);
  const noteTimer = useRef(null);

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
        const prev = repo.readingProgress.get()[r.id];
        setOpenedBefore(prev?.at || null);
        repo.readingProgress.touch(r.id);
        setNote(repo.notes.get(r.id));
        setNoteState('saved');
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
  const canPreview = v?.fileType === 'pdf' || v?.fileType === 'image';
  const scrollToViewer = () => document.getElementById('viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // Autosave notes (debounced) with visible saving/saved status.
  const onNote = (text) => {
    setNote(text);
    setNoteState('saving');
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      repo.notes.set(id, text);
      setNoteState('saved');
    }, 600);
  };

  // Warn before leaving with an unsaved note.
  useEffect(() => {
    if (noteState !== 'saving') return;
    const onBefore = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [noteState]);

  // Viewer shortcuts: o open · s save · f focus mode · ? help.
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (e.key === '?') setShowHelp(true);
      else if ((e.key === 's' || e.key === 'S') && v) toggle(v.id);
      else if ((e.key === 'o' || e.key === 'O') && v) open(v.id);
      else if ((e.key === 'f' || e.key === 'F') && canPreview) setDistractionFree((d) => !d);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [v, open, toggle, canPreview]);

  // Answer-key candidates: same title stem + answer/solution/key words (inferred, never auto-applied).
  const answerKeys = (related || []).filter((r) => {
    const t = String(r.displayTitle || r.title || '').toLowerCase();
    return /answer|solution|marking|key/.test(t) && (r.answersIncluded || /answer|solution/.test(t));
  }).slice(0, 3);

  if (missing)
    return (
      <div className="mx-auto max-w-[900px] px-5 py-10">
        <Empty title="Resource not found" msg="It may have been moved, hidden, or the link is incorrect.">
          <div className="mt-4">
            <Link to="/search" className="inline-flex min-h-[42px] items-center rounded-[11px] bg-[var(--primary)] px-[18px] py-2.5 text-sm font-bold text-[var(--primary-foreground)]">
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
      <div className="mb-4 mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge variant="accent">
          {pretty(v.category)}
        </Badge>
        {v.provider && <Badge variant="secondary">{pretty(v.provider)}</Badge>}
        <Badge variant="secondary">
          {pretty(v.fileType)}
        </Badge>
        {v.answersIncluded && <Badge variant="success">Answers included</Badge>}
      </div>
      {v.description && (
        <p className="reading max-w-[70ch] text-[15px]" style={{ color: 'var(--mut)' }}>
          {v.description}
        </p>
      )}
      {openedBefore && (
        <p className="mt-1 text-[13px]" style={{ color: 'var(--faint)' }}>
          You opened this before ({new Date(openedBefore).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}) — your note and place are kept below.
        </p>
      )}
      <div className="mb-[18px] mt-1.5 flex flex-wrap gap-1.5">
        {(v.tags || []).slice(0, 10).map((t) => (
          <Link
            key={t}
            to={'/search?q=' + encodeURIComponent(t)}
            className="chip-hover rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ borderColor: 'var(--line2)', color: 'var(--mut)' }}
          >
            {pretty(t)}
          </Link>
        ))}
      </div>
      <div className="mb-7 flex flex-wrap items-center gap-2.5" role="toolbar" aria-label="Resource actions">
        <span className="flex flex-wrap gap-2.5" role="group" aria-label="Open">
          {canPreview ? (
            <>
              <Button variant="default" onClick={scrollToViewer}>
                Read here ↓
              </Button>
              <Button variant="secondary" onClick={() => open(v.id)}>
                Open original ↗
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={() => open(v.id)}>
              Open resource →
            </Button>
          )}
        </span>
        <span className="flex flex-wrap gap-2.5" role="group" aria-label="Organise">
          <Button variant="secondary" onClick={() => toggle(v.id)} aria-pressed={String(saved.has(v.id))}>
            {saved.has(v.id) ? '★ Saved' : '☆ Save'}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
              } catch {
                /* noop */
              }
              toast('Link copied');
            }}
          >
            Copy link
          </Button>
          <Button variant="secondary" onClick={() => setRepOpen(true)}>
            Report issue
          </Button>
        </span>
        <span className="flex flex-wrap gap-2.5" role="group" aria-label="View">
          <Button variant="secondary" onClick={() => setDistractionFree((d) => !d)} aria-pressed={String(distractionFree)}>
            {distractionFree ? 'Exit focus mode' : 'Focus mode'}
          </Button>
          <Button variant="secondary" onClick={() => setShowHelp(true)} aria-label="Keyboard shortcuts">
            ?
          </Button>
        </span>
      </div>

      {canPreview && (
        <PreviewPanel id={v.id} kind={v.fileType} title={title} onOpen={() => open(v.id)} />
      )}

      {!distractionFree && !!answerKeys.length && (
        <SpotlightCard className="mb-7 rounded-2xl border shadow-sm" spotlight="rgba(245,158,11,0.10)">
          <section className="rounded-2xl p-[18px]" style={{ background: 'var(--ok-paper, #FBFAF6)' }} aria-label="Possible answer keys">
          <h3 className="mt-0 font-display text-[15.5px] font-bold">Possible answer key</h3>
          <p className="mb-2 mt-0 text-[13px]" style={{ color: 'var(--mut)' }}>
            Inferred from the collection index (title match) — check it covers this paper before trusting it.
          </p>
          <ul className="flex flex-col gap-1.5">
            {answerKeys.map((r) => (
              <li key={r.id}>
                <Link to={'/r/' + r.id} className="text-sm font-semibold hover:underline" style={{ color: 'var(--acc)' }}>
                  {r.displayTitle || r.title}
                </Link>
                <span className="ml-2 text-xs" style={{ color: 'var(--faint)' }}>inferred</span>
              </li>
            ))}
          </ul>
          </section>
        </SpotlightCard>
      )}

      <div className="mb-7 rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h3 className="mt-0 font-display text-[15.5px] font-bold">
          My note <span className="ml-1 text-xs font-semibold" style={{ color: 'var(--faint)' }}>{noteState === 'saving' ? 'Saving…' : 'Saved in this browser'}</span>
        </h3>
        <Textarea value={note} onChange={(e) => onNote(e.target.value)} rows={3} maxLength={8000} placeholder="What should future-you remember about this paper?" aria-label="My note on this resource" />
      </div>

      {showHelp && (
        <Dialog open onOpenChange={(isOpen) => { if (!isOpen) setShowHelp(false); }}>
          <DialogContent aria-label="Viewer keyboard shortcuts">
            <DialogHeader>
              <DialogTitle>Viewer shortcuts</DialogTitle>
              <DialogDescription>Available on this page. Shortcuts rest while typing.</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="tnum font-bold">O</dt><dd>Open the file in its original location</dd>
              <dt className="tnum font-bold">S</dt><dd>Save to my list</dd>
              <dt className="tnum font-bold">F</dt><dd>Toggle focus mode</dd>
              <dt className="tnum font-bold">?</dt><dd>Open this help</dd>
            </dl>
          </DialogContent>
        </Dialog>
      )}

      {!distractionFree && (
      <div className="mb-7 rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h3 className="mt-0 font-display text-[15.5px] font-bold">Study this properly</h3>
        <p className="mb-2.5 mt-0 text-[13.5px]" style={{ color: 'var(--mut)' }}>
          Turn this resource into flashcards or a short quiz. Made on the spot, saved to your browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={flashcards}>
            Make flashcards
          </Button>
          <Button size="sm" variant="secondary" onClick={quizMe}>
            Quiz me on this
          </Button>
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
                    <div className="mt-2">
                      <RadioGroup
                        aria-label={'Question ' + (i + 1)}
                        value={quizPick[i] !== undefined ? String(quizPick[i]) : ''}
                        onValueChange={(val) => setQuizPick((p) => ({ ...p, [i]: Number(val) }))}
                        disabled={quizPick[i] !== undefined}
                      >
                        {qq.options.map((o, k) => (
                          <Label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-[var(--line)] px-3.5 py-2.5 text-sm font-medium">
                            <RadioGroupItem value={String(k)} id={`rq-${i}-${k}`} />
                            <span>{o}</span>
                          </Label>
                        ))}
                      </RadioGroup>
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
      )}

      {repOpen && (
        <Dialog open onOpenChange={(isOpen) => { if (!isOpen) setRepOpen(false); }}>
          <DialogContent aria-label="Report an issue">
            <DialogHeader>
              <DialogTitle>Report an issue</DialogTitle>
              <DialogDescription>Tell us what is wrong and we will triage it.</DialogDescription>
            </DialogHeader>
            <form onSubmit={sendReport} className="grid gap-2">
              <Select aria-label="Reason" value={reason} onValueChange={(k) => setReason(String(k))}>
                <option value="broken">Link is broken</option>
                <option value="wrong-details">Wrong title/details</option>
                <option value="other">Something else</option>
              </Select>
              <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={500} placeholder="Optional details…" aria-label="Optional details" />
              <div>
                <Button type="submit" variant="default">
                  Send report
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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

function PreviewPanel({ id, kind, title, onOpen }) {
  const { ensure } = useTerms();
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [needsTerms, setNeedsTerms] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState(null);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    setErr(null);
    setNeedsTerms(false);
    let ok = false;
    try {
      ok = await ensure();
    } catch {
      ok = false;
    }
    if (!ok) {
      setNeedsTerms(true);
      return;
    }
    try {
      const j = await api.preview(id);
      setSrc(j.embedUrl);
    } catch (e) {
      setErr(e.message || 'Preview unavailable');
    }
  }, [ensure, id]);

  useEffect(() => {
    setSrc(null);
    setLoaded(false);
    setBlockedUrl(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openOriginal = async () => {
    const res = await onOpen();
    if (res?.blocked) setBlockedUrl(res.url);
  };

  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  return (
    <div id="viewer" className="mb-7 scroll-mt-24 overflow-hidden rounded-2xl border shadow-md" style={{ background: 'var(--panel)', borderColor: 'var(--line2)' }}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <h2 className="font-display text-[15px] font-bold">
          {kind === 'image' ? 'Image viewer' : 'Document viewer'}
        </h2>
        <span className="max-w-[40ch] truncate text-xs" style={{ color: 'var(--faint)' }}>{title}</span>
        <span className="ml-auto flex flex-wrap gap-2">
          <AnimatedTooltip tip="Fill the screen">
            <Button size="sm" variant="secondary" onClick={fullscreen}>
              ⛶ Fullscreen
            </Button>
          </AnimatedTooltip>
          <AnimatedTooltip tip="Open the original file" shortcut="O">
            <Button size="sm" variant="secondary" onClick={openOriginal}>
              Open original ↗
            </Button>
          </AnimatedTooltip>
        </span>
      </div>
      <div ref={wrapRef} className="relative" style={{ height: 'min(80vh, 720px)', background: 'var(--ok-paper, #FBFAF6)' }}>
        {!loaded && !err && !needsTerms && (
          <div className="absolute inset-0" aria-label="Loading document">
            <div className="mx-auto mt-10 h-6 w-2/3 animate-pulse rounded" style={{ background: 'var(--line)' }} />
            <div className="mx-auto mt-3 h-4 w-1/2 animate-pulse rounded" style={{ background: 'var(--line)' }} />
            <div className="mx-6 mt-6 space-y-3">
              {Array.from({ length: 8 }, (_, k) => (
                <div key={k} className="h-3 animate-pulse rounded" style={{ background: 'var(--line)', opacity: 0.7, width: `${92 - (k % 3) * 12}%` }} />
              ))}
            </div>
          </div>
        )}
        {needsTerms ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <p className="text-sm font-bold">One quick step before reading</p>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
                Accept the Terms &amp; Conditions once per tab to read documents here.
              </p>
              <p className="mt-3">
                <Button size="sm" variant="default" onClick={load}>
                  Continue to document →
                </Button>
              </p>
            </div>
          </div>
        ) : err ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <p className="text-sm font-bold">Preview didn&apos;t load</p>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
                {err} — the file still opens fine in its original location.
              </p>
              <p className="mt-3 flex justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={load}>
                  Retry
                </Button>
                <Button size="sm" variant="default" onClick={openOriginal}>
                  Open original ↗
                </Button>
              </p>
            </div>
          </div>
        ) : (
          src && (
            <iframe
              title={kind === 'image' ? 'Image viewer' : 'Document viewer'}
              src={src}
              className="absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-300"
              style={{ opacity: loaded ? 1 : 0 }}
              onLoad={() => setLoaded(true)}
              allow="fullscreen"
            />
          )
        )}
      </div>
      {blockedUrl ? (
        <p className="border-t px-4 py-2.5 text-[13px]" style={{ borderColor: 'var(--line)', background: 'var(--warn-bg)' }}>
          <strong>Popup blocked — your file is ready:</strong>{' '}
          <a href={blockedUrl} target="_blank" rel="noopener" className="font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>
            Click to open the file
          </a>
        </p>
      ) : (
        <p className="border-t px-4 py-2 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--faint)' }}>
          Reading here keeps your place and notes together. Some files block embedding — use Open original instead. Press ? for shortcuts.
        </p>
      )}
    </div>
  );
}
