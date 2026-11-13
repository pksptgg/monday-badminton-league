export function createMatch(homeTeamId, awayTeamId) {
  return {
    homeTeamId,
    awayTeamId,
    status: 'scheduled',
    games: [],
    current: { home: 0, away: 0 },
    gamesWon: { home: 0, away: 0 },
    winnerId: null,
    pointLog: [],
  };
}

function gameWinner(home, away) {
  if (home === away) return null;
  const high = Math.max(home, away);
  const difference = Math.abs(home - away);
  if ((high >= 21 && difference >= 2) || high === 30) {
    return home > away ? 'home' : 'away';
  }
  return null;
}

export function addPoint(match, side) {
  if (match.status === 'completed' || match.status === 'walkover') return match;
  const current = { ...match.current, [side]: match.current[side] + 1 };
  const next = {
    ...match,
    status: 'live',
    current,
    pointLog: [...match.pointLog, side],
  };
  const winner = gameWinner(current.home, current.away);
  if (!winner) return next;

  const gamesWon = { ...next.gamesWon, [winner]: next.gamesWon[winner] + 1 };
  const completed = gamesWon[winner] === 2;
  return {
    ...next,
    games: [...next.games, current],
    current: { home: 0, away: 0 },
    gamesWon,
    status: completed ? 'completed' : 'live',
    winnerId: completed ? match[`${winner}TeamId`] : null,
  };
}

export function undoPoint(match) {
  if (!match.pointLog.length || match.status === 'walkover' || match.status === 'retired') return match;
  const pointLog = match.pointLog.slice(0, -1);
  let replayed = createMatch(match.homeTeamId, match.awayTeamId);
  for (const side of pointLog) replayed = addPoint(replayed, side);
  return { ...match, ...replayed, pointLog };
}

export function completeSpecial(match, status, winnerId) {
  if (!['walkover', 'retired'].includes(status)) throw new Error('Invalid result status');
  if (![match.homeTeamId, match.awayTeamId].includes(winnerId)) throw new Error('Winner must be in this match');
  return { ...match, status, winnerId };
}

export function overrideMatch(match, games) {
  if (![2, 3].includes(games.length)) throw new Error('A completed match needs two or three games');
  const gamesWon = { home: 0, away: 0 };
  for (const game of games) {
    const winner = gameWinner(Number(game.home), Number(game.away));
    if (!winner) throw new Error('Every game must have a valid 21-point result');
    gamesWon[winner]++;
  }
  if (Math.max(gamesWon.home, gamesWon.away) !== 2) throw new Error('Match winner must win two games');
  const side = gamesWon.home === 2 ? 'home' : 'away';
  return {
    ...match,
    games: games.map((game) => ({ home: Number(game.home), away: Number(game.away) })),
    current: { home: 0, away: 0 },
    gamesWon,
    status: 'completed',
    winnerId: match[`${side}TeamId`],
    pointLog: [],
  };
}
