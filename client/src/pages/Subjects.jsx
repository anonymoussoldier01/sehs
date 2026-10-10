import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, pretty } from '../lib/api';
import { Skeleton, AnimatedGrid } from '../components/magic';

export default function Subjects({ subject }) {
  const [rows, setRows] = useState(null);
  const isSubj = !!subject;
  useEffect(() => {
    document.title = `${isSubj ? 'Subjects' : 'Providers'} — SEHS Study`;
    let live = true;
    api
      .search({ q: '', per: 96 })
      .then((j) => {
        if (!live) return;
        const m = new Map();
        for (const r of j.results || []) {
          const v = isSubj ? r.subject || r.category : r.provider;
          if (v) m.set(v, (m.get(v) || 0) + 1);
        }
        setRows([...m.entries()].sort((a, b) => b[1] - a[1]));
      })
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [isSubj]);

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-7">
      <h1 className="font-display text-3xl font-bold">Browse by {isSubj ? 'subject' : 'provider'}</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
        {rows ? `${rows.length} ${isSubj ? 'subjects' : 'providers'} in the collection.` : 'Loading…'}
      </p>
      {!rows ? (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <AnimatedGrid className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([name, c]) => {
            const href = isSubj ? `/search?q=${encodeURIComponent(name)}` : `/search?provider=${encodeURIComponent(name)}`;
            return (
              <div key={name} className="rounded-2xl border p-[18px] shadow-sm transition-all hover:-translate-y-[3px] hover:shadow-lg" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
                <h3 className="font-display text-[15.5px] font-bold">{pretty(name)}</h3>
                <p className="mb-2 text-[13px]" style={{ color: 'var(--mut)' }}>
                  {Number(c).toLocaleString()} resources
                </p>
                <Link to={href} className="text-[13.5px] font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>
                  Browse →
                </Link>
              </div>
            );
          })}
        </AnimatedGrid>
      )}
    </div>
  );
}
