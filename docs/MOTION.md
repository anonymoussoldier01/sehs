# Motion system

Single source of truth: `client/src/lib/motion.js` (tokens, springs, variants, `useMotionProfile`). No component invents its own timing.

## Principles
Motion explains (origin, change, next action) — never decoration. Fast, springy, precise; interfaces feel instant, motion adds polish, never latency. Same change ⇒ same animation, everywhere.

## Tokens
- Durations: micro 100–150ms, standard 200–300ms, emphasis 400–600ms (longer only where justified, e.g. skippable score reveal ≤1.5s).
- Easings: `standard` (0.2, 0.7, 0.25, 1), `decelerate` (0, 0, 0.2, 1), `accelerate` (0.4, 0, 1, 1), `emphasised` (0.05, 0.7, 0.1, 1).
- Springs: `snappy` {stiffness 500, damping 32, mass 0.8}, `smooth` {300, 30, 1}, `gentle` {180, 26, 1.1}.
- Stagger 40–60ms; reveal distance 8–16px (translateY only).

## Profiles
- **Expressive** — marketing/homepage only (hero choreography finishing ~1s, scroll reveals once-only, one or two scroll-linked clarifiers).
- **Standard** — app (library, dashboard, dialogs, toasts, palette, tabs).
- **Calm** — exam + viewer: minimal, instant, never distracting. Answer press feedback ≤100ms (tint/scale) without delaying recording; directional interruptible question transitions; timer ticks with tabular numerals, no jitter; warning = colour + icon + gentle pulse (static alternative under reduced motion).

## User control
In-app motion setting Full / Reduced / Off (`sehs-motion`), plus `prefers-reduced-motion`. `useMotionProfile()` resolves effective profile; `MotionConfig reducedMotion="user"` semantics implemented manually for CSS (see `index.css` `[data-motion]` rules): Reduced/Off ⇒ fades or instant changes, never removed feedback. Ambient/continuous effects (particles, meteors, marquee) render only under Full + no-preference + visible tab; paused offscreen via IntersectionObserver; listeners/controls cleaned up on unmount; session-level intros never replay (`sehs-seen-*`).

## Technical standards
framer-motion is the engine; CSS transitions for hover/focus. Animate transform + opacity only (filter sparingly); no width/height/top/left except layout animations. `will-change` sparingly, removed afterwards. No animation blocks navigation/input/answering/submission; all interruptible; reserved space (no layout shift). Shared module only: `motion.js` exports `dur`, `ease`, `springs`, `profiles`, `variants`, `useMotionProfile`, `shouldAnimate`.

## Key interactions (implemented)
Hero signature (highlighter draw + live sample question) · entrance choreography (headline → copy → CTA → preview) · scroll reveals once-only · shared-layout active indicator · palette/dialog/drawer transitions · sliding tab indicator · filter chips + result layout animation · skeleton shimmer matching layouts · bookmark toggle micro-interaction (optimistic) · viewer panel slides + toolbar show/hide in distraction-free mode · exam press/select/navigator/progress/timer-warning · pre-submit review + confirm dialog · results count-up + ring draw (skippable) → staggered breakdown · topic bars animate once on first view · review-queue completion · buttons/toggles/toasts/dialogs/empty-error accents.

## Third-party animated components
Adopted: none new (existing `magic.jsx` audited: AuroraText/WordRotate/NumberTicker/Marquee/Particles/Meteors kept on marketing surfaces only, bound to tokens, gated by motion profile). Rejected: stock parallax/confetti/template effects (see DECISIONS.md D6).
