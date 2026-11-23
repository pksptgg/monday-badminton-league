// Liga Monday Club: every league match is exactly 2 games (2-0 win or 1-1 draw).
// Play-off matches carry `bestOf: 3`: first to 2 games, no draw.
export const GAMES_PER_MATCH = 2;

export function maxGames(match) {
  return match.bestOf === 3 ? 3 : GAMES_PER_MATCH;
}

function isMatchOver(match, games, gamesWon) {
  if (match.bestOf === 3) return gamesWon.home === 2 || gamesWon.away === 2;
  return games.length === GAMES_PER_MATCH;
}

function matchWinner(match, gamesWon) {
  if (gamesWon.home > gamesWon.away) return match.homeTeamId;
  if (gamesWon.away > gamesWon.home) return match.awayTeamId;
  return null; // 1-1 draw
}

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
  const games = [...next.games, current];
  const completed = isMatchOver(match, games, gamesWon);
  return {
    ...next,
    games,
    current: { home: 0, away: 0 },
    gamesWon,
    status: completed ? 'completed' : 'live',
    winnerId: completed ? matchWinner(match, gamesWon) : null,
  };
}

// For the scorer: would the next rally win the game ('game') or end the match
// ('match', the second game decides 2-0 or 1-1)? null otherwise.
export function pointStatus(match) {
  const none = { home: null, away: null };
  if (!['scheduled', 'live'].includes(match.status) || match.games.length >= maxGames(match)) return none;
  const result = { ...none };
  for (const side of ['home', 'away']) {
    const next = { ...match.current, [side]: match.current[side] + 1 };
    if (gameWinner(next.home, next.away) !== side) continue;
    const decides = match.bestOf === 3 ? match.gamesWon[side] + 1 === 2 : match.games.length + 1 === GAMES_PER_MATCH;
    result[side] = decides ? 'match' : 'game';
  }
  return result;
}

export function undoPoint(match) {
  if (!match.pointLog.length || match.status === 'walkover' || match.status === 'retired') return match;
  const pointLog = match.pointLog.slice(0, -1);
  let replayed = { ...createMatch(match.homeTeamId, match.awayTeamId), bestOf: match.bestOf };
  for (const side of pointLog) replayed = addPoint(replayed, side);
  return { ...match, ...replayed, pointLog };
}

export function completeSpecial(match, status, winnerId) {
  if (!['walkover', 'retired'].includes(status)) throw new Error('Invalid result status');
  if (![match.homeTeamId, match.awayTeamId].includes(winnerId)) throw new Error('Winner must be in this match');
  return { ...match, status, winnerId };
}

export function overrideMatch(match, input) {
  let games = input;
  if (match.bestOf === 3) {
    // The third game is only played at 1-1; an empty 0:0 third game is ignored.
    games = input.filter((game, index) => index < 2 || Number(game.home) || Number(game.away));
    if (games.length < 2 || games.length > 3) throw new Error('A best-of-3 match needs two or three games');
  } else if (games.length !== GAMES_PER_MATCH) {
    throw new Error('A completed match needs exactly two games');
  }
  const gamesWon = { home: 0, away: 0 };
  for (const [index, game] of games.entries()) {
    const winner = gameWinner(Number(game.home), Number(game.away));
    if (!winner) throw new Error('Every game must have a valid 21-point result');
    if (match.bestOf === 3 && (gamesWon.home === 2 || gamesWon.away === 2)) throw new Error(`Game ${index + 1} played after the match was decided`);
    gamesWon[winner]++;
  }
  if (match.bestOf === 3 && gamesWon.home !== 2 && gamesWon.away !== 2) throw new Error('A best-of-3 match needs a winner');
  return {
    ...match,
    games: games.map((game) => ({ home: Number(game.home), away: Number(game.away) })),
    current: { home: 0, away: 0 },
    gamesWon,
    status: 'completed',
    winnerId: matchWinner(match, gamesWon),
    pointLog: [],
  };
}

// Admin "Batal keputusan": wipe a saved result so the match can be scored again.
export function clearResult(match) {
  const fresh = createMatch(match.homeTeamId, match.awayTeamId);
  const { completedAt, ...rest } = match;
  return { ...rest, ...fresh };
}
