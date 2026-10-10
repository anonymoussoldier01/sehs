import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-10 text-center">
      <h1 className="font-display text-3xl font-bold">Page not found</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
        That link doesn&apos;t point anywhere here.
      </p>
      <p className="mt-4">
        <Link to="/" className="inline-flex min-h-[42px] items-center rounded-[11px] bg-[var(--primary)] px-[18px] py-2.5 text-sm font-bold text-[var(--primary-foreground)]">
          Back home
        </Link>
      </p>
    </div>
  );
}
