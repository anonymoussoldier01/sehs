import { useEffect, useMemo, useRef, useState } from 'react';
import { Form, Link, NavLink, useNavigate } from 'react-router-dom';
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
  Layers,
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
import { Avatar, AvatarFallback } from './ui/avatar';
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
import { api, pretty } from '../lib/api';
import { keys, useLocal } from '../lib/store';
import { cn } from './cn';

const MAIN = [
  ['/', 'Home', Home],
  ['/saved', 'Your library', Bookmark],
  ['/search', 'Browse', Search],
  ['/search?type=pdf', 'PDF papers', FileText],
  ['/study', 'Study hub', GraduationCap],
];
const START = [
  ['/study', 'Flashcards', Layers],
  ['/mocks', 'Timed mocks', Timer],
  ['/exam-guide', 'Study guides', BookOpen],
  ['/drills', 'Games & drills', Gamepad2],
  ['/writing', 'Writing studio', PenLine],
  ['/reading', 'Reading room', Library],
];
const MORE = [
  ['/subjects', 'Subjects', Shapes],
  ['/providers', 'Providers', FlaskConical],
  ['/request', 'Request', Plus],
  ['/about', 'About', Info],
];

function SideLink({ to, icon: Icon, label, onNav }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNav}
      className={({ isActive }) =>
        cn(
          'flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
          isActive ? '' : 'hover:translate-x-[1px]'
        )
      }
      style={({ isActive }) => ({
        background: isActive ? 'var(--acc-soft)' : undefined,
        color: isActive ? 'var(--acc)' : 'var(--mut)',
      })}
    >
      <span
        className="grid h-[26px] w-[26px] flex-none place-items-center rounded-lg border"
        style={{ background: 'var(--bg2)', borderColor: 'var(--line)' }}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="truncate">{label}</span>
    </NavLink>
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
        <Link to="/" onClick={onClose} className="mb-2 flex items-center gap-2.5 rounded-xl p-2">
          <span className="grid h-9 w-9 flex-none -rotate-2 place-items-center rounded-[11px] font-display text-xl font-black shadow" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            Q
          </span>
          <span className="leading-tight">
            <strong className="block font-display text-[17px]">SEHS Study</strong>
            <small className="block text-xs" style={{ color: 'var(--mut)' }}>
              Flashcards · mocks · papers
            </small>
          </span>
        </Link>
        <nav className="flex flex-col gap-[1px]" aria-label="Sections">
          {MAIN.map(([to, l, i]) => (
            <SideLink key={to + l} to={to} icon={i} label={l} onNav={onClose} />
          ))}
          <p className="mx-3 mb-1.5 mt-4 text-[11px] font-extrabold uppercase tracking-[.08em]" style={{ color: 'var(--faint)' }}>
            Start here
          </p>
          {START.map(([to, l, i]) => (
            <SideLink key={to + l} to={to} icon={i} label={l} onNav={onClose} />
          ))}
          <p className="mx-3 mb-1.5 mt-4 text-[11px] font-extrabold uppercase tracking-[.08em]" style={{ color: 'var(--faint)' }}>
            More
          </p>
          {MORE.map(([to, l, i]) => (
            <SideLink key={to + l} to={to} icon={i} label={l} onNav={onClose} />
          ))}
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
      className="sticky top-0 z-40 border-b backdrop-blur-xl transition-all duration-300"
      style={{
        background: scrolled ? 'color-mix(in srgb, var(--panel) 82%, transparent)' : 'color-mix(in srgb, var(--panel) 94%, transparent)',
        borderColor: 'var(--line)',
        boxShadow: scrolled ? '0 6px 24px rgba(15,23,42,0.10)' : 'none',
      }}
    >
      <div className="mx-auto flex min-h-[62px] max-w-[1240px] items-center gap-2.5 px-4 transition-all duration-300 sm:px-6" style={scrolled ? { minHeight: 54 } : undefined}>
        <Button variant="secondary" size="icon" onClick={onMenu} aria-label="Open menu" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative mx-auto w-full min-w-0 max-w-[560px]" ref={boxRef}>
          <Form
            onSubmit={submit}
            className="flex min-h-[44px] items-center gap-2.5 rounded-full border py-0 pl-4 pr-2 transition-all focus-within:-translate-y-px"
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
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" onClick={() => window.dispatchEvent(new CustomEvent('sehs:palette'))} aria-label="Quick search (Ctrl+K)">
                <CommandIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quick search (Ctrl+K)</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Your profile menu" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                <Avatar>
                  <AvatarFallback>{(name?.trim()?.[0] || 'G').toUpperCase()}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Profile (this browser)</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => navigate('/saved')}>Your library</DropdownMenuItem>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => toggle()}>Toggle light / dark</DropdownMenuItem>
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

export function Palette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const navigate = useNavigate();
  const toast = useToast();

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
            placeholder="Search resources, subjects, actions…"
            className="min-h-[52px] w-full rounded-xl border bg-transparent px-4 text-base outline-none"
            style={{ borderColor: 'var(--line2)', background: 'var(--bg)' }}
          />
          <Command.List className="mt-2.5 max-h-[50vh] overflow-auto">
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
            {[
              ['Browse subjects', '/subjects'],
              ['Timed mocks', '/mocks'],
              ['Your library', '/saved'],
            ].map(([label, href]) => (
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
