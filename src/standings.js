const finalStatuses = new Set(['completed', 'walkover', 'retired']);

// Liga Monday Club: every match is 2 games, 1 league point per game won
// (2-0 win = 2, 1-1 draw = 1 each, 0-2 = 0; walkover/retired = 2 to the winner).
// Ties on points:
//   two teams level   -> result of the match between them (a draw does not separate them)
//   three+ teams level -> rally-point difference; if exactly two are still level, head-to-head
//   still level       -> drawing of lots (listed in team order, flagged for the admin)
function partition(ids, valueOf) {
  const groups = new Map();
  for (const id of ids) {
    const value = valueOf(id);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(id);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, group]) => group);
}

const CRITERIA = [{ key: 'pointDifference', label: 'beza mata badminton' }];

function resolve(group, stage, byId, headToHead) {
  if (group.length === 1) return [{ id: group[0], reason: null }];
  if (group.length === 2) {
    const winner = headToHead.get(`${group[0]}|${group[1]}`);
    if (winner) {
      const loser = winner === group[0] ? group[1] : group[0];
      return [{ id: winner, reason: 'Seri mata: menang head-to-head' }, { id: loser, reason: 'Seri mata: kalah head-to-head' }];
    }
  }
  if (stage >= CRITERIA.length) return group.map((id) => ({ id, reason: 'Seri penuh: cabutan undi' }));
  const { key, label } = CRITERIA[stage];
  const parts = partition(group, (id) => byId.get(id)[key]);
  return parts.flatMap((part) => part.length === 1
    ? [{ id: part[0], reason: parts.length > 1 ? `Seri mata: ditentukan ${label}` : null }]
    : resolve(part, stage + 1, byId, headToHead));
}

export function calculateStandings(teams, matches) {
  const rows = teams.map((team) => ({
    ...team,
    played: 0,
    won: 0,
    drawn: 0,
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
    if (!finalStatuses.has(match.status)) {
      home.remaining++;
      away.remaining++;
      continue;
    }
    home.played++;
    away.played++;

    if (match.status === 'walkover' || match.status === 'retired') {
      const winner = match.winnerId === home.id ? home : away;
      const loser = winner === home ? away : home;
      winner.won++;
      loser.lost++;
      headToHead.set(`${home.id}|${away.id}`, winner.id);
      headToHead.set(`${away.id}|${home.id}`, winner.id);
      // The winner is awarded both games; rally points already played still count for a retirement.
      winner.gamesFor += 2;
      loser.gamesAgainst += 2;
      if (match.status === 'retired') {
        const games = [...match.games];
        if (match.current.home || match.current.away) games.push(match.current);
        for (const game of games) {
          home.pointsFor += game.home; home.pointsAgainst += game.away;
          away.pointsFor += game.away; away.pointsAgainst += game.home;
        }
      }
      continue;
    }

    home.gamesFor += match.gamesWon.home;
    home.gamesAgainst += match.gamesWon.away;
    away.gamesFor += match.gamesWon.away;
    away.gamesAgainst += match.gamesWon.home;
    for (const game of match.games) {
      home.pointsFor += game.home; home.pointsAgainst += game.away;
      away.pointsFor += game.away; away.pointsAgainst += game.home;
    }
    if (match.winnerId) {
      const winner = match.winnerId === home.id ? home : away;
      const loser = winner === home ? away : home;
      winner.won++;
      loser.lost++;
      headToHead.set(`${home.id}|${away.id}`, winner.id);
      headToHead.set(`${away.id}|${home.id}`, winner.id);
    } else {
      home.drawn++;
      away.drawn++;
    }
  }

  for (const row of rows) {
    row.leaguePoints = row.gamesFor;
    row.gameDifference = row.gamesFor - row.gamesAgainst;
    row.pointDifference = row.pointsFor - row.pointsAgainst;
  }

  const anyPlayed = rows.some((row) => row.played > 0);
  const ordered = anyPlayed
    ? partition(rows.map((row) => row.id), (id) => byId.get(id).leaguePoints).flatMap((group) => {
      const result = resolve(group, 0, byId, headToHead);
      // Reasons only make sense once every team in the tie has played.
      return group.some((id) => byId.get(id).played === 0) ? result.map(({ id }) => ({ id, reason: null })) : result;
    })
    : rows.map((row) => ({ id: row.id, reason: null }));

  return ordered.map(({ id, reason }, position) => ({ ...byId.get(id), tieReason: reason, rank: position + 1 }));
}
