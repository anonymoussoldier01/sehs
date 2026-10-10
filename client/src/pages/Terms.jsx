import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Skeleton } from '../components/magic';

export default function Terms() {
  const [t, setT] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    document.title = 'Terms and Conditions · SEHS Study';
    let live = true;
    api
      .terms()
      .then((j) => live && setT(j))
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="mx-auto max-w-[760px] px-5 py-7">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
        <Link to="/" className="hover:underline" style={{ color: 'var(--acc)' }}>Home</Link> › Terms &amp; Conditions
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">Terms &amp; Conditions {t && <span className="text-lg font-normal" style={{ color: 'var(--faint)' }}>v{t.version}</span>}</h1>
      {!t && !err && <div className="mt-4"><Skeleton /></div>}
      {err && <p className="mt-4 text-sm" style={{ color: 'var(--mut)' }}>Couldn’t load the terms right now. Please try again shortly.</p>}
      {t && (
        <>
          <p className="reading mt-2 text-[15px] font-semibold" style={{ color: 'var(--mut)' }}>{t.summary}</p>
          <div className="reading mt-4 text-[15px]" style={{ color: 'var(--mut)' }}>
            {String(t.body || '').split(/\n{2,}/).map((para, i) =>
              /^## /.test(para) ? (
                <h2 key={i} className="mb-1 mt-6 font-display text-lg font-bold" style={{ color: 'var(--txt)' }}>
                  {para.replace(/^## /, '')}
                </h2>
              ) : (
                <p key={i} className="mb-3 whitespace-pre-wrap">{para.replace(/^# /, '')}</p>
              )
            )}
          </div>
          <p className="mt-6 text-sm">
            <Link to="/privacy" className="font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>Read the Privacy page →</Link>
          </p>
        </>
      )}
    </div>
  );
}
