// Assessment engine unit tests (node:test). Run: node scripts/assessment.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateQuestion, scoreResponse, scoreAttempt, seededShuffle, selectQuestions,
  startTimer, remainingMs, isExpired, formatMMSS, recordReview, dueItems,
  SAMPLE_QUESTIONS,
} from '../client/src/lib/assessment.js';

const single = SAMPLE_QUESTIONS[0];
const numeric = SAMPLE_QUESTIONS[2];
const writing = SAMPLE_QUESTIONS[7];

describe('schema validation', () => {
  it('accepts the sample bank', () => {
    for (const q of SAMPLE_QUESTIONS) {
      const v = validateQuestion(q);
      assert.ok(v.ok, `${q.id}: ${v.errors.join('; ')}`);
    }
  });
  it('rejects missing answer, dup options, writing with answer', () => {
    assert.ok(!validateQuestion({ ...single, answer: 9 }).ok);
    assert.ok(!validateQuestion({ ...single, options: ['a', 'a'] }).ok);
    assert.ok(!validateQuestion({ ...writing, answer: 0 }).ok);
    assert.ok(!validateQuestion({ ...numeric, answer: 'x' }).ok);
  });
});

describe('scoring', () => {
  it('single: correct / wrong / skipped / changed answer scores on final value', () => {
    assert.equal(scoreResponse(single, 0).correct, true);
    assert.equal(scoreResponse(single, 2).correct, false);
    assert.equal(scoreResponse(single, undefined).skipped, true);
    assert.equal(scoreResponse(single, -1).skipped, true);
    const r = scoreAttempt([single], [2]);
    assert.equal(r.score, 0);
    const r2 = scoreAttempt([single], [0]); // changed answer
    assert.equal(r2.score, 1);
  });
  it('numeric: tolerance and unit rules', () => {
    assert.equal(scoreResponse(numeric, 72).correct, true);
    assert.equal(scoreResponse(numeric, '72').correct, true);
    assert.equal(scoreResponse(numeric, 73).correct, false);
    const tol = { ...numeric, tolerance: 1 };
    assert.equal(scoreResponse(tol, 73).correct, true);
    assert.equal(scoreResponse(numeric, 'abc').correct, false);
  });
  it('writing is never auto-scored', () => {
    assert.equal(scoreResponse(writing, 'anything').scored, false);
    const r = scoreAttempt([single, writing], [0, 'essay']);
    assert.equal(r.total, 1);
    assert.equal(r.score, 1);
  });
  it('skipped questions counted, double-submit is pure', () => {
    const qs = [single, numeric];
    const r1 = scoreAttempt(qs, [undefined, undefined]);
    assert.equal(r1.skipped, 2);
    assert.equal(r1.score, 0);
    const r2 = scoreAttempt(qs, [0, 72]);
    assert.equal(scoreAttempt(qs, [0, 72]).score, r2.score); // pure, repeatable
  });
});

describe('timer (absolute timestamps)', () => {
  it('survives backgrounding: remaining derived from endAt, not ticks', () => {
    const t0 = 1_700_000_000_000;
    const t = startTimer({ minutes: 60, now: t0 });
    assert.equal(t.endAt - t.startedAt, 3600000);
    assert.equal(remainingMs(t.endAt, t0 + 10 * 60 * 1000), 50 * 60 * 1000);
    assert.equal(isExpired(t.endAt, t.endAt), true);
    assert.equal(isExpired(t.endAt, t.endAt - 1), false);
  });
  it('extra-time multiplier and formatting', () => {
    const t = startTimer({ minutes: 60, extraTimeMult: 1.25, now: 0 });
    assert.equal(t.endAt, 75 * 60 * 1000);
    assert.equal(formatMMSS(65), '01:05');
    assert.equal(formatMMSS(0), '00:00');
  });
  it('submission on timer expiry path: expired attempt still scores recorded answers', () => {
    const r = scoreAttempt([single], [0]);
    assert.equal(isExpired(Date.now() - 1), true);
    assert.equal(r.score, 1);
  });
});

describe('deterministic selection', () => {
  it('same seed ⇒ same order; different seeds differ (probably)', () => {
    const bank = SAMPLE_QUESTIONS;
    const a = selectQuestions(bank, { n: 5, seed: 42 });
    const b = selectQuestions(bank, { n: 5, seed: 42 });
    assert.deepEqual(a.map((q) => q.id), b.map((q) => q.id));
    const c = selectQuestions(bank, { n: 5, seed: 43 });
    assert.notDeepEqual(a.map((q) => q.id), c.map((q) => q.id));
    assert.deepEqual(seededShuffle([1, 2, 3], 7), seededShuffle([1, 2, 3], 7));
  });
  it('resume after refresh: stored seed reproduces the set', () => {
    const first = selectQuestions(SAMPLE_QUESTIONS, { n: 4, seed: 'attempt-9' });
    const again = selectQuestions(SAMPLE_QUESTIONS, { n: 4, seed: 'attempt-9' });
    assert.deepEqual(first.map((q) => q.id), again.map((q) => q.id));
  });
});

describe('review queue (Leitner rule)', () => {
  it('correct advances box, incorrect resets; intervals documented', () => {
    assert.deepEqual(recordReview(1, true, new Date('2026-01-01T00:00:00Z')), { box: 2, intervalDays: 3, nextDue: '2026-01-04' });
    assert.deepEqual(recordReview(4, false, new Date('2026-01-01T00:00:00Z')), { box: 1, intervalDays: 1, nextDue: '2026-01-02' });
    assert.equal(recordReview(5, true).box, 5);
  });
  it('missed question appears in due queue', () => {
    const items = [{ stem: 'x', nextDue: '2026-01-01' }, { stem: 'y', nextDue: '2099-01-01' }];
    assert.equal(dueItems(items, '2026-06-01').length, 1);
  });
});
