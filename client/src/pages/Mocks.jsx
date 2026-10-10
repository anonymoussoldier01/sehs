import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { keys } from '../lib/store';
import { BlurFade, Skeleton, SpotlightCard } from '../components/magic';
import { Lamp } from '../components/ace';
import { InteractiveHover } from '../components/bits';

export default function Mocks() {
  const navigate = useNavigate();
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
      <div className="mt-2">
        <Lamp
          kicker="Real clock · instant scoring"
          title="Timed mocks"
          sub="Full-length ACER-style blocks. Flag, skip, review. Best scores stay in this browser."
        />
      </div>
      {!mocks ? (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          {mocks.map((m) => (
            <BlurFade key={m.id}>
              <SpotlightCard className="h-full rounded-2xl border shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
                <div className="flex h-full flex-col p-[18px]">
                  <h3 className="font-display text-[15.5px] font-bold">{m.title}</h3>
                  <p className="mb-1 mt-0.5 text-[13px]" style={{ color: 'var(--mut)' }}>
                    {m.strands.join(' · ')} · {m.minutes} min · {m.count} questions
                  </p>
                  {best[m.id] ? (
                    <p className="text-[13px] font-bold" style={{ color: 'var(--ok)' }}>
                      Best: {best[m.id].score}/{best[m.id].total}
                    </p>
                  ) : (
                    <p className="text-[13px]" style={{ color: 'var(--faint)' }}>Not attempted yet</p>
                  )}
                  <p className="mt-2 flex gap-2">
                    <Button size="sm" variant="default" onClick={() => navigate('/mocks/' + encodeURIComponent(m.id))}>
                      Start →
                    </Button>
                    <InteractiveHover to={`/mocks/${encodeURIComponent(m.id)}?seed=${encodeURIComponent(m.id)}-fresh`}>
                      Fresh seed
                    </InteractiveHover>
                  </p>
                </div>
              </SpotlightCard>
            </BlurFade>
          ))}
        </div>
      )}
    </div>
  );
}
