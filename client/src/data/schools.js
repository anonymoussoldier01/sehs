// SEHS Study — school data (port of the /data/schools.ts pattern to this repo's JS stack).
// One-line change: to use an official crest, place the licensed file in
// client/public/crests/<slug>.svg|png and set crestSrc to '/crests/<slug>.svg'.
// Until then crestSrc stays null and the UI renders the typographic wordmark
// automatically — no broken images, no layout shift.
//
// COLOUR SYSTEM REPLACEMENT (Oct 2026): schools are identified by crest + name
// ONLY. No colour-coding. Crests render MONOCHROME by default (see
// crestColour flag). Door art uses ONE neutral palette + quiet sky accent.
// Per-school colour fields DELETED (were Mac.Rob blue, Nossal green, MHS red,
// SC purple). Nothing reads colour from school data for styling.
//
// Do NOT hotlink crests from school sites, do NOT redraw or alter them, and
// never imply endorsement. See footer disclaimer.

// Config flag crestColour: "mono" | "full", default "mono". Full-colour crests,
// if ever enabled, appear only at small size in the selected chip.
export const CREST_COLOUR = 'mono';

export const SCHOOLS = [
  {
    id: 'macrob',
    name: "Mac.Robertson Girls' High School",
    shortName: 'Mac.Rob',
    suburb: 'Melbourne CBD',
    tag: 'Girls',
    // Official crest: sourced from the school's own website / media kit only,
    // with permission. Null = wordmark fallback.
    crestSrc: null,
    crestAlt: "Mac.Robertson Girls' High School crest",
    wordmarkFallback: 'MR',
    stats: {
      rank: 4,
      pct40: 34.7,
      median: 37,
      extra: null,
    },
    hook: 'Ranked 4th in the state, with 34.7% of study scores at 40+.',
    sourceUrl: 'https://www.vic.gov.au/selective-entry-high-schools',
    sourceLabel: 'VCE 2025 results via school + VCAA pages',
    lastChecked: '2026-09-30',
  },
  {
    id: 'nossal',
    name: 'Nossal High School',
    shortName: 'Nossal',
    suburb: 'Berwick',
    tag: 'Co-ed',
    crestSrc: null,
    crestAlt: 'Nossal High School crest',
    wordmarkFallback: 'N',
    stats: {
      rank: 6,
      pct40: 32.4,
      median: 37,
      extra: null,
    },
    hook: 'Ranked 6th in the state, median study score 37.',
    sourceUrl: 'https://www.vic.gov.au/selective-entry-high-schools',
    sourceLabel: 'VCE 2025 results via school + VCAA pages',
    lastChecked: '2026-09-30',
  },
  {
    id: 'mhs',
    name: 'Melbourne High School',
    shortName: 'Melbourne High',
    suburb: 'South Yarra',
    tag: 'Boys',
    crestSrc: null,
    crestAlt: 'Melbourne High School crest',
    wordmarkFallback: 'M',
    stats: {
      rank: 10,
      pct40: 29.9,
      median: 36,
      extra: 'Largest cohort · 722 VCE students',
    },
    hook: 'Ranked 10th with the largest VCE cohort — 722 students at median 36.',
    sourceUrl: 'https://www.vic.gov.au/selective-entry-high-schools',
    sourceLabel: 'VCE 2025 results via school + VCAA pages',
    lastChecked: '2026-09-30',
  },
  {
    id: 'suzanne-cory',
    name: 'Suzanne Cory High School',
    shortName: 'Suzanne Cory',
    suburb: 'Werribee',
    tag: 'Co-ed',
    crestSrc: null,
    crestAlt: 'Suzanne Cory High School crest',
    wordmarkFallback: 'SC',
    stats: {
      rank: 17,
      pct40: 25.0,
      median: 35,
      extra: 'The riser · rank 44 → 17 in a year',
    },
    hook: 'The riser: rank 44 → 17 in a year, median 35.',
    sourceUrl: 'https://www.vic.gov.au/selective-entry-high-schools',
    sourceLabel: 'VCE 2025 results via school + VCAA pages',
    lastChecked: '2026-09-30',
  },
];

export const SCHOOL_BY_ID = Object.fromEntries(SCHOOLS.map((s) => [s.id, s]));

// Next exam: date lives in config so the countdown rolls year to year.
// Copy targets the 2028 intake / June 2027 exam. Always label "confirm on ACER"
// next to the rendered date — never present it as official.
export const EXAM = {
  // June exam for 2028 Year 9 intake. Day is provisional until ACER confirms.
  date: '2027-06-19',
  label: 'June 2027 · 2028 intake',
  confirmNote: 'confirm on ACER',
};

// Honest scarcity band — official facts only, no outcome promises.
export const SCARCITY_FACTS = [
  { title: 'About 1,000 Year 9 places', sub: 'a year across four schools', source: 'vic.gov.au' },
  { title: 'Government schools', sub: 'no tuition fees' },
  { title: 'One exam, held each June', sub: 'offers go out Aug–Nov' },
  { title: 'Preparing early is the unfair advantage that’s completely fair.', sub: '' },
];

// H1 A/B variants (serif display). ?h1=a|b overrides; otherwise random + persisted.
// Rule: h2 states the promise, sub adds NEW information (never restates h2).
export const H1_VARIANTS = {
  A: {
    id: 'A',
    h1: 'Your seat at Melbourne High, Mac.Rob, Nossal or Suzanne Cory starts here.',
    h2: 'Walk in ready. Master writing.',
    sub: 'Past papers, flashcards and timed mocks in ACER format. Free.',
  },
  B: {
    id: 'B',
    h1: 'Four doors. One exam. Walk in ready.',
    h2: 'Past papers, flashcards and timed mocks — free, no account.',
    sub: 'Built for Year 8 students facing the June exam. Pick a target school below and the countdown follows it.',
  },
};

export const FAQ_ITEMS = [
  {
    q: 'Is it really free?',
    a: 'Yes — free forever. No account, no paywall, no trial. Everything runs in this browser; optional study files live in the public library.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. Your library, notes, mock attempts and streaks are saved in this browser via local storage. Clearing site data removes them — export a copy any time from the Study hub.',
  },
  {
    q: 'Is this the real ACER format?',
    a: 'Practice follows the published ACER structure: Maths + quantitative reasoning, reading + verbal reasoning, and writing under timed blocks (60 / 55 / 40 minutes). Questions here are practice only — not official ACER material. Always confirm timings on ACER.',
  },
  {
    q: 'How early should I start?',
    a: 'Steady beats cramming. Many students start in Year 7 or early Year 8 with short, regular sessions, then add timed mocks closer to the June exam. The Study hub builds a plan from your own misses.',
  },
  {
    q: 'What if I only have 20 minutes a day?',
    a: 'Twenty focused minutes works: one drill set, ten flashcards, or a single timed passage. Small wins compound — the review queue keeps your misses returning until they stick.',
  },
  {
    q: 'Is my progress private?',
    a: 'Yes. Progress, notes and mistakes stay on this device. The server keeps only anonymous, auto-deleted open counts (30-day purge). See Privacy & cookies for details.',
  },
];
