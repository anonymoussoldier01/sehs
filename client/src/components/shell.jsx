import { useEffect, useMemo, useRef, useState } from 'react';
import { Form, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  BookOpen,
  Bookmark,
  Command as CommandIcon,
  FileText,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Home,
  Info,
  Library,
  Menu,
  Moon,
  PenLine,
  Plus,
  Search,
  Shapes,
  Sun,
  Timer,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useTheme, useToast } from '../providers';
import { api } from '../lib/api';
import { keys, useLocal } from '../lib/store';
import { SCHOOL_BY_ID } from '../data/schools';
import { cleanTitle } from './landing';
import { cn } from './cn';

const PRACTICE = [
  ['/mocks', 'Timed mocks', Timer],
  ['/study', 'Flashcards', GraduationCap],
  ['/drills', 'Maths drills', Gamepad2],
  ['/writing', 'Writing studio', PenLine],
  ['/reading', 'Reading room', Library],
];
const LEARN = [
  ['/exam-guide', 'Study guides', BookOpen],
];
const LIBRARY = [
  ['/saved', 'Your library', Bookmark],
  ['/search', 'Browse', Search],
  ['/search?type=pdf', 'Past papers', FileText],
  ['/subjects', 'Subjects', Shapes],
  ['/providers', 'Providers', FlaskConical],
];
const MORE = [
  ['/request', 'Request', Plus],
  ['/about', 'About', Info],
  ['/whats-new', "What's new", FileText],
  ['/study#backup', 'Settings & backup', Search],
];

function SideLink({ to, icon: Icon, label, onNav }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNav}
      className={({ isActive }) =>
        cn(
          'flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold transition-colors',
          isActive ? 'ledger-active' : ''
        )
      }
      style={({ isActive }) => ({
        // Calm system: active = accent-soft bg + 2px accent bar (via .ledger-active).
        background: isActive ? 'var(--accent-soft)' : undefined,
        color: isActive ? 'var(--text)' : 'var(--mut)',
        boxShadow: isActive ? 'inset 2px 0 0 var(--accent)' : undefined,
      })}
    >
      <span
        className="grid h-[26px] w-[26px] flex-none place-items-center rounded-lg border"
        style={{ background: 'var(--bg2)', borderColor: 'var(--line)' }}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function SideGroup({ id, label, children, defaultOpen = true }) {
  const [collapsed, setCollapsed] = useLocal(`sehs-nav-${id}`, !defaultOpen);
  const open = !collapsed;
  return (
    <div className="side-group">
      <div className="flex items-center gap-1">
        <span className="side-group-label">{label}</span>
        <button
          type="button"
          onClick={() => setCollapsed(open)}
          aria-expanded={String(open)}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
          className="side-chevron"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {open ? <div className="side-group-body">{children}</div> : null}
    </div>
  );
}

// Subtle Continue card: label + cleaned title (2-line clamp) + type badge +
// thin progress bar. Never a raw filename, never competes with Home.
function ContinueCard({ onNav }) {
  const [recent] = useLocal(keys.recent, []);
  const last = Array.isArray(recent) && recent.length ? recent[0] : null;
  const [progress, setProgress] = useState(0);
  const [kind, setKind] = useState('');
  const title = cleanTitle(last?.title || last?.id || '', 'Last opened');
  useEffect(() => {
    if (!last) return;
    try {
      const prog = JSON.parse(localStorage.getItem('sehs-progress') || '{}')[last.id];
      if (prog?.secondsRead) setProgress(Math.min(90, 10 + Math.min(80, Math.floor(prog.secondsRead / 6))));
    } catch { /* noop */ }
    let live = true;
    api.byIds([last.id]).then((j) => {
      if (!live) return;
      const v = (j.results || [])[0];
      if (v?.fileType) setKind(String(v.fileType).toUpperCase());
    }).catch(() => {});
    return () => { live = false; };
  }, [last?.id]);
  if (!last) {
    return (
      <Link to="/mocks" onClick={onNav} className="continue-side" aria-label="Start the diagnostic mock">
        <span className="continue-side-label">Recommended start</span>
        <span className="continue-side-title">Take the free diagnostic</span>
        <span className="continue-side-meta">10 minutes · real timing</span>
      </Link>
    );
  }
  return (
    <Link to={'/r/' + last.id} onClick={onNav} className="continue-side" title={last.title || last.id} aria-label={`Continue: ${title}`}>
      <span className="continue-side-label">Continue {kind ? `· ${kind}` : ''}</span>
      <span className="continue-side-title">{title}</span>
      <span className="continue-side-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress on ${title}`}>
        <i style={{ width: `${progress}%` }} />
      </span>
    </Link>
  );
}

export function Sidebar({ open, onClose, folders }) {
  return (
    <>
      <div
        className={cn('fixed inset-0 z-[48] bg-black/45 lg:hidden', open ? '' : 'hidden')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(300px,84vw)] flex-col gap-1.5 overflow-y-auto border-r p-3 transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-[248px] lg:translate-x-0 lg:rounded-none lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-[105%]'
        )}
        style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
        aria-label="Primary"
      >
        <Link to="/" onClick={onClose} className="mb-2 flex min-h-[44px] items-center gap-2.5 rounded-xl p-2">
          <span className="side-logo-tile grid h-9 w-9 flex-none place-items-center rounded-[11px] font-display text-xl font-black shadow" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
            S
          </span>
          <span className="leading-tight">
            <strong className="block font-display text-[17px]">SEHS Study</strong>
            <small className="block text-xs" style={{ color: 'var(--mut)' }}>
              Flashcards · mocks · papers
            </small>
          </span>
        </Link>
        <ContinueCard onNav={onClose} />
        <nav className="flex flex-col gap-[1px]" aria-label="Sections">
          <SideLink to="/" icon={Home} label="Home" onNav={onClose} />
          <SideLink to="/study" icon={GraduationCap} label="Study hub" onNav={onClose} />
          <SideGroup id="practice" label="Practice" defaultOpen>
            {PRACTICE.map(([to, l, i]) => (
              <SideLink key={to + l} to={to} icon={i} label={l} onNav={onClose} />
            ))}
          </SideGroup>
          <SideGroup id="learn" label="Learn" defaultOpen>
            {LEARN.map(([to, l, i]) => (
              <SideLink key={to + l} to={to} icon={i} label={l} onNav={onClose} />
            ))}
          </SideGroup>
          <SideGroup id="library" label="Library" defaultOpen>
            {LIBRARY.map(([to, l, i]) => (
              <SideLink key={to + l} to={to} icon={i} label={l} onNav={onClose} />
            ))}
          </SideGroup>
          <SideGroup id="more" label="More" defaultOpen>
            {MORE.map(([to, l, i]) => (
              <SideLink key={to + l} to={to} icon={i} label={l} onNav={onClose} />
            ))}
          </SideGroup>
        </nav>
        <div className="mt-auto border-t border-dashed px-2 pb-1 pt-3" style={{ borderColor: 'var(--line2)' }}>
          <Link to="/saved#list-new" onClick={onClose} className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-[13.5px] font-bold">
            <Plus className="h-4 w-4" aria-hidden="true" /> New folder
          </Link>
          {!!folders?.length && (
            <div className="mt-1.5 flex flex-col gap-[1px]">
              {folders.slice(0, 6).map((f) => (
                <Link
                  key={f.code}
                  to={'/list/' + f.code}
                  onClick={onClose}
                  className="flex min-h-[40px] items-center gap-3 rounded-xl px-3 text-sm font-semibold"
                  style={{ color: 'var(--mut)' }}
                >
                  <span
                    className="grid h-[26px] w-[26px] flex-none place-items-center rounded-lg border"
                    style={{ background: 'var(--bg2)', borderColor: 'var(--line)' }}
                  >
                    <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="truncate">{f.name}</span>
                  <span
                    className="ml-auto rounded-full border px-2 py-[1px] text-[11px] tabular-nums"
                    style={{ borderColor: 'var(--line)', color: 'var(--faint)' }}
                  >
                    {f.count}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <p className="mx-3 mt-1.5 text-[11.5px]" style={{ color: 'var(--faint)' }}>
            Progress saves in this browser.
          </p>
        </div>
      </aside>
    </>
  );
}

function useSuggest(value) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const last = value.split(/\s+/).pop() || '';
    if (last.length < 2) {
      setItems([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      api
        .suggest(last.slice(0, 40))
        .then((j) => live && setItems((j.suggestions || []).slice(0, 7)))
        .catch(() => {});
    }, 110);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value]);
  return items;
}

function isMac() {
  try {
    return /mac/i.test(navigator.platform || navigator.userAgent || '');
  } catch {
    return false;
  }
}

function goDoors(navigate, pathname) {
  // Home owns #four-doors. Off-home, route to study context instead of a
  // dead hash scroll (AUDIT #4). Never navigates to "/#four-doors".
  if (pathname && pathname !== '/') {
    navigate('/study');
    return;
  }
  const el = document.getElementById('four-doors');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else {
    navigate('/');
    setTimeout(() => document.getElementById('four-doors')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }
}

function TargetChip() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [targetId] = useLocal('sehs-target-school', null);
  const [days, setDays] = useState(null);
  useEffect(() => {
    try {
      const custom = JSON.parse(localStorage.getItem('sehs-exam-date') || 'null');
      const ds = custom || '2027-06-19';
      const d = Math.ceil((new Date(ds + 'T09:00:00') - new Date()) / 86400000);
      setDays(Number.isFinite(d) && d >= 0 ? d : null);
    } catch { /* noop */ }
  }, [targetId]);
  const school = targetId ? SCHOOL_BY_ID[targetId] : null;
  if (!school) {
    return (
      <button type="button" className="target-chip target-unset hidden md:inline-flex" onClick={() => goDoors(navigate, pathname)}>
        Pick your target school
      </button>
    );
  }
  return (
    <button
      type="button"
      className="target-chip hidden md:inline-flex"
      onClick={() => goDoors(navigate, pathname)}
      title="Your target school — select to change"
      aria-label={`Your target: ${school.shortName}${days != null ? `, ${days} days to exam` : ''}. Activate to change.`}
    >
      <span className="target-crest" aria-hidden="true">
        {school.wordmarkFallback}
      </span>
      {school.shortName}{days != null ? ` · ${days}d` : ''}
    </button>
  );
}

export function Topbar({ onMenu }) {
  const { dark, toggle } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [name, setName] = useLocal(keys.name, '');
  const sugg = useSuggest(q);
  const boxRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sehs:palette'));
      }
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
        const input = boxRef.current?.querySelector('input');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      const list = JSON.parse(localStorage.getItem(keys.recentSearches) || '[]');
      localStorage.setItem(keys.recentSearches, JSON.stringify([q.trim(), ...list.filter((x) => x !== q.trim())].slice(0, 8)));
    } catch {
      /* noop */
    }
    setFocus(false);
    navigate('/search?q=' + encodeURIComponent(q.trim()));
  };

  return (
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
      <div className="mx-auto flex min-h-[64px] w-full max-w-[1200px] items-center gap-2.5 px-4 sm:px-6">
        <Button variant="secondary" size="icon" onClick={onMenu} aria-label="Open menu" className="lg:hidden">
          <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
        </Button>
        <div className="relative mx-auto w-full min-w-0 max-w-[560px]" ref={boxRef}>
          <Form
            onSubmit={submit}
            className="flex min-h-[44px] items-center gap-2.5 rounded-[10px] border py-0 pl-4 pr-2 transition-colors"
            style={{ background: 'var(--bg2)', borderColor: focus ? 'var(--acc)' : 'var(--line)' }}
            role="search"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ color: 'var(--faint)', flex: 'none' }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 120)}
              type="search"
              placeholder="Search papers, decks, topics…"
              aria-label="Search study resources"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none"
            />
            <kbd className="kbd hidden sm:inline-flex" title="Press / to focus" aria-hidden="true">
              /
            </kbd>
          </Form>
          {focus && !!sugg.length && (
            <div
              className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border p-1.5 shadow-2xl"
              style={{ background: 'var(--panel)', borderColor: 'var(--line2)' }}
              role="listbox"
            >
              {sugg.map((s, i) => (
                <button
                  key={i}
                  role="option"
                  aria-selected="false"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    navigate('/search?q=' + encodeURIComponent(s.label));
                    setFocus(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--acc-soft)]"
                >
                  <span
                    className="flex-none rounded-md border px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider"
                    style={{ color: 'var(--acc)', borderColor: 'var(--acc-line)' }}
                  >
                    {s.kind}
                  </span>
                  <span className="truncate">{s.label}</span>
                  {!!s.count && <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--faint)' }}>{s.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <TargetChip />
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" onClick={() => window.dispatchEvent(new CustomEvent('sehs:palette'))} aria-label={`Quick search (${isMac() ? '⌘K' : 'Ctrl+K'})`}>
                <CommandIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isMac() ? 'Quick search (⌘K)' : 'Quick search (Ctrl+K)'}</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="Settings menu">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Settings (this browser)</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => navigate('/study#backup')}>Back up / restore progress</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggle()}>Theme: {dark ? 'dark' : 'light'} — toggle</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/study')}>Change target school…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/about')}>About SEHS Study</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  const next = window.prompt('Display name (stored only in this browser):', name || '');
                  if (next === null) return;
                  const v = String(next).trim().slice(0, 24);
                  setName(v);
                  toast(v ? `Hi, ${v}` : 'Profile cleared');
                }}
              >
                Set display name…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" onClick={(e) => toggle(e)} aria-pressed={String(dark)} aria-label="Toggle light and dark mode">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle light / dark</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

const PALETTE_CHIPS = ['verbal analogy', 'fractions', 'reading comprehension', 'Start a mock'];

export function Palette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [decks, setDecks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const on = () => {
      setQ('');
      setResults([]);
      setOpen((o) => !o);
    };
    window.addEventListener('sehs:palette', on);
    return () => window.removeEventListener('sehs:palette', on);
  }, []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    api.decks().then((j) => live && setDecks((j.decks || []).slice(0, 14))).catch(() => {});
    return () => { live = false; };
  }, [open ]);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      api
        .search({ q: q.trim(), per: 5 })
        .then((j) => live && setResults((j.results || []).slice(0, 6)))
        .catch(() => {});
    }, 130);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, q]);

  const deckHits = q.trim()
    ? decks.filter((d) => `${d.title || d.id}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 4)
    : decks.slice(0, 4);

  const go = (href) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Quick search">
      <div className="fixed inset-0 z-[70] grid place-items-start justify-center overflow-y-auto bg-black/55 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
        <div
          className="w-full max-w-[600px] rounded-[18px] border p-3.5 shadow-2xl"
          style={{ background: 'var(--panel)', borderColor: 'var(--line2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="Search resources, decks, pages, actions…"
            className="min-h-[52px] w-full rounded-xl border bg-transparent px-4 text-base outline-none"
            style={{ borderColor: 'var(--line2)', background: 'var(--bg)' }}
          />
          {!q.trim() ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Suggestions">
              {PALETTE_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    if (c === 'Start a mock') go('/mocks');
                    else setQ(c);
                  }}
                  className="rounded-full border px-3 py-2 text-[13px] font-bold"
                  style={{ borderColor: 'var(--line2)', color: 'var(--mut)' }}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
          <Command.List className="mt-2.5 max-h-[50vh] overflow-auto">
            {!!deckHits.length ? (
              <Command.Group heading="Decks">
                {deckHits.map((d) => (
                  <Command.Item
                    key={d.id || d.title}
                    value={String(d.title || d.id)}
                    onSelect={() => go('/study/' + encodeURIComponent(d.id || d.title))}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm aria-selected:bg-[var(--acc-soft)]"
                  >
                    <span className="rounded-md border px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase" style={{ color: 'var(--acc)', borderColor: 'var(--acc-line)' }}>
                      deck
                    </span>
                    <span className="truncate">{d.title || d.id}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            <Command.Empty className="px-3.5 py-2.5 text-sm" style={{ color: 'var(--mut)' }}>
              No matches. Press Enter to search.
            </Command.Empty>
            {q.trim() && (
              <Command.Item
                onSelect={() => go('/search?q=' + encodeURIComponent(q.trim()))}
                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm aria-selected:bg-[var(--acc-soft)]"
              >
                <span className="rounded-md border px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase" style={{ color: 'var(--acc)', borderColor: 'var(--acc-line)' }}>
                  search
                </span>
                Search for “{q.trim()}”
              </Command.Item>
            )}
            {results.map((v) => (
              <Command.Item
                key={v.id}
                value={v.displayTitle || v.title}
                onSelect={() => go('/r/' + v.id)}
                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm aria-selected:bg-[var(--acc-soft)]"
              >
                <span className="rounded-md border px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase" style={{ color: 'var(--acc)', borderColor: 'var(--acc-line)' }}>
                  {v.fileType}
                </span>
                <span className="truncate">{v.displayTitle || v.title}</span>
              </Command.Item>
            ))}
            <Command.Group heading="Actions">
              {[
                ['Start a mock', '/mocks'],
                ['Review flashcards', '/study'],
                ['Open Writing studio', '/writing'],
                ['Open Maths drills', '/drills'],
                ['Back up progress', '/study#backup'],
              ]
                .filter(([label]) => !q.trim() || label.toLowerCase().includes(q.trim().toLowerCase()))
                .map(([label, href]) => (
                  <Command.Item
                    key={href + label}
                    value={label}
                    onSelect={() => go(href)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm aria-selected:bg-[var(--acc-soft)]"
                  >
                    <span className="rounded-md border px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase" style={{ color: 'var(--acc)', borderColor: 'var(--acc-line)' }}>
                      run
                    </span>
                    {label}
                  </Command.Item>
                ))}
            </Command.Group>
            <Command.Group heading="Pages">
              {[
                ['Study hub', '/study'],
                ['Browse resources', '/search'],
                ['Your library', '/saved'],
                ['Subjects', '/subjects'],
                ['Providers', '/providers'],
                ['Exam guide', '/exam-guide'],
                ['Request a resource', '/request'],
                ["What's new", '/whats-new'],
                ['About', '/about'],
              ]
                .filter(([label]) => !q.trim() || label.toLowerCase().includes(q.trim().toLowerCase()))
                .map(([label, href]) => (
                  <Command.Item
                    key={href}
                    value={label}
                    onSelect={() => go(href)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm aria-selected:bg-[var(--acc-soft)]"
                  >
                    <span className="rounded-md border px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase" style={{ color: 'var(--acc)', borderColor: 'var(--acc-line)' }}>
                      go
                    </span>
                    {label}
                  </Command.Item>
                ))}
            </Command.Group>
          </Command.List>
          <p className="mb-0 mt-2.5 text-xs" style={{ color: 'var(--faint)' }}>
            ↑↓ navigate · Enter open · Esc close
          </p>
        </div>
      </div>
    </Command.Dialog>
  );
}

export function useFolders() {
  const [lists] = useLocal(keys.lists, []);
  return useMemo(() => {
    const encode = (ids) => btoa(JSON.stringify(ids.slice(0, 100))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return (lists || []).map((l) => ({ name: l.name, count: (l.items || []).length, code: encode(l.items || []) }));
  }, [lists]);
}
