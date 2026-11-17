import { createMatch } from './domain.js';

// Single round robin. There are no fixed dates: teams play whenever both are
// present, so a "round" is only a guide to the order (each team rests once).
export function generateRoundRobin(teamIds) {
  const rotation = [...teamIds, 'BYE'];
  const fixtures = [];
  const rounds = rotation.length - 1;

  for (let round = 1; round <= rounds; round++) {
    let matchNumber = 1;
    for (let index = 0; index < rotation.length / 2; index++) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];
      if (first === 'BYE' || second === 'BYE') continue;
      const swap = (round + index) % 2 === 0;
      fixtures.push({
        ...createMatch(swap ? second : first, swap ? first : second),
        id: `R${round}-M${matchNumber}`,
        round,
        matchNumber,
        court: 1,
      });
      matchNumber++;
    }
    const fixed = rotation[0];
    rotation.splice(0, 1, fixed, rotation[rotation.length - 1]);
    rotation.pop();
  }
  return fixtures;
}

// Group matches by round for the fixtures page, rounds in order and matches in
// their round order. Matches without a round go last (round 0).
export function groupByRound(matches) {
  const groups = new Map();
  for (const match of matches) {
    const round = Number.isInteger(match.round) && match.round > 0 ? match.round : 0;
    if (!groups.has(round)) groups.set(round, []);
    groups.get(round).push(match);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a || Number.MAX_SAFE_INTEGER) - (b || Number.MAX_SAFE_INTEGER))
    .map(([round, items]) => ({ round, matches: [...items].sort((x, y) => (x.matchNumber || 0) - (y.matchNumber || 0)) }));
}

// Teams with no match in the given round (the round's bye).
export function restingTeams(teamIds, roundMatches) {
  const playing = new Set(roundMatches.flatMap((match) => [match.homeTeamId, match.awayTeamId]));
  return teamIds.filter((id) => !playing.has(id));
}
