// Assessment engine, modular, typed-by-convention, tested (scripts/assessment.test.mjs).
// Timer uses absolute timestamps (Date.now, monotonic enough for exam timing) so it
// survives tab backgrounding and refresh; elapsed time can be re-validated from
// stored startedAt/endAt. Question selection is deterministic from a seed.
export const QUESTION_TYPES = ['single', 'numeric', 'passage', 'visual', 'writing'];
export const VERIFICATION = ['verified', 'draft'];

/** Validate a question object against the schema. Returns { ok, errors }. */
export function validateQuestion(q) {
  const errors = [];
  if (!q || typeof q !== 'object') return { ok: false, errors: ['not an object'] };
  if (!q.id || typeof q.id !== 'string') errors.push('id required (string)');
  if (!QUESTION_TYPES.includes(q.type)) errors.push(`type must be one of ${QUESTION_TYPES.join(', ')}`);
  if (!q.stem || typeof q.stem !== 'string') errors.push('stem required (string)');
  if (!VERIFICATION.includes(q.verification)) errors.push('verification must be verified|draft');
  if (q.verification === 'verified' && !q.method) errors.push('verified questions need a method');
  if (q.type === 'single' || q.type === 'passage' || q.type === 'visual') {
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push('options: need 2+ choices');
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options || []).length)
      errors.push('answer: index into options');
    const uniq = new Set((q.options || []).map((o) => String(o).trim().toLowerCase()));
    if (uniq.size !== (q.options || []).length) errors.push('options: must be distinct');
  }
  if (q.type === 'numeric') {
    if (typeof q.answer !== 'number' || Number.isNaN(q.answer)) errors.push('answer: number required');
    if (q.tolerance !== undefined && (typeof q.tolerance !== 'number' || q.tolerance < 0))
      errors.push('tolerance: non-negative number');
  }
  if (q.type === 'writing' && q.answer !== undefined) errors.push('writing: no auto answer');
  if (!q.explanation || typeof q.explanation !== 'string') errors.push('explanation required');
  return { ok: errors.length === 0, errors };
}

/** Score one response. Never throws on skipped/changed answers. */
export function scoreResponse(question, response) {
  if (question.type === 'writing') return { scored: false, correct: false, skipped: response == null };
  if (response == null || response === -1 || response === '') return { scored: true, correct: false, skipped: true };
  if (question.type === 'numeric') {
    const tol = question.tolerance ?? 0;
    const v = Number(response);
    if (Number.isNaN(v)) return { scored: true, correct: false, skipped: false };
    return { scored: true, correct: Math.abs(v - question.answer) <= tol, skipped: false };
  }
  return { scored: true, correct: response === question.answer, skipped: false };
}

/** Score a whole attempt. Changed answers score on their final value; double-submit safe (pure). */
export function scoreAttempt(questions, answers) {
  const details = questions.map((q, i) => ({ index: i, id: q.id, ...scoreResponse(q, answers[i]) }));
  const scored = details.filter((d) => d.scored);
  const correct = scored.filter((d) => d.correct).length;
  const skipped = details.filter((d) => d.skipped).length;
  return { score: correct, total: scored.length, skipped, details };
}

/** Deterministic PRNG (mulberry32). Seed may be any 32-bit int or string (hashed). */
export function seedToInt(seed) {
  if (Number.isInteger(seed)) return seed >>> 0;
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seedToInt(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Deterministic shuffle: same seed ⇒ same order. Pure (does not mutate input). */
export function seededShuffle(arr, seed) {
  const out = [...arr];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/** Deterministically select n questions, optionally filtered by strand. */
export function selectQuestions(bank, { n = 10, seed = 1, strand = null } = {}) {
  const pool = strand ? bank.filter((q) => q.strand === strand) : [...bank];
  return seededShuffle(pool, seed).slice(0, Math.max(0, Math.min(n, pool.length)));
}

// ---- timer (absolute timestamps) ----
export function startTimer({ minutes, extraTimeMult = 1, now = Date.now() } = {}) {
  const startedAt = now;
  const endAt = startedAt + Math.round(minutes * 60 * 1000 * extraTimeMult);
  return { startedAt, endAt };
}
export function remainingMs(endAt, now = Date.now()) {
  return Math.max(0, endAt - now);
}
export function isExpired(endAt, now = Date.now()) {
  return now >= endAt;
}
export function formatMMSS(totalSecs) {
  const s = Math.max(0, Math.ceil(totalSecs));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---- spaced-repetition review queue (Leitner-style, documented rule) ----
// Boxes 1..5 with intervals [1, 3, 7, 14, 30] days. Correct ⇒ box+1 (cap 5);
// incorrect ⇒ box 1. nextDue is an ISO date (UTC midnight + interval).
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30];
export function recordReview(prevBox, correct, now = new Date()) {
  const box = correct ? Math.min(5, (prevBox || 0) + 1) : 1;
  const days = REVIEW_INTERVALS[box - 1];
  const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  due.setUTCDate(due.getUTCDate() + days);
  return { box, intervalDays: days, nextDue: due.toISOString().slice(0, 10) };
}
export function dueItems(items, todayIso = new Date().toISOString().slice(0, 10)) {
  return (items || []).filter((it) => !it.nextDue || it.nextDue <= todayIso);
}

// ---- accommodations ----
export function applyAccommodations(settings = {}) {
  return {
    extraTimeMult: settings.extraTime ? Number(settings.extraTime) || 1 : 1,
    largerText: !!settings.largerText,
    highContrast: !!settings.highContrast,
    dyslexiaFriendly: !!settings.dyslexiaFriendly,
    calmMotion: true, // exam always uses the Calm profile
  };
}

// ---- clearly labelled SAMPLE questions for development (draft, not official) ----
export const SAMPLE_QUESTIONS = [
  {
    id: 'sample-vr-1', type: 'single', strand: 'verbal', stem: 'SAMPLE: Book is to chapter as song is to…',
    options: ['verse', 'cover', 'singer', 'stage'], answer: 0,
    explanation: 'A chapter is part of a book; a verse is part of a song.',
    difficulty: 'easy', timeSecs: 60, verification: 'draft', source: 'original sample',
  },
  {
    id: 'sample-qr-1', type: 'single', strand: 'quant', stem: 'SAMPLE: 3, 6, 11, 18, 27, … What comes next?',
    options: ['36', '38', '34', '39'], answer: 1,
    explanation: 'Differences grow by 2 each step: +3, +5, +7, +9, so +11 gives 38.',
    difficulty: 'medium', timeSecs: 90, verification: 'draft', source: 'original sample',
  },
  {
    id: 'sample-maths-1', type: 'numeric', strand: 'maths', stem: 'SAMPLE: What is 3/4 of 96?',
    answer: 72, tolerance: 0,
    explanation: '96 ÷ 4 = 24; 24 × 3 = 72.',
    difficulty: 'easy', timeSecs: 60, verification: 'draft', source: 'original sample',
  },
  {
    id: 'sample-maths-2', type: 'single', strand: 'maths', stem: 'SAMPLE: If 2x + 5 = 17, x = …',
    options: ['5', '6', '7', '11'], answer: 1,
    explanation: '2x = 12, so x = 6.',
    difficulty: 'easy', timeSecs: 60, verification: 'draft', source: 'original sample',
  },
  {
    id: 'sample-read-1', type: 'passage', strand: 'reading', stem: 'SAMPLE: The author compares the river to a "patient archivist" mainly to suggest it…',
    options: ['stores history in its layers', 'flows very slowly', 'is open to visitors', 'writes books'],
    answer: 0, passage: { title: 'SAMPLE: The river keeps receipts', text: 'SAMPLE passage: The river keeps receipts. … (two sentences for development only.)' },
    explanation: '"Archivist" implies keeping records, as the layers store history.',
    difficulty: 'medium', timeSecs: 90, verification: 'draft', source: 'original sample',
  },
  {
    id: 'sample-vocab-1', type: 'single', strand: 'vocab', stem: 'SAMPLE: "Meticulous" most nearly means…',
    options: ['careless', 'thorough', 'hasty', 'cheerful'], answer: 1,
    explanation: 'Meticulous means showing great attention to detail.',
    difficulty: 'easy', timeSecs: 45, verification: 'draft', source: 'original sample',
  },
  {
    id: 'sample-grammar-1', type: 'single', strand: 'grammar', stem: 'SAMPLE: Choose the correctly punctuated sentence.',
    options: ["Its a sunny day.", "It's a sunny day.", "Its' a sunny day.", "It,s a sunny day."], answer: 1,
    explanation: '"It\'s" is the contraction of "it is".',
    difficulty: 'easy', timeSecs: 45, verification: 'draft', source: 'original sample',
  },
  {
    id: 'sample-write-1', type: 'writing', strand: 'writing', stem: 'SAMPLE: "Should school start later in the day?" Plan and write a persuasive response (practice only, not officially marked).',
    explanation: 'Practise stating a position, giving two reasons with evidence, and concluding clearly.',
    difficulty: 'medium', timeSecs: 1200, verification: 'draft', source: 'original sample',
  },
];
