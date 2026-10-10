import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cn } from './cn';

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
        className="h-[7px] w-[7px] rounded-full"
        style={{ background: 'linear-gradient(135deg,#5b6cff,#ec4899)', boxShadow: '0 0 10px #5b6cff' }}
      />
      <span className="shiny-text">{children}</span>
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
      style={{ background: 'linear-gradient(135deg,#2f49e5,#6d28d9)' }}
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
        ctx.fillStyle = '#8b9bff';
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

// ---------- DeckCard ----------
export function DeckCard({ to, icon, title, sub, badge }) {
  return (
    <Link
      to={to}
      className="group flex min-h-[190px] flex-col gap-2 rounded-2xl border p-[18px] shadow-sm transition-all hover:-translate-y-[3px] hover:shadow-lg"
      style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          className="grid h-[42px] w-[42px] place-items-center rounded-xl border text-[19px]"
          style={{ background: 'var(--acc-soft)', borderColor: 'var(--acc-line)' }}
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
        className="mx-auto grid h-16 w-16 -rotate-3 place-items-center rounded-[20px] border text-3xl"
        style={{ background: 'var(--bg2)', borderColor: 'var(--line)' }}
      >
        🔍
      </div>
      <h2 className="mb-1.5 mt-3.5 font-display text-xl font-bold" style={{ color: 'var(--txt)' }}>
        {title}
      </h2>
      <p className="mx-auto max-w-[52ch] text-sm">{msg}</p>
      {children}
    </div>
  );
}
