import { describe, expect, it } from 'vitest';
import { addPoint, overrideMatch, pointStatus, undoPoint, completeSpecial } from './domain.js';
import { canClearSemi, createPlayoff, playoffPodium, resolvePlayoff } from './playoff.js';

const teams = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, name: `Team ${id}`, players: [{ id: `${id}1` }, { id: `${id}2` }] }));
const standings = ['D', 'E', 'A', 'B', 'C'].map((id) => ({ id }));
const play = (match, side, times) => { for (let i = 0; i < times; i++) match = addPoint(match, side); return match; };
const winGame = (match, side) => play(match, side, 21);

describe('best-of-3 play-off scoring', () => {
  const fresh = () => createPlayoff(standings, teams).matches[0];

  it('ends 2-0 after two games', () => {
    const match = winGame(winGame(fresh(), 'home'), 'home');
    expect(match).toMatchObject({ status: 'completed', winnerId: 'D', gamesWon: { home: 2, away: 0 } });
  });

  it('goes to a third game at 1-1 and never draws', () => {
    let match = winGame(winGame(fresh(), 'home'), 'away');
    expect(match.status).toBe('live');
    expect(match.winnerId).toBeNull();
    match = winGame(match, 'away');
    expect(match).toMatchObject({ status: 'completed', winnerId: 'B', gamesWon: { home: 1, away: 2 } });
  });

  it('flags match point only on the deciding game, and undo keeps best-of-3', () => {
    let match = play(fresh(), 'home', 20);
    expect(pointStatus(match)).toEqual({ home: 'game', away: null });
    match = addPoint(match, 'home'); // home leads 1-0 in games
    const homeLeads = play(play(match, 'home', 20), 'away', 19); // game 2 at 20-19
    expect(pointStatus(homeLeads)).toEqual({ home: 'match', away: null });
    const awayLeads = play(play(match, 'away', 20), 'home', 10); // game 2 at 10-20
    expect(pointStatus(awayLeads)).toEqual({ home: null, away: 'game' });
    let decider = addPoint(awayLeads, 'away'); // 1-1, third game
    expect(decider).toMatchObject({ status: 'live', winnerId: null });
    expect(decider.games).toHaveLength(2);
    decider = undoPoint(addPoint(decider, 'home'));
    expect(decider.status).toBe('live');
    expect(decider.games).toHaveLength(2);
    expect(pointStatus(play(play(decider, 'home', 20), 'away', 5))).toEqual({ home: 'match', away: null });
  });

  it('corrects a result with an optional third game', () => {
    const base = fresh();
    expect(overrideMatch(base, [{ home: 21, away: 10 }, { home: 21, away: 12 }, { home: 0, away: 0 }]).winnerId).toBe('D');
    expect(overrideMatch(base, [{ home: 21, away: 10 }, { home: 15, away: 21 }, { home: 19, away: 21 }]).winnerId).toBe('B');
    expect(() => overrideMatch(base, [{ home: 21, away: 10 }, { home: 15, away: 21 }, { home: 0, away: 0 }])).toThrow();
    expect(() => overrideMatch(base, [{ home: 21, away: 10 }, { home: 21, away: 15 }, { home: 21, away: 19 }])).toThrow();
  });
});

describe('play-off bracket', () => {
  it('seeds 1 v 4 and 2 v 3 from the standings', () => {
    const [sf1, sf2, final, third] = createPlayoff(standings, teams).matches;
    expect([sf1.homeTeamId, sf1.awayTeamId]).toEqual(['D', 'B']);
    expect([sf2.homeTeamId, sf2.awayTeamId]).toEqual(['E', 'A']);
    expect(final.homeTeamId).toBeNull();
    expect(third.homeTeamId).toBeNull();
    expect(sf1.homePlayerIds).toEqual(['D1', 'D2']);
  });

  it('fills the final and third place from the semi-finals', () => {
    const playoff = createPlayoff(standings, teams);
    playoff.matches[0] = winGame(winGame(playoff.matches[0], 'away'), 'away'); // B beat D
    let resolved = resolvePlayoff(playoff, teams);
    expect([resolved[2].homeTeamId, resolved[2].awayTeamId]).toEqual(['B', null]);
    playoff.matches[1] = completeSpecial(playoff.matches[1], 'walkover', 'E');
    resolved = resolvePlayoff(playoff, teams);
    expect([resolved[2].homeTeamId, resolved[2].awayTeamId]).toEqual(['B', 'E']);
    expect([resolved[3].homeTeamId, resolved[3].awayTeamId]).toEqual(['D', 'A']);
    expect(resolved[3].awayPlayerIds).toEqual(['A1', 'A2']);
  });

  it('locks semi-final results once the final starts, and reports the podium', () => {
    const playoff = createPlayoff(standings, teams);
    playoff.matches[0] = completeSpecial(playoff.matches[0], 'walkover', 'D');
    playoff.matches[1] = completeSpecial(playoff.matches[1], 'walkover', 'A');
    let resolved = resolvePlayoff(playoff, teams);
    expect(canClearSemi(resolved, 'SF1')).toBe(true);
    playoff.matches[2] = winGame(winGame(resolved[2], 'away'), 'away');
    playoff.matches[3] = completeSpecial(resolved[3], 'walkover', 'E');
    resolved = resolvePlayoff(playoff, teams);
    expect(canClearSemi(resolved, 'SF1')).toBe(false);
    expect(canClearSemi(resolved, 'F')).toBe(true);
    expect(playoffPodium(resolved)).toEqual({ champion: 'A', runnerUp: 'D', third: 'E' });
  });
});
