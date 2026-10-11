// Shared system components (Phase 1): ONE primary action per surface.
// Verbs are fixed: resources "Open" · practice "Start" · decks "Review".
// Every page header uses PageHeader; every empty state uses EmptyState with a
// next action; stats use StatCard; topic coverage uses ProgressRing.
import { Link } from 'react-router-dom';

export function PageHeader({ kicker, title, purpose, action, children }) {
  return (
    <div className="page-head mb-4">
      {kicker ? (
        <p className="kicker" style={{ marginBottom: 6 }}>{kicker}</p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
          {purpose ? (
            <p className="lede mt-1 max-w-[64ch]">{purpose}</p>
          ) : null}
        </div>
        {action ? <div className="flex flex-none items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub }) {
  return (
    <div className="quiet-card p-4">
      <div className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>{label}</div>
      <div className="font-display text-[28px] font-extrabold tnum tabular-nums">{value}</div>
      {sub ? <div className="text-xs" style={{ color: 'var(--faint)' }}>{sub}</div> : null}
    </div>
  );
}

export function ProgressRing({ value = 0, size = 56, label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="inline-flex items-center gap-2"
      role={label ? 'img' : undefined}
      aria-label={label ? `${label}: ${pct}%` : undefined}
    >
      <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle
          cx="28" cy="28" r={r} fill="none" stroke="var(--acc)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          transform="rotate(-90 28 28)"
        />
        <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--txt)" className="tnum">
          {pct}
        </text>
      </svg>
      {label ? <span className="text-sm font-semibold">{label}</span> : null}
    </span>
  );
}

export function EmptyState({ title, body, actionTo, actionLabel, secondary }) {
  return (
    <div className="quiet-card pad text-center" style={{ borderStyle: 'dashed' }}>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {body ? <p className="mx-auto mt-1 max-w-[52ch] text-sm" style={{ color: 'var(--mut)' }}>{body}</p> : null}
      <p className="mt-4 flex flex-wrap justify-center gap-2">
        {actionTo ? (
          <Link
            to={actionTo}
            className="inline-flex min-h-[44px] items-center rounded-xl px-5 py-2.5 text-sm font-bold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {actionLabel}
          </Link>
        ) : null}
        {secondary}
      </p>
    </div>
  );
}

/** Gentle one-line backup reminder: shows once per device after meaningful
 *  progress exists and no backup has happened yet. Never shaming. */
export function BackupNudge() {
  let show = false;
  try {
    const done = localStorage.getItem('sehs-backup-done');
    if (!done) {
      const saved = JSON.parse(localStorage.getItem('sehs-saved') || '[]').length;
      const notes = Object.keys(JSON.parse(localStorage.getItem('sehs-notes') || '{}')).length;
      const mistakes = JSON.parse(localStorage.getItem('sehs-mistakes') || '[]').length;
      const mocks = Object.keys(JSON.parse(localStorage.getItem('sehs-mocks') || '{}')).length;
      const grades = JSON.parse(localStorage.getItem('sehs-grades') || '[]').length;
      show = saved + notes + mistakes + mocks + grades >= 5;
    }
  } catch {
    show = false;
  }
  if (!show) return null;
  return (
    <p className="mt-3 rounded-xl border border-dashed px-4 py-3 text-sm" style={{ borderColor: 'var(--line2)', color: 'var(--mut)' }} role="status">
      You&apos;ve built up real progress in this browser.{' '}
      <Link to="/study#backup" className="font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>
        Back it up in 10 seconds
      </Link>{' '}
      so a cleared cache never costs you a month of study.
    </p>
  );
}
