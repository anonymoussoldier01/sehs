import { useCallback, useEffect, useRef, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';
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

// ---------- BlurFade (entrance) ----------
export function BlurFade({ children, delay = 0, className, y = 16 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.7, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
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

// ---------- ShimmerButton ----------
export function ShimmerButton({ children, className, ...props }) {
  return (
    <button
      {...props}
      className={cn(
        'btn-magic btn-pulse relative inline-flex min-h-[42px] items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-transform active:scale-[.97]',
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

// ---------- Particles (lightweight canvas) ----------
export function Particles({ className, density = 60 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    let w, h, raf, running = true;
    const dots = Array.from({ length: density }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.8 + 0.6,
      vy: -(Math.random() * 0.0006 + 0.0002),
      vx: (Math.random() - 0.5) * 0.0003,
      tw: Math.random() * Math.PI * 2,
    }));
    const size = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      w = canvas.width = rect.width;
      h = canvas.height = rect.height;
    };
    size();
    window.addEventListener('resize', size);
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      if (running) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);
    const frame = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x = (d.x + d.vx + 1) % 1;
        d.y += d.vy;
        if (d.y < -0.02) {
          d.y = 1.02;
          d.x = Math.random();
        }
        d.tw += 0.03;
        ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(d.tw));
        ctx.fillStyle = '#7d9bf0';
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', size);
    };
  }, [density]);
  return <canvas ref={ref} aria-hidden="true" className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} />;
}

// ---------- Meteors ----------
export function Meteors({ count = 5 }) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <div className="meteors" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="meteor"
          style={{ left: `${8 + i * 19}%`, animationDelay: `${(i * 1.7) % 7}s`, animationDuration: `${6 + (i % 3)}s` }}
        />
      ))}
    </div>
  );
}

// ---------- AnimatedList (items slide in one after another) ----------
export function AnimatedList({ items, className, renderItem, step = 0.09 }) {
  return (
    <div className={className}>
      {(items || []).map((item, i) => (
        <motion.div
          key={item.key || i}
          initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ duration: 0.45, delay: Math.min(i, 8) * step, ease: [0.2, 0.7, 0.25, 1] }}
        >
          {renderItem ? renderItem(item, i) : item}
        </motion.div>
      ))}
    </div>
  );
}

// ---------- SparklesText (twinkling stars around text) ----------
export function SparklesText({ children, className, count = 6 }) {
  const [seeds, setSeeds] = useState([]);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setSeeds(Array.from({ length: count }, () => ({ left: Math.random() * 100, delay: Math.random() * 2.4, size: 8 + Math.random() * 8 })));
  }, [count]);
  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      {seeds.map((s, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="sparkle-star"
          style={{ left: `${s.left}%`, animationDelay: `${s.delay}s`, fontSize: s.size }}
        >
          ✦
        </span>
      ))}
    </span>
  );
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

// ---------- Dock (mobile shortcut bar) ----------
export function Dock() {
  return (
    <nav
      aria-label="Quick sections"
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-1 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl lg:hidden"
      style={{ background: 'color-mix(in srgb, var(--panel) 92%, transparent)', borderColor: 'var(--line2)', paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
    >
      {[
        ['/', '⌂', 'Home'],
        ['/search', '⚲', 'Search'],
        ['/study', '✎', 'Study'],
        ['/mocks', '◷', 'Mocks'],
      ].map(([to, ico, label]) => (
        <Link
          key={to}
          to={to}
          className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold transition-colors"
          style={{ color: 'var(--mut)' }}
        >
          <span className="text-lg leading-none">{ico}</span>
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
      className="glare group flex min-h-[190px] flex-col gap-2 rounded-2xl border p-[18px] shadow-sm transition-all hover:-translate-y-[3px] hover:shadow-lg"
      style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          className="grid h-[42px] w-[42px] place-items-center rounded-xl border"
          style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)', color: 'var(--acc)' }}
        >
          {icon}
        </span>
        {badge && (
          <span
            className="whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-bold"
            style={{ background: 'var(--bg2)', borderColor: 'var(--line)', color: 'var(--mut)' }}
          >
            {badge}
          </span>
        )}
      </span>
      <h3 className="mt-1 text-[15.5px] font-bold leading-snug">{title}</h3>
      <p className="text-[13px]" style={{ color: 'var(--mut)' }}>
        {sub}
      </p>
      <span className="mt-auto text-[13.5px] font-bold" style={{ color: 'var(--acc)' }}>
        Study <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
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

// ---------- SpotlightCard (Aceternity Spotlight + MagicUI MagicCard) ----------
// Cursor-following radial highlight + border glow. Desktop pointers only.
export function SpotlightCard({ children, className, spotlight = 'rgba(56,189,248,0.14)', ...props }) {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!finePointer() || !motionOk()) return;
    setOn(true);
  }, []);
  const onMove = useCallback(
    (e) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      mx.set((e.clientX - r.left) / Math.max(1, r.width));
      my.set((e.clientY - r.top) / Math.max(1, r.height));
    },
    [mx, my]
  );
  const bg = useTransform([mx, my], ([x, y]) => `radial-gradient(420px circle at ${x * 100}% ${y * 100}%, ${spotlight}, transparent 65%)`);
  return (
    <motion.div
      ref={ref}
      onMouseMove={on ? onMove : undefined}
      whileHover={on ? { y: -3 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      {on && <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: bg }} />}
      {children}
    </motion.div>
  );
}

// ---------- StarBorder / ShineBorder (MagicUI + React Bits) ----------
// Animated conic-gradient border for one featured surface per screen, max.
export function StarBorder({ children, className, speed = 5 }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  return (
    <div className={cn('relative rounded-2xl p-[1.5px]', className)} style={{ background: 'var(--line)' }}>
      {animate && (
        <span
          aria-hidden="true"
          className="star-border-beam absolute inset-[-1.5px] rounded-2xl"
          style={{ animationDuration: `${speed}s` }}
        />
      )}
      <div className="relative rounded-2xl" style={{ background: 'var(--panel)' }}>
        {children}
      </div>
    </div>
  );
}

// ---------- TextGenerate (Aceternity TextGenerateEffect) ----------
// Word-by-word blur + rise on first view. Marketing/hero surfaces only.
export function TextGenerate({ words, className, stagger = 0.05 }) {
  const text = Array.isArray(words) ? words.join(' ') : String(words || '');
  const parts = text.split(' ');
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  if (!animate) return <span className={className}>{text}</span>;
  return (
    <span ref={ref} className={className} aria-label={text}>
      {parts.map((w, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="inline-block"
          initial={{ opacity: 0, filter: 'blur(8px)', y: 8 }}
          animate={inView ? { opacity: 1, filter: 'blur(0px)', y: 0 } : {}}
          transition={{ duration: 0.45, delay: i * stagger, ease: [0, 0, 0.2, 1] }}
        >
          {w}
          {i < parts.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  );
}

// ---------- BlurText (React Bits) ----------
// Scroll-linked word blur reveal for section headings. Once only.
export function BlurText({ children, className, as: Tag = 'h2', stagger = 0.04 }) {
  const text = typeof children === 'string' ? children : '';
  const words = text.split(' ');
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  if (!animate || !text) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="inline-block"
          initial={{ opacity: 0.15, filter: 'blur(6px)' }}
          animate={inView ? { opacity: 1, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.4, delay: i * stagger }}
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </Tag>
  );
}

// ---------- Magnet (React Bits) ----------
// Gentle pull toward the cursor; springs back on leave. pointer:fine only.
export function Magnet({ children, strength = 18, className }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 250, damping: 18, mass: 0.6 });
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (finePointer() && motionOk()) setOn(true);
  }, []);
  if (!on) return <span className={cn('inline-block', className)}>{children}</span>;
  return (
    <motion.span
      ref={ref}
      className={cn('inline-block', className)}
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set(((e.clientX - (r.left + r.width / 2)) / r.width) * strength);
        y.set(((e.clientY - (r.top + r.height / 2)) / r.height) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

// ---------- ClickSpark (React Bits) ----------
// Brief spark burst on click. Marketing buttons only, never exam/viewer.
export function ClickSpark({ children, className, onClick, color = 'var(--primary)' }) {
  const [sparks, setSparks] = useState([]);
  const id = useRef(0);
  const fire = useCallback(
    (e) => {
      if (motionOk() && finePointer()) {
        const r = e.currentTarget.getBoundingClientRect();
        const s = { id: ++id.current, x: e.clientX - r.left, y: e.clientY - r.top };
        setSparks((p) => [...p.slice(-11), s]);
        setTimeout(() => setSparks((p) => p.filter((q) => q.id !== s.id)), 550);
      }
      onClick?.(e);
    },
    [onClick]
  );
  return (
    <span className={cn('relative inline-block overflow-visible', className)} onClick={fire}>
      {children}
      {sparks.map((s) => (
        <span key={s.id} aria-hidden="true" className="click-spark" style={{ left: s.x, top: s.y, '--spark': color }}>
          {Array.from({ length: 8 }, (_, k) => (
            <i key={k} style={{ '--a': `${k * 45}deg` }} />
          ))}
        </span>
      ))}
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

// ---------- Tilt (subtle 3D hover; desktop only) ----------
export function Tilt({ children, className, max = 6 }) {
  const ref = useRef(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 260, damping: 20 });
  const sry = useSpring(ry, { stiffness: 260, damping: 20 });
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (finePointer() && motionOk()) setOn(true);
  }, []);
  if (!on) return <div className={className}>{children}</div>;
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
      }}
      onMouseLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
    </motion.div>
  );
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
