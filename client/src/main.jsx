import { StrictMode, Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter, useRouteError, Link } from 'react-router-dom';
import Lenis from 'lenis';
import { inject } from '@vercel/analytics';
import './index.css';
import Layout, { Providers } from './Layout';
import Home from './pages/Home';
import { initMotion } from './lib/motion';
import { migrate } from './lib/storage';

// Code-split every route; heavy viewer/editor/chart bundles stay out of home.
const Search = lazy(() => import('./pages/Search'));
const Resource = lazy(() => import('./pages/Resource'));
const StudyHub = lazy(() => import('./pages/StudyHub'));
const Deck = lazy(() => import('./pages/Deck'));
const Mocks = lazy(() => import('./pages/Mocks'));
const MockRun = lazy(() => import('./pages/MockRun'));
const Writing = lazy(() => import('./pages/Writing'));
const Drills = lazy(() => import('./pages/Drills'));
const Reading = lazy(() => import('./pages/Reading'));
const Saved = lazy(() => import('./pages/Saved'));
const SharedList = lazy(() => import('./pages/SharedList'));
const Subjects = lazy(() => import('./pages/Subjects'));
const About = lazy(() => import('./pages/About'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Request = lazy(() => import('./pages/Request'));
const Unlock = lazy(() => import('./pages/Unlock'));
const Guide = lazy(() => import('./pages/Guide'));
const WhatsNew = lazy(() => import('./pages/WhatsNew'));
const Design = lazy(() => import('./pages/Design'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10" aria-busy="true" aria-label="Loading page">
      <div className="skel h-7 w-2/5 rounded-lg" />
      <div className="skel mt-3 h-4 w-3/5 rounded-lg" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="skel h-28 rounded-2xl border" style={{ borderColor: 'var(--line)' }} />
        <div className="skel h-28 rounded-2xl border" style={{ borderColor: 'var(--line)' }} />
      </div>
    </div>
  );
}

const susp = (el) => <Suspense fallback={<RouteFallback />}>{el}</Suspense>;

// Versioned storage migration runs once, before first paint. Additive-only:
// existing bookmarks, folders, attempts and flashcard state carry over.
try {
  migrate();
} catch {
  /* storage unavailable: app runs ephemeral */
}

// Initialize Vercel Web Analytics
inject();

// Route error boundary: a designed recovery card instead of a blank crash.
function RouteError() {
  const err = useRouteError();
  return (
    <div className="mx-auto max-w-[640px] px-5 py-14 text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: 'var(--warn)' }}>Something broke on our side</p>
      <h1 className="mt-2 font-display text-3xl font-bold">This page hit a snag</h1>
      <p className="mx-auto mt-2 max-w-[52ch] text-sm" style={{ color: 'var(--mut)' }}>
        Nothing of yours is lost. Your library, notes and progress stay in this browser.
        {err && err.message ? ` (Detail: ${String(err.message).slice(0, 140)})` : ''}
      </p>
      <p className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Link to="/" className="inline-flex min-h-[44px] items-center rounded-xl px-5 py-2.5 text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          Back home
        </Link>
        <button onClick={() => window.location.reload()} className="inline-flex min-h-[44px] items-center rounded-xl border px-5 py-2.5 text-sm font-bold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
          Reload this page
        </button>
      </p>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      // "/app" = study hub (app surface). Old URLs keep working.
      { path: 'app', element: susp(<StudyHub />) },
      { path: 'search', element: susp(<Search />) },
      { path: 'r/:id', element: susp(<Resource />) },
      { path: 'study', element: susp(<StudyHub />) },
      { path: 'study/:deckId', element: susp(<Deck />) },
      { path: 'mocks', element: susp(<Mocks />) },
      { path: 'mocks/:id', element: susp(<MockRun />) },
      { path: 'writing', element: susp(<Writing />) },
      { path: 'drills', element: susp(<Drills />) },
      { path: 'reading', element: susp(<Reading />) },
      { path: 'saved', element: susp(<Saved />) },
      { path: 'list/:code', element: susp(<SharedList />) },
      { path: 'subjects', element: susp(<Subjects subject />) },
      { path: 'providers', element: susp(<Subjects />) },
      { path: 'about', element: susp(<About />) },
      { path: 'terms', element: susp(<Terms />) },
      { path: 'privacy', element: susp(<Privacy />) },
      { path: 'request', element: susp(<Request />) },
      { path: 'unlock', element: susp(<Unlock />) },
      { path: 'exam-guide', element: susp(<Guide />) },
      { path: 'whats-new', element: susp(<WhatsNew />) },
      { path: 'design', element: susp(<Design />) },
      { path: 'design/colours', element: susp(<Design />) },
      { path: '*', element: susp(<NotFound />) },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers router={<RouterProvider router={router} />} />
  </StrictMode>
);

// Apply stored theme (dark default) + motion setting before first paint.
try {
  if (localStorage.getItem('sehs-theme') !== 'light') document.documentElement.classList.add('dark');
} catch {
  document.documentElement.classList.add('dark');
}
initMotion();

// Buttery smooth scrolling (Lenis). Skipped for reduced-motion users;
// React Router's ScrollRestoration keeps working (native scrollTo passes through).
(function smooth() {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
    window.__sehsLenis = lenis;
    let raf;
    const loop = (time) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(loop);
    });
  } catch {
    /* non-critical enhancement */
  }
})();
