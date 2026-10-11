// What's new / changelog: one honest list per shipped phase.
import { useEffect } from 'react';

export default function WhatsNew() {
  useEffect(() => {
    document.title = "What's new · SEHS Study";
    try {
      localStorage.setItem('sehs-whats-new-seen', 'phase-1');
    } catch {
      /* noop */
    }
  }, []);
  return (
    <div className="page-browse py-7">
      <p className="kicker">Changelog · newest first</p>
      <h1 className="font-display text-3xl font-bold" style={{ letterSpacing: '-0.02em' }}>What&apos;s new</h1>
      <p className="lede mt-1">Each phase ships working, with what changed and why.</p>

      <section className="quiet-card mt-4 p-[18px]" aria-label="Phase 1">
        <h2 className="font-display text-lg font-bold">Phase 1 · Foundation: audit, safe storage, shared verbs</h2>
        <ul className="mt-2 list-disc pl-5 text-sm" style={{ color: 'var(--mut)' }}>
          <li>Step-0 audit of every route published in <code>docs/AUDIT.md</code> — what each page does, what&apos;s broken, every <code>sehs-*</code> key and shape.</li>
          <li>Versioned storage schema (v2) with an additive-only migrator: bookmarks, folders, attempts, flashcard state and notes carry over; a v1 snapshot is kept for recovery.</li>
          <li>Settings → Back up / restore progress: one JSON file, export + import, plus a gentle one-line reminder once real progress exists.</li>
          <li>One primary verb everywhere: resources <strong>Open</strong>, practice <strong>Start</strong>, decks <strong>Review</strong>.</li>
          <li>Shared building blocks: PageHeader, StatCard, ProgressRing, EmptyState, BackupNudge.</li>
          <li>Command palette gains Actions + Pages; mobile tab bar is Home / Practice / Library / Progress; target-school chip works from any page.</li>
          <li>Library: prominent + New folder with starter suggestions (Weak spots, Mocks to redo, Nossal prep).</li>
          <li>Single sources added: <code>data/topics.js</code>, <code>data/providers.js</code> (schools already in <code>data/schools.js</code>).</li>
        </ul>
        <p className="mt-2 text-sm" style={{ color: 'var(--mut)' }}>
          Why: stop the #1 risk (cache-cleared progress loss), end label confusion, and give every later phase one shelf of parts to build on.
        </p>
      </section>
    </div>
  );
}
