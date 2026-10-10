import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';
import { ListBox } from '@heroui/react/list-box';
import { ListBoxItem } from '@heroui/react/list-box-item';
import { Modal } from '@heroui/react/modal';
import { Radio } from '@heroui/react/radio';
import { RadioGroup } from '@heroui/react/radio-group';
import { Select } from '@heroui/react/select';
import { TextArea } from '@heroui/react/textarea';
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
  const [previewOpen, setPreviewOpen] = useState(false);
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
      <div className="mb-4 mt-2.5 flex flex-wrap items-center gap-1.5">
        <Chip size="sm" color="accent">
          {pretty(v.category)}
        </Chip>
        {v.provider && <Chip size="sm" variant="secondary">{pretty(v.provider)}</Chip>}
        <Chip size="sm" variant="secondary">
          {pretty(v.fileType)}
        </Chip>
        {v.answersIncluded && <Chip size="sm" color="success">Answers included</Chip>}
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
        <Button variant="primary" onPress={() => open(v.id)}>
          {v.fileType === 'pdf' ? 'Open PDF →' : 'Open resource →'}
        </Button>
        {v.fileType === 'pdf' && (
          <Button variant="secondary" onPress={() => setPreviewOpen((o) => !o)} aria-expanded={String(previewOpen)}>
            {previewOpen ? 'Hide preview' : 'Preview here'}
          </Button>
        )}
        <Button variant="secondary" onPress={() => toggle(v.id)} aria-pressed={String(saved.has(v.id))}>
          {saved.has(v.id) ? '★ Saved' : '☆ Save'}
        </Button>
        <Button
          variant="secondary"
          onPress={async () => {
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
        <Button variant="secondary" onPress={() => setRepOpen(true)}>
          Report issue
        </Button>
      </div>

      {v.fileType === 'pdf' && previewOpen && (
        <PreviewPanel id={v.id} onOpen={() => open(v.id)} />
      )}

      <div className="mb-7 rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h3 className="mt-0 font-display text-[15.5px] font-bold">Study this properly</h3>
        <p className="mb-2.5 mt-0 text-[13.5px]" style={{ color: 'var(--mut)' }}>
          Turn this resource into flashcards or a short quiz. Made on the spot, saved to your browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onPress={flashcards}>
            Make flashcards
          </Button>
          <Button size="sm" variant="secondary" onPress={quizMe}>
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
                        value={quizPick[i] !== undefined ? String(quizPick[i]) : null}
                        onChange={(v) => setQuizPick((p) => ({ ...p, [i]: Number(v) }))}
                        isDisabled={quizPick[i] !== undefined}
                      >
                        {qq.options.map((o, k) => (
                          <Radio key={k} value={String(k)}>
                            <Radio.Control>
                              <Radio.Indicator />
                            </Radio.Control>
                            <Radio.Content>{o}</Radio.Content>
                          </Radio>
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

      {repOpen && (
      <Modal defaultOpen onOpenChange={(open) => { if (!open) setRepOpen(false); }}>
        <Modal.Backdrop>
          <Modal.Container placement="center">
            <Modal.Dialog aria-label="Report an issue">
              <Modal.Header>
                <h2 className="font-display text-xl font-bold">Report an issue</h2>
              </Modal.Header>
              <Modal.Body>
                <form onSubmit={sendReport} className="grid gap-2">
                  <Select aria-label="Reason" selectedKey={reason} onSelectionChange={(k) => setReason(String(k))}>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox aria-label="Report reasons">
                        {[['broken', 'Link is broken'], ['wrong-details', 'Wrong title/details'], ['other', 'Something else']].map(([v, l]) => (
                          <ListBoxItem key={v} id={v} textValue={l}>
                            {l}
                          </ListBoxItem>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <TextArea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={500} placeholder="Optional details…" aria-label="Optional details" />
                  <div>
                    <Button type="submit" variant="primary">
                      Send report
                    </Button>
                  </div>
                </form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
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

function PreviewPanel({ id, onOpen }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    let live = true;
    api
      .preview(id)
      .then((j) => live && setSrc(j.embedUrl))
      .catch((e) => live && setErr(e.message || 'Preview unavailable'));
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <div className="mb-7 overflow-hidden rounded-2xl border shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <h3 className="font-display text-[15px] font-bold">PDF preview</h3>
        <span className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              const el = wrapRef.current;
              if (!el) return;
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              else el.requestFullscreen?.().catch(() => {});
            }}
          >
            Fullscreen
          </Button>
          <Button size="sm" variant="primary" onPress={onOpen}>
            Open PDF →
          </Button>
        </span>
      </div>
      <div ref={wrapRef} className="relative bg-black/40" style={{ height: 'min(75vh, 640px)' }}>
        {!loaded && !err && (
          <div className="absolute inset-0 animate-pulse" style={{ background: 'var(--bg2)' }} aria-label="Loading preview" />
        )}
        {err ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <p className="text-sm font-bold">Preview didn&apos;t load</p>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
                {err} — the file still opens fine in a new tab.
              </p>
              <p className="mt-3">
                <Button size="sm" variant="primary" onPress={onOpen}>
                  Open PDF →
                </Button>
              </p>
            </div>
          </div>
        ) : (
          src && (
            <iframe
              title="PDF preview"
              src={src}
              className="absolute inset-0 h-full w-full border-0 bg-white"
              onLoad={() => setLoaded(true)}
              allow="fullscreen"
            />
          )
        )}
      </div>
      <p className="px-4 py-2 text-xs" style={{ color: 'var(--faint)' }}>
        Preview not loading? Some files block embedding — use Open PDF instead.
      </p>
    </div>
  );
}
