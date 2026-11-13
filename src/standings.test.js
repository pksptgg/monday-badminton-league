import { describe, expect, it } from 'vitest';
import { addPoint, createMatch, completeSpecial } from './domain.js';
import { calculateStandings } from './standings.js';

function completedMatch(homeTeamId, awayTeamId, games) {
  let match = createMatch(homeTeamId, awayTeamId);
  for (const game of games) {
    const first = game.home >= game.away ? 'home' : 'away';
    const second = first === 'home' ? 'away' : 'home';
    const targetFirst = game[first];
    const targetSecond = game[second];
    for (let i = 0; i < targetFirst; i++) {
      match = addPoint(match, first);
      if (i < targetSecond) match = addPoint(match, second);
    }
  }
  return match;
}

describe('league standings', () => {
  it('uses league points, then game difference, then point difference', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id) => ({ id, name: `Team ${id}` }));
    const matches = [
      completedMatch('A', 'B', [{ home: 21, away: 19 }, { home: 21, away: 10 }]),
      completeSpecial(createMatch('C', 'D'), 'walkover', 'C'),
      completeSpecial(createMatch('E', 'F'), 'retired', 'E'),
    ];
    const table = calculateStandings(teams, matches);
    const row = Object.fromEntries(table.map((team) => [team.id, team]));
    expect(row.A).toMatchObject({ played: 1, won: 1, leaguePoints: 2, gameDifference: 2, pointDifference: 13 });
    expect(row.B).toMatchObject({ played: 1, lost: 1, leaguePoints: 1, gameDifference: -2, pointDifference: -13 });
    expect(row.C.leaguePoints).toBe(2);
    expect(row.D.leaguePoints).toBe(0);
    expect(row.E.leaguePoints).toBe(2);
    expect(row.F.leaguePoints).toBe(1);
    expect(row.G).toMatchObject({ played: 0, leaguePoints: 0 });
    expect(table.map((team) => team.id)).toEqual(['A', 'C', 'E', 'F', 'B', 'D', 'G']);
  });
});
