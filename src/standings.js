const finalStatuses = new Set(['completed', 'walkover', 'retired']);

export function calculateStandings(teams, matches) {
  const rows = teams.map((team, index) => ({
    ...team,
    index,
    played: 0,
    won: 0,
    lost: 0,
    leaguePoints: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    gameDifference: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifference: 0,
  }));
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const match of matches) {
    if (!finalStatuses.has(match.status) || !match.winnerId) continue;
    const home = byId.get(match.homeTeamId);
    const away = byId.get(match.awayTeamId);
    if (!home || !away) continue;
    const homeWon = match.winnerId === match.homeTeamId;
    const winner = homeWon ? home : away;
    const loser = homeWon ? away : home;
    home.played++;
    away.played++;
    winner.won++;
    loser.lost++;
    winner.leaguePoints += 2;
    loser.leaguePoints += match.status === 'walkover' ? 0 : 1;

    if (match.status !== 'walkover') {
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
  }

  for (const row of rows) {
    row.gameDifference = row.gamesFor - row.gamesAgainst;
    row.pointDifference = row.pointsFor - row.pointsAgainst;
  }
  rows.sort((a, b) =>
    b.leaguePoints - a.leaguePoints ||
    b.gameDifference - a.gameDifference ||
    b.pointDifference - a.pointDifference ||
    a.index - b.index
  );
  rows.forEach((row, position) => {
    const previous = rows[position - 1];
    row.rank = previous &&
      previous.leaguePoints === row.leaguePoints &&
      previous.gameDifference === row.gameDifference &&
      previous.pointDifference === row.pointDifference
      ? previous.rank
      : position + 1;
    delete row.index;
  });
  return rows;
}
