import { describe, expect, it } from 'vitest';
import { DEFAULT_CUTOFF, formatClock, isSessionActive, nextCutoff, normalizeCutoff, nextPlayDay, cutoffOn, isSessionActive as active, sessionLabel } from './session.js';

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

describe('nextPlayDay (Monday and Tuesday sessions)', () => {
  // 23 Nov 2026 is a Monday.
  const at = (date, hour, minute = 0) => new Date(2026, 10, date, hour, minute);
  const day = (value) => `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`;

  it('is today on a play day before the cut-off', () => {
    expect(day(nextPlayDay('19:00', at(23, 9)))).toBe('2026-11-23');
    expect(day(nextPlayDay('19:00', at(24, 18, 59)))).toBe('2026-11-24');
  });

  it('moves from Monday to Tuesday after the cut-off', () => {
    expect(day(nextPlayDay('19:00', at(23, 19)))).toBe('2026-11-24');
  });

  it('moves to next Monday after Tuesday and through the rest of the week', () => {
    expect(day(nextPlayDay('19:00', at(24, 19, 30)))).toBe('2026-11-30');
    expect(day(nextPlayDay('19:00', at(25, 10)))).toBe('2026-11-30');
    expect(day(nextPlayDay('19:00', at(29, 23)))).toBe('2026-11-30');
  });

  it('follows the admin cut-off time', () => {
    expect(day(nextPlayDay('21:00', at(24, 20)))).toBe('2026-11-24');
    expect(day(nextPlayDay('18:00', at(24, 18, 30)))).toBe('2026-11-30');
  });
});

describe('announcing the next session', () => {
  const wednesday = new Date(2026, 10, 25, 9);

  it('names the session by its day', () => {
    expect(sessionLabel('2026-11-25', wednesday)).toBe('Petang ni');
    expect(sessionLabel('2026-11-26', wednesday)).toBe('Esok petang');
    expect(sessionLabel('2026-11-30', wednesday)).toBe('Isnin, 30 Nov');
    expect(sessionLabel('2026-12-01', wednesday)).toBe('Selasa, 1 Dis');
  });

  it('keeps a list made on Wednesday up until Monday\'s cut-off', () => {
    const monday = nextPlayDay('19:00', wednesday);
    const entry = { date: '2026-11-30', validUntil: cutoffOn(monday, '19:00').toISOString() };
    expect(active(entry, '19:00', new Date(2026, 10, 25, 20))).toBe(true);
    expect(active(entry, '19:00', new Date(2026, 10, 30, 18, 59))).toBe(true);
    expect(active(entry, '19:00', new Date(2026, 10, 30, 19))).toBe(false);
  });
});
