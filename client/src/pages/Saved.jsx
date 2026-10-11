import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { keys, useSyncedLocal } from '../lib/store';
import { useToast } from '../providers';
import { Skeleton, AnimatedGrid } from '../components/magic';
import { ResourceCard } from '../components/cards';

const encodeIds = (ids) =>
  btoa(JSON.stringify(ids.slice(0, 100)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export default function Saved() {
  const toast = useToast();
  const navigate = useNavigate();
  const [savedIds] = useSyncedLocal(keys.saved, []);
  const [items, setItems] = useState(null);
  const [lists, setLists] = useSyncedLocal(keys.lists, []);
  const [name, setName] = useState('');

  useEffect(() => {
    document.title = 'Your library · SEHS Study';
    if (!savedIds.length) {
      setItems([]);
      return;
    }
    let live = true;
    api
      .byIds(savedIds.slice(0, 100))
      .then((j) => live && setItems(j.results || []))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [savedIds]);

  const share = (l) => {
    if (!l.items?.length) {
      toast('List is empty');
      return;
    }
    const url = new URL('/list/' + encodeIds(l.items), window.location.origin).href;
    navigator.clipboard?.writeText(url).catch(() => {});
    toast('Share link copied');
  };

  return (
    <div className="page-browse py-7">
      <h1 className="font-display text-3xl font-bold">
        Your library{' '}
        {!!savedIds.length && (
          <span className="rounded-full px-2 py-0.5 align-middle text-[11px] font-bold" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>{savedIds.length}</span>
        )}
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--mut)' }}>
        Bookmarks live in this browser. Clearing site data removes them.
      </p>
      {!items ? (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : !items.length ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--mut)' }}>
          Nothing here yet. Tap ☆ Save on any resource and it will show up here.
        </p>
      ) : (
        <AnimatedGrid className="mt-4 grid gap-3.5 sm:grid-cols-2">
          {items.map((v) => (
            <ResourceCard key={v.id} v={v} showDesc={false} />
          ))}
        </AnimatedGrid>
      )}

      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Folders</h2>
        <a href="#list-new" className="inline-flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          + New folder
        </a>
      </div>
      {!lists.length ? (
        <div className="quiet-card p-[18px]">
          <p className="text-sm" style={{ color: 'var(--mut)' }}>
            No folders yet. Start with one of these, or create your own below.
          </p>
          <p className="mt-3 flex flex-wrap gap-2">
            {['Weak spots', 'Mocks to redo', 'Nossal prep'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setLists((x) => [...x, { id: 'l' + Date.now().toString(36), name: s, items: [], colour: null, tags: [], order: x.length, updatedAt: new Date().toISOString() }]);
                  toast(`Folder “${s}” created`);
                }}
                className="inline-flex min-h-[44px] items-center rounded-xl border px-4 py-2 text-sm font-bold"
                style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
              >
                + {s}
              </button>
            ))}
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {lists.map((l, i) => (
            <div key={i} className="quiet-card p-[18px]">
              <h3 className="font-display text-[15.5px] font-bold">{l.name}</h3>
              <p className="mb-3 text-[13px]" style={{ color: 'var(--mut)' }}>
                {(l.items || []).length} resources
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => share(l)}>
                  Share link
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate('/list/' + encodeIds(l.items || []))}>
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setLists((x) => x.filter((_, k) => k !== i));
                    toast('Folder deleted');
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <form
        id="list-new"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim().slice(0, 60);
          if (!n) return;
          setLists((x) => [...x, { id: 'l' + Date.now().toString(36), name: n, items: [] }]);
          setName('');
          toast(`Folder “${n}” created`);
        }}
        className="mt-3 flex max-w-[480px] gap-2"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          placeholder="New folder name…"
          aria-label="New folder name"
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="default">
          Create folder
        </Button>
      </form>
      <p className="mt-1.5 text-xs" style={{ color: 'var(--faint)' }}>
        Folders live in this browser. Share links encode public resource IDs only.
      </p>
    </div>
  );
}
