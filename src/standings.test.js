import { describe, expect, it } from 'vitest';
import { addPoint, createMatch, completeSpecial, overrideMatch } from './domain.js';
import { calculateStandings } from './standings.js';

const result = (home, away, games) => overrideMatch(createMatch(home, away), games);
const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id) => ({ id, name: `Team ${id}` }));

describe('league standings (2 games, 1 point per game)', () => {
  it('awards one point per game won, including draws', () => {
    const matches = [
      result('A', 'B', [{ home: 21, away: 19 }, { home: 21, away: 10 }]),
      result('C', 'D', [{ home: 21, away: 15 }, { home: 18, away: 21 }]),
      completeSpecial(createMatch('E', 'F'), 'walkover', 'E'),
    ];
    const row = Object.fromEntries(calculateStandings(teams, matches).map((team) => [team.id, team]));
    expect(row.A).toMatchObject({ played: 1, won: 1, drawn: 0, leaguePoints: 2, pointDifference: 13 });
    expect(row.B).toMatchObject({ played: 1, lost: 1, leaguePoints: 0 });
    expect(row.C).toMatchObject({ played: 1, drawn: 1, leaguePoints: 1, pointDifference: 3 });
    expect(row.D).toMatchObject({ played: 1, drawn: 1, leaguePoints: 1, pointDifference: -3 });
    expect(row.E).toMatchObject({ won: 1, leaguePoints: 2, pointDifference: 0 });
    expect(row.F).toMatchObject({ lost: 1, leaguePoints: 0 });
    expect(row.G).toMatchObject({ played: 0, remaining: 0, leaguePoints: 0 });
  });

  it('uses head-to-head when exactly two teams are level on points', () => {
    const matches = [
      result('A', 'B', [{ home: 21, away: 19 }, { home: 22, away: 20 }]),
      result('B', 'C', [{ home: 21, away: 2 }, { home: 21, away: 3 }]),
    ];
    const table = calculateStandings(teams.slice(0, 3), matches);
    expect(table.map((team) => team.id)).toEqual(['A', 'B', 'C']);
    expect(table[0].tieReason).toBe('Seri mata: menang head-to-head');
  });

  it('falls back to point difference when the two level teams drew', () => {
    const matches = [result('A', 'B', [{ home: 21, away: 19 }, { home: 10, away: 21 }])];
    const table = calculateStandings(teams.slice(0, 2), matches);
    expect(table.map((team) => team.id)).toEqual(['B', 'A']);
    expect(table[0].tieReason).toBe('Seri mata: ditentukan beza mata badminton');
  });

  it('counts remaining matches and finishes live matches after two games', () => {
    let live = createMatch('A', 'B');
    for (let i = 0; i < 21; i++) live = addPoint(live, 'home');
    const row = Object.fromEntries(calculateStandings(teams.slice(0, 3), [live, result('A', 'C', [{ home: 21, away: 1 }, { home: 21, away: 1 }])]).map((team) => [team.id, team]));
    expect(row.A).toMatchObject({ played: 1, remaining: 1, leaguePoints: 2 });
    expect(row.B).toMatchObject({ played: 0, remaining: 1 });
  });
});
