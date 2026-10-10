// MagicUI + React-Bits-style wave: reveals, orbits, velocity, canvas moments.
// Re-implemented on repo tokens + motion profiles. Canvas work is gated on
// Full motion, pointer capability where apt, and on-screen visibility.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useAnimationFrame, useInView } from 'framer-motion';
import { cn } from './cn';
import { motionOk, finePointer } from './magic';

function useVisible() {
  const ref = useRef(null);
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((es) => setVis(es[0].isIntersecting), { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, vis];
}

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
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk() && finePointer());
  }, []);
  return (
    <div className={cn('relative mx-auto', className)} style={{ width: radius * 2 + 72, height: radius * 2 + 72 }} aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-dashed" style={{ borderColor: 'var(--line2)' }} />
      <div className="absolute inset-6 rounded-full border" style={{ borderColor: 'var(--line)' }} />
      <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border text-2xl shadow-lg" style={{ background: 'var(--panel)', borderColor: 'var(--acc-line)' }}>
        {core}
      </div>
      <div className={cn('absolute inset-0', animate && 'orbit-spin')} style={animate ? { animationDuration: `${duration}s` } : undefined}>
        {items.map((it, k) => {
          const a = (k / items.length) * Math.PI * 2;
          return (
            <span
              key={k}
              className="absolute grid h-11 w-11 place-items-center rounded-full border text-lg shadow-md"
              style={{
                background: 'var(--panel)',
                borderColor: 'var(--line2)',
                left: `calc(50% + ${Math.cos(a) * radius}px - 22px)`,
                top: `calc(50% + ${Math.sin(a) * radius}px - 22px)`,
              }}
            >
              <span className={animate ? 'orbit-counter' : undefined} style={animate ? { animationDuration: `${duration}s` } : undefined}>
                {it}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------- SpinningText (circular rotating badge) ----------
export function SpinningText({ text, size = 110, duration = 14, children }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  const [id] = useState(() => `st-${Math.floor(Math.random() * 1e6)}`);
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" className={animate ? 'absolute inset-0 spin-slow' : 'absolute inset-0'} style={animate ? { animationDuration: `${duration}s` } : undefined}>
        <defs>
          <path id={id} d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
        </defs>
        <text style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2.5, fill: 'var(--mut)' }}>
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </svg>
      <span className="grid h-11 w-11 place-items-center rounded-full border text-xl" style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)' }}>
        {children}
      </span>
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
                Search papers, decks, topics — {phrases[pi]}
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
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = String(text).split(' ');
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  if (!animate) return <p className={className}>{text}</p>;
  return (
    <p ref={ref} className={className}>
      {words.map((w, k) => (
        <Word key={k} progress={scrollYProgress} range={[k / words.length, (k + 1) / words.length]} word={w} last={k === words.length - 1} />
      ))}
    </p>
  );
}
function Word({ progress, range, word, last }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return (
    <motion.span style={{ opacity }}>
      {word}
      {last ? '' : ' '}
    </motion.span>
  );
}

// ---------- HyperText (decrypt reveal on first view) ----------
const HY_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#*+?=';
export function HyperText({ text, className, as: Tag = 'span' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [out, setOut] = useState(null);
  useEffect(() => {
    if (!inView || !motionOk()) {
      setOut(text);
      return;
    }
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 900);
      setOut(text.split('').map((c, i) => (c === ' ' || i / text.length < k ? c : HY_GLYPHS[Math.floor(Math.random() * HY_GLYPHS.length)])).join(''));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, text]);
  return (
    <Tag ref={ref} className={cn('font-mono', className)} aria-label={text}>
      {out ?? text}
    </Tag>
  );
}

// ---------- InteractiveHover (arrow-slide button) ----------
export function InteractiveHover({ to, onClick, children, primary }) {
  const cls = 'ih-btn group inline-flex min-h-[44px] items-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:-translate-y-px';
  const style = primary
    ? { background: 'var(--primary)', color: 'var(--primary-foreground)' }
    : { borderColor: 'var(--line2)', background: 'var(--panel)' };
  const inner = (
    <>
      <span className="ih-label">{children}</span>
      <span className="ih-arrows" aria-hidden="true">
        <span>→</span>
        <span>→</span>
      </span>
    </>
  );
  if (to)
    return (
      <Link to={to} className={cn(cls, !primary && 'border')} style={style}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cn(cls, !primary && 'border')} style={style}>
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

// ---------- ScrollVelocity (scroll-reactive marquee ribbon) ----------
export function ScrollVelocity({ children, base = 40, className }) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const [dir, setDir] = useState(1);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(motionOk());
  }, []);
  const vel = useRef(0);  useEffect(() => scrollY.on('change', (v, prev) => {
    vel.current = v - (prev ?? v);
    setDir(vel.current >= 0 ? 1 : -1);
  }), [scrollY]);
  useAnimationFrame((_, delta) => {
    if (!on) return;
    const boost = Math.min(4, 1 + Math.abs(vel.current) / 40);
    vel.current *= 0.92;
    baseX.set(baseX.get() + dir * (base / 1000) * delta * boost);
  });
  const x = useTransform(baseX, (v) => `${-(((v % 100) + 100) % 100)}%`);
  const row = (
    <div className="flex w-max shrink-0 items-center">
      {children}
      {children}
    </div>
  );
  if (!on) return <div className={cn('overflow-hidden', className)}><div className="flex w-max">{children}</div></div>;
  return (
    <div className={cn('marquee overflow-hidden', className)}>
      <motion.div className="flex w-max" style={{ x }}>
        {row}
        {row}
      </motion.div>
    </div>
  );
}

// ---------- Ripple (expanding rings behind a CTA) ----------
export function Ripple({ children, className, rings = 3 }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(motionOk());
  }, []);
  return (
    <span className={cn('relative inline-grid place-items-center', className)}>
      {on &&
        Array.from({ length: rings }, (_, k) => (
          <span key={k} aria-hidden="true" className="ripple-ring absolute rounded-full border" style={{ borderColor: 'var(--acc-line)', animationDelay: `${k * 1.1}s` }} />
        ))}
      <span className="relative">{children}</span>
    </span>
  );
}

// ---------- Vortex (canvas particle swirl for CTA bands) ----------
export function Vortex({ children, className }) {
  const [ref, vis] = useVisible();
  const canvas = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(motionOk());
  }, []);
  useEffect(() => {
    if (!on || !vis) return;
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let raf;
    let w;
    let h;
    let t = 0;
    const fit = () => {
      const r = cv.parentElement.getBoundingClientRect();
      w = cv.width = Math.floor(r.width);
      h = cv.height = Math.floor(r.height);
    };
    fit();
    const N = 70;
    const ps = Array.from({ length: N }, () => ({ a: Math.random() * Math.PI * 2, r: 40 + Math.random() * 200, s: 0.004 + Math.random() * 0.012, sz: Math.random() * 2 + 0.6 }));
    const tick = () => {
      t++;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      for (const p of ps) {
        p.a += p.s * (1 + Math.sin(t / 60) * 0.3);
        const x = cx + Math.cos(p.a) * p.r;
        const y = cy + Math.sin(p.a) * p.r * 0.45;
        ctx.beginPath();
        ctx.arc(x, y, p.sz, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(91,140,255,0.5)';
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
  }, [on, vis]);
  return (
    <div ref={ref} className={cn('relative overflow-hidden rounded-3xl border', className)} style={{ background: '#0B1220', borderColor: '#243049' }}>
      {on && <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />}
      <div className="relative">{children}</div>
    </div>
  );
}

// ---------- ShootingStars (canvas starfield + meteors) ----------
export function ShootingStars({ children, className, density = 90 }) {
  const [ref, vis] = useVisible();
  const canvas = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(motionOk());
  }, []);
  useEffect(() => {
    if (!on || !vis) return;
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let raf;
    let w;
    let h;
    const fit = () => {
      const r = cv.parentElement.getBoundingClientRect();
      w = cv.width = Math.floor(r.width);
      h = cv.height = Math.floor(r.height);
    };
    fit();
    const stars = Array.from({ length: density }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.3, p: Math.random() * Math.PI * 2 }));
    let meteors = [];
    let t = 0;
    const tick = () => {
      t++;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        ctx.globalAlpha = 0.35 + Math.sin(t / 30 + s.p) * 0.25;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = '#cdd8f3';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (t % 130 === 0 && meteors.length < 3) meteors.push({ x: Math.random() * w * 0.7 + w * 0.2, y: -20, vx: -4 - Math.random() * 3, vy: 5 + Math.random() * 2, life: 1 });
      meteors = meteors.filter((m) => m.life > 0 && m.y < h + 40);
      for (const m of meteors) {
        m.x += m.vx;
        m.y += m.vy;
        m.life -= 0.02;
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12);
        g.addColorStop(0, `rgba(147,168,232,${0.9 * m.life})`);
        g.addColorStop(1, 'rgba(147,168,232,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 12, m.y - m.vy * 12);
        ctx.stroke();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
    };
  }, [on, vis, density]);
  return (
    <div ref={ref} className={cn('relative overflow-hidden rounded-3xl border', className)} style={{ background: '#0B1220', borderColor: '#243049' }}>
      {on && <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />}
      <div className="relative">{children}</div>
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
