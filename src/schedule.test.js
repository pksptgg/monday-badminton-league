import { describe, expect, it } from 'vitest';
import { generateRoundRobin, groupByRound, restingTeams } from './schedule.js';

const TEAMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

describe('seven-team single round robin', () => {
  it('creates 21 fixtures across seven rounds with one bye per round', () => {
    const fixtures = generateRoundRobin(TEAMS);
    expect(fixtures).toHaveLength(21);
    expect(new Set(fixtures.map((fixture) => fixture.round))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    for (let round = 1; round <= 7; round++) {
      const roundFixtures = fixtures.filter((fixture) => fixture.round === round);
      expect(roundFixtures).toHaveLength(3);
      expect(new Set(roundFixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId])).size).toBe(6);
    }
    const pairs = fixtures.map(({ homeTeamId, awayTeamId }) => [homeTeamId, awayTeamId].sort().join('-'));
    expect(new Set(pairs).size).toBe(21);
  });

  it('has no fixed dates or sessions', () => {
    for (const fixture of generateRoundRobin(TEAMS)) {
      expect(fixture.date).toBeUndefined();
      expect(fixture.session).toBeUndefined();
    }
  });

  it('gives every team exactly one rest round', () => {
    const groups = groupByRound(generateRoundRobin(TEAMS));
    const rests = groups.map(({ matches }) => restingTeams(TEAMS, matches));
    expect(rests.every((ids) => ids.length === 1)).toBe(true);
    expect(new Set(rests.flat()).size).toBe(7);
  });
});

describe('groupByRound', () => {
  it('orders rounds and matches, putting matches without a round last', () => {
    const groups = groupByRound([
      { id: 'x', round: 2, matchNumber: 2 },
      { id: 'y' },
      { id: 'z', round: 1, matchNumber: 1 },
      { id: 'w', round: 2, matchNumber: 1 },
    ]);
    expect(groups.map((group) => group.round)).toEqual([1, 2, 0]);
    expect(groups[1].matches.map((match) => match.id)).toEqual(['w', 'x']);
  });
});
