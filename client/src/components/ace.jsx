// Aceternity-style wave: bento, scroll scenes, cards, beams, loaders, buttons.
// Re-implemented on repo tokens + motion profiles (docs/MOTION.md).
// Ambient/canvas pieces render only under Full motion + visible tab.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView, useMotionValue } from 'framer-motion';
import { cn } from './cn';
import { motionOk, finePointer } from './magic';

// ---------- BentoGrid + BentoCard (aceternity bento, live skeleton headers) ----------
export function BentoGrid({ children, className }) {
  return <div className={cn('grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}
export function BentoCard({ to, title, desc, header, span, badge }) {
  const [spot, setSpot] = useState(false);
  useEffect(() => {
    if (finePointer() && motionOk()) setSpot(true);
  }, []);
  return (
    <Link
      to={to}
      onMouseMove={
        spot
          ? (e) => {
              const el = e.currentTarget;
              const r = el.getBoundingClientRect();
              el.style.setProperty('--mx', `${e.clientX - r.left}px`);
              el.style.setProperty('--my', `${e.clientY - r.top}px`);
            }
          : undefined
      }
      className={cn('bento-spot group relative flex flex-col overflow-hidden rounded-2xl border p-[18px] shadow-sm transition-all hover:-translate-y-[3px] hover:shadow-lg', span)}
      style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
    >
      {badge && (
        <span className="absolute right-3 top-3 rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider" style={{ borderColor: 'var(--acc-line)', color: 'var(--acc)', background: 'var(--acc-soft)' }}>
          {badge}
        </span>
      )}
      <div className="bento-head relative mb-3 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--line)', background: 'var(--bg2)' }}>
        {header}
      </div>
      <h3 className="font-display text-[16px] font-bold">{title}</h3>
      <p className="mb-3 mt-1 text-[13px]" style={{ color: 'var(--mut)' }}>{desc}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 text-[13.5px] font-bold" style={{ color: 'var(--acc)' }}>
        Open <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}

// Mini live headers for the bento (tiny product previews, clearly illustrative).
export function MiniTimer() {
  const [s, setS] = useState(3599);
  useEffect(() => {
    if (!motionOk()) return;
    const t = setInterval(() => setS((v) => (v > 0 ? v - 1 : 3599)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return (
    <div className="flex h-[110px] flex-col justify-center gap-2 p-4">
      <div className="tnum font-display text-3xl font-extrabold">{mm}:{ss}</div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
          <span key={k} className="h-7 w-5 rounded-md border text-center text-[11px] font-bold leading-7" style={{ borderColor: k < 5 ? 'var(--acc)' : 'var(--line2)', background: k < 5 ? 'var(--acc-soft)' : 'var(--panel)', color: k < 5 ? 'var(--acc)' : 'var(--faint)' }}>
            {k + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
export function MiniViewer() {
  return (
    <div className="flex h-[110px] flex-col gap-1.5 p-4">
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--bad)' }} />
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--warn)' }} />
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--ok)' }} />
        <span className="ml-2 h-2 flex-1 rounded" style={{ background: 'var(--line)' }} />
      </div>
      {[92, 98, 84, 95, 60].map((w, k) => (
        <div key={k} className="h-2 rounded" style={{ width: `${w}%`, background: k === 1 ? 'var(--mark-bg)' : 'var(--line)', opacity: 0.85 }} />
      ))}
    </div>
  );
}
export function MiniDeck() {
  const cards = [
    { r: '-8deg', x: '-14px' },
    { r: '5deg', x: '12px' },
    { r: '-2deg', x: '0px' },
  ];
  return (
    <div className="relative h-[110px]">
      {cards.map((c, k) => (
        <div key={k} className="absolute left-1/2 top-3 h-[74px] w-[120px] rounded-xl border p-2 text-center shadow-sm transition-transform hover:-translate-y-1" style={{ background: 'var(--panel)', borderColor: 'var(--line2)', transform: `translateX(calc(-50% + ${c.x})) rotate(${c.r})` }}>
          <div className="mx-auto h-1.5 w-16 rounded" style={{ background: 'var(--line)' }} />
          <div className="mx-auto mt-1.5 h-1.5 w-10 rounded" style={{ background: 'var(--acc-soft)' }} />
        </div>
      ))}
    </div>
  );
}
export function MiniPen() {
  return (
    <div className="flex h-[110px] flex-col justify-center gap-2 p-4">
      {[88, 96, 72].map((w, k) => (
        <div key={k} className="h-2.5 rounded" style={{ width: `${w}%`, background: 'var(--line)' }} />
      ))}
      <span className="typing-caret" aria-hidden="true" />
    </div>
  );
}
export function MiniBars() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!motionOk()) return;
    const t = setInterval(() => setTick((v) => v + 1), 1400);
    return () => clearInterval(t);
  }, []);
  const vals = [42, 68, 55, 80, 63, 74, 90].map((v, k) => (v + tick * 7 + k * 13) % 60 + 30);
  return (
    <div className="flex h-[110px] items-end justify-center gap-1.5 p-4">
      {vals.map((v, k) => (
        <span key={k} className="w-5 rounded-t-md transition-all duration-500" style={{ height: `${v}%`, background: k === vals.length - 1 ? 'var(--primary)' : 'var(--acc-soft)', border: '1px solid var(--acc-line)' }} />
      ))}
    </div>
  );
}
export function MiniLines() {
  return (
    <div className="flex h-[110px] flex-col justify-center gap-2 rounded-xl p-4" style={{ background: 'var(--ok-paper, #FBFAF6)' }}>
      <p className="font-display text-[13px] font-bold">“The river keeps receipts…”</p>
      {['A', 'B', 'C'].map((o, k) => (
        <div key={k} className="flex items-center gap-2 rounded-lg border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: k === 0 ? 'var(--ok)' : 'var(--line2)', background: k === 0 ? 'var(--ok-bg)' : 'var(--panel)' }}>
          <span>{o}.</span><span className="h-1.5 flex-1 rounded" style={{ background: 'var(--line)' }} />
        </div>
      ))}
    </div>
  );
}

// ---------- ContainerScroll (scroll-unfolds hero visual) ----------
export function ContainerScroll({ title, sub, children }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const rotate = useTransform(scrollYProgress, [0, 0.55], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.55], [0.92, 1]);
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  return (
    <div ref={ref} className="mx-auto max-w-[880px] px-5 pb-4 pt-10 text-center">
      <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
      {sub && <p className="mx-auto mt-2 max-w-[60ch] text-[15px]" style={{ color: 'var(--mut)' }}>{sub}</p>}
      <div style={{ perspective: 1200 }}>
        <motion.div
          style={animate ? { rotateX: rotate, scale } : undefined}
          className="mt-6 overflow-hidden rounded-2xl border text-left shadow-2xl"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

// ---------- TracingBeam (scroll beam for long reads) ----------
export function TracingBeam({ children, className }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.6'] });
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  return (
    <div ref={ref} className={cn('relative', className)}>
      <div aria-hidden="true" className="absolute -left-5 top-0 hidden h-full w-[3px] overflow-hidden rounded-full md:block" style={{ background: 'var(--line)' }}>
        {animate ? (
          <motion.div className="w-full origin-top rounded-full" style={{ scaleY: scrollYProgress, height: '100%', background: 'linear-gradient(to bottom, var(--primary), #6d28d9)' }} />
        ) : (
          <div className="h-full w-full" style={{ background: 'var(--acc-line)' }} />
        )}
      </div>
      {children}
    </div>
  );
}

// ---------- StickyScroll (sticky stage + scrolling steps) ----------
export function StickyScroll({ steps }) {
  const [active, setActive] = useState(0);
  const refs = useRef([]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            const k = Number(e.target.dataset.k);
            setActive(k);
          }
        });
      },
      { rootMargin: '-40% 0px -40% 0px' }
    );
    refs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [steps.length]);
  const cur = steps[Math.min(active, steps.length - 1)];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-16 py-6">
        {steps.map((s, k) => (
          <div key={k} data-k={k} ref={(el) => (refs.current[k] = el)} className="transition-opacity" style={{ opacity: !motionOk() || active === k ? 1 : 0.45 }}>
            <p className="tnum text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--acc)' }}>{s.kicker}</p>
            <h3 className="mt-1 font-display text-xl font-bold">{s.title}</h3>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--mut)' }}>{s.desc}</p>
            {s.link && (
              <Link to={s.link.to} className="mt-2 inline-block text-sm font-bold underline underline-offset-2" style={{ color: 'var(--acc)' }}>
                {s.link.label} →
              </Link>
            )}
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <div className="sticky top-24 overflow-hidden rounded-2xl border shadow-sm" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={motionOk() ? { opacity: 0, y: 14 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={motionOk() ? { opacity: 0, y: -14 } : undefined}
              transition={{ duration: 0.25 }}
              className="p-6"
            >
              {cur.visual}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------- Timeline (scroll-drawn line + steps) ----------
export function Timeline({ items }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.6'] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  return (
    <div ref={ref} className="relative pl-8">
      <div aria-hidden="true" className="absolute bottom-2 left-[9px] top-2 w-[2px] rounded" style={{ background: 'var(--line)' }} />
      {animate && (
        <motion.div aria-hidden="true" className="absolute bottom-2 left-[9px] top-2 w-[2px] origin-top rounded" style={{ scaleY, background: 'var(--primary)' }} />
      )}
      <div className="flex flex-col gap-6">
        {items.map((it, k) => (
          <div key={k} className="relative">
            <span aria-hidden="true" className="absolute -left-8 top-1 grid h-5 w-5 place-items-center rounded-full border text-[10px] font-extrabold" style={{ background: 'var(--panel)', borderColor: 'var(--acc)', color: 'var(--acc)' }}>
              {k + 1}
            </span>
            <h3 className="font-display text-[15.5px] font-bold">{it.title}</h3>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--mut)' }}>{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- FocusCards (hover one, dim the rest) ----------
export function FocusCards({ cards }) {
  const [hovered, setHovered] = useState(null);
  const on = motionOk();
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c, k) => (
        <Link
          key={c.to}
          to={c.to}
          onMouseEnter={() => setHovered(k)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(k)}
          onBlur={() => setHovered(null)}
          className="rounded-2xl border p-[18px] shadow-sm transition-all duration-300 hover:-translate-y-[3px] hover:shadow-lg"
          style={{
            background: 'var(--panel)',
            borderColor: hovered === k ? 'var(--acc)' : 'var(--line)',
            opacity: on && hovered !== null && hovered !== k ? 0.45 : 1,
            filter: on && hovered !== null && hovered !== k ? 'blur(1.5px)' : 'none',
          }}
        >
          <p className="tnum text-3xl font-extrabold" style={{ color: hovered === k ? 'var(--acc)' : 'var(--faint)' }}>{c.glyph}</p>
          <h3 className="mt-2 font-display text-[15.5px] font-bold">{c.title}</h3>
          <p className="mb-2 mt-0.5 text-[13px]" style={{ color: 'var(--mut)' }}>{c.sub}</p>
          <span className="text-[13px] font-bold" style={{ color: 'var(--acc)' }}>Browse →</span>
        </Link>
      ))}
    </div>
  );
}

// ---------- DirectionHover (overlay enters from cursor side) ----------
export function DirectionHover({ to, title, sub, meta, tint = 'var(--acc-soft)' }) {
  const ref = useRef(null);
  const [dir, setDir] = useState('bottom');
  const [inOut, setInOut] = useState('out');
  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    setDir(Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'bottom' : 'top');
  };
  const off = { top: { y: '-100%' }, bottom: { y: '100%' }, left: { x: '-100%' }, right: { x: '100%' } }[dir] || {};
  return (
    <Link
      ref={ref}
      to={to}
      onMouseMove={finePointer() && motionOk() ? onMove : undefined}
      onMouseEnter={() => setInOut('in')}
      onMouseLeave={() => setInOut('out')}
      className="relative block overflow-hidden rounded-2xl border p-[18px] shadow-sm"
      style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
    >
      <h3 className="relative z-10 font-display text-[15.5px] font-bold">{title}</h3>
      <p className="relative z-10 mb-1 mt-0.5 text-[13px]" style={{ color: 'var(--mut)' }}>{sub}</p>
      <p className="relative z-10 text-xs tabular-nums" style={{ color: 'var(--faint)' }}>{meta}</p>
      <motion.span
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: tint }}
        initial={false}
        animate={inOut === 'in' ? { x: 0, y: 0, opacity: 1 } : { ...off, opacity: 0.9 }}
        transition={{ duration: 0.28, ease: [0.2, 0.7, 0.25, 1] }}
      />
    </Link>
  );
}

// ---------- LinkPreview (floating metadata card on hover, no external fetch) ----------
export function LinkPreview({ to, title, desc, meta, children }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 350, damping: 28 });
  const sy = useSpring(y, { stiffness: 350, damping: 28 });
  const [show, setShow] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (finePointer() && motionOk()) setOn(true);
  }, []);
  return (
    <span
      className="relative"
      onMouseMove={
        on
          ? (e) => {
              x.set(e.clientX + 18);
              y.set(e.clientY + 16);
            }
          : undefined
      }
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Link data-result-link to={to} className="link-slide font-semibold transition-colors hover:text-[var(--acc)]">
        {children || title}
      </Link>
      {on && show && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-[80] w-[280px] rounded-2xl border p-4 shadow-2xl"
          style={{ x: sx, y: sy, background: 'var(--panel)', borderColor: 'var(--line2)' }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.16 }}
        >
          <span className="block font-display text-sm font-bold">{title}</span>
          {desc && <span className="mt-1 line-clamp-3 block text-xs" style={{ color: 'var(--mut)' }}>{desc}</span>}
          {meta && <span className="mt-1.5 block text-[11px] tabular-nums" style={{ color: 'var(--faint)' }}>{meta}</span>}
        </motion.span>
      )}
    </span>
  );
}

// ---------- SnapCarousel (scroll-snap row with arrows) ----------
export function SnapCarousel({ children, label }) {
  const ref = useRef(null);
  const step = useCallback((d) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: d * Math.min(560, el.clientWidth * 0.85), behavior: motionOk() ? 'smooth' : 'auto' });
  }, []);
  return (
    <div>
      <div className="mb-2 flex justify-end gap-1.5">
        <button onClick={() => step(-1)} aria-label={`Scroll ${label} back`} className="icon-hover grid h-10 w-10 place-items-center rounded-full border text-lg" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
          ←
        </button>
        <button onClick={() => step(1)} aria-label={`Scroll ${label} forward`} className="icon-hover grid h-10 w-10 place-items-center rounded-full border text-lg" style={{ borderColor: 'var(--line2)', background: 'var(--panel)' }}>
          →
        </button>
      </div>
      <div ref={ref} className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {children}
      </div>
    </div>
  );
}

// ---------- Evervault (scramble reveal on hover) ----------
const GLYPHS = '!<>-_\\/[]{}—=+*^?#________';
export function Evervault({ text, className }) {
  const [out, setOut] = useState(text);
  const raf = useRef(0);
  const scramble = useCallback(() => {
    if (!motionOk()) {
      setOut(text);
      return;
    }
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 700);
      setOut(text.split('').map((c, i) => (c === ' ' || i / text.length < k ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(''));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [text]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <span onMouseEnter={scramble} onFocus={scramble} tabIndex={0} className={cn('font-mono', className)} aria-label={text}>
      {out}
    </span>
  );
}

// ---------- WobbleCard (translate + scale on mousemove) ----------
export function WobbleCard({ children, className, to, style }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18 });
  const sy = useSpring(y, { stiffness: 200, damping: 18 });
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (finePointer() && motionOk()) setOn(true);
  }, []);
  const inner = (
    <motion.div
      ref={ref}
      style={on ? { x: sx, y: sy, ...style } : style}
      onMouseMove={
        on
          ? (e) => {
              const r = ref.current?.getBoundingClientRect();
              if (!r) return;
              x.set(((e.clientX - r.left) / r.width - 0.5) * 14);
              y.set(((e.clientY - r.top) / r.height - 0.5) * 14);
            }
          : undefined
      }
      onMouseLeave={
        on
          ? () => {
              x.set(0);
              y.set(0);
            }
          : undefined
      }
      className={cn('h-full rounded-2xl border p-[18px] shadow-sm transition-shadow hover:shadow-lg', className)}
    >
      {children}
    </motion.div>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ---------- Lamp (section header glow) ----------
export function Lamp({ kicker, title, sub }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl border px-6 py-10 text-center" style={{ background: '#0B1220', borderColor: '#243049' }}>
      <div aria-hidden="true" className="lamp-glow absolute inset-x-0 top-0 mx-auto h-40 w-[420px]" />
      <motion.div initial={animate ? { opacity: 0, y: 18 } : false} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }}>
        {kicker && <p className="text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: '#38BDF8' }}>{kicker}</p>}
        <h2 className="mx-auto mt-2 max-w-[22ch] font-display text-3xl font-bold" style={{ color: '#E8EDF7' }}>{title}</h2>
        {sub && <p className="mx-auto mt-2 max-w-[56ch] text-[15px]" style={{ color: '#8A97B2' }}>{sub}</p>}
      </motion.div>
    </div>
  );
}

// ---------- AuroraBg (drifting gradient blobs) ----------
export function AuroraBg({ children, className }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  return (
    <div className={cn('aurora-wrap relative overflow-hidden rounded-3xl border', className)} style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>
      {animate && (
        <div aria-hidden="true" className="absolute inset-0">
          <span className="aurora-blob aurora-a" />
          <span className="aurora-blob aurora-b" />
          <span className="aurora-blob aurora-c" />
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

// ---------- Beams (animated SVG paths backdrop) ----------
export function Beams({ children, className }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(motionOk());
  }, []);
  return (
    <div className={cn('relative overflow-hidden rounded-3xl border', className)} style={{ background: '#0B1220', borderColor: '#243049' }}>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 800 400">
        {[
          'M-20,320 C200,260 320,120 820,60',
          'M-20,360 C240,300 380,180 820,140',
          'M-20,250 C180,220 400,80 820,20',
        ].map((d, k) => (
          <path key={k} d={d} fill="none" stroke={k === 1 ? '#38BDF8' : '#5b8cff'} strokeWidth="1.5" opacity={animate ? 0.55 : 0.25} strokeDasharray={animate ? '14 220' : 'none'} className={animate ? 'beam-dash' : undefined} style={animate ? { animationDelay: `${k * 1.4}s` } : undefined} />
        ))}
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}

// ---------- Faq (expandable accordion) ----------
export function Faq({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, k) => {
        const isOpen = open === k;
        return (
          <div key={k} className="overflow-hidden rounded-2xl border" style={{ background: 'var(--panel)', borderColor: isOpen ? 'var(--acc)' : 'var(--line)' }}>
            <button
              onClick={() => setOpen(isOpen ? -1 : k)}
              aria-expanded={String(isOpen)}
              className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-bold"
            >
              <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className="grid h-7 w-7 flex-none place-items-center rounded-full border text-lg leading-none" style={{ borderColor: 'var(--line2)', color: 'var(--acc)' }}>
                +
              </motion.span>
              {it.q}
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: motionOk() ? 0.28 : 0 }}
                >
                  <div className="px-4 pb-4 pl-[52px] text-sm" style={{ color: 'var(--mut)' }}>{it.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ---------- MultiStepLoader (mock assembly + AI states) ----------
export function MultiStepLoader({ steps, done }) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (done) return;
    if (k >= steps.length - 1) return;
    const t = setTimeout(() => setK((v) => v + 1), motionOk() ? 650 : 0);
    return () => clearTimeout(t);
  }, [k, steps.length, done]);
  return (
    <div className="mx-auto max-w-[420px] rounded-2xl border p-6 text-center" style={{ background: 'var(--panel)', borderColor: 'var(--line)' }} role="status" aria-label="Loading">
      <div className="mx-auto h-9 w-9 animate-spin rounded-full border-[3px]" style={{ borderColor: 'var(--line2)', borderTopColor: 'var(--primary)' }} />
      <AnimatePresence mode="wait">
        <motion.p
          key={k}
          initial={motionOk() ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={motionOk() ? { opacity: 0, y: -6 } : undefined}
          transition={{ duration: 0.2 }}
          className="mt-3 text-sm font-semibold"
        >
          {steps[Math.min(k, steps.length - 1)]}
        </motion.p>
      </AnimatePresence>
      <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full" style={{ background: 'var(--bg2)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(((k + 1) / steps.length) * 100)}%`, background: 'var(--primary)' }} />
      </div>
    </div>
  );
}

// ---------- StatefulButton (idle → loading → success morph) ----------
export function StatefulButton({ idle, loadingLabel = 'Working…', successLabel = 'Done ✓', onAction, ...props }) {
  const [state, setState] = useState('idle');
  const click = async (e) => {
    if (state !== 'idle') return;
    setState('loading');
    try {
      await onAction?.(e);
      setState('success');
      setTimeout(() => setState('idle'), 1800);
    } catch {
      setState('idle');
    }
  };
  return (
    <button
      onClick={click}
      disabled={state === 'loading'}
      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[11px] px-[18px] py-2.5 text-sm font-bold transition-all hover:-translate-y-px disabled:cursor-wait"
      style={
        state === 'success'
          ? { background: 'var(--ok)', color: '#fff' }
          : { background: 'var(--primary)', color: 'var(--primary-foreground)' }
      }
      {...props}
    >
      {state === 'loading' && <span className="h-4 w-4 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />}
      {state === 'idle' ? idle : state === 'loading' ? loadingLabel : successLabel}
    </button>
  );
}

// ---------- LinkArrow (hover-border-gradient arrow link) ----------
export function LinkArrow({ to, children }) {
  return (
    <Link to={to} className="hover-arrow group inline-flex min-h-[38px] items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-[13px] font-bold" style={{ borderColor: 'var(--line2)', background: 'var(--panel)', color: 'var(--acc)' }}>
      {children}
      <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
    </Link>
  );
}

// ---------- GlowingCard (Cursor-style border glow container) ----------
export function GlowingCard({ children, className }) {
  return <div className={cn('glow-card relative rounded-2xl border p-[18px]', className)} style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}>{children}</div>;
}

// ---------- StickyBanner (hides on scroll down, returns on scroll up) ----------
export function StickyBanner({ children, top = 0 }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 140 && y > last);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      className="sticky z-[60] transition-transform duration-300"
      style={{ top, transform: hidden ? 'translateY(-130%)' : 'translateY(0)' }}
    >
      {children}
    </div>
  );
}
