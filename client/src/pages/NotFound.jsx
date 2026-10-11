import { Link } from 'react-router-dom';
import { InteractiveHover } from '../components/bits';

export default function NotFound() {
  return (
    <div className="page-narrow py-10">
      <div className="quiet-card px-6 py-12 text-center">
        <p className="kicker" style={{ justifyContent: 'center' }}>Lost in the stacks</p>
        <p className="tnum font-display font-bold tabular-nums" style={{ fontSize: 'clamp(72px,14vw,128px)', lineHeight: 1, letterSpacing: '-0.04em' }} aria-label="404">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold">Lost among the papers?</h1>
        <p className="mx-auto mt-2 max-w-[46ch] text-[15px]" style={{ color: 'var(--mut)' }}>
          That link doesn&apos;t point anywhere here. The library, mocks and study hub are all one tap away.
        </p>
        <p className="mt-5 flex flex-wrap justify-center gap-2.5">
          <InteractiveHover to="/" primary>Back home</InteractiveHover>
          <InteractiveHover to="/search">Search the library</InteractiveHover>
        </p>
        <p className="tnum mt-6 text-xs tabular-nums" style={{ color: 'var(--faint)' }}>
          <Link to="/request" className="link-slide font-bold" style={{ color: 'var(--acc)' }}>
            Looking for something specific? Request it →
          </Link>
        </p>
      </div>
    </div>
  );
}
