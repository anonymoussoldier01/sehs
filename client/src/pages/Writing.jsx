import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { TypingText } from '../components/magic';
import { api } from '../lib/api';
import { keys } from '../lib/store';
import { useToast } from '../providers';

const BANDS = {
  ideas: ['thin or off-topic', 'basic idea, partly developed', 'clear, well-developed ideas'],
  structure: ['no clear shape', 'paragraphs present, links weak', 'shaped, linked, strong opening/close'],
  devices: ['none evident', 'some devices attempted', 'controlled, well-chosen devices'],
  vocabulary: ['repetitive, basic', 'some precise choices', 'precise and varied'],
  sentences: ['fragments or run-ons', 'mostly correct, little variety', 'varied and controlled'],
  spelling: ['errors distract', 'mostly accurate', 'accurate throughout'],
};
const bandOf = (v) => (v <= 2 ? 0 : v === 3 ? 1 : 2);

function readGrades() {
  try {
    return JSON.parse(localStorage.getItem('sehs-grades') || '[]');
  } catch {
    return [];
  }
}

export default function Writing() {
  const toast = useToast();
  const [prompts, setPrompts] = useState(null);
  const [kind, setKind] = useState(null);
  const [current, setCurrent] = useState(null);
  const [text, setText] = useState('');
  const [secs, setSecs] = useState(20 * 60);
  const [running, setRunning] = useState(false);
  const [aiOut, setAiOut] = useState(null);
  const [grade, setGrade] = useState(null);
  const [grades, setGrades] = useState(readGrades);
  const [busy, setBusy] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    document.title = 'Writing studio · SEHS Study';
    let live = true;
    api
      .writing()
      .then((j) => live && setPrompts(j.prompts || []))
      .catch(() => live && setPrompts([]));
    try {
      const d = localStorage.getItem('sehs-draft');
      if (d) setText(d);
    } catch {
      /* noop */
    }
    return () => {
      live = false;
      clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(timer.current);
          setRunning(false);
          toast("Time! Check the rubric, then get feedback.");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer.current);
  }, [running, toast]);

  const words = (text.match(/\S+/g) || []).length;
  const pool = (prompts || []).filter((p) => !kind || p.kind === kind);
  const pick = (list) => {
    const arr = list?.length ? list : pool;
    if (!arr.length) return;
    setCurrent(arr[Math.floor(Math.random() * arr.length)]);
  };

  const newAiPrompt = async () => {
    setBusy('prompt');
    try {
      const j = await api.aiPrompt(kind === 'creative' ? 'creative' : 'persuasive', '');
      setCurrent({ kind: kind || 'persuasive', prompt: j.prompt.prompt, stimulus: j.prompt.stimulus, plan: j.prompt.plan });
    } catch (e) {
      toast('AI unavailable: ' + e.message);
    }
    setBusy(null);
  };

  const feedback = async () => {
    if (words < 10) {
      toast('Write a little more first.');
      return;
    }
    setBusy('fb');
    setAiOut('Reading your work…');
    try {
      setAiOut(await api.aiChat('writing', `Kind: ${current?.kind || 'persuasive'}. Prompt: ${current?.prompt || ''}\n\nMy response:\n${text.slice(0, 3200)}`));
    } catch (e) {
      setAiOut('AI unavailable: ' + e.message);
    }
    setBusy(null);
  };

  const gradeIt = async () => {
    if (words < 30) {
      toast('Write at least ~30 words first.');
      return;
    }
    setBusy('grade');
    setGrade(null);
    try {
      const kind = current?.kind === 'creative' ? 'creative' : 'persuasive';
      const j = await api.aiGrade(kind, text);
      setGrade(j);
      const entry = { at: new Date().toISOString().slice(0, 10), kind, overall: j.ai?.overall ?? j.auto?.overall ?? null, words };
      try {
        const all = [entry, ...readGrades()].slice(0, 20);
        localStorage.setItem('sehs-grades', JSON.stringify(all));
        setGrades(all);
      } catch {
        /* noop */
      }
    } catch (e) {
      toast('AI unavailable: ' + e.message);
    }
    setBusy(null);
  };

  const inputCls = 'rounded-[10px] border px-3 py-2 text-sm';
  const inputStyle = { borderColor: 'var(--line2)', background: 'var(--panel)', color: 'var(--txt)' };

  return (
    <div className="mx-auto max-w-[860px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>Home</Link> › Writing
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">Writing studio</h1>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        80 prompts (40 persuasive + 40 creative). 20:00 timer per task, word counter (target 250-350). Drafts autosave in this browser.
      </p>
      <div className="my-3 flex flex-wrap gap-2">
        <Button size="sm" variant="default" onClick={() => pick()}>Random prompt</Button>
        {['persuasive', 'creative'].map((k) => (
          <Button
            key={k}
            size="sm"
            variant={kind === k ? 'primary' : 'secondary'}
            onClick={() => {
              setKind(kind === k ? null : k);
              pick((prompts || []).filter((p) => p.kind === k));
            }}
            className="capitalize"
          >
            {k}
          </Button>
        ))}
        <Button size="sm" variant="secondary" disabled={busy === 'prompt'} onClick={newAiPrompt}>
          {busy === 'prompt' ? 'Writing…' : '✦ New AI prompt'}
        </Button>
      </div>
      <div className="rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h3 className="font-display text-[15.5px] font-bold">{current ? current.prompt : 'Pick a prompt to start'}</h3>
        {!!current?.stimulus && (
          <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
            {current.stimulus}
          </p>
        )}
        {!!current?.plan?.length && (
          <p className="mt-1 text-[13px]" style={{ color: 'var(--faint)' }}>
            Plan: {current.plan.join(' → ')}
          </p>
        )}
      </div>
      <div className="my-3.5 flex flex-wrap items-center gap-3">
        <div className={`font-display text-[28px] font-extrabold tabular-nums ${secs <= 60 && running ? 'animate-pulse' : ''}`} style={secs <= 60 && running ? { color: 'var(--bad)' } : undefined}>
          {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setRunning((r) => !r)}
        >
          {running ? 'Pause' : 'Start'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setRunning(false);
            setSecs(20 * 60);
          }}
        >
          Reset
        </Button>
        <span className="text-sm tabular-nums" style={{ color: 'var(--mut)' }}>
          {words} words{words >= 250 && words <= 350 ? ' · on target ✓' : ''}
        </span>
      </div>
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            localStorage.setItem('sehs-draft', e.target.value);
          } catch {
            /* noop */
          }
        }}
        rows={12}
        placeholder="Write here…"
        aria-label="Your writing"
        className="w-full"
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="default" disabled={busy === 'fb'} onClick={feedback}>
          {busy === 'fb' ? 'Reading…' : 'Get AI feedback'}
        </Button>
        <Button size="sm" variant="secondary" disabled={busy === 'grade'} onClick={gradeIt}>
          {busy === 'grade' ? 'Grading…' : 'Grade my writing'}
        </Button>
        <span className="text-xs" style={{ color: 'var(--faint)' }}>
          Optional · free shared AI · don&apos;t include your name · ~20s between requests
        </span>
      </div>
      {aiOut && (
        <div className="mt-2.5 rounded-2xl border p-4" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <h3 className="font-bold">AI feedback</h3>
          <p className="whitespace-pre-wrap text-sm">
            <TypingText text={aiOut} />
          </p>
        </div>
      )}
      {grade && (
        <div className="mt-2.5 rounded-2xl border p-4" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <h3 className="font-bold">Grade</h3>
          {grade.ai ? (
            <>
              {Object.entries(grade.ai.scores || {}).map(([k, v]) => (
                <div key={k} className="my-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-[110px] flex-none text-[13px] font-semibold capitalize">{k}</span>
                    <span className="h-3 flex-1 overflow-hidden rounded-md border" style={{ background: 'var(--bg2)', borderColor: 'var(--line)' }}>
                      <span className="block h-full rounded-md transition-all" style={{ width: `${(v / 5) * 100}%`, background: 'var(--primary)' }} />
                    </span>
                    <span className="w-[26px] flex-none text-right text-[13px] font-bold tabular-nums">{v}</span>
                  </div>
                  <p className="ml-[118px] text-xs" style={{ color: 'var(--faint)' }}>
                    Band: {(BANDS[k] || [])[bandOf(v)] || ''}
                  </p>
                </div>
              ))}
              <p className="mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
                Overall {grade.ai.overall}/5 · {grade.ai.strength} {grade.ai.fix1} {grade.ai.fix2}
              </p>
            </>
          ) : (
            <p className="text-[13px]" style={{ color: 'var(--mut)' }}>
              {grade.note || 'Showing automatic checks only.'} Words: {grade.auto?.words}
            </p>
          )}
        </div>
      )}
      {!!grades.length && (
        <div className="mt-2.5 rounded-2xl border p-4" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <h3 className="font-bold">Grade history</h3>
          <div className="mt-1.5 flex flex-col gap-1">
            {grades.slice(0, 8).map((g, i) => (
              <p key={i} className="flex justify-between text-[13px] tabular-nums">
                <span style={{ color: 'var(--mut)' }}>{g.at} · {g.kind}</span>
                <strong>{g.overall != null ? `${g.overall}/5` : '–'}</strong>
              </p>
            ))}
          </div>
        </div>
      )}
      <h2 className="mb-3 mt-6 font-display text-xl font-bold">Self-rubric (tick before you finish)</h2>
      <div className="flex flex-col gap-1 rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        {['Clear position / story problem by line 5', 'Paragraphs: 1 idea each, linked', '2+ persuasive devices / 3+ senses (creative)', 'Varied sentences (short punch + long flow)', 'Precise vocab (no repeats)', 'Spelling + punctuation checked'].map((t) => (
          <label key={t} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-medium">
            <Checkbox aria-label={t} />
            {t}
          </label>
        ))}
      </div>
    </div>
  );
}
