import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Unlock() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return !!sessionStorage.getItem('sehs-admin-token');
    } catch {
      return false;
    }
  });
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Admin unlock — SEHS Study';
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const j = await api.unlock(pw);
      try {
        sessionStorage.setItem('sehs-admin-token', j.token);
      } catch {
        /* noop */
      }
      window.__sehsAdmin = j.token;
      navigate('/admin');
    } catch (ex) {
      setErr(ex.retryAfter ? `Too many attempts — try again in ${ex.retryAfter}s.` : 'Incorrect password. Please try again.');
      setPw('');
    }
  };

  if (unlocked)
    return (
      <div className="mx-auto max-w-[560px] px-5 py-8">
        <p>
          <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: 'var(--acc-soft)', color: 'var(--acc)' }}>
            Admin unlocked in this tab
          </span>
        </p>
        <div className="mt-2 flex gap-2">
          <Link to="/admin" className="inline-flex min-h-[38px] items-center rounded-[10px] bg-[#2f49e5] px-3.5 py-2 text-[13px] font-bold text-white">
            Open dashboard →
          </Link>
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem('sehs-admin-token');
              } catch {
                /* noop */
              }
              window.__sehsAdmin = null;
              setUnlocked(false);
            }}
            className="inline-flex min-h-[38px] items-center rounded-[10px] border px-3.5 py-2 text-[13px] font-bold"
            style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}
          >
            Lock this tab
          </button>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-[560px] px-5 py-8">
      <h1 className="font-display text-3xl font-bold">Admin unlock</h1>
      <p className="mt-1 text-[15px]" style={{ color: 'var(--mut)' }}>
        Enter the admin password to manage the collection. Access stays in this browser tab only — closing the tab locks it again.
      </p>
      <form onSubmit={submit} className="mt-3">
        <label className="mb-2.5 block text-sm font-semibold" style={{ color: 'var(--mut)' }}>
          Admin password
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            className="mt-1.5 block w-full rounded-[10px] border px-3 py-2.5 text-[15px]"
            style={{ borderColor: 'var(--line2)', background: 'var(--panel)', color: 'inherit' }}
          />
        </label>
        {!!err && <p className="mb-2 text-[13px] font-semibold" style={{ color: 'var(--bad)' }}>{err}</p>}
        <button type="submit" className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[11px] bg-[#2f49e5] px-[18px] py-2.5 text-sm font-bold text-white">
          Unlock admin
        </button>
      </form>
    </div>
  );
}
