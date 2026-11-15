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

const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id) => ({ id, name: `Team ${id}` }));

describe('league standings', () => {
  it('ranks by matches won, then game difference and point difference for three-way ties', () => {
    const matches = [
      completedMatch('A', 'B', [{ home: 21, away: 19 }, { home: 21, away: 10 }]),
      completeSpecial(createMatch('C', 'D'), 'walkover', 'C'),
      completeSpecial(createMatch('E', 'F'), 'retired', 'E'),
    ];
    const table = calculateStandings(teams, matches);
    const row = Object.fromEntries(table.map((team) => [team.id, team]));
    expect(row.A).toMatchObject({ played: 1, won: 1, leaguePoints: 2, gameDifference: 2, pointDifference: 13 });
    expect(row.B).toMatchObject({ played: 1, lost: 1, leaguePoints: 0, gameDifference: -2, pointDifference: -13 });
    // Walkover: 2-0 in games, no rally points; loser gets nothing.
    expect(row.C).toMatchObject({ won: 1, leaguePoints: 2, gameDifference: 2, pointDifference: 0 });
    expect(row.D).toMatchObject({ lost: 1, leaguePoints: 0, gameDifference: -2 });
    expect(row.G).toMatchObject({ played: 0, remaining: 0, leaguePoints: 0, tieReason: null });
    // A, C, E all have one win: A and C level on game difference, A ahead on points.
    expect(table.map((team) => team.id)).toEqual(['A', 'C', 'E', 'F', 'G', 'D', 'B']);
    expect(table.map((team) => team.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('uses head-to-head when exactly two teams are level on wins', () => {
    const matches = [
      completedMatch('A', 'B', [{ home: 21, away: 19 }, { home: 19, away: 21 }, { home: 22, away: 20 }]),
      completedMatch('B', 'C', [{ home: 21, away: 2 }, { home: 21, away: 3 }]),
      completedMatch('C', 'D', [{ home: 21, away: 5 }, { home: 21, away: 5 }]),
      completedMatch('D', 'A', [{ home: 21, away: 10 }, { home: 21, away: 10 }]),
    ];
    const table = calculateStandings(teams.slice(0, 4), matches);
    // Everyone has one win, so it is a four-way tie decided by game difference first.
    expect(table.every((team) => team.won === 1)).toBe(true);
    const twoWay = calculateStandings(teams.slice(0, 3), matches.slice(0, 2));
    // A and B both have one win; B has far better point difference but lost to A.
    expect(twoWay.map((team) => team.id)).toEqual(['A', 'B', 'C']);
    expect(twoWay[0].tieReason).toBe('Seri: menang head-to-head');
    expect(table).toHaveLength(4);
  });

  it('counts remaining matches for each team', () => {
    const matches = [createMatch('A', 'B'), completedMatch('A', 'C', [{ home: 21, away: 1 }, { home: 21, away: 1 }])];
    const row = Object.fromEntries(calculateStandings(teams.slice(0, 3), matches).map((team) => [team.id, team]));
    expect(row.A).toMatchObject({ played: 1, remaining: 1 });
    expect(row.B).toMatchObject({ played: 0, remaining: 1 });
  });
});
