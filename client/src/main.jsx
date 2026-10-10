import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter, useRouteError, Link } from 'react-router-dom';
import Lenis from 'lenis';
import './index.css';
import Layout, { Providers } from './Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import Resource from './pages/Resource';
import StudyHub from './pages/StudyHub';
import Deck from './pages/Deck';
import Mocks from './pages/Mocks';
import MockRun from './pages/MockRun';
import Writing from './pages/Writing';
import Drills from './pages/Drills';
import Reading from './pages/Reading';
import Saved from './pages/Saved';
import SharedList from './pages/SharedList';
import Subjects from './pages/Subjects';
import About from './pages/About';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Request from './pages/Request';
import Unlock from './pages/Unlock';
import Guide from './pages/Guide';
import Design from './pages/Design';
import NotFound from './pages/NotFound';
import { initMotion } from './lib/motion';

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
      { path: 'search', element: <Search /> },
      { path: 'r/:id', element: <Resource /> },
      { path: 'study', element: <StudyHub /> },
      { path: 'study/:deckId', element: <Deck /> },
      { path: 'mocks', element: <Mocks /> },
      { path: 'mocks/:id', element: <MockRun /> },
      { path: 'writing', element: <Writing /> },
      { path: 'drills', element: <Drills /> },
      { path: 'reading', element: <Reading /> },
      { path: 'saved', element: <Saved /> },
      { path: 'list/:code', element: <SharedList /> },
      { path: 'subjects', element: <Subjects subject /> },
      { path: 'providers', element: <Subjects /> },
      { path: 'about', element: <About /> },
      { path: 'terms', element: <Terms /> },
      { path: 'privacy', element: <Privacy /> },
      { path: 'request', element: <Request /> },
      { path: 'unlock', element: <Unlock /> },
      { path: 'exam-guide', element: <Guide /> },
      { path: 'design', element: <Design /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers router={<RouterProvider router={router} />} />
  </StrictMode>
);

// Apply stored theme + motion setting before first paint (module executes pre-paint in practice).
try {
  if (localStorage.getItem('sehs-theme') === 'dark') document.documentElement.classList.add('dark');
} catch {
  /* noop */
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
