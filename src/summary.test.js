import { describe, expect, it } from 'vitest';
import { buildDailySummary, matchesOnDay, playedOn } from './summary.js';
import { generateRoundRobin } from './schedule.js';

const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const teams = ids.map((id) => ({ id, name: `Team ${id}`, players: [{ id: `${id}1`, name: `${id}-one` }, { id: `${id}2`, name: `${id}-two` }] }));
// Local-time timestamps so the test does not depend on the machine's time zone.
const at = (y, m, d, h) => new Date(y, m - 1, d, h).toISOString();

function league() {
  const matches = generateRoundRobin(ids);
  const set = (home, away, patch) => {
    const index = matches.findIndex((match) => match.homeTeamId === home && match.awayTeamId === away);
    matches[index] = { ...matches[index], ...patch };
  };
  const first = matches[0];
  const second = matches[1];
  set(first.homeTeamId, first.awayTeamId, { status: 'completed', games: [{ home: 21, away: 18 }, { home: 21, away: 14 }], gamesWon: { home: 2, away: 0 }, winnerId: first.homeTeamId, completedAt: at(2026, 11, 17, 18) });
  set(second.homeTeamId, second.awayTeamId, { status: 'completed', games: [{ home: 21, away: 19 }, { home: 19, away: 21 }], gamesWon: { home: 1, away: 1 }, winnerId: null, completedAt: at(2026, 11, 17, 19) });
  set(matches[2].homeTeamId, matches[2].awayTeamId, { status: 'walkover', winnerId: matches[2].awayTeamId, completedAt: at(2026, 11, 16, 18) });
  return { name: 'Monday Badminton League', teams, matches, first, second };
}

describe('daily summary', () => {
  it('picks matches by the day they finished, or the admin-set date', () => {
    const data = league();
    expect(matchesOnDay(data.matches, '2026-11-17')).toHaveLength(2);
    expect(matchesOnDay(data.matches, '2026-11-16')).toHaveLength(1);
    expect(playedOn({ dateCorrected: true, date: '2026-11-20', completedAt: at(2026, 11, 17, 18) })).toBe('2026-11-20');
    // A planned date set before the match is ignored once it is finished.
    expect(playedOn({ dateSetByAdmin: true, date: '2026-11-17', completedAt: at(2026, 11, 24, 18) })).toBe('2026-11-24');
  });

  it('lists results, highlights, the table and the next priority', () => {
    const data = league();
    const { text, count } = buildDailySummary(data, { day: '2026-11-17', venue: 'Kompleks Sukan Wakaf Tapai', courts: 2, url: 'https://example.test/' });
    expect(count).toBe(2);
    expect(text).toContain('Rumusan Selasa, 17.11.26');
    expect(text).toContain('📍 Kompleks Sukan Wakaf Tapai · 2 court');
    expect(text).toContain(`*2–0* Team ${data.first.awayTeamId}`);
    expect(text).toContain(`*TEAM ${data.first.homeTeamId} MENANG*`);
    expect(text).toContain('21–19, 19–21 · *SERI*');
    expect(text).toContain(`⭐ Team ${data.first.homeTeamId} menang 2–0 ke atas Team ${data.first.awayTeamId}.`);
    expect(text).toContain('🔥 Paling sengit:');
    expect(text).toContain('📊 Liga: 3 / 21 perlawanan selesai');
    expect(text).toContain('➡️ Sesi seterusnya: *');
    expect(text).toContain('(belum main)');
    expect(text.trim().endsWith('https://example.test/')).toBe(true);
  });

  it('says so when nothing was played that day', () => {
    const { text, count } = buildDailySummary(league(), { day: '2026-11-18' });
    expect(count).toBe(0);
    expect(text).toContain('Tiada perlawanan direkod');
    expect(text).not.toContain('KEPUTUSAN HARI INI');
  });

  it('shows walkovers and play-off matches', () => {
    const data = league();
    expect(buildDailySummary(data, { day: '2026-11-16' }).text).toContain('W/O · *Team');
    const playoffMatches = [{ id: 'PO-F', stage: 'F', label: 'Akhir', homeTeamId: 'A', awayTeamId: 'B', status: 'completed', bestOf: 3, games: [{ home: 21, away: 10 }, { home: 18, away: 21 }, { home: 21, away: 19 }], gamesWon: { home: 2, away: 1 }, winnerId: 'A', completedAt: at(2026, 11, 30, 19) }];
    const { text } = buildDailySummary(data, { day: '2026-11-30', playoffMatches });
    expect(text).toContain('*PLAY-OFF*');
    expect(text).toContain('Akhir: Team A (A-one/A-two) *2–1* Team B');
  });
});
