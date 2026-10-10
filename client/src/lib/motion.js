// Shared motion layer — the single source of truth for timing (see docs/MOTION.md).
// No component invents its own durations/easings; import from here.
import { useCallback, useEffect, useState } from 'react';

export const dur = { micro: 120, standard: 240, emphasis: 480 };
export const ease = {
  standard: [0.2, 0.7, 0.25, 1],
  decelerate: [0, 0, 0.2, 1],
  accelerate: [0.4, 0, 1, 1],
  emphasised: [0.05, 0.7, 0.1, 1],
};
export const springs = {
  snappy: { type: 'spring', stiffness: 500, damping: 32, mass: 0.8 },
  smooth: { type: 'spring', stiffness: 300, damping: 30, mass: 1 },
  gentle: { type: 'spring', stiffness: 180, damping: 26, mass: 1.1 },
};
export const profiles = { expressive: 'expressive', standard: 'standard', calm: 'calm' };
export const MOTION_KEY = 'sehs-motion'; // 'full' | 'reduced' | 'off'

function prefersReduced() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function readMotionSetting() {
  try {
    return localStorage.getItem(MOTION_KEY) || 'full';
  } catch {
    return 'full';
  }
}

/** Effective animation enabled flag: in-app setting + OS preference. */
export function shouldAnimate(setting) {
  const s = setting ?? readMotionSetting();
  if (s === 'off') return false;
  if (s === 'reduced') return false;
  return !prefersReduced();
}

/** Resolve the motion profile for a surface; exam/viewer always calm. */
export function useMotionProfile(surface = 'standard') {
  const [setting, setSetting] = useState(readMotionSetting);
  useEffect(() => {
    try {
      document.documentElement.dataset.motion = setting === 'full' ? 'full' : setting;
    } catch {
      /* noop */
    }
    const onStorage = (e) => {
      if (e.key === MOTION_KEY) setSetting(e.newValue || 'full');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [setting]);
  const set = useCallback((v) => {
    try {
      localStorage.setItem(MOTION_KEY, v);
    } catch {
      /* noop */
    }
    setSetting(v);
  }, []);
  const calm = surface === 'exam' || surface === 'viewer' ? profiles.calm : profiles[surface] || profiles.standard;
  return { setting, setSetting: set, animate: shouldAnimate(setting), profile: calm };
}

/** Apply the stored motion setting before paint (called once in main.jsx). */
export function initMotion() {
  try {
    const s = localStorage.getItem(MOTION_KEY) || 'full';
    document.documentElement.dataset.motion = s;
  } catch {
    /* noop */
  }
}

export const variants = {
  fadeUp: {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: dur.standard / 1000, ease: ease.decelerate } },
  },
  stagger: (staggerChildren = 0.05) => ({
    hidden: {},
    show: { transition: { staggerChildren } },
  }),
  press: { whileTap: { scale: 0.97 }, transition: springs.snappy },
  calmFade: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: dur.micro / 1000 } },
  },
};
