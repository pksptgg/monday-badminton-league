const finalStatuses = new Set(['completed', 'walkover', 'retired']);

// Ranking follows BWF group rules:
// 1. matches won
// 2. two teams level  -> winner of the match between them
// 3. three+ teams level -> game difference, then point difference
//    (whenever exactly two are still level, their head-to-head decides)
// 4. still level -> drawing of lots (listed in team order, flagged for the admin)
function partition(ids, valueOf) {
  const groups = new Map();
  for (const id of ids) {
    const value = valueOf(id);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(id);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, group]) => group);
}

const CRITERIA = [
  { key: 'gameDifference', label: 'beza game' },
  { key: 'pointDifference', label: 'beza mata' },
];

function resolve(group, stage, byId, headToHead) {
  if (group.length === 1) return [{ id: group[0], reason: null }];
  if (group.length === 2) {
    const winner = headToHead.get(`${group[0]}|${group[1]}`);
    if (winner) {
      const loser = winner === group[0] ? group[1] : group[0];
      return [{ id: winner, reason: 'Seri: menang head-to-head' }, { id: loser, reason: 'Seri: kalah head-to-head' }];
    }
  }
  if (stage >= CRITERIA.length) return group.map((id) => ({ id, reason: 'Seri penuh: cabutan undi' }));
  const { key, label } = CRITERIA[stage];
  const parts = partition(group, (id) => byId.get(id)[key]);
  return parts.flatMap((part) => part.length === 1
    ? [{ id: part[0], reason: parts.length > 1 ? `Seri: ditentukan ${label}` : null }]
    : resolve(part, stage + 1, byId, headToHead));
}

export function calculateStandings(teams, matches) {
  const rows = teams.map((team) => ({
    ...team,
    played: 0,
    won: 0,
    lost: 0,
    remaining: 0,
    leaguePoints: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    gameDifference: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifference: 0,
    tieReason: null,
  }));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const headToHead = new Map();

  for (const match of matches) {
    const home = byId.get(match.homeTeamId);
    const away = byId.get(match.awayTeamId);
    if (!home || !away) continue;
    if (!finalStatuses.has(match.status) || !match.winnerId) {
      home.remaining++;
      away.remaining++;
      continue;
    }
    const homeWon = match.winnerId === match.homeTeamId;
    const winner = homeWon ? home : away;
    const loser = homeWon ? away : home;
    home.played++;
    away.played++;
    winner.won++;
    loser.lost++;
    headToHead.set(`${home.id}|${away.id}`, winner.id);
    headToHead.set(`${away.id}|${home.id}`, winner.id);

    if (match.status === 'walkover') {
      // A walkover counts as a 2-0 win in games, with no rally points.
      winner.gamesFor += 2;
      loser.gamesAgainst += 2;
      continue;
    }
    home.gamesFor += match.gamesWon.home;
    home.gamesAgainst += match.gamesWon.away;
    away.gamesFor += match.gamesWon.away;
    away.gamesAgainst += match.gamesWon.home;
    const games = [...match.games];
    if (match.status === 'retired' && (match.current.home || match.current.away)) games.push(match.current);
    for (const game of games) {
      home.pointsFor += game.home;
      home.pointsAgainst += game.away;
      away.pointsFor += game.away;
      away.pointsAgainst += game.home;
    }
  }

  for (const row of rows) {
    row.gameDifference = row.gamesFor - row.gamesAgainst;
    row.pointDifference = row.pointsFor - row.pointsAgainst;
    // Menang 2 mata, kalah 0: kept for the carta keputusan and WhatsApp summary.
    row.leaguePoints = row.won * 2;
  }

  const anyPlayed = rows.some((row) => row.played > 0);
  const ordered = anyPlayed
    ? partition(rows.map((row) => row.id), (id) => byId.get(id).won).flatMap((group) => {
      const result = resolve(group, 0, byId, headToHead);
      // Reasons only make sense once every team in the tie has played.
      return group.some((id) => byId.get(id).played === 0) ? result.map(({ id }) => ({ id, reason: null })) : result;
    })
    : rows.map((row) => ({ id: row.id, reason: null }));

  return ordered.map(({ id, reason }, position) => ({ ...byId.get(id), tieReason: reason, rank: position + 1 }));
}
