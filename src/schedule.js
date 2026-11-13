import { createMatch } from './domain.js';

export function generateRoundRobin(teamIds, startDate = '2026-11-16') {
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
      const homeTeamId = swap ? second : first;
      const awayTeamId = swap ? first : second;
      const dayOffset = Math.floor((round - 1) / 2) * 7 + ((round - 1) % 2);
      const date = new Date(`${startDate}T00:00:00`);
      date.setDate(date.getDate() + dayOffset);
      fixtures.push({
        ...createMatch(homeTeamId, awayTeamId),
        id: `R${round}-M${matchNumber}`,
        round,
        matchNumber,
        court: 1,
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        session: (round - 1) % 2 === 0 ? 'Isnin' : 'Selasa',
      });
      matchNumber++;
    }
    const fixed = rotation[0];
    rotation.splice(0, 1, fixed, rotation[rotation.length - 1]);
    rotation.pop();
  }
  return fixtures;
}
