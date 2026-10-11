// MagicUI + React-Bits-style wave: reveals, orbits, velocity, canvas moments.
// Re-implemented on repo tokens + motion profiles. Canvas work is gated on
// Full motion, pointer capability where apt, and on-screen visibility.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { cn } from './cn';
import { motionOk, finePointer } from './magic';

// ---------- BoxReveal (sliding colour-block headline reveal) ----------
export function BoxReveal({ children, color = 'var(--primary)', delay = 0, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  if (!animate) return <span className={cn('block', className)}>{children}</span>;
  return (
    <span ref={ref} className={cn('relative block overflow-hidden', className)}>
      <motion.span className="block" initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.01, delay: delay + 0.35 }}>
        {children}
      </motion.span>
      {inView && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: color }}
          initial={{ x: '-101%' }}
          animate={{ x: ['-101%', '0%', '101%'] }}
          transition={{ duration: 0.7, delay, times: [0, 0.5, 1], ease: [0.2, 0.7, 0.25, 1] }}
        />
      )}
    </span>
  );
}

// ---------- OrbitingCircles (subject icons orbiting a core) ----------
export function OrbitingCircles({ core, items, radius = 110, duration = 22, className }) {
  void radius;
  void duration;
  return (
    <div className={cn('quiet-card flex flex-wrap items-center justify-center gap-2 p-4', className)}>
      <span className="tnum grid h-11 w-11 place-items-center rounded-[10px] border text-sm font-extrabold" style={{ background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }} aria-hidden="true">
        {core}
      </span>
      {(items || []).map((it, k) => (
        <span key={k} className="tnum rounded-full border px-3 py-1.5 text-xs font-bold tabular-nums" style={{ borderColor: 'var(--line2)', color: 'var(--mut)' }}>
          {it}
        </span>
      ))}
    </div>
  );
}

// ---------- SpinningText (ledger: static free/no-account seal) ----------
export function SpinningText({ text, size = 110, duration = 14, children }) {
  void size;
  void duration;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)', color: 'var(--mut)' }} title={text}>
      <span className="grid h-7 w-7 place-items-center rounded-full border text-sm" style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)' }} aria-hidden="true">
        {children}
      </span>
      Free · no account
    </span>
  );
}

// ---------- VanishInput (rotating placeholders, vanish on submit) ----------
const HERO_PHRASES = ['Try “fractions”…', 'Try “VSSE”…', 'Try “verbal analogy”…', 'Try “reading comprehension”…', 'Try “quant matrices”…'];
export function VanishInput({ onSearch, phrases = HERO_PHRASES }) {
  const [q, setQ] = useState('');
  const [pi, setPi] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!motionOk() || q) return;
    const t = setInterval(() => setPi((v) => (v + 1) % phrases.length), 2600);
    return () => clearInterval(t);
  }, [q, phrases.length]);
  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    if (motionOk()) {
      setGone(true);
      setTimeout(() => {
        onSearch(q.trim());
        setGone(false);
      }, 220);
    } else onSearch(q.trim());
  };
  return (
    <form
      role="search"
      onSubmit={submit}
      className="searchbox flex min-h-[60px] items-center gap-2.5 rounded-2xl border py-0 pl-[18px] pr-2 shadow-lg transition-all focus-within:-translate-y-px"
      style={{ background: 'var(--panel)', borderColor: 'var(--line2)' }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ color: 'var(--faint)', flex: 'none' }}>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="relative min-w-0 flex-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          aria-label="Search study resources"
          className="w-full bg-transparent py-4 text-[17px] outline-none"
        />
        {!q && (
          <span className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-[17px]" style={{ color: 'var(--faint)' }} aria-hidden="true">
            <AnimatePresence mode="wait">
              <motion.span key={pi} initial={motionOk() ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} exit={motionOk() ? { opacity: 0, y: -10 } : undefined} transition={{ duration: 0.3 }}>
                Search papers, decks, topics: {phrases[pi]}
              </motion.span>
            </AnimatePresence>
          </span>
        )}
      </span>
      <motion.button
        type="submit"
        animate={gone ? { scale: 0.9, opacity: 0.4 } : { scale: 1, opacity: 1 }}
        className="min-h-[44px] flex-none rounded-xl px-4 text-sm font-bold"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        Search
      </motion.button>
    </form>
  );
}

// ---------- Typewriter (looping typed lines) ----------
export function Typewriter({ lines, className, speed = 34 }) {
  const [li, setLi] = useState(0);
  const [n, setN] = useState(0);
  const [del, setDel] = useState(false);
  useEffect(() => {
    if (!motionOk()) {
      setN(lines[0]?.length || 0);
      return;
    }
    const cur = lines[li % lines.length] || '';
    let t;
    if (!del && n < cur.length) t = setTimeout(() => setN(n + 1), speed);
    else if (!del) t = setTimeout(() => setDel(true), 1600);
    else if (n > 0) t = setTimeout(() => setN(n - 1), speed / 2);
    else {
      setDel(false);
      setLi((v) => v + 1);
    }
    return () => clearTimeout(t);
  }, [n, del, li, lines, speed]);
  const cur = lines[li % lines.length] || '';
  return (
    <span className={className} aria-label={cur}>
      {(motionOk() ? cur.slice(0, n) : cur) || ' '}
      <span className="typing-caret" aria-hidden="true" />
    </span>
  );
}

// ---------- TextReveal (scroll-linked word opacity) ----------
export function TextReveal({ text, className }) {
  return <p className={className}>{text}</p>;
}

// ---------- HyperText (ledger: plain mono label) ----------
export function HyperText({ text, className, as: Tag = 'span' }) {
  return (
    <Tag className={cn('font-mono', className)} aria-label={text}>
      {text}
    </Tag>
  );
}

// ---------- InteractiveHover (ledger: two button variants, static arrow) ----------
export function InteractiveHover({ to, onClick, children, primary }) {
  const cls = 'inline-flex min-h-[44px] items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold transition-colors hover:brightness-110 active:translate-y-px';
  const style = primary
    ? { background: 'var(--primary)', color: 'var(--primary-foreground)' }
    : { border: '1px solid var(--line2)', background: 'var(--panel)', color: 'var(--txt)' };
  const inner = (
    <>
      <span>{children}</span>
      <span aria-hidden="true">→</span>
    </>
  );
  if (to)
    return (
      <Link to={to} className={cls} style={style}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {inner}
    </button>
  );
}

// ---------- FlipTrue (pure 3D flip wrapper with shine) ----------
export function FlipTrue({ flipped, onFlip, front, back, label }) {
  const [shine, setShine] = useState(false);
  useEffect(() => {
    setShine(motionOk() && finePointer());
  }, []);
  return (
    <div style={{ perspective: 1400 }}>
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={onFlip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onFlip();
          }
        }}
        onMouseMove={
          shine
            ? (e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
              }
            : undefined
        }
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        style={{ transformStyle: 'preserve-3d', cursor: 'pointer' }}
        className="flip-shine relative"
      >
        <div style={{ backfaceVisibility: 'hidden' }}>{front}</div>
        <div className="absolute inset-0" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
          {back}
        </div>
      </motion.div>
    </div>
  );
}

// ---------- ScrollVelocity (ledger: static topic index strip) ----------
export function ScrollVelocity({ children, base = 40, className }) {
  void base;
  return (
    <div className={cn('overflow-hidden border-y py-2.5', className)} style={{ borderColor: 'var(--line)' }}>
      <div className="flex w-max items-center">{children}</div>
    </div>
  );
}

// ---------- Ripple (ledger: plain wrapper) ----------
export function Ripple({ children, className, rings = 3 }) {
  void rings;
  return <span className={cn('relative inline-grid place-items-center', className)}><span className="relative">{children}</span></span>;
}

// ---------- Vortex (ledger: themed panel, canvas removed) ----------
export function Vortex({ children, className }) {
  return (
    <div className={cn('quiet-card', className)}>
      {children}
    </div>
  );
}

// ---------- ShootingStars (ledger: themed panel, starfield canvas retired) ----------
export function ShootingStars({ children, className, density = 90 }) {
  void density;
  return (
    <div className={cn('quiet-card', className)}>
      {children}
    </div>
  );
}

// ---------- FuzzyText (canvas fuzz for the 404) ----------
export function FuzzyText({ text, font = '700 92px Fraunces, Georgia, serif' }) {
  const canvas = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(motionOk());
  }, []);
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    cv.width = 520;
    cv.height = 170;
    const render = (t) => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const layers = on ? 3 : 1;
      for (let k = layers - 1; k >= 0; k--) {
        const jx = on ? Math.sin(t / 240 + k * 2.1) * (k + 1) * 2.4 : 0;
        const jy = on ? Math.cos(t / 310 + k * 1.7) * (k + 1) * 1.8 : 0;
        ctx.fillStyle = k === 0 ? '#E8EDF7' : k === 1 ? 'rgba(56,189,248,0.55)' : 'rgba(245,158,11,0.4)';
        ctx.fillText(text, cv.width / 2 + jx, cv.height / 2 + jy);
      }
    };
    if (!on) {
      render(0);
      return;
    }
    let raf;
    const tick = (t) => {
      render(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, text]);
  return <canvas ref={canvas} role="img" aria-label={text} className="mx-auto block max-w-full" style={{ width: 420 }} />;
}
