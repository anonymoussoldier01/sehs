import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { TypingText } from '../components/magic';
import { TextReveal, InteractiveHover, Vortex } from '../components/bits';
import { TracingBeam, StickyScroll, Timeline, Faq, Lamp, MiniTimer, MiniLines, MiniPen } from '../components/ace';
import { api } from '../lib/api';

export default function Guide() {
  const [tq, setTq] = useState('');
  const [ta, setTa] = useState('');
  const [busy, setBusy] = useState(false);
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
      <Lamp
        kicker="ACER format · verified"
        title="Three timed blocks. One calm plan."
        sub="Maths + Quant 60 min · Reading + Verbal 55 min · Writing 40 min — 2 hours 35 minutes of tasks, Year-8 curriculum cap, paper booklets."
      />
      <TextReveal
        className="mx-auto mt-6 max-w-[62ch] text-center font-display text-xl font-bold"
        text="The exam rewards steady pacing over sprinting. Two passes through every block: easy marks first, then marked questions with fresh eyes."
      />
      <h2 className="mb-3 mt-8 font-display text-xl font-bold">The three blocks</h2>
      <TracingBeam>
        <StickyScroll
          steps={[
            {
              kicker: 'Block 1 · 60 min',
              title: 'Maths + Quantitative Reasoning',
              desc: 'Curriculum maths (number, algebra, geometry, stats) plus patterns, series, matrices, Venn and spatial. Roughly 90 seconds a question — easy first, mark-and-return.',
              link: { to: '/mocks/maths-qr-60', label: 'Start this block' },
              visual: <MiniTimer />,
            },
            {
              kicker: 'Block 2 · 55 min',
              title: 'Reading + Verbal Reasoning',
              desc: 'Six to eight passages plus analogies, synonyms, odd-one-out, codes and deductions. Point at the evidence line for every reading answer.',
              link: { to: '/mocks/reading-vr-55', label: 'Start this block' },
              visual: <MiniLines />,
            },
            {
              kicker: 'Block 3 · 40 min',
              title: 'Writing — two tasks',
              desc: 'Usually one persuasive and one creative piece (unverified split — prepare for both). Five minutes planning, thirteen writing, two checking. Target 250–350 words.',
              link: { to: '/writing', label: 'Open the writing studio' },
              visual: <MiniPen />,
            },
          ]}
        />
      </TracingBeam>
      <h2 className="mb-3 mt-8 font-display text-xl font-bold">Schools</h2>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[['Melbourne High', 'Boys, South Yarra.'], ['Mac.Robertson Girls’', 'Girls, Melbourne.'], ['Nossal', 'Co-ed, Berwick.'], ['Suzanne Cory', 'Co-ed, Werribee.']].map(([t, p]) => (
          <div key={t} className="lift rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
            <h3 className="font-display text-[15.5px] font-bold">{t}</h3>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>
              {p}
            </p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 mt-8 font-display text-xl font-bold">12-week plan</h2>
      <div className="rounded-2xl border p-[18px] sm:p-6" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <Timeline
          items={[
            { title: 'Weeks 1–2 · Foundations', desc: 'Vocabulary tiers + Year-8 maths facts daily, plus one untimed diagnostic to find your gaps.' },
            { title: 'Weeks 3–6 · One type a day', desc: 'Rotate verbal and quantitative types (analogy, series, matrices, codes), one passage a day, one weekly timed mini-block.' },
            { title: 'Weeks 7–10 · Full blocks timed', desc: '60 / 55 / 40-minute blocks under exam conditions. Every miss goes in the review queue.' },
            { title: 'Weeks 11–12 · Mocks + taper', desc: 'Two full mocks, writing twice a week, then taper: light review, sleep, and trust the preparation.' },
            { title: 'Crash version · 4 weeks', desc: 'Daily: 30 vocab + 20 verbal + 20 quant + 1 passage + 1 prompt plan. One mock each weekend.' },
          ]}
        />
        <p className="mt-4 flex flex-wrap gap-2.5">
          <InteractiveHover to="/study" primary>Open study hub</InteractiveHover>
          <InteractiveHover to="/drills">Maths drills</InteractiveHover>
        </p>
      </div>
      <h2 className="mb-3 mt-8 font-display text-xl font-bold">Ask about the exam</h2>
      <div className="rounded-2xl border p-[18px]" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <div className="flex gap-2">
          <Input
            value={tq}
            onChange={(e) => setTq(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            maxLength={800}
            placeholder="e.g. How do I pace the 55-min block?"
            aria-label="Ask the tutor"
            className="min-w-0 flex-1"
          />
          <Button variant="default" disabled={busy} onClick={ask}>
            {busy ? '…' : 'Ask'}
          </Button>
        </div>
        {!!ta && (
          <p className="mt-2 whitespace-pre-wrap text-sm">
            <TypingText text={ta} />
          </p>
        )}
      </div>
      <h2 className="mb-3 mt-8 font-display text-xl font-bold">FAQ</h2>
      <Faq
        items={[
          { q: 'Calculator?', a: 'No — practise every mock and drill without one.' },
          { q: 'Question counts?', a: 'Unverified: ACER doesn’t publish them — train to the minutes (60 / 55 / 40), not to assumed counts.' },
          { q: 'Writing?', a: 'Two tasks in 40 minutes (verified). Unverified: usually one persuasive and one creative — prepare for both.' },
          { q: 'Offers?', a: 'Around 1,000 Year 9 places; up to 5% of places may be offered at a principal’s discretion (verified, vic.gov.au). We don’t model cut-offs or predict results.' },
        ]}
      />
      <h2 className="mb-3 mt-8 font-display text-xl font-bold">Sources</h2>
      <div className="rounded-2xl border p-[18px] text-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
        <ul className="flex flex-col gap-1.5" style={{ color: 'var(--mut)' }}>
          <li><a className="link-slide font-semibold" style={{ color: 'var(--acc)' }} href="https://selectiveentry.acer.org/vic/prepare">ACER — Prepare (exam format, 3 blocks, 2h 35m)</a></li>
          <li><a className="link-slide font-semibold" style={{ color: 'var(--acc)' }} href="https://selectiveentry.acer.org/vic/exam-day">ACER — Exam day (schedule, answer booklets)</a></li>
          <li><a className="link-slide font-semibold" style={{ color: 'var(--acc)' }} href="https://www.vic.gov.au/selective-entry-high-schools">Victorian Government — Selective entry high schools</a></li>
        </ul>
        <p className="mt-2 text-[13px]" style={{ color: 'var(--faint)' }}>Independent guide — not affiliated with the Department of Education or ACER. Check the official pages for the current year.</p>
      </div>
      <Vortex className="mt-8 px-6 py-10 text-center">
        <h2 className="font-display text-2xl font-bold" style={{ color: '#E8EDF7' }}>Feel the timing before exam day</h2>
        <p className="mx-auto mt-2 max-w-[48ch] text-[15px]" style={{ color: '#8A97B2' }}>
          Run one block this week. Real clock, instant scoring, every miss explained.
        </p>
        <p className="mt-5 flex flex-wrap justify-center gap-2.5">
          <InteractiveHover to="/mocks" primary>Browse timed mocks</InteractiveHover>
          <InteractiveHover to="/study">Warm up with flashcards</InteractiveHover>
        </p>
      </Vortex>
    </div>
  );
}
