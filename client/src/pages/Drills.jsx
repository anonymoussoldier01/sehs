import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { recordMistake } from '../lib/store';
import { useToast } from '../providers';

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function gen(kind) {
  if (kind === 'fraction') {
    const d = rnd(2, 12);
    const n = rnd(1, d - 1);
    const g = gcd(n, d);
    return { q: `Simplify ${n}/${d}`, a: [`${n / g}/${d / g}`], explain: `Divide top and bottom by ${g}.` };
  }
  if (kind === 'percent') {
    const p = pick([10, 20, 25, 50, 75]);
    const v = rnd(2, 20) * 10;
    return { q: `What is ${p}% of ${v}?`, a: [String((v * p) / 100)], explain: `${p}% = ${p}/100.` };
  }
  if (kind === 'algebra') {
    const a = rnd(2, 9);
    const b = rnd(1, 20);
    const x = rnd(1, 12);
    return { q: `Solve: ${a}x + ${b} = ${a * x + b}`, a: [String(x)], explain: `x = (${a * x + b} − ${b}) ÷ ${a}.` };
  }
  if (kind === 'bodmas') {
    const a = rnd(2, 9);
    const b = rnd(2, 9);
    const c = rnd(1, 9);
    return { q: `Evaluate: ${a} + ${b} × ${c}`, a: [String(a + b * c)], explain: `Multiply first: ${b} × ${c} = ${b * c}.` };
  }
  // sequence
  const start = rnd(1, 12);
  const step = rnd(2, 9);
  return {
    q: `Next: ${[0, 1, 2, 3].map((k) => start + k * step).join(', ')}, ?`,
    a: [String(start + 4 * step)],
    explain: `Add ${step} each time.`,
  };
}
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

const KINDS = [
  ['fraction', 'Fractions'],
  ['percent', 'Percent'],
  ['algebra', 'Algebra'],
  ['bodmas', 'BODMAS'],
  ['sequence', 'Sequences'],
];

export default function Drills() {
  const toast = useToast();
  const [kind, setKind] = useState('fraction');
  const [cur, setCur] = useState(() => gen('fraction'));
  const [val, setVal] = useState('');
  const [msg, setMsg] = useState('');
  const [streak, setStreak] = useState(0);
  const [aiSet, setAiSet] = useState(null);
  const [aiIdx, setAiIdx] = useState(0);

  useEffect(() => {
    document.title = 'Maths drills — SEHS Study';
  }, []);

  const next = (k) => {
    setCur(gen(k || kind));
    setVal('');
    setMsg('');
    setAiSet(null);
  };

  const check = () => {
    if (aiSet) {
      const q = aiSet[aiIdx];
      const ok = Number(val.trim()) === q.answer || val.trim().toLowerCase() === String(q.options[q.answer]).trim().toLowerCase();
      if (ok) {
        setMsg('✓ Correct. ' + q.explain);
        setStreak((s) => s + 1);
      } else {
        setMsg(`✗ Correct: ${q.options[q.answer]}. ${q.explain}`);
        setStreak(0);
        recordMistake({ stem: q.stem, strand: 'maths', picked: val, correct: q.answer });
      }
      return;
    }
    const ok = cur.a.some((a) => val.trim().replace(/\s+/g, '') === a.replace(/\s+/g, ''));
    if (ok) {
      setMsg('✓ Correct. ' + cur.explain);
      setStreak((s) => s + 1);
      try {
        const m = JSON.parse(localStorage.getItem('sehs-drill-streak') || '0');
        localStorage.setItem('sehs-drill-streak', JSON.stringify(Math.max(Number(m) || 0, streak + 1)));
      } catch {
        /* noop */
      }
    } else {
      setMsg(`✗ Answer: ${cur.a[0]}. ${cur.explain}`);
      setStreak(0);
      recordMistake({ stem: cur.q, strand: 'maths', picked: val, correct: cur.a[0] });
    }
  };

  const aiDrill = async () => {
    setMsg('Writing fresh questions…');
    try {
      const j = await api.aiQuestions('maths', kind, 5);
      setAiSet(j.questions);
      setAiIdx(0);
      setVal('');
      setMsg('');
    } catch (e) {
      setMsg('AI unavailable: ' + e.message);
      toast('AI unavailable — drills below still work');
    }
  };

  const shown = aiSet ? { q: aiSet[aiIdx].stem, a: [] } : cur;

  return (
    <div className="mx-auto max-w-[860px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>Home</Link> › Drills
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">Maths drills (infinite)</h1>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Generative Year-8 drills with instant working. Streak{streak > 1 ? `: ${streak} 🔥` : ' stays in this browser.'}
      </p>
      <div className="my-3 flex flex-wrap gap-2">
        {KINDS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              next(k);
            }}
            className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold"
            style={
              kind === k && !aiSet
                ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                : { borderColor: 'var(--line2)', background: 'var(--panel)' }
            }
          >
            {l}
          </button>
        ))}
        <Button size="sm" variant="secondary" onClick={aiDrill}>
          ✦ AI set
        </Button>
      </div>
      <div className="rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <h3 className="font-display text-xl font-bold tabular-nums">{shown.q}</h3>
        {aiSet && <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>AI question {aiIdx + 1} of {aiSet.length}</p>}
        <div className="mt-2.5 flex gap-2">
          <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            placeholder="Your answer"
            aria-label="Your answer"
            className="min-w-0 flex-1"
          />
          <Button variant="default" onClick={check}>
            Check
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (aiSet) {
                if (aiIdx + 1 < aiSet.length) {
                  setAiIdx(aiIdx + 1);
                  setVal('');
                  setMsg('');
                } else setAiSet(null);
              } else next();
            }}
          >
            Next
          </Button>
        </div>
        {!!msg && <p className="mt-2 text-[13px]">{msg}</p>}
      </div>
    </div>
  );
}
