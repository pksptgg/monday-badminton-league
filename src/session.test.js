import { describe, expect, it } from 'vitest';
import { DEFAULT_CUTOFF, formatClock, isSessionActive, nextCutoff, normalizeCutoff } from './session.js';

const at = (y, m, d, h, min) => new Date(y, m - 1, d, h, min, 0, 0);

describe('daily session cut-off', () => {
  it('defaults to 7:00 pm and rejects bad values', () => {
    expect(normalizeCutoff(undefined)).toBe(DEFAULT_CUTOFF);
    expect(normalizeCutoff('25:00')).toBe('19:00');
    expect(normalizeCutoff('18:30')).toBe('18:30');
    expect(formatClock('19:00')).toBe('7:00 ptg');
    expect(formatClock('21:15')).toBe('9:15 mlm');
  });

  it('ends an announcement made before the cut-off at 7 pm the same day', () => {
    const until = nextCutoff('19:00', at(2026, 11, 16, 17, 20));
    expect(until).toEqual(at(2026, 11, 16, 19, 0));
    const entry = { validUntil: until.toISOString() };
    expect(isSessionActive(entry, '19:00', at(2026, 11, 16, 18, 59))).toBe(true);
    expect(isSessionActive(entry, '19:00', at(2026, 11, 16, 19, 0))).toBe(false);
  });

  it('carries an announcement made after the cut-off to the next session', () => {
    const until = nextCutoff('19:00', at(2026, 11, 16, 20, 10));
    expect(until).toEqual(at(2026, 11, 17, 19, 0));
  });

  it('handles older announcements that only stored the day', () => {
    const entry = { date: '2026-11-16', ids: [] };
    expect(isSessionActive(entry, '19:00', at(2026, 11, 16, 18, 0))).toBe(true);
    expect(isSessionActive(entry, '19:00', at(2026, 11, 16, 19, 30))).toBe(false);
    expect(isSessionActive(entry, '19:00', at(2026, 11, 17, 18, 0))).toBe(false);
    expect(isSessionActive(null, '19:00', at(2026, 11, 16, 18, 0))).toBe(false);
  });
});
