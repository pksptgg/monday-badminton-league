import { describe, expect, it } from 'vitest';
import { createMatch, addPoint, undoPoint, overrideMatch, clearResult, pointStatus } from './domain.js';

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
  it('cancels a saved result back to an unplayed match', () => {
    const done = { ...overrideMatch({ ...createMatch('A', 'B'), id: 'R1-M1', round: 1, homePlayerIds: ['A1', 'A2'] }, [{ home: 21, away: 18 }, { home: 21, away: 15 }]), completedAt: '2026-11-16T10:00:00Z' };
    const cleared = clearResult(done);
    expect(cleared).toMatchObject({ id: 'R1-M1', round: 1, homePlayerIds: ['A1', 'A2'], status: 'scheduled', games: [], winnerId: null, gamesWon: { home: 0, away: 0 }, pointLog: [] });
    expect(cleared.completedAt).toBeUndefined();
  });
});

describe('pointStatus (game point / match point hint)', () => {
  const play = (match, side, times) => { for (let i = 0; i < times; i++) match = addPoint(match, side); return match; };

  it('is empty early in a game', () => {
    expect(pointStatus(play(createMatch('A', 'B'), 'home', 5))).toEqual({ home: null, away: null });
  });

  it('flags game point in game 1 and match point in game 2', () => {
    let match = play(createMatch('A', 'B'), 'home', 20);
    expect(pointStatus(match)).toEqual({ home: 'game', away: null });
    match = play(addPoint(match, 'home'), 'away', 20);
    expect(pointStatus(match)).toEqual({ home: null, away: 'match' });
  });

  it('flags both sides at 29-29 and nothing once the match is over', () => {
    let match = play(play(createMatch('A', 'B'), 'home', 20), 'away', 20);
    for (let i = 0; i < 9; i++) match = addPoint(addPoint(match, 'home'), 'away');
    expect(match.current).toEqual({ home: 29, away: 29 });
    expect(pointStatus(match)).toEqual({ home: 'game', away: 'game' });
    match = overrideMatch(match, [{ home: 21, away: 10 }, { home: 21, away: 10 }]);
    expect(pointStatus(match)).toEqual({ home: null, away: null });
  });
});
