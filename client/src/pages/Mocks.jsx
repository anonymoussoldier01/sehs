import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { keys } from '../lib/store';
import { BlurFade, Skeleton } from '../components/magic';

export default function Mocks() {
  const [mocks, setMocks] = useState(null);
  const [best, setBest] = useState({});
  useEffect(() => {
    document.title = 'Timed mocks — SEHS Study';
    let live = true;
    api
      .mocks()
      .then((j) => live && setMocks(j.mocks || []))
      .catch(() => live && setMocks([]));
    try {
      setBest(JSON.parse(localStorage.getItem(keys.mocks) || '{}'));
    } catch {
      /* noop */
    }
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="mx-auto max-w-[1000px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>Home</Link> › Mocks
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">Timed mocks</h1>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Exact block timing. Flag, skip, review. Instant scoring with explanations. Best scores stay in this browser.
      </p>
      {!mocks ? (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          {mocks.map((m) => (
            <BlurFade key={m.id}>
              <div className="rounded-2xl border p-[18px] shadow-sm transition-all hover:-translate-y-[3px] hover:shadow-lg" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
                <h3 className="font-display text-[15.5px] font-bold">{m.title}</h3>
                <p className="mb-1 mt-0.5 text-[13px]" style={{ color: 'var(--mut)' }}>
                  {m.strands.join(' · ')} · {m.minutes} min · {m.count} questions
                </p>
                {best[m.id] && (
                  <p className="text-[13px] font-bold" style={{ color: 'var(--ok)' }}>
                    Best: {best[m.id].score}/{best[m.id].total}
                  </p>
                )}
                <Link to={'/mocks/' + encodeURIComponent(m.id)} className="mt-2 inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
                  Start →
                </Link>
              </div>
            </BlurFade>
          ))}
        </div>
      )}
    </div>
  );
}
