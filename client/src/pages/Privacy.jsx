import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  ['Who we are', 'SEHS Study is an independent Victorian selective-entry study resource. There are no accounts: the site works without signing in, and the only locked area is the administrator console.'],
  ['What we collect and why', 'To run the site we keep the minimum possible:\n• Access events: which resource was opened, when, and whether it succeeded (used for security, abuse prevention and anonymous popularity counts).\n• Rate-limit and security signals: IP addresses are hashed with a monthly salt and never stored raw; user-agents are reduced to a broad family (e.g. “mobile browser”).\n• Reports and requests you send us, so we can triage broken links and takedown matters.\n• Admin sign-ins (password hashes with salt, session tokens), administrator only.\nWe do not collect names, emails, school details, or exam results. Anything you type into AI features is processed to answer you and is not stored as content, only aggregate mode and length counts.'],
  ['What stays in your browser', 'Your theme, library, notes, annotations, decks, Leitner boxes, mock attempts, mistakes and settings live in this browser’s cookies and local storage. We cannot see them. Export a copy any time from the Study hub; delete everything there too, or simply clear site data.'],
  ['What we never do', 'No third-party advertising. No third-party tracking scripts. We do not sell personal information and do not share analytics with anyone. Anonymous usage counts are aggregated and raw events auto-delete after 30 days.'],
  ['Children', 'The site is designed for Year 8 students. We avoid collecting personal information from anyone, and ask under-18s to use the site with a parent or guardian. Parents or guardians can ask questions or request removal of anything via the Request page or any resource’s Report button.'],
  ['Your choices and rights', 'Use the Study hub to export or delete your local data. Because most data never leaves your device, clearing site data is usually complete erasure. For server-side questions (access logs, reports), contact the operator through the Request page. If you believe privacy law applies to your situation, you can also contact the Office of the Australian Information Commissioner (OAIC).'],
  ['Changes', 'If this page changes materially, we will bump the Terms version so the update is shown for acceptance again.'],
  ['Contact', 'Privacy questions and takedown matters: use the Request page or the Report issue button on any resource. Both reach the triage queue.'],
];

export default function Privacy() {
  useEffect(() => {
    document.title = 'Privacy · SEHS Study';
  }, []);
  return (
    <div className="mx-auto max-w-[760px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>Home</Link> › Privacy
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">Privacy, in plain English</h1>
      <p className="reading mt-2 text-[15px]" style={{ color: 'var(--mut)' }}>
        No accounts, no ads, no trackers. The short version: we log the minimum needed for security, your study data stays in your browser, and raw analytics delete themselves after 30 days.
      </p>
      {SECTIONS.map(([h, b]) => (
        <section key={h} className="mt-6">
          <h2 className="font-display text-lg font-bold">{h}</h2>
          {String(b).split('\n').map((p, i) => (
            <p key={i} className="reading mt-1 whitespace-pre-wrap text-[15px]" style={{ color: 'var(--mut)' }}>{p}</p>
          ))}
        </section>
      ))}
      <p className="mt-6 text-sm">
        <Link to="/terms" className="font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>Read the Terms &amp; Conditions →</Link>
      </p>
    </div>
  );
}
