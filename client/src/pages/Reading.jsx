import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { recordMistake } from '../lib/store';
import { useToast } from '../providers';
import { Skeleton } from '../components/magic';

export default function Reading() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [cur, setCur] = useState(null);
  const [pick, setPick] = useState({});
  const [genre, setGenre] = useState('');
  const [busy, setBusy] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);

  useEffect(() => {
    document.title = 'Reading studio — SEHS Study';
    let live = true;
    api
      .reading()
      .then((j) => {
        if (!live) return;
        setList(j.passages || []);
        setCur(j.passages?.[0] || null);
      })
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, []);

  const open = (p) => {
    setCur(p);
    setPick({});
  };

  const aiPassage = async () => {
    setBusy(true);
    try {
      const j = await api.aiPassage(genre || undefined, '');
      const p = { id: 'ai-' + Date.now(), title: j.passage.title, genre: j.genre, text: j.passage.text, questions: j.passage.questions };
      setList((l) => [p, ...(l || [])]);
      setCur(p);
      setPick({});
    } catch (e) {
      toast('AI unavailable: ' + e.message);
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-[860px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>Home</Link> › Reading
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">Reading studio</h1>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Built-in passages plus unlimited AI-written passages.{' '}
        <span className="font-bold tabular-nums">
          Session: {correct}/{answered}
        </span>
      </p>
      {!list ? (
        <div className="mt-3">
          <Skeleton />
        </div>
      ) : (
        <div className="my-3 flex flex-wrap gap-2">
          {list.map((p) => (
            <button
              key={p.id}
              onClick={() => open(p)}
              className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold"
              style={
                cur?.id === p.id
                  ? { background: '#2f49e5', borderColor: '#2f49e5', color: '#fff' }
                  : { borderColor: 'var(--line2)', background: 'var(--panel)' }
              }
            >
              {p.title}
            </button>
          ))}
        </div>
      )}
      <div className="my-3 flex flex-wrap items-center gap-2">
        <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre" className="min-h-[40px] rounded-lg border px-2.5 py-2 text-sm font-semibold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)', color: 'var(--txt)' }}>
          <option value="">Any genre (rotates)</option>
          {['fiction', 'nonfiction', 'opinion', 'poetry', 'informational'].map((g) => (
            <option key={g} value={g}>
              {g[0].toUpperCase() + g.slice(1)}
            </option>
          ))}
        </select>
        <button onClick={aiPassage} disabled={busy} className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
          {busy ? 'Writing…' : '✦ New AI passage'}
        </button>
      </div>
      {cur && (
        <div className="rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <h3 className="font-display text-xl font-bold">{cur.title}</h3>
          <p className="mt-2 max-h-[300px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--mut)' }}>
            {cur.text}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {(cur.questions || []).map((qq, i) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: 'var(--line)' }}>
                <p className="text-sm">
                  <strong>Q{i + 1}</strong> {qq.stem}
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
                          setAnswered((a) => a + 1);
                          if (k === qq.answer) setCorrect((c) => c + 1);
                          else recordMistake({ stem: qq.stem, strand: 'reading', picked: k, correct: qq.answer });
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
        </div>
      )}
    </div>
  );
}
