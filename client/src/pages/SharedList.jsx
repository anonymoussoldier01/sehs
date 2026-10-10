import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { api, pretty } from '../lib/api';
import { Skeleton } from '../components/magic';
import { ResourceCard } from '../components/cards';

export default function SharedList() {
  const { code } = useParams();
  const [items, setItems] = useState(null);

  useEffect(() => {
    let live = true;
    try {
      const ids = JSON.parse(atob(code.replace(/-/g, '+').replace(/_/g, '/'))).filter((s) => /^[0-9a-f]{32}$/.test(s)).slice(0, 100);
      document.title = `Shared folder (${ids.length}) — SEHS Study`;
      if (!ids.length) {
        setItems([]);
        return;
      }
      api
        .byIds(ids)
        .then((j) => live && setItems(j.results || []))
        .catch(() => live && setItems([]));
    } catch {
      setItems([]);
    }
    return () => {
      live = false;
    };
  }, [code]);

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>Home</Link> › <Link to="/saved" className="hover:underline" style={{ color: 'var(--acc)' }}>Library</Link> › Shared folder
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">Shared folder{items ? ` (${items.length} resources)` : ''}</h1>
      <div className="my-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          Print pack
        </Button>
      </div>
      {!items ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : !items.length ? (
        <p className="text-sm" style={{ color: 'var(--mut)' }}>
          None of these resources are available.
        </p>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {items.map((v) => (
            <ResourceCard key={v.id} v={v} />
          ))}
        </div>
      )}
      <p className="mt-2 text-xs" style={{ color: 'var(--faint)' }}>
        {pretty('shared')} via encoded public IDs — validated server-side.
      </p>
    </div>
  );
}
