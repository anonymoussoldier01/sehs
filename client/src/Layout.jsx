import { useEffect, useState } from 'react';
import { Link, Outlet, ScrollRestoration } from 'react-router-dom';
import { Palette, Sidebar, Topbar, useFolders } from './components/shell';
import { Dock } from './components/magic';
import { ThemeProvider, ToastProvider } from './providers';
import { TermsProvider } from './providers';
import { api } from './lib/api';
import { keys } from './lib/store';

function CookieBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(keys.cookieOk)) setShow(true);
    } catch {
      /* noop */
    }
  }, []);
  if (!show) return null;
  return (
    <div
      className="fixed bottom-[18px] left-1/2 z-[75] flex max-w-[min(640px,calc(100vw-32px))] -translate-x-1/2 items-center gap-3.5 rounded-2xl px-[18px] py-3.5 text-[13px] shadow-2xl"
      style={{ background: 'var(--toast-bg)', color: 'var(--toast-fg)' }}
      role="status"
    >
      <span>We use cookies + local storage to remember your theme, library and progress.</span>
      <span className="flex gap-2">
        <Link to="/about" className="underline underline-offset-2">
          Details
        </Link>
        <button
          className="min-h-[38px] rounded-[10px] bg-[var(--primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--primary-foreground)]"
          onClick={() => {
            try {
              localStorage.setItem(keys.cookieOk, '1');
            } catch {
              /* noop */
            }
            setShow(false);
          }}
        >
          Got it
        </button>
      </span>
    </div>
  );
}

function Announcement() {
  const [body, setBody] = useState(null);
  useEffect(() => {
    api.announcement().then((j) => {
      if (!j.body) return;
      try {
        if (localStorage.getItem(keys.annSeen) === String(j.body).slice(0, 120)) return;
      } catch {
        /* noop */
      }
      setBody(j.body);
    });
  }, []);
  if (!body) return null;
  return (
    <div
      className="mx-5 mb-0 mt-3 flex items-center gap-3 rounded-2xl border p-3.5 text-sm shadow-sm"
      style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)' }}
      role="status"
    >
      <span className="flex-1">{body}</span>
      <button
        className="font-bold underline underline-offset-2"
        style={{ color: 'var(--acc)' }}
        onClick={() => {
          try {
            localStorage.setItem(keys.annSeen, String(body).slice(0, 120));
          } catch {
            /* noop */
          }
          setBody(null);
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

function Layout() {
  const [sideOpen, setSideOpen] = useState(false);
  const folders = useFolders();
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSideOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="grid min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar open={sideOpen} onClose={() => setSideOpen(false)} folders={folders} />
      <div className="flex min-w-0 flex-col">
        <Topbar onMenu={() => setSideOpen((o) => !o)} />
        <Announcement />
        <main id="main" className="flex-1">
          <Outlet />
        </main>
        <footer className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-start gap-4 border-t-2 px-5 pb-12 pt-7 md:grid-cols-[1fr_auto]" style={{ borderColor: 'var(--txt)' }}>
          <div>
            <h2 className="font-display text-base font-bold">About this directory</h2>
            <p className="mb-2 mt-1 max-w-[80ch] text-[13.5px]" style={{ color: 'var(--mut)' }}>
              A searchable collection of selective-entry study resources — past papers, notes, flashcards, mocks and guides. Free for anyone studying, no account needed.
            </p>
            <p className="text-xs tabular-nums" style={{ color: 'var(--faint)' }}>
              We use cookies + local storage to remember your theme, library and progress. Anonymous usage counts auto-delete after 30 days.{' '}
              <Link to="/about" className="font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>
                Privacy &amp; cookies
              </Link>
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--faint)' }}>
              Independent study resource — not affiliated with the Victorian Department of Education, ACER, or any exam provider.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-0.5">
            {[
              ['/about', 'About'],
              ['/saved', 'Library'],
              ['/study', 'Study hub'],
              ['/request', 'Request'],
              ['/unlock', 'Admin'],
            ].map(([to, l]) => (
              <Link key={to} to={to} className="min-h-[36px] px-2 py-2 text-[13.5px] font-bold underline underline-offset-[3px]" style={{ color: 'var(--acc)' }}>
                {l}
              </Link>
            ))}
          </div>
        </footer>
      </div>
      <Palette />
      <Dock />
      <CookieBar />
      <ScrollRestoration />
    </div>
  );
}

export function Providers({ router }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TermsProvider>{router}</TermsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default Layout;
