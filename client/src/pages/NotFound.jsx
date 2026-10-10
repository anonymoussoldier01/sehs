import { FuzzyText, ShootingStars, InteractiveHover } from '../components/bits';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-10">
      <ShootingStars className="px-6 py-10 text-center" density={70}>
        <FuzzyText text="404" />
        <h1 className="mt-2 font-display text-2xl font-bold" style={{ color: '#E8EDF7' }}>Lost among the papers?</h1>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm" style={{ color: '#8A97B2' }}>
          That link doesn&apos;t point anywhere here. The library, mocks and study hub are all one tap away.
        </p>
        <p className="mt-5 flex flex-wrap justify-center gap-2.5">
          <InteractiveHover to="/" primary>Back home</InteractiveHover>
          <InteractiveHover to="/search">Search the library</InteractiveHover>
        </p>
      </ShootingStars>
    </div>
  );
}
