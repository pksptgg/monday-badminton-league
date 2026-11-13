import { describe, expect, it } from 'vitest';
import { generateRoundRobin } from './schedule.js';

describe('seven-team single round robin', () => {
  it('creates 21 fixtures across seven rounds with one bye per round', () => {
    const fixtures = generateRoundRobin(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(fixtures).toHaveLength(21);
    expect(fixtures[0].date).toBe('2026-11-16');
    expect(fixtures.find((fixture) => fixture.round === 2).date).toBe('2026-11-17');
    expect(new Set(fixtures.map((fixture) => fixture.round))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    for (let round = 1; round <= 7; round++) {
      const roundFixtures = fixtures.filter((fixture) => fixture.round === round);
      expect(roundFixtures).toHaveLength(3);
      expect(new Set(roundFixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId])).size).toBe(6);
    }
    const pairs = fixtures.map(({ homeTeamId, awayTeamId }) => [homeTeamId, awayTeamId].sort().join('-'));
    expect(new Set(pairs).size).toBe(21);
  });
});
