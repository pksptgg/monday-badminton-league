const finals = new Set(['completed', 'walkover', 'retired']);

export function calculatePlayerStats(teams, matches) {
  const players = teams.flatMap((team) => team.players.map((player) => ({
    ...player,
    teamId: team.id,
    teamName: team.name,
    played: 0,
    won: 0,
    lost: 0,
    winRate: 0,
  })));
  const byId = new Map(players.map((player) => [player.id, player]));
  for (const match of matches) {
    if (!finals.has(match.status) || !match.winnerId) continue;
    for (const [side, teamId] of [['home', match.homeTeamId], ['away', match.awayTeamId]]) {
      for (const playerId of match[`${side}PlayerIds`] || []) {
        const player = byId.get(playerId);
        if (!player) continue;
        player.played++;
        if (match.winnerId === teamId) player.won++;
        else player.lost++;
      }
    }
  }
  players.forEach((player) => { player.winRate = player.played ? Math.round(player.won / player.played * 100) : 0; });
  return players.sort((a, b) => b.won - a.won || b.winRate - a.winRate || a.name.localeCompare(b.name));
}

export function calculatePairStats(teams, matches) {
  const pairs = new Map();
  const playerTeam = new Map(teams.flatMap((team) => team.players.map((player) => [player.id, { ...player, teamId: team.id, teamName: team.name }])));
  for (const match of matches) {
    if (!finals.has(match.status) || !match.winnerId) continue;
    for (const [side, teamId] of [['home', match.homeTeamId], ['away', match.awayTeamId]]) {
      const ids = [...(match[`${side}PlayerIds`] || [])].sort();
      if (ids.length !== 2) continue;
      const key = ids.join('-');
      if (!pairs.has(key)) {
        const members = ids.map((id) => playerTeam.get(id)).filter(Boolean);
        pairs.set(key, { key, names: members.map((player) => player.name), teamName: members[0]?.teamName || '-', played: 0, won: 0, winRate: 0 });
      }
      const pair = pairs.get(key);
      pair.played++;
      if (match.winnerId === teamId) pair.won++;
    }
  }
  return [...pairs.values()].map((pair) => ({ ...pair, winRate: Math.round(pair.won / pair.played * 100) }))
    .sort((a, b) => b.won - a.won || b.winRate - a.winRate);
}
