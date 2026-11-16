import { describe, expect, it } from 'vitest';
import { createMatch, addPoint, undoPoint, overrideMatch } from './domain.js';

describe('BWF 21-point scoring', () => {
  it('finishes a game at 21 points with a two-point lead', () => {
    let match = createMatch('A', 'B');
    for (let i = 0; i < 20; i++) match = addPoint(match, 'home');
    for (let i = 0; i < 19; i++) match = addPoint(match, 'away');
    match = addPoint(match, 'home');
    expect(match.status).toBe('live');
    expect(match.games).toEqual([{ home: 21, away: 19 }]);
    expect(match.current).toEqual({ home: 0, away: 0 });
    expect(match.gamesWon).toEqual({ home: 1, away: 0 });
  });

  it('continues at deuce and caps a game at 30', () => {
    let match = createMatch('A', 'B');
    for (let i = 0; i < 20; i++) {
      match = addPoint(match, 'home');
      match = addPoint(match, 'away');
    }
    match = addPoint(match, 'home');
    match = addPoint(match, 'away');
    expect(match.games).toEqual([]);
    for (let i = 0; i < 9; i++) {
      match = addPoint(match, 'home');
      match = addPoint(match, 'away');
    }
    match = addPoint(match, 'home');
    expect(match.games).toEqual([{ home: 30, away: 29 }]);
  });

  it('undoes the last rally including a game-winning rally', () => {
    let match = createMatch('A', 'B');
    for (let i = 0; i < 21; i++) match = addPoint(match, 'home');
    match = undoPoint(match);
    expect(match.games).toEqual([]);
    expect(match.current).toEqual({ home: 20, away: 0 });
    expect(match.gamesWon).toEqual({ home: 0, away: 0 });
  });

  it('ends a match after exactly two games, with 1-1 as a draw', () => {
    let match = createMatch('A', 'B');
    for (let i = 0; i < 21; i++) match = addPoint(match, 'home');
    expect(match.status).toBe('live');
    for (let i = 0; i < 21; i++) match = addPoint(match, 'away');
    expect(match.status).toBe('completed');
    expect(match.gamesWon).toEqual({ home: 1, away: 1 });
    expect(match.winnerId).toBeNull();
    expect(addPoint(match, 'home')).toBe(match);
  });

  it('allows an admin to correct final scores for two games', () => {
    const win = overrideMatch(createMatch('A', 'B'), [{ home: 21, away: 18 }, { home: 30, away: 29 }]);
    expect(win).toMatchObject({ status: 'completed', winnerId: 'A', gamesWon: { home: 2, away: 0 } });
    const draw = overrideMatch(createMatch('A', 'B'), [{ home: 21, away: 18 }, { home: 17, away: 21 }]);
    expect(draw).toMatchObject({ status: 'completed', winnerId: null, gamesWon: { home: 1, away: 1 } });
    expect(() => overrideMatch(createMatch('A', 'B'), [{ home: 21, away: 18 }])).toThrow();
  });
});
