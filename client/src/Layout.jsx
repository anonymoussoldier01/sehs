import { useEffect, useState, ViewTransition } from 'react';
import { Link, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import { readMotionSetting } from './lib/motion';
import { motion } from 'framer-motion';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { Palette, Sidebar, Topbar, useFolders } from './components/shell';
import { Dock } from './components/magic';
import { ThemeProvider, ToastProvider, useTheme } from './providers';
import { TermsProvider } from './providers';
import { api } from './lib/api';
import { keys } from './lib/store';
import { WelcomeBackBar } from './components/landing';

function LandingNav() {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const centre = [
    ['/mocks', 'Mocks'],
    ['/study', 'Flashcards'],
    ['/search?type=pdf', 'Past papers'],
    ['/writing', 'Writing'],
    ['/exam-guide', 'Guides'],
  ];
  return (
    <>
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--border)',
          boxShadow: scrolled ? '0 1px 0 rgba(15,23,42,0.06)' : 'none',
        }}
      >
        <div className="mx-auto flex min-h-[64px] w-full max-w-[1200px] items-center gap-3 px-6">
          <Link to="/" className="flex min-h-[44px] items-center gap-2.5" aria-label="SEHS Study home">
            <span
              className="grid h-9 w-9 flex-none place-items-center rounded-[11px] font-display text-xl font-black"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              S
            </span>
            <strong className="font-display text-[17px]">SEHS Study</strong>
          </Link>
          <nav className="mx-auto hidden items-center gap-1 md:flex" aria-label="Product">
            {centre.map(([to, l]) => (
              <Link
                key={to + l}
                to={to}
                className="min-h-[44px] items-center px-3 py-2 text-[14px] font-semibold"
                style={{ color: 'var(--text-2)', display: 'inline-flex' }}
              >
                {l}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button
              type="button"
              onClick={(e) => toggle(e)}
              aria-pressed={String(dark)}
              aria-label="Toggle light and dark mode"
              className="grid h-10 w-10 place-items-center rounded-[10px] border"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-2)' }}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/study"
              className="hidden min-h-[44px] items-center rounded-[10px] border px-4 py-2 text-sm font-bold sm:inline-flex"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text)' }}
            >
              Study hub
            </Link>
            <button
              type="button"
              onClick={() => navigate('/mocks')}
              className="hidden min-h-[44px] items-center rounded-[10px] px-4 py-2 text-sm font-extrabold sm:inline-flex"
              style={{ background: 'var(--cta-bg)', color: 'var(--cta-fg)' }}
            >
              Start a free mock
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={String(open)}
              className="grid h-11 w-11 place-items-center rounded-[10px] border md:hidden"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[80] flex flex-col p-6"
          style={{ background: 'var(--bg)' }}
        >
          <div className="flex items-center justify-between">
            <strong className="font-display text-lg">SEHS Study</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid h-11 w-11 place-items-center rounded-[10px] border"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
            {[...centre, ['/study', 'Study hub'], ['/mocks', 'Start a free mock']].map(
              ([to, l]) => (
                <Link
                  key={to + l}
                  to={to}
                  onClick={() => setOpen(false)}
                  className="min-h-[52px] items-center border-b py-3 text-lg font-bold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)', display: 'flex' }}
                >
                  {l} →
                </Link>
              )
            )}
          </nav>
        </div>
      ) : null}
    </>
  );
}

// One footer for both surfaces (landing + app shell): same columns, same
// legal note, same theme toggle. The app shell used to render a different
// ledger footer — that split is what made the two halves feel disconnected.
function SiteFooter() {
  const { dark, toggle } = useTheme();
  const cols = [
    ['Product', [['/mocks', 'Timed mocks'], ['/study', 'Flashcards'], ['/drills', 'Maths drills'], ['/writing', 'Writing studio'], ['/reading', 'Reading room']]],
    ['Practice', [['/search?type=pdf', 'Past papers'], ['/subjects', 'Subjects'], ['/providers', 'Providers'], ['/exam-guide', 'Exam guide']]],
    ['Resources', [['/saved', 'Library'], ['/request', 'Request'], ['/whats-new', "What's new"], ['/study#backup', 'Backup & restore']]],
    ['About', [['/about', 'About'], ['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/unlock', 'Contact / takedown']]],
  ];
  return (
    <footer className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-10" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {cols.map(([h, links]) => (
          <nav key={h} aria-label={h}>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: 'var(--text-2)', margin: '0 0 10px' }}>
              {h}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {links.map(([to, l]) => (
                <li key={to + l}>
                  <Link to={to} className="inline-flex min-h-[36px] items-center text-[13.5px] font-semibold" style={{ color: 'var(--text-2)' }}>
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={(e) => toggle(e)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border px-4 py-2 text-sm font-bold"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text)' }}
          aria-pressed={String(dark)}
        >
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
        <p className="text-xs" style={{ color: 'var(--text-3)', maxWidth: '72ch', margin: 0 }}>
          Free forever, no account — progress saves in this browser. Melbourne High · Mac.Rob · Nossal ·
          Suzanne Cory. Not affiliated with ACER, the Department of Education or any school; names and crests
          used for identification only. VCE 2025 results via vic.gov.au, last checked 2026-09-30. Sources and
          dates on school pages.
        </p>
      </div>
    </footer>
  );
}

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
      className="flex min-h-[34px] items-center justify-center gap-2 px-4 py-1 text-center text-[13px]"
      style={{ background: 'var(--acc-soft)', borderBottom: '1px solid var(--line)', color: 'var(--txt)' }}
      role="status"
    >
      <span className="truncate" title={body}>{body}</span>
      <button
        className="flex-none font-bold underline underline-offset-2"
        style={{ color: 'var(--acc)' }}
        aria-label="Dismiss announcement"
        onClick={() => {
          try {
            localStorage.setItem(keys.annSeen, String(body).slice(0, 120));
          } catch {
            /* noop */
          }
          setBody(null);
        }}
      >
        ×
      </button>
    </div>
  );
}

// First-visit gate: the full Terms & Conditions on first site open.
// Accepting records the version locally; declining dismisses (browsing stays
// open, but study features re-ask per tab). Shown once per terms version.
function FirstVisitTerms() {
  const [terms, setTerms] = useState(null);
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    let live = true;
    api
      .terms()
      .then((t) => {
        if (!live || !t?.version) return;
        let accepted = 0;
        try {
          accepted = Number(localStorage.getItem('sehs-terms-accepted') || 0);
        } catch {
          /* noop */
        }
        if (accepted < t.version) setTerms(t);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!terms) return null;
  const decide = (val) => {
    if (val) {
      try {
        localStorage.setItem('sehs-terms-accepted', String(terms.version));
      } catch {
        /* noop */
      }
    }
    setTerms(null);
    setAgreed(false);
  };
  const paras = String(terms.body || '').split(/\n{2,}/);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[80] grid place-items-center overflow-auto bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Terms and Conditions: please read"
    >
      <motion.div
        initial={{ scale: 0.97, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        className="my-auto w-full max-w-2xl rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--panel)', borderColor: 'var(--line2)' }}
      >
        <p className="text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--acc)' }}>
          Before you start studying
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">Terms &amp; Conditions <span className="text-sm font-normal" style={{ color: 'var(--faint)' }}>v{terms.version}</span></h2>
        <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--mut)' }}>{terms.summary}</p>
        <div className="mt-3 max-h-[46vh] overflow-auto rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--mut)' }} tabIndex={0} aria-label="Full terms and conditions">
          {paras.map((para, i) =>
            /^## /.test(para) ? (
              <h3 key={i} className="mb-1 mt-4 font-display text-[15px] font-bold first:mt-0" style={{ color: 'var(--txt)' }}>
                {para.replace(/^## /, '')}
              </h3>
            ) : (
              <p key={i} className="mb-2 whitespace-pre-wrap">{para.replace(/^# /, '')}</p>
            )
          )}
        </div>
        <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
          I have read these Terms &amp; Conditions{terms.body && terms.body.includes('under 18') ? ' (and, if I’m under 18, my parent or guardian has read them too)' : ''}
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="min-h-[44px] rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] hover:brightness-110 disabled:opacity-50"
            disabled={!agreed}
            onClick={() => decide(true)}
          >
            Accept &amp; start studying
          </button>
          <button
            className="min-h-[44px] rounded-xl border px-5 py-2.5 text-sm font-bold"
            style={{ borderColor: 'var(--line2)' }}
            onClick={() => decide(false)}
          >
            Not now
          </button>
          <span className="ml-auto self-center text-xs" style={{ color: 'var(--faint)' }}>
            <Link to="/terms" className="underline underline-offset-2" style={{ color: 'var(--acc)' }} onClick={() => setTerms(null)}>Read later</Link>
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReleaseNote() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem('sehs-whats-new-seen');
      const returning = localStorage.getItem('sehs-started') || localStorage.getItem('sehs-saved');
      if (returning && seen !== 'phase-2') setShow(true);
    } catch {
      /* noop */
    }
  }, []);
  if (!show) return null;
  return (
    <div
      className="flex min-h-[34px] items-center justify-center gap-2 px-4 py-1 text-center text-[13px]"
      style={{ background: 'var(--panel)', borderBottom: '1px solid var(--line)', color: 'var(--mut)' }}
      role="status"
    >
      <span className="truncate">
        New: back up and restore your progress. <Link to="/whats-new" className="font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }} onClick={dismiss}>See what&apos;s new</Link>
      </span>
      <button className="flex-none font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }} aria-label="Dismiss what's new" onClick={dismiss}>×</button>
    </div>
  );
  function dismiss() {
    try {
      localStorage.setItem('sehs-whats-new-seen', 'phase-2');
    } catch {
      /* noop */
    }
    setShow(false);
  }
}

// Route transitions (React ViewTransition, auto cross-fade on navigations).
// Renders only when the browser supports the API, motion is Full, and the
// OS allows it — otherwise navigation stays instant, never broken.
function viewTransitionsOK() {
  try {
    if (!ViewTransition || typeof document?.startViewTransition !== 'function') return false;
    if ((readMotionSetting() || 'full') !== 'full') return false;
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function Main({ children }) {
  const el = (
    <main id="main" className="flex-1">
      {children}
    </main>
  );
  return viewTransitionsOK() ? <ViewTransition>{el}</ViewTransition> : el;
}

function Layout() {
  const [sideOpen, setSideOpen] = useState(false);
  const folders = useFolders();
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSideOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (isLanding) {
    // "/" = marketing landing: full-width, sticky top nav, NO sidebar, full footer.
    return (
      <div className="flex min-h-screen min-w-0 flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[90] focus:min-h-[44px] focus:rounded-xl focus:px-4 focus:py-2 focus:text-sm focus:font-bold"
          style={{ background: 'var(--cta-bg)', color: 'var(--cta-fg)' }}
        >
          Skip to content
        </a>
        <LandingNav />
        <WelcomeBackBar />
        <Main>
          <Outlet />
        </Main>
        <SiteFooter />
        <CookieBar />
        <FirstVisitTerms />
        <ScrollRestoration />
      </div>
    );
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar open={sideOpen} onClose={() => setSideOpen(false)} folders={folders} />
      <div className="flex min-w-0 flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[90] focus:min-h-[44px] focus:rounded-xl focus:px-4 focus:py-2 focus:text-sm focus:font-bold"
          style={{ background: 'var(--cta-bg)', color: 'var(--cta-fg)' }}
        >
          Skip to content
        </a>
        <Topbar onMenu={() => setSideOpen((o) => !o)} />
        <Announcement />
        <ReleaseNote />
        <Main>
          <Outlet />
        </Main>
        <SiteFooter />
      </div>
      <Palette />
      <Dock />
      <CookieBar />
      <FirstVisitTerms />
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
