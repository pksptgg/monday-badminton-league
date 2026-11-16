import { describe, expect, it } from 'vitest';
import { assignCourts, normalizeCourts } from './courts.js';

const m = (id, homeTeamId, awayTeamId) => ({ id, homeTeamId, awayTeamId });

describe('court assignment', () => {
  it('keeps the order unchanged on one court', () => {
    const order = [m('1', 'A', 'B'), m('2', 'A', 'C'), m('3', 'B', 'C')];
    expect(assignCourts(order, 1).map(({ match, turn, court }) => [match.id, turn, court])).toEqual([['1', 1, 1], ['2', 2, 1], ['3', 3, 1]]);
  });

  it('pairs matches with no shared team on two courts', () => {
    const order = [m('1', 'A', 'B'), m('2', 'A', 'C'), m('3', 'C', 'D'), m('4', 'B', 'D')];
    const result = assignCourts(order, 2).map(({ match, turn, court }) => [match.id, turn, court]);
    expect(result).toEqual([['1', 1, 1], ['3', 1, 2], ['2', 2, 1], ['4', 2, 2]]);
  });

  it('never puts the same team on two courts in one turn', () => {
    const order = [m('1', 'A', 'B'), m('2', 'A', 'C'), m('3', 'B', 'C')];
    const result = assignCourts(order, 2);
    const byTurn = new Map();
    for (const { match, turn } of result) byTurn.set(turn, [...(byTurn.get(turn) || []), match.homeTeamId, match.awayTeamId]);
    for (const teams of byTurn.values()) expect(new Set(teams).size).toBe(teams.length);
    expect(result).toHaveLength(3);
  });

  it('limits courts to 1-4', () => {
    expect(normalizeCourts('2')).toBe(2);
    expect(normalizeCourts(0)).toBe(1);
    expect(normalizeCourts(9)).toBe(1);
  });
});
