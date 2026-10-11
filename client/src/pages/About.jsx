import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Beams } from '../components/ace';
import { HyperText } from '../components/bits';

export default function About() {
  const [n, setN] = useState(null);
  useEffect(() => {
    document.title = 'About · SEHS Study';
    api
      .stats()
      .then((j) => setN(j.publicResources))
      .catch(() => {});
  }, []);
  return (
    <div className="mx-auto max-w-[760px] px-5 py-7">
      <p className="editorial-kicker">An independent study companion</p>
      <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">Practice, organised.<br />Pressure, <em>off</em>.</h1>
      <hr className="editorial-rule" />
      <p className="reading mt-2 text-[17px]" style={{ color: 'var(--mut)' }}>
        A searchable collection of {n ? Number(n).toLocaleString() : ''} selective-entry study resources: practice papers, notes, flashcards, mocks and study guides. Free for anyone studying, no
        account needed. Search runs on our own index; every paper reads inside the site.
      </p>
      <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--line2)', background: 'var(--line)' }}>
        {[
          ['What this site is', 'A calm study instrument: an index, a reader, and practice tools that respect your time and your data.'],
          ['What it is not', 'Not official material, not affiliated with any school or test provider, and never a promise of results.'],
        ].map(([h, b]) => (
          <div key={h} className="p-4" style={{ background: 'var(--panel)' }}>
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em]" style={{ color: 'var(--acc)' }}>{h}</h2>
            <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>{b}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-2 mt-8 font-display text-xl font-bold">Four principles</h2>
      <ol className="flex flex-col gap-4">
        {[
          ['Practice over promises', 'Timed mocks, flashcards and drills with honest scoring. We never predict scores or selection outcomes.'],
          ['Owners keep ownership', 'Files belong to their providers. We link, never re-host, and remove listings on valid request.'],
          ['Minimum data, maximum calm', 'No accounts, no ads, no trackers. Your library lives in your browser; raw analytics delete after 30 days.'],
          ['Usefulness earns return visits', 'No streak-shaming, no locks, no urgency. A clear next step every time you arrive.'],
        ].map(([h, b], k) => (
          <li key={h} className="flex gap-4">
            <span className="principle-num tnum pt-1">0{k + 1}</span>
            <div>
              <h3 className="font-display text-[16px] font-bold">{h}</h3>
              <p className="mt-0.5 text-[15px]" style={{ color: 'var(--mut)' }}>{b}</p>
            </div>
          </li>
        ))}
      </ol>
      <h2 className="mt-6 text-base font-bold">Which test is this for?</h2>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Selective school entry exams in the ACER style: timed maths, quantitative and verbal reasoning, reading comprehension and written expression. Mocks mirror the
        three-block format (maths + quant, reading + verbal, writing) so practice transfers directly to exam day.
      </p>
      <h2 className="mt-6 text-base font-bold">Access</h2>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Every resource is open to everyone: no account, no login. You will be asked to accept the Terms &amp; Conditions when you open your first resource in each browser tab.
      </p>
      <Beams className="mt-6 px-6 py-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>Our promise</p>
        <p className="mt-2 font-display text-xl font-bold" style={{ color: 'var(--text)' }}>
          <HyperText text="Real numbers only. No hype, no guilt, no paywalls." />
        </p>
        <p className="mt-1 max-w-[60ch] text-[15px]" style={{ color: 'var(--text-2)' }}>
          Every count on this site comes from the live collection. Samples are labelled. Misses become practice, never shame.
        </p>
      </Beams>
      <h2 className="mt-6 text-base font-bold">Independence</h2>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        This site is independent and is not affiliated with, endorsed by, or connected to the Victorian Department of
        Education, ACER, or any selective entry high school. Exam-format summaries cite the official ACER and
        Department pages; anything we cannot verify is labelled as such. If you own material listed here and want it
        updated or removed, use the Request page or the report button on any resource.
      </p>
      <h2 className="mt-6 text-base font-bold">Privacy &amp; cookies</h2>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        We use cookies and local storage to remember your theme, library, decks and study progress. We don&apos;t sell personal data and we don&apos;t run third-party advertising. Anonymous usage
        counts (resource opens, searches) auto-delete after 30 days. Your library and progress stay in your own browser unless you choose to export them. Clearing site data removes them.
      </p>
      <p className="mt-2 text-[15px]" style={{ color: 'var(--mut)' }}>
        Admin sign-in uses a per-tab token (closing the tab locks it again). Contact the site operator if you want your data removed.
      </p>
    </div>
  );
}
