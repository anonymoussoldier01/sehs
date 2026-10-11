import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { keys } from '../lib/store';
import { PageHeader } from '../components/system';

function LoadingCard() {
  return (
    <div className="quiet-card p-[18px]" aria-busy="true" aria-label="Loading mocks">
      <div className="h-4 w-3/5 animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} />
      <div className="mt-2 h-3 w-[90%] animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} />
    </div>
  );
}

export default function Mocks() {
  const navigate = useNavigate();
  const [mocks, setMocks] = useState(null);
  const [best, setBest] = useState({});
  useEffect(() => {
    document.title = 'Timed mocks · SEHS Study';
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
    <div className="page-browse py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--text-2)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--accent)' }}>Home</Link> › Mocks
      </p>
      <PageHeader
        kicker="Real clock · instant scoring"
        title="Timed mocks"
        purpose="Full-length ACER-style blocks. Flag, skip, review. Best scores stay in this browser."
      />
      {!mocks ? (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <LoadingCard />
          <LoadingCard />
        </div>
      ) : (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          {mocks.map((m) => (
            <article key={m.id} className="quiet-card flex h-full flex-col p-[18px]">
              <h3 className="font-display text-[15.5px] font-bold">{m.title}</h3>
              <p className="mb-1 mt-0.5 text-[13px]" style={{ color: 'var(--text-2)' }}>
                {m.strands.join(' · ')} · {m.minutes} min · {m.count} questions
              </p>
              {best[m.id] ? (
                <p className="text-[13px] font-bold" style={{ color: 'var(--success)' }}>
                  Best: {best[m.id].score}/{best[m.id].total}
                </p>
              ) : (
                <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>Not attempted yet</p>
              )}
              <p className="mt-2 flex gap-2">
                <Button size="sm" variant="default" onClick={() => navigate('/mocks/' + encodeURIComponent(m.id))}>
                  Start
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/mocks/${encodeURIComponent(m.id)}?seed=${encodeURIComponent(m.id)}-fresh`)}>
                  Fresh seed
                </Button>
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
