import { useEffect, useState } from 'react';
import { api, pretty } from '../lib/api';
import { Skeleton, AnimatedGrid } from '../components/magic';
import { FocusCards, DirectionHover } from '../components/ace';

const GLYPHS = ['◈', '⬡', '⬢', '✦', '◉', '▣', '⬣', '❖', '◍', '⬔', '⬕', '⬘'];

export default function Subjects({ subject }) {
  const [rows, setRows] = useState(null);
  const isSubj = !!subject;
  useEffect(() => {
    document.title = `${isSubj ? 'Subjects' : 'Providers'} · SEHS Study`;
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
        {isSubj ? ' Follow the selective-entry strands: maths, reasoning, reading, writing.' : ''}
      </p>
      {!rows ? (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <div className="mt-4">
          <FocusCards
            cards={rows.slice(0, 6).map(([name, c], k) => ({
              to: isSubj ? `/search?q=${encodeURIComponent(name)}` : `/search?provider=${encodeURIComponent(name)}`,
              glyph: GLYPHS[k % GLYPHS.length],
              title: pretty(name),
              sub: `${Number(c).toLocaleString()} resources`,
            }))}
          />
          {rows.length > 6 && (
            <>
              <h2 className="mb-2 mt-8 font-display text-lg font-bold">Everything else A–Z</h2>
              <AnimatedGrid className="grid gap-2.5 sm:grid-cols-2">
                {rows.slice(6).map(([name, c]) => (
                  <DirectionHover
                    key={name}
                    to={isSubj ? `/search?q=${encodeURIComponent(name)}` : `/search?provider=${encodeURIComponent(name)}`}
                    title={pretty(name)}
                    sub="Open in the library →"
                    meta={`${Number(c).toLocaleString()} resources`}
                  />
                ))}
              </AnimatedGrid>
            </>
          )}
        </div>
      )}
    </div>
  );
}
