// "Rumusan hari ini": a WhatsApp-ready summary of the matches finished on one
// day, plus highlights, the current table and who to put first next session.
import { calculateStandings } from './standings.js';

const FINAL = new Set(['completed', 'walkover', 'retired']);
const DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

export function localIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// The day a finished match belongs to: when it was finished (device time),
// unless the admin corrected the date after the match was finished. A planned
// date set before the match does not count.
export function playedOn(match) {
  if (match.dateCorrected && match.date) return match.date;
  if (match.completedAt) return localIso(new Date(match.completedAt));
  return match.date || null;
}

export function matchesOnDay(matches, day) {
  return matches
    .filter((match) => FINAL.has(match.status) && playedOn(match) === day)
    .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''));
}

function formatDay(day) {
  const [year, month, date] = day.split('-').map(Number);
  const weekday = DAYS[new Date(year, month - 1, date).getDay()];
  return `${weekday}, ${String(date).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(2)}`;
}

function names(team, ids) {
  const picked = (ids || []).map((id) => team.players.find((player) => player.id === id)?.name).filter(Boolean);
  const list = picked.length ? picked : team.players.slice(0, 2).map((player) => player.name);
  return list.join('/');
}

function side(team, ids) {
  return `${team.name} (${names(team, ids)})`;
}

function resultLines(match, index, teamsById) {
  const home = teamsById.get(match.homeTeamId);
  const away = teamsById.get(match.awayTeamId);
  const winner = teamsById.get(match.winnerId);
  const games = match.games.map((game) => `${game.home}–${game.away}`).join(', ');
  const prefix = match.label ? `${match.label}: ` : '';
  if (match.status === 'walkover') {
    return `${index}. ${prefix}${side(home, match.homePlayerIds)} lwn ${side(away, match.awayPlayerIds)}\n   W/O · *${winner?.name || '—'} menang (walkover)*`;
  }
  const score = `${match.gamesWon.home}–${match.gamesWon.away}`;
  if (match.status === 'retired') {
    return `${index}. ${prefix}${side(home, match.homePlayerIds)} ${score} ${side(away, match.awayPlayerIds)}\n   ${games ? `${games} · ` : ''}RET · *${winner?.name || '—'} menang (retired)*`;
  }
  const verdict = match.winnerId ? `*${winner.name.toUpperCase()} MENANG*` : '*SERI*';
  const shown = match.winnerId ? `*${score}*` : score;
  return `${index}. ${prefix}${side(home, match.homePlayerIds)} ${shown} ${side(away, match.awayPlayerIds)}\n   ${games} · ${verdict}`;
}

function highlights(day, teamsById) {
  const lines = [];
  const league = day.filter((match) => !match.stage);
  for (const match of day) {
    if (match.status !== 'completed' || !match.winnerId) continue;
    const loserId = match.winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    const winnerGames = match.winnerId === match.homeTeamId ? match.gamesWon.home : match.gamesWon.away;
    const loserGames = match.winnerId === match.homeTeamId ? match.gamesWon.away : match.gamesWon.home;
    if (loserGames === 0) lines.push(`⭐ ${teamsById.get(match.winnerId).name} menang ${winnerGames}–0 ke atas ${teamsById.get(loserId).name}.`);
  }
  const draws = league.filter((match) => match.status === 'completed' && !match.winnerId).length;
  if (draws > 1) lines.push(`🤝 ${draws} daripada ${league.length} perlawanan berakhir seri.`);
  else if (draws === 1 && league.length === 1) lines.push('🤝 Perlawanan berakhir seri.');
  let longest = null;
  for (const match of day) {
    match.games.forEach((game, index) => {
      const total = game.home + game.away;
      if (Math.abs(game.home - game.away) <= 2 && (!longest || total > longest.total)) longest = { match, game, index, total };
    });
  }
  if (longest) {
    const { match, game, index } = longest;
    lines.push(`🔥 Paling sengit: ${teamsById.get(match.homeTeamId).name} lwn ${teamsById.get(match.awayTeamId).name}, game ${index + 1} ${game.home}–${game.away}.`);
  }
  return lines;
}

export function buildDailySummary(league, { day, venue, courts, url, playoffMatches = [] } = {}) {
  const teamsById = new Map(league.teams.map((team) => [team.id, team]));
  const leagueToday = matchesOnDay(league.matches, day);
  const playoffToday = matchesOnDay(playoffMatches, day);
  const all = [...leagueToday, ...playoffToday];
  const standings = calculateStandings(league.teams, league.matches);
  const done = league.matches.filter((match) => FINAL.has(match.status)).length;

  const out = [`*${(league.name || 'Monday Badminton League').toUpperCase()}* 🏸`, `Rumusan ${formatDay(day)}`];
  if (venue) out.push(`📍 ${venue}${courts > 1 ? ` · ${courts} court` : ''}`);

  if (leagueToday.length) out.push('', '*KEPUTUSAN HARI INI*', ...leagueToday.map((match, index) => resultLines(match, index + 1, teamsById)));
  if (playoffToday.length) out.push('', '*PLAY-OFF*', ...playoffToday.map((match, index) => resultLines(match, index + 1, teamsById)));
  if (!all.length) out.push('', '_Tiada perlawanan direkod pada hari ini._');

  const notes = highlights(all, teamsById);
  if (notes.length) out.push('', ...notes);

  out.push('', '*KEDUDUKAN TERKINI* (Mata · Main · Baki)', ...standings.map((row) => `${row.rank}. ${row.name} — ${row.leaguePoints} mata · ${row.played} main · baki ${row.remaining}`));
  if (standings.some((row) => row.tieReason?.includes('beza mata'))) out.push('_Mata sama ditentukan ikut beza mata badminton._');
  out.push('_4 teratas ke playoff._');

  out.push('', `📊 Liga: ${done} / ${league.matches.length} perlawanan selesai`);
  const waiting = standings.filter((row) => row.remaining > 0);
  if (waiting.length) {
    const fewest = Math.min(...waiting.map((row) => row.played));
    const first = waiting.filter((row) => row.played === fewest).map((row) => row.name.replace('Team ', ''));
    const list = first.length > 1 ? `${first.slice(0, -1).join(', ')} dan ${first[first.length - 1]}` : first[0];
    out.push(`➡️ Sesi seterusnya: *${list}* diutamakan (${fewest === 0 ? 'belum main' : `baru ${fewest} perlawanan`}).`);
  } else {
    out.push('🏁 Semua perlawanan liga selesai.');
  }

  out.push('', all.length ? 'Terima kasih semua yang turun hari ini. Jumpa sesi seterusnya! 💪' : 'Jumpa sesi seterusnya! 💪');
  if (url) out.push(`Skor live & jadual: ${url}`);
  return { text: out.join('\n'), count: all.length };
}
