import { generateRoundRobin } from './schedule.js';

export const DEFAULT_PIN = '123456';

export function createSeedLeague() {
  const teamData = [
    ['A', ['Poknik', 'Sharil']],
    ['B', ['Aziz', 'Zizi']],
    ['C', ['Qori', 'Hafiz']],
    ['D', ['Dr D', 'Safar']],
    ['E', ['Pokjas', 'X']],
    ['F', ['Fuad', 'Tamimi']],
    ['G', ['Paiz', 'Midi']],
  ];
  const teams = teamData.map(([id, players]) => ({
    id,
    name: `Team ${id}`,
    players: players.map((name, index) => ({ id: `${id}${index + 1}`, name })),
  }));
  const matches = generateRoundRobin(teams.map((team) => team.id)).map((match) => ({
    ...match,
    homePlayerIds: teams.find((team) => team.id === match.homeTeamId).players.map((player) => player.id),
    awayPlayerIds: teams.find((team) => team.id === match.awayTeamId).players.map((player) => player.id),
  }));
  return {
    id: 'monday-badminton-league',
    name: 'Monday Badminton League',
    season: 'Musim 1',
    teams,
    matches,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
