import { createMatch } from './domain.js';

// Play-off for the top 4: semi-finals 1 v 4 and 2 v 3, then the final
// (semi-final winners) and the third-place match (semi-final losers).
// Every play-off match is best of 3 games. Play-off matches live in
// league.playoff.matches, apart from league.matches, so they never count
// towards the league table or player statistics.
export const STAGES = {
  SF1: { label: 'Separuh akhir 1', short: 'SA1' },
  SF2: { label: 'Separuh akhir 2', short: 'SA2' },
  F: { label: 'Akhir', short: 'Akhir' },
  T3: { label: 'Tempat ketiga', short: 'Ke-3' },
};
const FINAL = new Set(['completed', 'walkover', 'retired']);

function lineup(teams, teamId) {
  return (teams.find((team) => team.id === teamId)?.players || []).slice(0, 2).map((player) => player.id);
}

export function createPlayoff(standings, teams) {
  const seeds = standings.slice(0, 4).map((row) => row.id);
  if (seeds.length < 4) throw new Error('Play-off perlu sekurang-kurangnya 4 team.');
  const make = (stage, court, home = null, away = null) => ({
    ...createMatch(home, away),
    id: `PO-${stage}`,
    stage,
    label: STAGES[stage].label,
    court,
    bestOf: 3,
    homePlayerIds: home ? lineup(teams, home) : [],
    awayPlayerIds: away ? lineup(teams, away) : [],
  });
  return {
    createdAt: new Date().toISOString(),
    seeds,
    matches: [
      make('SF1', 1, seeds[0], seeds[3]),
      make('SF2', 2, seeds[1], seeds[2]),
      make('F', 1),
      make('T3', 2),
    ],
  };
}

export function hasStarted(match) {
  return Boolean(match) && (match.status !== 'scheduled' || match.pointLog.length > 0);
}

function outcome(match) {
  if (!match || !FINAL.has(match.status) || !match.winnerId) return null;
  return { winner: match.winnerId, loser: match.winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId };
}

// Fill the final and third-place teams from the semi-final results. Once one
// of those matches has started it keeps the teams it was played with.
export function resolvePlayoff(playoff, teams = []) {
  if (!Array.isArray(playoff?.matches)) return [];
  const byStage = Object.fromEntries(playoff.matches.map((match) => [match.stage, match]));
  const semis = [outcome(byStage.SF1), outcome(byStage.SF2)];
  return playoff.matches.map((match) => {
    if ((match.stage !== 'F' && match.stage !== 'T3') || hasStarted(match)) return match;
    const pick = match.stage === 'F' ? 'winner' : 'loser';
    const [home, away] = semis.map((result) => result?.[pick] ?? null);
    return {
      ...match,
      homeTeamId: home,
      awayTeamId: away,
      homePlayerIds: home && home === match.homeTeamId && match.homePlayerIds?.length ? match.homePlayerIds : home ? lineup(teams, home) : [],
      awayPlayerIds: away && away === match.awayTeamId && match.awayPlayerIds?.length ? match.awayPlayerIds : away ? lineup(teams, away) : [],
    };
  });
}

// A semi-final result can only be cancelled while the final and the
// third-place match have not started (they were set up from it).
export function canClearSemi(matches, stage) {
  if (stage !== 'SF1' && stage !== 'SF2') return true;
  return !matches.some((match) => (match.stage === 'F' || match.stage === 'T3') && hasStarted(match));
}

export function playoffPodium(matches) {
  const byStage = Object.fromEntries(matches.map((match) => [match.stage, match]));
  const final = outcome(byStage.F);
  const third = outcome(byStage.T3);
  return { champion: final?.winner ?? null, runnerUp: final?.loser ?? null, third: third?.winner ?? null };
}
