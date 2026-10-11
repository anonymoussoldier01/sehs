import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast as sonnerToast } from './components/ui/sonner';
import { api } from './lib/api';
import { keys } from './lib/store';

// ---------- theme (.dark class drives dark mode) ----------
const ThemeCtx = createContext({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem(keys.theme) !== 'light';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(keys.theme, dark ? 'dark' : 'light');
    } catch {
      /* noop */
    }
  }, [dark]);
  const toggle = useCallback(
    (e) => {
      const apply = () => setDark((d) => !d);
      if (document.startViewTransition) {
        const root = document.documentElement;
        if (e?.clientX != null) {
          root.style.setProperty('--tx', e.clientX + 'px');
          root.style.setProperty('--ty', e.clientY + 'px');
        }
        root.setAttribute('data-vt', 'circle');
        document.startViewTransition(apply);
        setTimeout(() => root.removeAttribute('data-vt'), 600);
      } else apply();
    },
    []
  );
  return <ThemeCtx.Provider value={{ dark, toggle }}>{children}</ThemeCtx.Provider>;
}

// ---------- toast (shadcn/ui Sonner; same useToast() signature for callers) ----------
const ToastCtx = createContext((msg) => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const toast = useCallback((m) => {
    sonnerToast(String(m ?? ''));
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <Toaster />
    </ToastCtx.Provider>
  );
}

// ---------- terms gate (per-tab acceptance) ----------
const TermsCtx = createContext({ ensure: async () => true });
export const useTerms = () => useContext(TermsCtx);

export function TermsProvider({ children }) {
  const [pending, setPending] = useState(null); // { version, summary, body, resolve }
  const [agreed, setAgreed] = useState(false);
  const acceptedVersion = useRef(0);

  const ensure = useCallback(async () => {
    let t;
    try {
      t = await api.terms();
    } catch {
      return false;
    }
    if (!t?.version) return false;
    if (acceptedVersion.current >= t.version) return true;
    return new Promise((resolve) => setPending({ ...t, resolve }));
  }, []);

  const decide = (val) => {
    if (val) acceptedVersion.current = pending.version;
    setPending(null);
    setAgreed(false);
    pending.resolve(val);
  };

  return (
    <TermsCtx.Provider value={{ ensure }}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.97, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 6 }}
              className="w-full max-w-xl rounded-2xl border p-6 shadow-2xl"
              style={{ background: 'var(--panel)', borderColor: 'var(--line2)' }}
              role="dialog"
              aria-modal="true"
              aria-label="Terms and Conditions"
            >
              <h2 className="font-display text-xl font-bold">
                Terms &amp; Conditions{' '}
                <span className="text-sm font-normal" style={{ color: 'var(--faint)' }}>
                  v{pending.version} · this browser tab only
                </span>
              </h2>
              <p className="mt-1 font-semibold" style={{ color: 'var(--mut)' }}>
                {pending.summary}
              </p>
              <div
                className="mt-3 max-h-[40vh] overflow-auto rounded-xl border p-3 text-sm"
                style={{ borderColor: 'var(--line)', color: 'var(--mut)' }}
              >
                {String(pending.body || '')
                  .split(/\n{2,}/)
                  .map((para, i) => (
                    <p key={i} className="mb-2">
                      {para}
                    </p>
                  ))}
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                I have read and agree to these Terms &amp; Conditions
              </label>
              <div className="mt-4 flex gap-2">
                <button
                  className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-[var(--primary-foreground)] hover:brightness-110"
                  onClick={() => (agreed ? decide(true) : null)}
                >
                  Accept &amp; continue
                </button>
                <button
                  className="rounded-xl border px-5 py-2.5 text-sm font-bold"
                  style={{ borderColor: 'var(--line2)' }}
                  onClick={() => decide(false)}
                >
                  Decline
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </TermsCtx.Provider>
  );
}

// ---------- resource opener (grant flow) ----------
// Terms are accepted FIRST, in this tab. Only then is the file opened.
// No about:blank pre-open, no placeholder tabs. If the browser still blocks
// the new tab, the granted URL is handed back as a real link (never a dead end).
export function useOpener() {
  const { ensure } = useTerms();
  const toast = useToast();
  return useCallback(
    async (id, { newTab = true } = {}) => {
      try {
        const ok = await ensure();
        if (!ok) return null;
        const j = await api.access(id);
        if (!j.openUrl) {
          toast('Could not open resource');
          return null;
        }
        if (!newTab) {
          window.location.href = j.openUrl;
          return j.openUrl;
        }
        const w = window.open(j.openUrl, '_blank', 'noopener');
        if (!w) {
          // Blocked: hand the granted URL back so the caller renders a real link.
          toast('Popup blocked. Your file is ready below');
          return { url: j.openUrl, blocked: true };
        }
        return { url: j.openUrl, blocked: false };
      } catch (e) {
        toast(e.status === 410 ? 'This resource is temporarily unavailable' : e.message || 'Could not open resource');
        return null;
      }
    },
    [ensure, toast]
  );
}
