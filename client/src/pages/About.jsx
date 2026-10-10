import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Beams } from '../components/ace';
import { HyperText } from '../components/bits';

export default function About() {
  const [n, setN] = useState(null);
  useEffect(() => {
    document.title = 'About — SEHS Study';
    api
      .stats()
      .then((j) => setN(j.publicResources))
      .catch(() => {});
  }, []);
  return (
    <div className="mx-auto max-w-[760px] px-5 py-7">
      <h1 className="font-display text-3xl font-bold">About this directory</h1>
      <p className="mt-2 text-[15px]" style={{ color: 'var(--mut)' }}>
        A searchable collection of {n ? Number(n).toLocaleString() : ''} selective-entry study resources — practice papers, notes, flashcards, mocks and study guides. Free for anyone studying, no
        account needed. Search runs on our own index; opening a resource takes you to its hosted file.
      </p>
      <h2 className="mt-6 text-base font-bold">Which test is this for?</h2>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Selective school entry exams in the ACER style: timed maths, quantitative and verbal reasoning, reading comprehension and written expression. Mocks mirror the
        three-block format (maths + quant, reading + verbal, writing) so practice transfers directly to exam day.
      </p>
      <h2 className="mt-6 text-base font-bold">Access</h2>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Every resource is open to everyone — no account, no login. You will be asked to accept the Terms &amp; Conditions when you open your first resource in each browser tab.
      </p>
      <Beams className="mt-6 px-6 py-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: '#38BDF8' }}>Our promise</p>
        <p className="mt-2 font-display text-xl font-bold" style={{ color: '#E8EDF7' }}>
          <HyperText text="Real numbers only. No hype, no guilt, no paywalls." />
        </p>
        <p className="mt-1 max-w-[60ch] text-[15px]" style={{ color: '#8A97B2' }}>
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
        counts (resource opens, searches) auto-delete after 30 days. Your library and progress stay in your own browser unless you choose to export them — clearing site data removes them.
      </p>
      <p className="mt-2 text-[15px]" style={{ color: 'var(--mut)' }}>
        Admin sign-in uses a per-tab token (closing the tab locks it again). Contact the site operator if you want your data removed.
      </p>
    </div>
  );
}
