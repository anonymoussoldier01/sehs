import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { keys, useSyncedLocal } from '../lib/store';
import { useToast } from '../providers';
import { Skeleton } from '../components/magic';
import { ResourceCard } from '../components/cards';

const encodeIds = (ids) =>
  btoa(JSON.stringify(ids.slice(0, 100)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export default function Saved() {
  const toast = useToast();
  const [savedIds] = useSyncedLocal(keys.saved, []);
  const [items, setItems] = useState(null);
  const [lists, setLists] = useSyncedLocal(keys.lists, []);
  const [name, setName] = useState('');

  useEffect(() => {
    document.title = 'Your library — SEHS Study';
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
    <div className="mx-auto max-w-[1000px] px-5 py-7">
      <h1 className="font-display text-3xl font-bold">
        Your library{' '}
        {!!savedIds.length && (
          <span className="rounded-full bg-[#b45309] px-2 py-0.5 align-middle text-[11px] font-bold text-white">{savedIds.length}</span>
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
          Nothing here yet — tap ☆ Save on any resource and it will show up here.
        </p>
      ) : (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          {items.map((v) => (
            <ResourceCard key={v.id} v={v} showDesc={false} />
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-6 font-display text-xl font-bold">Folders</h2>
      {!lists.length ? (
        <p className="text-sm" style={{ color: 'var(--mut)' }}>
          No folders yet — tap “+” on any resource card, or create one below.
        </p>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {lists.map((l, i) => (
            <div key={i} className="rounded-2xl border p-[18px] shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
              <h3 className="font-display text-[15.5px] font-bold">{l.name}</h3>
              <p className="mb-3 text-[13px]" style={{ color: 'var(--mut)' }}>
                {(l.items || []).length} resources
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => share(l)} className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
                  Share link
                </button>
                <Link
                  to={'/list/' + encodeIds(l.items || [])}
                  className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold"
                  style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
                >
                  Open
                </Link>
                <button
                  onClick={() => {
                    setLists((x) => x.filter((_, k) => k !== i));
                    toast('Folder deleted');
                  }}
                  className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold"
                  style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
                >
                  Delete
                </button>
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
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          placeholder="New folder name…"
          aria-label="New folder name"
          className="min-h-[42px] min-w-0 flex-1 rounded-[10px] border px-3 py-2 text-base"
          style={{ borderColor: 'var(--line2)', background: 'var(--panel)', color: 'var(--txt)' }}
        />
        <button type="submit" className="inline-flex min-h-[42px] items-center rounded-[10px] bg-[#2f49e5] px-4 py-2 text-sm font-bold text-white">
          Create folder
        </button>
      </form>
      <p className="mt-1.5 text-xs" style={{ color: 'var(--faint)' }}>
        Folders live in this browser. Share links encode public resource IDs only.
      </p>
    </div>
  );
}
