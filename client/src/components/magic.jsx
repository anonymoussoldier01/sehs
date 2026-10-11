import { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { cn } from './cn';
import { readMotionSetting } from '../lib/motion';

export function motionOk() {  try {
    const s = readMotionSetting();
    if (s !== 'full') return false;
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
export function finePointer() {
  try {
    return window.matchMedia?.('(pointer: fine)').matches ?? false;
  } catch {
    return false;
  }
}

// ---------- AnimatedGrid (auto-animate list transitions) ----------
export function AnimatedGrid({ children, className }) {
  const [parent] = useAutoAnimate({ duration: 260, easing: 'cubic-bezier(.2,.7,.25,1)' });
  return (
    <div ref={parent} className={className}>
      {children}
    </div>
  );
}

// ---------- BlurFade (ledger: section-level calm only, no blur choreography) ----------
export function BlurFade({ children, delay = 0, className, y = 16 }) {
  void delay;
  void y;
  return <div className={className}>{children}</div>;
}

// ---------- AuroraText ----------
export function AuroraText({ children, className }) {
  return <span className={cn('aurora-text', className)}>{children}</span>;
}

// ---------- ShinyBadge ----------
// Single pill label: real status text, no glow stack, no animated sheen.
export function ShinyBadge({ children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold tracking-wide shadow-sm',
        className
      )}
      style={{ background: 'var(--panel)', borderColor: 'var(--line2)', color: 'var(--mut)' }}
    >
      <span
        className="h-[7px] w-[7px] flex-none rounded-full"
        style={{ background: 'var(--acc)' }}
        aria-hidden="true"
      />
      <span>{children}</span>
    </span>
  );
}

// ---------- WordRotate ----------
export function WordRotate({ words, interval = 2400, className }) {
  const [i, setI] = useState(0);
  const [swap, setSwap] = useState(false);
  useEffect(() => {
    if (!words?.length || words.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      setSwap(true);
      setTimeout(() => {
        setI((v) => (v + 1) % words.length);
        setSwap(false);
      }, 280);
    }, interval);
    return () => clearInterval(t);
  }, [words, interval]);
  return (
    <span
      data-rotate
      className={cn(swap && 'swap', className)}
      style={{ display: 'inline-block', minWidth: '2ch', transition: 'opacity .28s, filter .28s, transform .28s' }}
    >
      {words[i]}
    </span>
  );
}

// ---------- ShimmerButton (ledger: solid primary, no beam/pulse) ----------
export function ShimmerButton({ children, className, ...props }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold transition-colors hover:brightness-110 active:translate-y-px',
        className
      )}
      style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
    >
      {children}
    </button>
  );
}

// ---------- Marquee ----------
export function Marquee({ children, className, duration = 36 }) {
  const items = [children, children];
  return (
    <div className={cn('marquee', className)}>
      <div className="marquee-track" style={{ animationDuration: `${duration}s` }}>
        {items.map((c, i) => (
          <div key={i} className="flex shrink-0 gap-2.5 pr-2.5" aria-hidden={i === 1}>
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- NumberTicker ----------
export function NumberTicker({ value, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const target = Number(value) || 0;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(target);
      return;
    }
    let raf;
    const t0 = performance.now();
    const dur = 1200;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      setN(Math.round(target * (1 - Math.pow(2, -10 * k))));
      if (k < 1) raf = requestAnimationFrame(step);
      else setN(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {n.toLocaleString()}
    </span>
  );
}

// ---------- Particles: retired (ledger uses static dot-grid; canvas removed for perf) ----------
export function Particles() {
  return null;
}

// ---------- Meteors: retired ----------
export function Meteors() {
  return null;
}

// ---------- AnimatedList (ledger: instant list, layout animation only via auto-animate parent) ----------
export function AnimatedList({ items, className, renderItem, step = 0.09 }) {
  void step;
  return (
    <div className={className}>
      {(items || []).map((item, i) => (
        <div key={item.key || i}>{renderItem ? renderItem(item, i) : item}</div>
      ))}
    </div>
  );
}

// ---------- SparklesText: retired twinkles, plain text ----------
export function SparklesText({ children, className, count = 6 }) {
  void count;
  return <span className={cn('inline-block', className)}>{children}</span>;
}

// ---------- TypingAnimation (stream-in text, click to complete) ----------
export function TypingText({ text, speed = 14, className }) {
  const [n, setN] = useState(0);
  const full = String(text || '');
  useEffect(() => {
    setN(0);
    if (!full) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(full.length);
      return;
    }
    const t = setInterval(() => {
      setN((v) => {
        if (v >= full.length) {
          clearInterval(t);
          return v;
        }
        return v + 1;
      });
    }, speed);
    return () => clearInterval(t);
  }, [full, speed]);
  return (
    <span className={className} onClick={() => setN(full.length)} title="Click to show all">
      {full.slice(0, n)}
      {n < full.length && <span className="typing-caret" aria-hidden="true" />}
    </span>
  );
}

// ---------- Dock (mobile shortcut bar, Lucide icons, solid panel) ----------
export function Dock() {
  return (
    <nav
      aria-label="Quick sections"
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-1 rounded-[14px] border p-1.5 shadow-xl lg:hidden"
      style={{ background: 'var(--panel)', borderColor: 'var(--line2)', paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
    >
      {[
        ['/', 'Home'],
        ['/search', 'Search'],
        ['/study', 'Study'],
        ['/mocks', 'Mocks'],
      ].map(([to, label]) => (
        <Link
          key={to}
          to={to}
          className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[10px] text-[11px] font-bold transition-colors"
          style={{ color: 'var(--mut)' }}
        >
          <span className="tnum text-[13px] font-extrabold" style={{ color: 'var(--acc)' }} aria-hidden="true">
            {label === 'Home' ? '01' : label === 'Search' ? '02' : label === 'Study' ? '03' : '04'}
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function DeckCard({ to, icon, title, sub, badge }) {
  return (
    <Link
      to={to}
      className="quiet-card group flex min-h-[176px] flex-col gap-2 p-[18px] transition-colors"
    >
      <span className="flex items-start justify-between gap-2">
        <span
          className="grid h-[40px] w-[40px] place-items-center rounded-[10px] border"
          style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)', color: 'var(--acc)' }}
        >
          {icon}
        </span>
        {badge && (
          <span
            className="tnum whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-bold tabular-nums"
            style={{ background: 'var(--bg2)', borderColor: 'var(--line)', color: 'var(--mut)' }}
          >
            {badge}
          </span>
        )}
      </span>
      <h3 className="mt-1 text-[15.5px] font-bold leading-snug">{title}</h3>
      <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--mut)' }}>
        {sub}
      </p>
      <span className="mt-auto text-[13.5px] font-bold" style={{ color: 'var(--acc)' }}>
        Study <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

// ---------- Empty / loading ----------
export function Skeleton({ className }) {
  return (
    <div className={cn('rounded-2xl border p-4', className)} style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      <div className="h-4 w-3/5 animate-pulse rounded-lg" style={{ background: 'var(--bg2)' }} />
      <div className="mt-2.5 h-3 w-[90%] animate-pulse rounded-lg" style={{ background: 'var(--bg2)' }} />
    </div>
  );
}

export function Empty({ title, msg, children }) {
  return (
    <div
      className="rounded-2xl border border-dashed px-6 py-12 text-center"
      style={{ borderColor: 'var(--line2)', background: 'var(--panel)', color: 'var(--mut)' }}
    >
      <div
        className="mx-auto grid h-16 w-16 -rotate-3 place-items-center rounded-[20px] border"
        style={{ background: 'var(--bg2)', borderColor: 'var(--line)', color: 'var(--faint)' }}
        aria-hidden="true"
      >
        <SearchIcon className="h-7 w-7" />
      </div>
      <h2 className="mb-1.5 mt-3.5 font-display text-xl font-bold" style={{ color: 'var(--txt)' }}>
        {title}
      </h2>
      <p className="mx-auto max-w-[52ch] text-sm">{msg}</p>
      {children}
    </div>
  );
}

// ============================================================================
// Second-wave magic: Magic UI + Aceternity UI + React Bits patterns,
// re-implemented on this repo's tokens + motion system (docs/MOTION.md).
// Every effect below renders statically when motion is Reduced/Off.
// ============================================================================

// ---------- SpotlightCard (ledger: quiet card, no cursor tracking) ----------
export function SpotlightCard({ children, className, spotlight = 'rgba(56,189,248,0.14)', ...props }) {
  void spotlight;
  return (
    <div className={cn('quiet-card', className)} {...props}>
      {children}
    </div>
  );
}

// ---------- StarBorder (ledger: single static featured frame) ----------
export function StarBorder({ children, className, speed = 5 }) {
  void speed;
  return (
    <div className={cn('beam-feature quiet-card', className)}>
      {children}
    </div>
  );
}

// ---------- TextGenerate (ledger: plain text) ----------
export function TextGenerate({ words, className, stagger = 0.05 }) {
  void stagger;
  const text = Array.isArray(words) ? words.join(' ') : String(words || '');
  return <span className={className}>{text}</span>;
}

// ---------- BlurText (ledger: plain heading) ----------
export function BlurText({ children, className, as: Tag = 'h2', stagger = 0.04 }) {
  void stagger;
  return <Tag className={className}>{children}</Tag>;
}

// ---------- Magnet (ledger: static wrapper) ----------
export function Magnet({ children, strength = 18, className }) {
  void strength;
  return <span className={cn('inline-block', className)}>{children}</span>;
}

// ---------- ClickSpark (ledger: plain click-through) ----------
export function ClickSpark({ children, className, onClick, color = 'var(--primary)' }) {
  void color;
  return (
    <span className={cn('inline-block', className)} onClick={onClick}>
      {children}
    </span>
  );
}

// ---------- AnimatedTabs (Aceternity Tabs) ----------
// Sliding-pill tab list with shared layout indicator.
export function AnimatedTabs({ tabs, value, onChange, label }) {
  return (
    <div className="inline-flex gap-0.5 rounded-full border p-1" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }} role="tablist" aria-label={label}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className="relative min-h-[38px] rounded-full px-3.5 text-[13px] font-bold transition-colors"
            style={{ color: active ? 'var(--primary-foreground)' : 'var(--mut)' }}
          >
            {active && (
              <motion.span
                layoutId={label ? `tab-pill-${label}` : 'tab-pill'}
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--primary)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- AnimatedTooltip (Aceternity) ----------
// Cursor-lifting tooltip with optional kbd shortcut hint. For icon buttons.
export function AnimatedTooltip({ tip, shortcut, children }) {
  const [show, setShow] = useState(false);
  const [above, setAbove] = useState(true);
  const ref = useRef(null);
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => {
        const r = ref.current?.getBoundingClientRect();
        setAbove((r?.top ?? 200) > 120);
        setShow(true);
      }}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && tip && (
        <motion.span
          role="tooltip"
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-lg"
          style={{
            background: 'var(--toast-bg)',
            color: 'var(--toast-fg)',
            borderColor: 'var(--line2)',
            ...(above ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
          }}
          initial={animate ? { opacity: 0, y: above ? 4 : -4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {tip}
          {shortcut && (
            <kbd className="rounded border px-1 font-mono text-[10px]" style={{ borderColor: 'currentColor', opacity: 0.8 }}>
              {shortcut}
            </kbd>
          )}
        </motion.span>
      )}
    </span>
  );
}

// ---------- DotPattern / GridPattern (MagicUI) ----------
// Subtle SVG backgrounds with radial fade. Decorative only (aria-hidden).
export function DotPattern({ className, dot = 'var(--line2)' }) {
  return (
    <svg aria-hidden="true" className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}>
      <defs>
        <pattern id="sehs-dots" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" fill={dot} opacity="0.55" />
        </pattern>
        <radialGradient id="sehs-dotfade">
          <stop offset="35%" stopColor="black" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <mask id="sehs-dotmask">
          <rect width="100%" height="100%" fill="url(#sehs-dotfade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#sehs-dots)" mask="url(#sehs-dotmask)" />
    </svg>
  );
}

export function GridPattern({ className, line = 'var(--line)' }) {
  return (
    <svg aria-hidden="true" className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}>
      <defs>
        <pattern id="sehs-grid" width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M 44 0 L 0 0 0 44" fill="none" stroke={line} strokeWidth="1" opacity="0.6" />
        </pattern>
        <radialGradient id="sehs-gridfade">
          <stop offset="30%" stopColor="black" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <mask id="sehs-gridmask">
          <rect width="100%" height="100%" fill="url(#sehs-gridfade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#sehs-grid)" mask="url(#sehs-gridmask)" />
    </svg>
  );
}

// ---------- Tilt (ledger: static wrapper, 3D hover retired) ----------
export function Tilt({ children, className, max = 6 }) {
  void max;
  return <div className={className}>{children}</div>;
}

// ---------- Confetti (restrained: perfect-score reward only) ----------
// Lightweight canvas burst, self-cleaning. Never renders under reduced motion.
export function Confetti({ fire }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!fire || !motionOk()) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = (canvas.width = Math.min(560, window.innerWidth));
    const H = (canvas.height = 320);
    const colors = ['#38BDF8', '#10B981', '#FDE68A', '#F59E0B', '#5b8cff'];
    const parts = Array.from({ length: 90 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 60,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 8 - 2,
      s: Math.random() * 6 + 3,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf;
    let frames = 0;
    const tick = () => {
      frames++;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.22;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - frames / 110);
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      }
      if (frames < 110) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  if (!fire) return null;
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none mx-auto block" style={{ maxWidth: 560 }} />;
}
