import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
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
import Request from './pages/Request';
import Unlock from './pages/Unlock';
import Guide from './pages/Guide';
import NotFound from './pages/NotFound';

const router = createBrowserRouter([
  {
    element: <Layout />,
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
      { path: 'request', element: <Request /> },
      { path: 'unlock', element: <Unlock /> },
      { path: 'exam-guide', element: <Guide /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers router={<RouterProvider router={router} />} />
  </React.StrictMode>
);

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
