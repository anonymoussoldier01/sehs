import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Guide() {
  const [tq, setTq] = useState('');
  const [ta, setTa] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = 'SEHS exam guide — SEHS Study';
  }, []);
  const ask = async () => {
    if (tq.trim().length < 2) return;
    setBusy(true);
    setTa('Asking the tutor…');
    try {
      setTa(await api.aiChat('tutor', tq.trim().slice(0, 800)));
    } catch (e) {
      setTa('AI unavailable: ' + e.message);
    }
    setBusy(false);
  };
  return (
    <div className="mx-auto max-w-[860px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>Home</Link> › Exam guide
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">SEHS exam guide (ACER format)</h1>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Selective entry: three timed blocks, ~2h 35m of tasks. Year-8 curriculum cap, no calculator, paper booklets.
      </p>
      <h2 className="mb-3 mt-6 font-display text-xl font-bold">The three blocks</h2>
      <div className="grid gap-3.5 sm:grid-cols-3">
        {[
          ['Block 1 — Maths + Quant (60 min)', 'Curriculum maths (number, algebra, geometry, stats) + patterns, series, matrices, Venn, spatial. ~90s/Q. Two passes: easy first, mark-and-return.', '/mocks/maths-qr-60', 'Start block →'],
          ['Block 2 — Reading + Verbal (55 min)', '6-8 passages + analogies, synonyms, odd-one-out, codes, deductions. Evidence-pointer for reading.', '/mocks/reading-vr-55', 'Start block →'],
          ['Block 3 — Writing (40 min)', '2 handwritten tasks (~20 min each), usually persuasive + narrative. 5 plan / 13 write / 2 check.', '/writing', 'Writing studio →'],
        ].map(([t, p, to, l]) => (
          <div key={to} className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <h3 className="font-display text-[15.5px] font-bold">{t}</h3>
            <p className="mb-3 mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
              {p}
            </p>
            <Link to={to} className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
              {l}
            </Link>
          </div>
        ))}
      </div>
      <h2 className="mb-3 mt-6 font-display text-xl font-bold">Schools</h2>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[['Melbourne High', 'Boys, South Yarra.'], ['Mac.Robertson Girls’', 'Girls, Melbourne.'], ['Nossal', 'Co-ed, Berwick.'], ['Suzanne Cory', 'Co-ed, Werribee.']].map(([t, p]) => (
          <div key={t} className="rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <h3 className="font-display text-[15.5px] font-bold">{t}</h3>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
              {p}
            </p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 mt-6 font-display text-xl font-bold">12-week plan</h2>
      <div className="rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <p className="text-sm" style={{ color: 'var(--mut)' }}>
          Wk1-2: vocab foundation + maths facts + 1 diagnostic. Wk3-6: VR/QR one type per day + weekly mini. Wk7-10: full blocks timed + mistake bank. Wk11-12: 2 full mocks + writing 2×/week +
          taper. Crash (4wk): daily 30 vocab + 20 VR + 20 QR + 1 passage + 1 prompt plan.
        </p>
        <p className="mt-2 flex gap-3">
          <Link to="/study" className="text-[13.5px] font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>Open study hub →</Link>
          <Link to="/drills" className="text-[13.5px] font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>Maths drills →</Link>
        </p>
      </div>
      <h2 className="mb-3 mt-6 font-display text-xl font-bold">Ask about the exam</h2>
      <div className="rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <div className="flex gap-2">
          <input
            value={tq}
            onChange={(e) => setTq(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            maxLength={800}
            placeholder="e.g. How do I pace the 55-min block?"
            aria-label="Ask the tutor"
            className="min-h-[42px] min-w-0 flex-1 rounded-lg border px-3 py-2 text-base"
            style={{ borderColor: 'var(--line2)', background: 'var(--panel)', color: 'var(--txt)' }}
          />
          <button onClick={ask} disabled={busy} className="inline-flex min-h-[42px] items-center rounded-[10px] bg-[#2f49e5] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy ? '…' : 'Ask'}
          </button>
        </div>
        {!!ta && <p className="mt-2 whitespace-pre-wrap text-sm">{ta}</p>}
      </div>
      <h2 className="mb-3 mt-6 font-display text-xl font-bold">FAQ</h2>
      <div className="rounded-2xl border p-[18px] text-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <p><strong>Calculator?</strong> No.</p>
        <p className="mt-1"><strong>Question counts?</strong> ACER doesn&apos;t publish them — train to minutes, not counts.</p>
        <p className="mt-1"><strong>Writing?</strong> Usually 1 persuasive + 1 narrative in 40 min.</p>
        <p className="mt-1"><strong>Scoring?</strong> ~85% rank / 10% equity / 5% principal discretion.</p>
      </div>
    </div>
  );
}
