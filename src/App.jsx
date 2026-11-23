import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, Edit3,
  LockKeyhole, LogOut, Medal, Plus, RotateCcw, Share2, ShieldCheck,
  Trophy, Tv, Undo2, UserPlus, Users, X, UserCheck, Megaphone, Crown, Trash2,
} from 'lucide-react';
import { addPoint, clearResult, completeSpecial, maxGames, overrideMatch, pointStatus, undoPoint } from './domain.js';
import { STAGES, canClearSemi, createPlayoff, playoffPodium, resolvePlayoff } from './playoff.js';
import { generateRoundRobin, groupByRound, restingTeams } from './schedule.js';
import { formatClock, isSessionActive, nextCutoff, normalizeCutoff } from './session.js';
import { assignCourts, normalizeCourts } from './courts.js';
import { calculateStandings } from './standings.js';
import { calculatePairStats, calculatePlayerStats } from './stats.js';
import { changeAdminPin, loadLeague, online, saveLeague, saveMatch, subscribeLeague, verifyAdminPin } from './storage.js';

const FINAL = new Set(['completed', 'walkover', 'retired']);
const DEFAULT_VENUES = ['Dewan Sivik Wakaf Tapai', 'Kompleks Sukan Wakaf Tapai'];
const LOGO = `${import.meta.env.BASE_URL}logo-192.webp`;
const LOGO_ALT = 'Logo Isnin Khamis Badminton Club';
const PLAY_TIME = 'Isnin & Selasa · 5:30 ptg';
const statusText = { scheduled: 'Akan datang', live: 'Sedang berlangsung', completed: 'Selesai', walkover: 'Walkover', retired: 'Retired' };
const navItems = [
  ['home', 'Utama', Activity], ['fixtures', 'Perlawanan', CalendarDays],
  ['standings', 'Kedudukan', Trophy], ['playoff', 'Play-off', Crown], ['teams', 'Team', Users], ['stats', 'Statistik', Medal],
];

function formatDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return '—';
  return new Intl.DateTimeFormat('ms-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}
function finalLabel(match) {
  if (match.status === 'walkover') return 'W/O';
  if (match.status === 'retired') return 'RET';
  if (match.status === 'completed' && !match.winnerId) return `${match.gamesWon.home}–${match.gamesWon.away} SERI`;
  return `${match.gamesWon.home}–${match.gamesWon.away}`;
}
function TeamMark({ team, large = false }) {
  const color = ['green', 'blue', 'red'][Number(team.id.replace(/\D/g, '') || team.id.charCodeAt(0)) % 3];
  return <span className={`team-mark ${color} ${large ? 'large' : ''}`}>{team.name.replace('Team ', '')}</span>;
}
function PlayerNames({ team, ids }) {
  const names = ids.map((id) => team.players.find((player) => player.id === id)?.name).filter(Boolean);
  return <>{names.join(' / ') || 'Pilih pemain'}</>;
}
function StatusPill({ match }) {
  return <span className={`status-pill ${match.status}`}><span />{statusText[match.status] || match.status}</span>;
}
function Modal({ children, onClose, title, wide = false }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><span className="eyebrow">MONDAY BADMINTON LEAGUE</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={21} /></button></div>
      {children}
    </section>
  </div>;
}
function Scoreboard({ match, home, away, tv = false, court, className = '' }) {
  const isFinal = FINAL.has(match.status);
  const homeScore = isFinal ? match.gamesWon.home : match.current.home;
  const awayScore = isFinal ? match.gamesWon.away : match.current.away;
  return <div className={`scoreboard ${tv ? 'tv-scoreboard' : ''} ${className}`}>
    <div className="score-top"><StatusPill match={match} /><span>{match.label || `Perlawanan ${match.number || match.matchNumber}`} · Court {court || match.court || 1}</span><span>{FINAL.has(match.status) || match.dateSetByAdmin ? formatDate(match.date) : match.bestOf === 3 ? 'Terbaik 3 game' : 'Bila team hadir'}</span></div>
    <div className="score-main">
      <div className={`score-team home ${match.winnerId === home.id ? 'winner' : ''}`}>
        <TeamMark team={home} large /><div><h2>{home.name}</h2><p><PlayerNames team={home} ids={match.homePlayerIds || []} /></p></div>
      </div>
      <div className={`score-number home-score ${isFinal && match.winnerId === home.id ? 'win' : ''}`}>{homeScore}</div>
      <div className="score-divider"><span>VS</span><small>{isFinal ? 'GAME' : `GAME ${Math.min(match.games.length + 1, maxGames(match))}`}</small></div>
      <div className={`score-number away-score ${isFinal && match.winnerId === away.id ? 'win' : ''}`}>{awayScore}</div>
      <div className={`score-team away ${match.winnerId === away.id ? 'winner' : ''}`}>
        <TeamMark team={away} large /><div><h2>{away.name}</h2><p><PlayerNames team={away} ids={match.awayPlayerIds || []} /></p></div>
      </div>
    </div>
    <div className="game-strip">
      {Array.from({ length: maxGames(match) }, (_, index) => index).map((index) => {
        const game = match.games[index];
        return <div className={!game ? 'empty' : ''} key={index}><span>G{index + 1}</span><strong>{game ? `${game.home} : ${game.away}` : '– : –'}</strong></div>;
      })}
      {isFinal && <div className="result-tag"><Check size={15} />{finalLabel(match)}</div>}
    </div>
  </div>;
}
function FixtureCard({ match, home, away, onOpen, isAdmin, onPostpone }) {
  return <article className={`fixture-card ${match.status}`}>
    <div className="fixture-meta"><span>PERLAWANAN {match.number || match.matchNumber}</span><StatusPill match={match} /></div>
    <button className="fixture-teams" onClick={onOpen}>
      <div><TeamMark team={home} /><strong>{home.name}</strong><small><PlayerNames team={home} ids={match.homePlayerIds || []} /></small></div>
      <span className="fixture-score">{FINAL.has(match.status) ? finalLabel(match) : match.status === 'live' ? `${match.current.home} : ${match.current.away}` : 'VS'}</span>
      <div><TeamMark team={away} /><strong>{away.name}</strong><small><PlayerNames team={away} ids={match.awayPlayerIds || []} /></small></div>
    </button>
    <div className="fixture-foot"><span>{FINAL.has(match.status) ? `Dimain ${formatDate(match.date)}` : match.status === 'live' ? 'Sedang dimain' : match.dateSetByAdmin ? `Dijadual ${formatDate(match.date)}` : 'Belum dimain'}</span>{isAdmin && <div><button onClick={onOpen} className="text-btn">{FINAL.has(match.status) ? 'Semak' : 'Buka skor'}<ChevronRight size={15} /></button></div>}</div>
  </article>;
}
function signed(value) { return `${value > 0 ? '+' : ''}${value}`; }
function StandingsTable({ rows, compact = false }) {
  return <div className="table-wrap"><table className="standings-table"><thead><tr><th>#</th><th>Team</th><th title="Main">P</th>{!compact && <><th title="Menang 2–0">M</th><th title="Seri 1–1">S</th><th title="Kalah 0–2">K</th></>}<th className="emphasis" title="1 mata setiap game menang">Mata</th><th title="Perlawanan belum dimain">Baki</th>{!compact && <th title="Beza mata badminton">± Mata</th>}</tr></thead><tbody>
    {rows.map((row) => <tr key={row.id} className={row.rank <= 4 ? 'playoff-zone' : ''}><td><span className={`rank ${row.rank <= 4 ? 'top' : ''}`}>{row.rank}</span></td><td><div className="table-team"><TeamMark team={row} /><div><strong>{row.name}</strong>{row.players?.length > 0 && <small className="row-players">{row.players.map((player) => player.name).join(' / ')}</small>}{!compact && row.tieReason && <small className="tie-reason">{row.tieReason}</small>}</div></div></td><td>{row.played}</td>{!compact && <><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td></>}<td className="points-cell">{row.leaguePoints}</td><td className="remaining-cell">{row.remaining}</td>{!compact && <td className={row.pointDifference > 0 ? 'positive' : row.pointDifference < 0 ? 'negative' : ''}>{signed(row.pointDifference)}</td>}</tr>)}
  </tbody></table></div>;
}
// Same ordering as the presence tool in the artifact: teams with the most matches left go first,
// nobody plays twice in a row while someone else can play.
function suggestMatches(matches, present) {
  const here = new Set(present);
  const remaining = new Map(present.map((id) => [id, matches.filter((m) => !FINAL.has(m.status) && (m.homeTeamId === id || m.awayTeamId === id)).length]));
  let candidates = matches.filter((m) => !FINAL.has(m.status) && m.status !== 'live' && here.has(m.homeTeamId) && here.has(m.awayTeamId));
  const times = new Map(present.map((id) => [id, 0]));
  const order = [];
  let last = new Set();
  while (candidates.length) {
    const score = (m) => (times.get(m.homeTeamId) + times.get(m.awayTeamId)) * 100 + (last.has(m.homeTeamId) || last.has(m.awayTeamId) ? 40 : 0) - (remaining.get(m.homeTeamId) + remaining.get(m.awayTeamId)) + (m.round * 10 + m.matchNumber) / 1000;
    candidates = [...candidates].sort((a, b) => score(a) - score(b));
    const next = candidates.shift();
    order.push(next);
    times.set(next.homeTeamId, times.get(next.homeTeamId) + 1);
    times.set(next.awayTeamId, times.get(next.awayTeamId) + 1);
    last = new Set([next.homeTeamId, next.awayTeamId]);
  }
  return order;
}
function teamPlayers(team) {
  const names = (team?.players || []).slice(0, 2).map((player) => player.name).filter(Boolean);
  return names.length ? names.join(' / ') : team?.name || '';
}
function hasBackToBack(order) {
  return order.some((match, index) => index > 0 && [match.homeTeamId, match.awayTeamId].some((id) => id === order[index - 1].homeTeamId || id === order[index - 1].awayTeamId));
}
function todayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function PinForm({ onSubmit, busy, error }) {
  const [pin, setPin] = useState('');
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(pin); }} className="stack-form">
    <p>Masukkan PIN 6 digit untuk mengurus skor, team dan jadual.</p>
    <label>PIN admin<div className="pin-input"><LockKeyhole size={20} /><input autoFocus type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="••••••" required /></div></label>
    {error && <p className="form-error">{error}</p>}
    <button className="primary-btn full" disabled={busy || pin.length !== 6}>{busy ? 'Menyemak…' : 'Masuk sebagai admin'}</button>
  </form>;
}
function SpecialForm({ match, home, away, onSave }) {
  const [status, setStatus] = useState('retired');
  const [winnerId, setWinnerId] = useState(home.id);
  return <div className="stack-form"><p>Skor sedia ada akan disimpan. Pilih status dan pemenang perlawanan.</p>
    <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="retired">Retired</option><option value="walkover">Walkover</option></select></label>
    <label>Pemenang<select value={winnerId} onChange={(event) => setWinnerId(event.target.value)}><option value={home.id}>{home.name}</option><option value={away.id}>{away.name}</option></select></label>
    <button className="danger-btn full" onClick={() => onSave(completeSpecial(match, status, winnerId))}>Sahkan {status === 'retired' ? 'Retired' : 'Walkover'}</button>
  </div>;
}
function EditResultForm({ match, onSave }) {
  const initial = [...match.games, { home: 0, away: 0 }, { home: 0, away: 0 }, { home: 0, away: 0 }].slice(0, maxGames(match));
  const [games, setGames] = useState(initial);
  const [error, setError] = useState('');
  const update = (index, side, value) => setGames(games.map((game, gameIndex) => gameIndex === index ? { ...game, [side]: value } : game));
  const submit = () => {
    try { onSave(overrideMatch(match, games)); } catch (reason) { setError(match.bestOf === 3 ? 'Skor tidak sah. Setiap game: 21 mata dengan beza 2, atau had 30. Game 3 hanya jika 1–1, dan mesti ada pemenang.' : 'Skor tidak sah. Setiap game: 21 mata dengan beza 2, atau had 30.'); }
  };
  return <div className="stack-form"><p>{match.bestOf === 3 ? 'Guna ini untuk pembetulan keputusan akhir. Terbaik 3 game: isi Game 3 hanya jika 1–1, biarkan 0 : 0 jika menang 2–0.' : 'Guna ini untuk pembetulan keputusan akhir. Setiap perlawanan 2 game; 1–1 dikira seri.'}</p>
    {games.map((game, index) => <div className="edit-game" key={index}><span>Game {index + 1}</span><input aria-label={`Game ${index + 1} home`} type="number" min="0" max="30" value={game.home} onChange={(event) => update(index, 'home', event.target.value)} /><b>:</b><input aria-label={`Game ${index + 1} away`} type="number" min="0" max="30" value={game.away} onChange={(event) => update(index, 'away', event.target.value)} /></div>)}
    {error && <p className="form-error">{error}</p>}<button className="primary-btn full" onClick={submit}>Simpan pembetulan</button>
  </div>;
}
function LineupSelect({ label, team, ids, onChange, disabled }) {
  return <div className="lineup"><span>{label}</span><div>{[0, 1].map((index) => <select key={index} disabled={disabled} value={ids[index] || ''} onChange={(event) => { const next = [...ids]; next[index] = event.target.value; onChange(next); }}><option value="">Pilih pemain</option>{team.players.map((player) => <option key={player.id} value={player.id} disabled={ids.includes(player.id) && ids[index] !== player.id}>{player.name}</option>)}</select>)}</div></div>;
}
const shortName = (team) => team.name.replace('Team ', '');
function PointButton({ side, team, ids, score, hint, disabled, onPoint }) {
  return <button className={`point-${side} ${hint ? 'hot' : ''}`} disabled={disabled} onClick={onPoint} aria-label={`Tambah 1 mata untuk ${team.name}`}>
    <span className="pb-team">{team.name}</span>
    <small className="pb-players"><PlayerNames team={team} ids={ids} /></small>
    <strong className="pb-score">{score}</strong>
    <span className="pb-hint">{hint === 'match' ? 'Match point' : hint === 'game' ? 'Game point' : '+1 mata'}</span>
  </button>;
}
// Courtside scoring: point buttons first, everything else below or folded away.
function ScoringConsole({ match, teamsById, courtMatches, courtOf, turnLabel = () => '', onSelect, updateMatch, onEdit, onSpecial, onTv, onClose, onClearResult }) {
  const home = teamsById.get(match.homeTeamId);
  const away = teamsById.get(match.awayTeamId);
  const isFinal = FINAL.has(match.status);
  const [detailsOpen, setDetailsOpen] = useState(match.status === 'scheduled' && !match.pointLog.length);
  const hints = pointStatus(match);
  const lastSide = match.pointLog[match.pointLog.length - 1];
  const point = (side) => { try { navigator.vibrate?.(12); } catch { /* not supported */ } updateMatch(match.id, (current) => addPoint(current, side), null); };
  const lineupText = (team, ids) => ids.map((id) => team.players.find((player) => player.id === id)?.name).filter(Boolean).join(' / ') || 'belum pilih';
  return <div className="scoring-console">
    {courtMatches.length > 1 && <div className="court-switch" aria-label="Tukar perlawanan">{courtMatches.map((item) => <button key={item.id} className={item.id === match.id ? 'on' : ''} aria-pressed={item.id === match.id} onClick={() => onSelect(item.id)}>
      {turnLabel(item) && <small className="cs-turn">{turnLabel(item)}</small>}<b>C{courtOf(item)}</b><span>{shortName(teamsById.get(item.homeTeamId))} lwn {shortName(teamsById.get(item.awayTeamId))}</span>{item.status === 'live' && <em>{item.current.home}–{item.current.away}</em>}
    </button>)}</div>}
    <div className="point-buttons">
      <PointButton side="home" team={home} ids={match.homePlayerIds || []} score={isFinal ? match.gamesWon.home : match.current.home} hint={hints.home} disabled={isFinal} onPoint={() => point('home')} />
      <PointButton side="away" team={away} ids={match.awayPlayerIds || []} score={isFinal ? match.gamesWon.away : match.current.away} hint={hints.away} disabled={isFinal} onPoint={() => point('away')} />
    </div>
    <div className="score-tools">
      <button className="light-btn undo-btn" disabled={!match.pointLog.length} onClick={() => updateMatch(match.id, undoPoint, null)}><Undo2 size={18} />Undo rally{lastSide ? ` · ${shortName(lastSide === 'home' ? home : away)}` : ''}</button>
      <button className="light-btn" onClick={onEdit}><Edit3 size={18} />Betulkan skor</button>
      <button className="light-btn" onClick={onTv}><Tv size={18} />Mod TV</button>
      {isFinal ? <button className="danger-outline" onClick={onClearResult}><RotateCcw size={18} />Batal keputusan</button> : <button className="danger-outline" onClick={onSpecial}>Walkover / Retired</button>}
    </div>
    <section className={`console-details ${detailsOpen ? 'open' : ''}`}>
      <button className="details-toggle" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(!detailsOpen)}>
        <span><strong>Lineup & tarikh</strong><small>{lineupText(home, match.homePlayerIds || [])} lwn {lineupText(away, match.awayPlayerIds || [])}{match.dateSetByAdmin ? ` · ${formatDate(match.date)}` : ''}</small></span><ChevronDown size={20} />
      </button>
      {detailsOpen && <div className="details-body">
        <div className="lineups"><LineupSelect label={home.name} team={home} ids={match.homePlayerIds || []} disabled={match.status === 'live'} onChange={(ids) => updateMatch(match.id, (current) => ({ ...current, homePlayerIds: ids }))} /><LineupSelect label={away.name} team={away} ids={match.awayPlayerIds || []} disabled={match.status === 'live'} onChange={(ids) => updateMatch(match.id, (current) => ({ ...current, awayPlayerIds: ids }))} /></div>
        {match.status === 'live' && <p className="muted-note">Lineup dikunci semasa perlawanan berlangsung.</p>}
        <label className="match-date">Tarikh perlawanan<input type="date" value={match.dateSetByAdmin || isFinal ? match.date || '' : ''} onChange={(event) => { const value = event.target.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return; updateMatch(match.id, (current) => ({ ...current, date: value, dateSetByAdmin: true }), `Tarikh ditetapkan: ${formatDate(value)}`); }} /><small>{isFinal ? 'Tukar jika perlawanan dimain pada hari lain.' : 'Pilihan. Tiada tarikh tetap; tarikh direkod sendiri bila perlawanan tamat.'}</small></label>
      </div>}
    </section>
    {isFinal && <button className="confirm-close-btn" onClick={onClose}><Check size={20} />Sahkan & Tutup</button>}
  </div>;
}
// Keep the phone screen on while scoring or showing the TV scoreboard.
function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const request = () => { if (document.visibilityState !== 'visible') return; navigator.wakeLock.request('screen').then((next) => { if (cancelled) next.release(); else lock = next; }).catch(() => {}); };
    request();
    document.addEventListener('visibilitychange', request);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', request); lock?.release().catch(() => {}); };
  }, [active]);
}
const PLACEHOLDER = { F: ['Pemenang SA1', 'Pemenang SA2'], T3: ['Kalah SA1', 'Kalah SA2'] };
function PlayoffCard({ match, teamsById, seeds, onOpen }) {
  const home = teamsById.get(match.homeTeamId);
  const away = teamsById.get(match.awayTeamId);
  const done = FINAL.has(match.status);
  const live = match.status === 'live';
  const row = (team, side, index) => {
    const won = done && team && match.winnerId === team.id;
    const seed = team ? seeds.indexOf(team.id) + 1 : 0;
    return <div className={`po-row ${won ? 'won' : ''} ${done && !won ? 'lost' : ''}`}>
      {team ? <><TeamMark team={team} /><span className="po-names"><strong>{team.name}{seed > 0 && <small className="po-seed">#{seed}</small>}</strong><small><PlayerNames team={team} ids={(side === 'home' ? match.homePlayerIds : match.awayPlayerIds) || []} /></small></span></> : <span className="po-names"><em>{PLACEHOLDER[match.stage]?.[index] || 'Menunggu'}</em></span>}
      <b>{match.status === 'walkover' || match.status === 'retired' ? (won ? (match.status === 'walkover' ? 'W/O' : 'RET') : '') : done || live ? match.gamesWon[side] : ''}</b>
      {live && <i className="po-current">{match.current[side]}</i>}
    </div>;
  };
  return <button className={`playoff-card ${match.status} ${match.stage === 'F' ? 'final' : ''}`} disabled={!home || !away} onClick={onOpen}>
    <div className="po-head"><span>{STAGES[match.stage]?.label} · Court {match.court || 1}</span><StatusPill match={match} /></div>
    {row(home, 'home', 0)}
    {row(away, 'away', 1)}
    <div className="po-games">{match.games.length ? match.games.map((game) => `${game.home}–${game.away}`).join(' · ') : match.status === 'walkover' ? 'Walkover' : (!home || !away) ? 'Menunggu keputusan separuh akhir' : 'Terbaik 3 game'}</div>
  </button>;
}
function PlayoffBracket({ matches, teamsById, seeds, onOpen }) {
  const byStage = Object.fromEntries(matches.map((match) => [match.stage, match]));
  const podium = playoffPodium(matches);
  const champion = teamsById.get(podium.champion);
  const card = (stage) => byStage[stage] && <PlayoffCard match={byStage[stage]} teamsById={teamsById} seeds={seeds} onOpen={() => onOpen(byStage[stage])} />;
  return <div className="bracket-wrap">
    {champion && <div className="champion-banner"><Crown size={30} /><div><span className="eyebrow">JUARA MUSIM INI</span><h2>{champion.name}</h2><p>{teamPlayers(champion)}</p></div><TeamMark team={champion} large /></div>}
    {champion && <div className="podium-line"><span>🥈 {teamsById.get(podium.runnerUp)?.name || '—'}</span><span>🥉 {teamsById.get(podium.third)?.name || 'Belum ditentukan'}</span></div>}
    <div className="bracket">
      <div className="bracket-col"><h3>Separuh akhir</h3>{card('SF1')}{card('SF2')}</div>
      <div className="bracket-col"><h3>Akhir</h3>{card('F')}<h3>Tempat ketiga</h3>{card('T3')}</div>
    </div>
  </div>;
}
function EmptyStats() {
  return <div className="empty-state"><Medal size={34} /><h3>Statistik akan muncul selepas perlawanan pertama</h3><p>Sistem akan kira rekod pemain dan pasangan daripada keputusan sebenar.</p></div>;
}

export default function App() {
  const [league, setLeague] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('home');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isAdmin, setIsAdmin] = useState(() => Boolean(sessionStorage.getItem('mbl-admin-pin')));
  const [adminPin, setAdminPin] = useState(() => sessionStorage.getItem('mbl-admin-pin') || '');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [specialOpen, setSpecialOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [roundFilter, setRoundFilter] = useState('pending');
  const [teamFilter, setTeamFilter] = useState('');
  const [toast, setToast] = useState('');
  const [present, setPresent] = useState(() => { try { const saved = JSON.parse(sessionStorage.getItem('mbl-present') || 'null'); return saved?.validUntil && Date.now() < Date.parse(saved.validUntil) ? saved.ids : []; } catch { return []; } });
  const [now, setNow] = useState(() => Date.now());
  const [cutoffDraft, setCutoffDraft] = useState('');
  const [picked, setPicked] = useState(null);
  useWakeLock(Boolean(selectedMatchId) && (isAdmin || tvMode));
  const leagueRef = useRef(null);
  const revision = useRef(0);
  const pending = useRef(0);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    let alive = true;
    let lastSync = 0;
    // Never overwrite the admin's own edits that are still being saved.
    const apply = (data) => { if (alive && data && pending.current === 0) { leagueRef.current = data; setLeague(data); } };
    // Re-read the latest scores when the viewer comes back to the app, the network
    // returns, or the live channel reconnects: updates sent while away are not replayed.
    const resync = () => {
      const now = Date.now();
      if (now - lastSync < 2000) return;
      lastSync = now;
      loadLeague().then(apply).catch(() => {});
    };
    const onVisible = () => { if (document.visibilityState === 'visible') resync(); };
    loadLeague().then((data) => { leagueRef.current = data; setLeague(data); }).catch((error) => setLoadError(error.message));
    const unsubscribe = subscribeLeague(apply, resync);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', resync);
    window.addEventListener('online', resync);
    window.addEventListener('pageshow', resync);
    return () => {
      alive = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', resync);
      window.removeEventListener('online', resync);
      window.removeEventListener('pageshow', resync);
    };
  }, []);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); } }, [toast]);

  const teamsById = useMemo(() => new Map((league?.teams || []).map((team) => [team.id, team])), [league]);
  const standings = useMemo(() => league ? calculateStandings(league.teams, league.matches) : [], [league]);
  const playerStats = useMemo(() => league ? calculatePlayerStats(league.teams, league.matches) : [], [league]);
  const pairStats = useMemo(() => league ? calculatePairStats(league.teams, league.matches) : [], [league]);
  const playoffMatches = useMemo(() => resolvePlayoff(league?.playoff, league?.teams || []), [league]);
  const selectedMatch = league?.matches.find((match) => match.id === selectedMatchId) || playoffMatches.find((match) => match.id === selectedMatchId);
  const latestFinished = useMemo(() => {
    if (!league) return null;
    const done = league.matches.map((match, index) => ({ match, index })).filter(({ match }) => FINAL.has(match.status));
    done.sort((a, b) => (a.match.completedAt || '').localeCompare(b.match.completedAt || '') || a.index - b.index);
    return done.length ? done[done.length - 1].match : null;
  }, [league]);
  const suggestions = useMemo(() => league && present.length >= 2 ? suggestMatches(league.matches, present) : [], [league, present]);
  const plan = useMemo(() => assignCourts(suggestions, normalizeCourts(league?.settings?.courts)), [suggestions, league]);
  const cutoff = normalizeCutoff(league?.settings?.cutoff);
  const courts = normalizeCourts(league?.settings?.courts);
  const [courtsDraft, setCourtsDraft] = useState(0);
  const savedVenues = Array.isArray(league?.settings?.venues) ? league.settings.venues.filter((name) => typeof name === 'string' && name.trim()) : [];
  const venues = [...new Set([...DEFAULT_VENUES, ...savedVenues])];
  const venue = (typeof league?.settings?.venue === 'string' && league.settings.venue.trim()) || DEFAULT_VENUES[0];
  const [venueDraft, setVenueDraft] = useState('');
  const [newVenue, setNewVenue] = useState('');
  // Tick so the page resets on its own at the session cut-off.
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!present.length) return;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('mbl-present') || 'null'); } catch { saved = null; }
    if (!saved?.validUntil || now >= Date.parse(saved.validUntil)) { setPresent([]); setPicked(null); sessionStorage.removeItem('mbl-present'); }
  }, [now, present.length]);
  const todayMatches = useMemo(() => {
    if (!league?.today || !isSessionActive(league.today, cutoff, new Date(now))) return [];
    return league.today.ids.map((id) => league.matches.find((match) => match.id === id)).filter(Boolean);
  }, [league, cutoff, now]);
  const activeMatch = useMemo(() => {
    if (!league) return null;
    return league.matches.find((match) => match.status === 'live') || todayMatches.find((match) => !FINAL.has(match.status)) || latestFinished || league.matches.find((match) => !FINAL.has(match.status));
  }, [league, todayMatches, latestFinished]);

  function commit(next, message = 'Perubahan disimpan') {
    leagueRef.current = next;
    setLeague(next);
    const ownRevision = ++revision.current;
    pending.current++;
    queue.current = queue.current.then(() => saveLeague(next, adminPin)).then((saved) => {
      if (ownRevision === revision.current) { leagueRef.current = saved; setLeague(saved); }
      if (message) setToast(message);
    }).catch((error) => setToast(error.message || 'Gagal menyimpan. Cuba lagi.')).finally(() => { pending.current--; });
  }
  // Score changes save only the one match, so two courts can be scored at once.
  function commitMatch(next, matchId, message) {
    leagueRef.current = next;
    setLeague(next);
    const ownRevision = ++revision.current;
    pending.current++;
    const match = next.matches.find((item) => item.id === matchId) || next.playoff?.matches?.find((item) => item.id === matchId);
    queue.current = queue.current.then(() => saveMatch(match, adminPin)).then((saved) => {
      if (ownRevision === revision.current) { leagueRef.current = saved; setLeague(saved); }
      if (message) setToast(message);
    }).catch((error) => setToast(error.message || 'Gagal menyimpan. Cuba lagi.')).finally(() => { pending.current--; });
  }
  // League-wide changes (announcement, settings) are applied on top of the latest
  // server copy so points scored on another court in the meantime are kept.
  function commitLatest(change, message) {
    const optimistic = change(leagueRef.current);
    leagueRef.current = optimistic;
    setLeague(optimistic);
    const ownRevision = ++revision.current;
    pending.current++;
    queue.current = queue.current.then(() => loadLeague()).then((latest) => saveLeague(change(latest), adminPin)).then((saved) => {
      if (ownRevision === revision.current) { leagueRef.current = saved; setLeague(saved); }
      if (message) setToast(message);
    }).catch((error) => setToast(error.message || 'Gagal menyimpan. Cuba lagi.')).finally(() => { pending.current--; });
  }
  // message: null = save quietly (rally points, undo); errors still show.
  function updateMatch(id, updater, message) {
    let justFinished = false;
    const apply = (match) => {
      const updated = updater(match);
      if (FINAL.has(updated.status) && !FINAL.has(match.status)) { justFinished = true; return { ...updated, completedAt: new Date().toISOString(), date: updated.dateSetByAdmin ? updated.date : todayIso() }; }
      if (!FINAL.has(updated.status) && updated.completedAt) return { ...updated, completedAt: undefined };
      return updated;
    };
    const current = leagueRef.current;
    let next;
    if (current.matches.some((match) => match.id === id)) {
      next = { ...current, matches: current.matches.map((match) => match.id === id ? apply(match) : match) };
    } else {
      // Play-off: update the match with its final/third-place teams filled in.
      const resolved = resolvePlayoff(current.playoff, current.teams);
      const target = resolved.find((match) => match.id === id);
      if (!target) return;
      next = { ...current, playoff: { ...current.playoff, matches: current.playoff.matches.map((match) => match.id === id ? apply(target) : match) } };
    }
    commitMatch(next, id, message === null && justFinished ? 'Perlawanan tamat' : message);
  }
  function generatePlayoff() {
    const pending = leagueRef.current.matches.filter((match) => !FINAL.has(match.status)).length;
    const top = standings.slice(0, 4).map((row, index) => `#${index + 1} ${row.name}`).join(', ');
    if (!window.confirm(`${pending ? `Liga belum tamat: ${pending} perlawanan belum dimain, jadi kedudukan masih boleh berubah.\n\n` : ''}Jana play-off daripada 4 teratas sekarang?\n${top}\n\nSA1: #1 lwn #4 · SA2: #2 lwn #3`)) return;
    commitLatest((latest) => ({ ...latest, playoff: createPlayoff(calculateStandings(latest.teams, latest.matches), latest.teams) }), 'Play-off dijana');
  }
  function removePlayoff() {
    if (!window.confirm('Padam play-off? Semua skor play-off akan hilang. Keputusan liga tidak terjejas.')) return;
    commitLatest((latest) => { const { playoff, ...rest } = latest; return rest; }, 'Play-off dipadam');
    setSelectedMatchId(null);
  }
  function openMatch(match) { setSelectedMatchId(match.id); }
  function closeMatch() { setSelectedMatchId(null); setSpecialOpen(false); setEditOpen(false); setTvMode(false); }
  async function login(pin) {
    setPinBusy(true); setPinError('');
    try {
      if (!await verifyAdminPin(pin)) throw new Error('PIN tidak sah. Cuba lagi.');
      sessionStorage.setItem('mbl-admin-pin', pin); setAdminPin(pin); setIsAdmin(true); setPinOpen(false); setToast('Mod admin aktif');
    } catch (error) { setPinError(error.message); } finally { setPinBusy(false); }
  }
  function logout() { sessionStorage.removeItem('mbl-admin-pin'); setAdminPin(''); setIsAdmin(false); setSettingsOpen(false); closeMatch(); setToast('Mod admin dimatikan'); }
  function shareWhatsapp() {
    const results = league.matches.filter((match) => FINAL.has(match.status)).slice(-6).map((match) => `${teamsById.get(match.homeTeamId).name} ${finalLabel(match)} ${teamsById.get(match.awayTeamId).name} (${statusText[match.status]})`);
    const table = standings.map((row) => `${row.rank}. ${row.name} — ${row.leaguePoints} mata, baki ${row.remaining}`).join('\n');
    const podium = playoffPodium(playoffMatches);
    const playoffLines = playoffMatches.filter((match) => match.homeTeamId && match.awayTeamId).map((match) => `${STAGES[match.stage].label}: ${teamsById.get(match.homeTeamId).name} ${FINAL.has(match.status) ? finalLabel(match) : 'lwn'} ${teamsById.get(match.awayTeamId).name}`);
    const playoffText = playoffLines.length ? `\n\n*PLAY-OFF*\n${playoffLines.join('\n')}${podium.champion ? `\n🏆 Juara: ${teamsById.get(podium.champion).name}` : ''}` : '';
    const text = `*${league.name}* 🏸\n${league.season}\n\n*KEPUTUSAN*\n${results.length ? results.join('\n') : 'Belum ada keputusan.'}\n\n*KEDUDUKAN*\n${table}${playoffText}\n\nSkor live: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }
  function resetSchedule() {
    if (!window.confirm('Ini akan memadam semua keputusan dan menjana semula jadual round robin. Teruskan?')) return;
    const matches = generateRoundRobin(league.teams.map((team) => team.id)).map((match) => ({ ...match, homePlayerIds: teamsById.get(match.homeTeamId).players.slice(0, 2).map((player) => player.id), awayPlayerIds: teamsById.get(match.awayTeamId).players.slice(0, 2).map((player) => player.id) }));
    commit({ ...league, matches }, 'Jadual baharu dijana');
  }

  if (loadError) return <main className="fatal"><h1>Monday Badminton League</h1><p>Sambungan database gagal: {loadError}</p><button className="primary-btn" onClick={() => window.location.reload()}>Cuba lagi</button></main>;
  if (!league) return <main className="loading"><img className="brand-loader" src={LOGO} alt={LOGO_ALT} width="84" height="84" /><h1>Monday Badminton League</h1><p>Menyediakan court…</p></main>;

  league.matches.forEach((match, index) => { match.number = index + 1; });
  const pendingMatches = league.matches.filter((match) => !FINAL.has(match.status));
  const finishedMatches = league.matches.filter((match) => FINAL.has(match.status)).sort((a, b) => (b.completedAt || b.date || '').localeCompare(a.completedAt || a.date || ''));
  const completedCount = league.matches.filter((match) => FINAL.has(match.status)).length;
  const todayIds = new Set(todayMatches.map((match) => match.id));
  const sessionVenue = (todayMatches.length && league.today?.venue) || venue;
  const courtOf = (match) => (todayIds.has(match.id) && league.today?.courts?.[match.id]) || match.court || 1;
  const turnOf = (match, index) => (league.today?.turns?.[match.id]) || index + 1;
  const liveMatches = [...league.matches, ...playoffMatches].filter((match) => match.status === 'live').sort((a, b) => courtOf(a) - courtOf(b));
  const heroMatch = liveMatches[0] || activeMatch;
  // Matches the courtside admin may want to jump between: live ones and today's unplayed list.
  const courtMatches = [...new Map([...liveMatches, ...todayMatches.filter((match) => !FINAL.has(match.status)), ...(selectedMatch ? [selectedMatch] : [])].map((match) => [match.id, match])).values()].sort((a, b) => courtOf(a) - courtOf(b));
  const fixtureSource = roundFilter === 'done' ? finishedMatches : roundFilter === 'pending' ? pendingMatches : league.matches;
  const visibleFixtures = teamFilter ? fixtureSource.filter((match) => match.homeTeamId === teamFilter || match.awayTeamId === teamFilter) : fixtureSource;
  const roundCount = new Set(league.matches.map((match) => match.round).filter(Boolean)).size;
  const posterTeams = [...new Set(todayMatches.flatMap((match) => [match.homeTeamId, match.awayTeamId]))].map((id) => teamsById.get(id)?.name.replace('Team ', '')).filter(Boolean).sort();

  const defaultPicked = plan.slice(0, 4 * courts).map(({ match }) => match.id);
  const presencePanel = isAdmin ? <section className="panel presence-panel"><div className="panel-head"><div><span className="eyebrow">ADMIN SAHAJA · {courts} COURT · SESI TAMAT {formatClock(cutoff)}</span><h2>Siapa hadir hari ini?</h2></div>{present.length > 0 && <button className="text-btn muted" onClick={() => { setPresent([]); setPicked(null); sessionStorage.removeItem('mbl-present'); }}>Kosongkan</button>}</div>
        <div className="presence-chips">{league.teams.map((team) => { const left = standings.find((row) => row.id === team.id)?.remaining ?? 0; const on = present.includes(team.id); return <label key={team.id} className={on ? 'on' : ''}><input type="checkbox" checked={on} disabled={!left} onChange={(event) => { const next = event.target.checked ? [...present, team.id] : present.filter((id) => id !== team.id); setPresent(next); setPicked(null); sessionStorage.setItem('mbl-present', JSON.stringify({ validUntil: nextCutoff(cutoff).toISOString(), ids: next })); }} /><TeamMark team={team} /><span className="pc-names">{teamPlayers(team)}</span><small>baki {left}</small></label>; })}</div>
        {present.length < 2 ? <p className="muted-note">Tanda sekurang-kurangnya 2 team yang hadir untuk lihat perlawanan yang boleh dimain.</p> : suggestions.length === 0 ? <p className="muted-note">Semua team yang hadir sudah pun bertemu. Tiada perlawanan liga yang tinggal untuk mereka.</p> : <>
          <p className="muted-note">{suggestions.length} perlawanan boleh dimain{courts > 1 ? ` di ${courts} court, disusun ikut giliran (tiada team main di dua court serentak)` : ''}. Team yang paling banyak baki didahulukan.{courts === 1 && (hasBackToBack(suggestions) ? ' Bilangan team yang hadir sedikit, jadi ada team yang terpaksa main berturut-turut. Beri mereka rehat sebentar antara perlawanan.' : ' Tiada team main dua kali berturut-turut.')}</p>
          <ol className="suggestion-list">{plan.map(({ match, turn, court }) => { const chosen = (picked ?? defaultPicked).includes(match.id); return <li key={match.id}><b>{turn}{courts > 1 && <small className="sg-court">C{court}</small>}</b><button className="suggestion-teams" onClick={() => openMatch(match)}><span className="sg-side"><TeamMark team={teamsById.get(match.homeTeamId)} /><strong>{teamPlayers(teamsById.get(match.homeTeamId))}</strong></span><span className="sg-vs">lwn</span><span className="sg-side"><TeamMark team={teamsById.get(match.awayTeamId)} /><strong>{teamPlayers(teamsById.get(match.awayTeamId))}</strong></span></button><label><input type="checkbox" checked={chosen} onChange={(event) => { const base = picked ?? defaultPicked; setPicked(event.target.checked ? [...base, match.id] : base.filter((id) => id !== match.id)); }} />Pilih</label></li>; })}</ol>
          <button className="primary-btn" onClick={() => { const chosen = plan.filter(({ match }) => (picked ?? defaultPicked).includes(match.id)); if (!chosen.length) { setToast('Pilih sekurang-kurangnya satu perlawanan'); return; } const today = { date: todayIso(), ids: chosen.map(({ match }) => match.id), courts: Object.fromEntries(chosen.map(({ match, court }) => [match.id, court])), turns: Object.fromEntries(chosen.map(({ match, turn }) => [match.id, turn])), validUntil: nextCutoff(cutoff).toISOString(), venue }; commitLatest((current) => ({ ...current, today }), `Senarai diumumkan sehingga ${formatClock(cutoff)}`); }}><Megaphone size={18} />Umumkan {(picked ?? defaultPicked).length} perlawanan</button>
        </>}
      </section> : null;

  if (tvMode && selectedMatch) return <main className="tv-mode"><div className="tv-head"><div className="brand inverse"><img className="brand-logo" src={LOGO} alt={LOGO_ALT} width="52" height="52" /><div><span>Liga Badminton</span><strong>Monday Club</strong></div></div><button className="light-btn" onClick={() => setTvMode(false)}><ArrowLeft size={18} />Keluar mod TV</button></div><Scoreboard court={courtOf(selectedMatch)} match={selectedMatch} home={teamsById.get(selectedMatch.homeTeamId)} away={teamsById.get(selectedMatch.awayTeamId)} tv /><div className="tv-footer"><span>{league.season}</span><span>{maxGames(selectedMatch) === 3 ? 'Terbaik 3 game' : '2 game'} · 21 mata · Had 30</span><span className="live-dot">{selectedMatch.status === 'live' ? 'LIVE' : 'SCOREBOARD'}</span></div></main>;

  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <button className="brand" onClick={() => setView('home')}><img className="brand-logo" src={LOGO} alt={LOGO_ALT} width="52" height="52" /><div><span>Liga Badminton · {league.season}</span><strong>Monday Club</strong></div></button>
      <div className="header-actions"><span className={`connection ${online ? 'online' : 'local'}`}><span />{online ? 'Live online' : 'Demo peranti ini'}</span><button className="share-btn" onClick={shareWhatsapp}><Share2 size={17} /><span>Kongsi</span></button><button className={isAdmin ? 'admin-active' : 'admin-btn'} onClick={() => isAdmin ? setSettingsOpen(true) : setPinOpen(true)}><ShieldCheck size={17} />{isAdmin ? 'Admin aktif' : 'Admin'}</button></div>
    </div><div className="color-line"><i /><i /><i /></div></header>

    <nav className="main-nav" aria-label="Navigasi utama"><div>{navItems.map(([id, label, Icon]) => <button className={view === id ? 'active' : ''} key={id} onClick={() => { setView(id); window.scrollTo(0, 0); }} aria-label={label} title={label} aria-current={view === id ? 'page' : undefined}><Icon size={26} strokeWidth={2.1} /><span className="nav-label">{label}</span></button>)}</div></nav>

    <main className="page-content">
      {view === 'home' && <>
        {presencePanel}
        {league.playoff && <section className="panel home-playoff"><div className="panel-head"><div><span className="eyebrow">4 TERATAS · TERBAIK 3 GAME</span><h2>Play-off</h2></div><button className="text-btn" onClick={() => setView('playoff')}>Penuh<ChevronRight size={16} /></button></div><PlayoffBracket matches={playoffMatches} teamsById={teamsById} seeds={league.playoff.seeds || []} onOpen={openMatch} /></section>}
        <section className="page-intro"><div><span className="eyebrow">{posterTeams.length ? `Petang ni · ${formatDate(todayIso())} · 5:30` : `${league.season} · Main bila team hadir`}</span><h1>{posterTeams.length ? <>{posterTeams.join(' · ')}<br />turun gelanggang</> : <>{pendingMatches.length} perlawanan<br />menunggu</>}</h1><p>{posterTeams.length ? `${todayMatches.length} perlawanan · ${sessionVenue}` : `${sessionVenue} · ${PLAY_TIME}`}</p></div><div className="season-progress"><span>PERKEMBANGAN LIGA</span><strong>{completedCount}<small> / {league.matches.length} perlawanan</small></strong><div><i style={{ width: `${completedCount / league.matches.length * 100}%` }} /></div></div></section>
        <section className="hero-score"><div className="section-heading"><div><span className="eyebrow">COURT {courtOf(heroMatch)}</span><h2>{heroMatch.status === 'live' ? 'Live sekarang' : FINAL.has(heroMatch.status) ? 'Keputusan terkini' : 'Perlawanan seterusnya'}</h2></div><div className="heading-actions"><button className="light-btn" onClick={() => { setSelectedMatchId(heroMatch.id); setTvMode(true); }}><Tv size={18} />Mod TV</button>{isAdmin && <button className="primary-btn" onClick={() => openMatch(heroMatch)}><Activity size={18} />Buka scoring</button>}</div></div><Scoreboard court={courtOf(heroMatch)} match={heroMatch} home={teamsById.get(heroMatch.homeTeamId)} away={teamsById.get(heroMatch.awayTeamId)} /></section>
        {liveMatches.filter((match) => match.id !== heroMatch.id).map((match) => <section className="hero-score extra-live" key={match.id}><div className="section-heading"><div><span className="eyebrow">COURT {courtOf(match)}</span><h2>Live sekarang</h2></div><div className="heading-actions"><button className="light-btn" onClick={() => { setSelectedMatchId(match.id); setTvMode(true); }}><Tv size={18} />Mod TV</button>{isAdmin && <button className="primary-btn" onClick={() => openMatch(match)}><Activity size={18} />Buka scoring</button>}</div></div><Scoreboard court={courtOf(match)} match={match} home={teamsById.get(match.homeTeamId)} away={teamsById.get(match.awayTeamId)} /></section>)}
        {todayMatches.length > 0 && <section className="match-poster" aria-label="Senarai perlawanan hari ini">
          <div className="mp-stripe"><i /><i /><i /></div>
          <div className="mp-head"><div><span className="eyebrow">Petang ni · {formatDate(todayIso())}</span><h2>Senarai perlawanan</h2><p>{sessionVenue} · 5:30 ptg</p></div><img className="mp-crest" src={LOGO} alt="" width="56" height="56" /></div>
          <ol>{todayMatches.map((match, index) => { const home = teamsById.get(match.homeTeamId); const away = teamsById.get(match.awayTeamId); const done = FINAL.has(match.status); return <li key={match.id}><button onClick={() => openMatch(match)}>
            <b>{turnOf(match, index)}{courts > 1 && <small className="mp-court">COURT {courtOf(match)}</small>}</b>
            <span className={`mp-side ${done && match.winnerId === home.id ? 'won' : ''}`}><TeamMark team={home} /><span>{teamPlayers(home)}</span></span>
            <em className={done ? 'done' : ''}>{done ? finalLabel(match) : match.status === 'live' ? `${match.current.home}–${match.current.away}` : 'LWN'}</em>
            <span className={`mp-side away ${done && match.winnerId === away.id ? 'won' : ''}`}><span>{teamPlayers(away)}</span><TeamMark team={away} /></span>
          </button></li>; })}</ol>
          <div className="mp-foot"><span>Monday Club · Liga Badminton</span><span>{todayMatches.filter((match) => FINAL.has(match.status)).length} / {todayMatches.length} selesai</span></div>
        </section>}
        <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">{pendingMatches.length} BELUM DIMAIN · TIADA TARIKH TETAP</span><h2>Perlawanan belum dimain</h2></div><button className="text-btn" onClick={() => setView('fixtures')}>Semua<ChevronRight size={16} /></button></div><div className="compact-fixtures">{pendingMatches.slice(0, 6).map((match) => <button key={match.id} onClick={() => openMatch(match)}><span>{teamsById.get(match.homeTeamId).name}</span><strong>{FINAL.has(match.status) ? finalLabel(match) : match.status === 'live' ? `${match.current.home} : ${match.current.away}` : 'VS'}</strong><span>{teamsById.get(match.awayTeamId).name}</span></button>)}</div><div className="bye-note"><Clock3 size={17} /><span>Tiada tarikh tetap. Team yang hadir bermain dengan team yang belum mereka lawan, sehingga setiap team habis {league.teams.length - 1} perlawanan.</span></div></section>
          <section className="panel"><div className="panel-head"><div><span className="eyebrow">LIGA</span><h2>Kedudukan semasa</h2></div><button className="text-btn" onClick={() => setView('standings')}>Penuh<ChevronRight size={16} /></button></div><StandingsTable rows={standings.slice(0, 5)} compact /></section></div>
      </>}

      {view === 'fixtures' && presencePanel}
      {view === 'fixtures' && <section><div className="page-title"><div><span className="eyebrow">{league.matches.length} PERLAWANAN · {roundCount} PUSINGAN · TIADA TARIKH TETAP</span><h1>Jadual perlawanan</h1><p>Setiap team bertemu sekali. Pusingan hanya panduan susunan; main bila kedua-dua team hadir.</p></div><div className="fixture-filters"><label className="round-filter">Papar<select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value)}><option value="pending">Belum main ({pendingMatches.length})</option><option value="done">Selesai ({finishedMatches.length})</option><option value="all">Semua ({league.matches.length})</option></select></label><label className="round-filter">Team<select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="">Semua team</option>{league.teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {teamPlayers(team)}</option>)}</select></label></div></div>
        {visibleFixtures.length === 0 ? <div className="empty-state"><CalendarDays size={34} /><h3>{roundFilter === 'pending' ? 'Semua perlawanan selesai' : 'Tiada perlawanan'}</h3><p>{teamFilter ? 'Tiada perlawanan untuk team ini dalam paparan ini.' : 'Tukar pilihan paparan untuk lihat perlawanan lain.'}</p></div> : groupByRound(visibleFixtures).map(({ round, matches }) => {
          const all = league.matches.filter((match) => (Number.isInteger(match.round) && match.round > 0 ? match.round : 0) === round);
          const done = all.filter((match) => FINAL.has(match.status)).length;
          const resting = round ? restingTeams(league.teams.map((team) => team.id), all).map((id) => teamsById.get(id)?.name).filter(Boolean) : [];
          return <section className={`round-group ${done === all.length ? 'complete' : ''}`} key={round}><div className="round-head"><h2>{round ? `Pusingan ${round}` : 'Lain-lain'}</h2><span className="round-count">{done}/{all.length} selesai</span>{resting.length > 0 && <span className="round-rest">Rehat: {resting.join(', ')}</span>}</div><div className="fixtures-list">{matches.map((match) => <FixtureCard key={match.id} match={match} home={teamsById.get(match.homeTeamId)} away={teamsById.get(match.awayTeamId)} isAdmin={isAdmin} onOpen={() => openMatch(match)} />)}</div></section>;
        })}</section>}

      {view === 'playoff' && <section><div className="page-title"><div><span className="eyebrow">4 TERATAS · TERBAIK 3 GAME</span><h1>Play-off</h1><p>Separuh akhir #1 lwn #4 dan #2 lwn #3. Pemenang ke akhir, yang kalah rebut tempat ketiga.</p></div>{isAdmin && league.playoff && <button className="danger-outline" onClick={removePlayoff}><Trash2 size={17} />Padam play-off</button>}</div>
        {league.playoff ? <PlayoffBracket matches={playoffMatches} teamsById={teamsById} seeds={league.playoff.seeds || []} onOpen={openMatch} /> : <section className="panel playoff-setup"><div className="panel-head"><div><span className="eyebrow">{pendingMatches.length ? `LIGA BELUM TAMAT · ${pendingMatches.length} PERLAWANAN LAGI` : 'LIGA TAMAT'}</span><h2>{pendingMatches.length ? 'Jika liga tamat sekarang' : 'Sedia untuk play-off'}</h2></div></div>
          <ol className="seed-preview">{[[0, 3], [1, 2]].map(([a, b], index) => <li key={index}><span className="eyebrow">Separuh akhir {index + 1} · Court {index + 1}</span><div>{[a, b].map((rank) => { const row = standings[rank]; return row ? <span key={rank} className="seed-team"><b>#{rank + 1}</b><TeamMark team={row} /><strong>{teamPlayers(row)}</strong></span> : null; })}</div></li>)}</ol>
          {isAdmin ? <button className="primary-btn" onClick={generatePlayoff}><Crown size={18} />Jana play-off daripada 4 teratas</button> : <p className="muted-note">Admin akan menjana play-off selepas semua perlawanan liga selesai.</p>}
        </section>}
        <div className="rules-note"><strong>Peraturan play-off:</strong> terbaik 3 game. Setiap game 21 mata, mesti menang dengan beza 2, maksimum 30. Tiada seri: jika 1–1, terus main game ketiga. Walkover dan retired seperti liga. Kedua-dua separuh akhir dimain serentak (Court 1 dan 2), kemudian akhir (Court 1) dan tempat ketiga (Court 2). Play-off tidak dikira dalam kedudukan atau statistik liga.</div>
      </section>}

      {view === 'standings' && <section>{latestFinished && <section className="latest-result"><div className="section-heading"><div><span className="eyebrow">BARU TAMAT</span><h2>Keputusan terkini</h2></div><button className="light-btn" onClick={() => { setSelectedMatchId(latestFinished.id); setTvMode(true); }}><Tv size={18} />Mod TV</button></div><Scoreboard court={courtOf(latestFinished)} match={latestFinished} home={teamsById.get(latestFinished.homeTeamId)} away={teamsById.get(latestFinished.awayTeamId)} /></section>}<div className="page-title"><div><span className="eyebrow">KEDUDUKAN LIGA · 4 TERATAS KE PLAYOFF</span><h1>Siapa di depan?</h1><p>2 game setiap perlawanan · 1 mata setiap game menang · setiap team main {league.teams.length - 1} perlawanan</p></div><button className="light-btn" onClick={shareWhatsapp}><Share2 size={18} />Kongsi ke WhatsApp</button></div><div className="standings-panel"><StandingsTable rows={standings} /></div><div className="rules-note"><strong>Cara kira:</strong> setiap perlawanan 2 game. Menang 2–0 = 2 mata, seri 1–1 = 1 mata seorang, kalah 0–2 = 0. Walkover = 2 mata kepada pemenang. <strong>Jika mata sama:</strong> 2 team → keputusan perlawanan antara mereka; 3 team atau lebih → beza mata badminton (jika tinggal 2 team, head-to-head); masih sama → cabutan undi. Lajur <strong>Baki</strong> = perlawanan yang belum dimain.</div></section>}

      {view === 'teams' && <section><div className="page-title"><div><span className="eyebrow">7 TEAM · DOUBLES</span><h1>Team & pemain</h1><p>Setiap pemain mewakili satu team sahaja.</p></div>{isAdmin && <button className="light-btn" onClick={resetSchedule}><RotateCcw size={17} />Jana semula liga</button>}</div><div className="team-grid">{league.teams.map((team) => <article className="team-card" key={team.id}><div className="team-card-head"><TeamMark team={team} large />{isAdmin ? <input className="team-name-input" defaultValue={team.name} onBlur={(event) => { if (event.target.value.trim() && event.target.value !== team.name) commit({ ...league, teams: league.teams.map((item) => item.id === team.id ? { ...item, name: event.target.value.trim() } : item) }, 'Nama team dikemas kini'); }} /> : <h2>{team.name}</h2>}<span>{team.players.length} pemain</span></div><div className="player-list">{team.players.map((player, index) => <div key={player.id}><span>{String(index + 1).padStart(2, '0')}</span>{isAdmin ? <input defaultValue={player.name} onBlur={(event) => { if (event.target.value.trim() && event.target.value !== player.name) commit({ ...league, teams: league.teams.map((item) => item.id === team.id ? { ...item, players: item.players.map((person) => person.id === player.id ? { ...person, name: event.target.value.trim() } : person) } : item) }, 'Nama pemain dikemas kini'); }} /> : <strong>{player.name}</strong>}</div>)}</div>{isAdmin && <form className="add-player" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.player; if (!input.value.trim()) return; const player = { id: `${team.id}-P${Date.now()}`, name: input.value.trim() }; commit({ ...league, teams: league.teams.map((item) => item.id === team.id ? { ...item, players: [...item.players, player] } : item) }, 'Pemain ditambah'); input.value = ''; }}><input name="player" placeholder="Nama pemain baharu" /><button aria-label={`Tambah pemain ${team.name}`}><Plus size={18} /></button></form>}</article>)}{isAdmin && <article className="team-card add-team"><UserPlus size={28} /><h2>Tambah team</h2><p>Team baharu akan masuk apabila jadual liga dijana semula.</p><form onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.team; if (!input.value.trim()) return; const id = `T${Date.now()}`; commit({ ...league, teams: [...league.teams, { id, name: input.value.trim(), players: [] }] }, 'Team ditambah'); input.value = ''; }}><input name="team" placeholder="Nama team" required /><button className="primary-btn"><Plus size={17} />Tambah</button></form></article>}</div></section>}

      {view === 'stats' && <section><div className="page-title"><div><span className="eyebrow">REKOD SEBENAR</span><h1>Statistik liga</h1><p>Prestasi pemain dan kombinasi pasangan sepanjang musim.</p></div></div>{completedCount === 0 ? <EmptyStats /> : <><div className="stat-leaders"><div><span>KEDUDUKAN TERATAS</span><strong>{standings[0].name}</strong><small>{standings[0].leaguePoints} mata liga</small></div><div><span>PALING BANYAK MENANG</span><strong>{playerStats[0].name}</strong><small>{playerStats[0].won} kemenangan · {playerStats[0].teamName}</small></div><div><span>PASANGAN TERBAIK</span><strong>{pairStats[0]?.names.join(' / ') || '—'}</strong><small>{pairStats[0] ? `${pairStats[0].winRate}% kadar menang` : 'Belum ada data'}</small></div></div><div className="stats-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">INDIVIDU</span><h2>Rekod pemain</h2></div></div><div className="player-stats">{playerStats.filter((player) => player.played).map((player) => <div key={player.id}><div><strong>{player.name}</strong><span>{player.teamName}</span></div><div className="win-bar"><i style={{ width: `${player.winRate}%` }} /></div><span>{player.won}M / {player.lost}K</span><b>{player.winRate}%</b></div>)}</div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">DOUBLES</span><h2>Kombinasi pasangan</h2></div></div><div className="pair-list">{pairStats.map((pair, index) => <div key={pair.key}><span className="pair-rank">{index + 1}</span><div><strong>{pair.names.join(' / ')}</strong><small>{pair.teamName} · {pair.played} perlawanan</small></div><b>{pair.winRate}%</b></div>)}</div></section></div></>}</section>}
    </main>

    <footer><span>Monday Club · {league.season} · {sessionVenue}</span><span>{PLAY_TIME} · 2 game · 21 mata</span></footer>

    {pinOpen && <Modal title="Akses admin" onClose={() => setPinOpen(false)}><PinForm onSubmit={login} busy={pinBusy} error={pinError} /></Modal>}
    {settingsOpen && <Modal title="Tetapan admin" onClose={() => setSettingsOpen(false)}><div className="stack-form"><p>Mod admin aktif. Semua perubahan akan dikongsi kepada paparan live.</p><label>Bilangan court<select value={courtsDraft || courts} onChange={(event) => setCourtsDraft(Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} court</option>)}</select></label><button className="primary-btn full" disabled={!courtsDraft || courtsDraft === courts} onClick={() => { const value = normalizeCourts(courtsDraft); commitLatest((current) => ({ ...current, settings: { ...(current.settings || {}), courts: value } }), `${value} court digunakan`); setCourtsDraft(0); setPicked(null); }}><CalendarDays size={18} />Simpan bilangan court</button><label>Tempat main<select value={venueDraft || venue} onChange={(event) => setVenueDraft(event.target.value)}>{venues.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><div className="add-venue"><input value={newVenue} onChange={(event) => setNewVenue(event.target.value)} placeholder="Tambah tempat baharu" maxLength={60} aria-label="Nama tempat baharu" /><button className="light-btn" disabled={!newVenue.trim() || venues.includes(newVenue.trim())} onClick={() => { const name = newVenue.trim(); setVenueDraft(name); setNewVenue(''); commitLatest((current) => ({ ...current, settings: { ...(current.settings || {}), venues: [...new Set([...(current.settings?.venues || []), name])] } }), `${name} ditambah`); }}><Plus size={18} />Tambah</button></div><button className="primary-btn full" disabled={!venueDraft || venueDraft === venue} onClick={() => { const name = venueDraft; commitLatest((current) => ({ ...current, settings: { ...(current.settings || {}), venue: name } }), `Tempat main: ${name}`); setVenueDraft(''); }}><Check size={18} />Simpan tempat main</button><label>Waktu tamat sesi<input type="time" value={cutoffDraft || cutoff} onChange={(event) => setCutoffDraft(event.target.value)} /></label><p className="muted-note">Selepas waktu ini, senarai "Petang ni" dan tanda team hadir dikosongkan. Perlawanan yang tak sempat dimain kekal "Belum main" untuk sesi seterusnya.</p><button className="primary-btn full" disabled={!cutoffDraft || normalizeCutoff(cutoffDraft) !== cutoffDraft || cutoffDraft === cutoff} onClick={() => { const value = normalizeCutoff(cutoffDraft); commitLatest((current) => ({ ...current, settings: { ...(current.settings || {}), cutoff: value } }), `Waktu tamat sesi: ${formatClock(value)}`); setCutoffDraft(''); }}><Clock3 size={18} />Simpan waktu tamat</button><button className="light-btn full" onClick={() => { const current = adminPin; const next = window.prompt('PIN baharu (6 digit):'); if (!next) return; changeAdminPin(current, next).then(() => { sessionStorage.setItem('mbl-admin-pin', next); setAdminPin(next); setSettingsOpen(false); setToast('PIN berjaya ditukar'); }).catch((error) => window.alert(error.message)); }}><LockKeyhole size={18} />Tukar PIN</button><button className="danger-outline full" onClick={logout}><LogOut size={18} />Keluar mod admin</button></div></Modal>}

    {selectedMatch && !tvMode && <Modal title={isAdmin ? 'Live scoring' : 'Butiran perlawanan'} onClose={closeMatch} wide><Scoreboard className={isAdmin ? 'admin-board' : ''} court={courtOf(selectedMatch)} match={selectedMatch} home={teamsById.get(selectedMatch.homeTeamId)} away={teamsById.get(selectedMatch.awayTeamId)} />
      {isAdmin ? <ScoringConsole key={selectedMatch.id} match={selectedMatch} teamsById={teamsById} courtMatches={courtMatches} courtOf={courtOf} turnLabel={(item) => todayIds.has(item.id) && league.today?.turns?.[item.id] ? `Giliran ${league.today.turns[item.id]}` : item.status === 'live' ? 'Live' : ''} onSelect={(id) => { setSelectedMatchId(id); setSpecialOpen(false); setEditOpen(false); }} updateMatch={updateMatch} onEdit={() => setEditOpen(true)} onSpecial={() => setSpecialOpen(true)} onTv={() => setTvMode(true)} onClose={closeMatch} onClearResult={() => { if (!canClearSemi(playoffMatches, selectedMatch.stage)) { setToast('Akhir atau tempat ketiga sudah bermula. Batalkan keputusan itu dahulu.'); return; } const home = teamsById.get(selectedMatch.homeTeamId); const away = teamsById.get(selectedMatch.awayTeamId); if (!window.confirm(`Batalkan keputusan ${teamPlayers(home)} lwn ${teamPlayers(away)} (${finalLabel(selectedMatch)})?\n\nSkor akan dipadam dan perlawanan kembali "Belum main".`)) return; updateMatch(selectedMatch.id, clearResult, 'Keputusan dibatalkan'); }} /> : <div className="public-match-note"><Activity size={18} />Paparan ini dikemas kini oleh admin. Skor live muncul secara automatik.</div>}
    </Modal>}

    {specialOpen && selectedMatch && <Modal title="Keputusan khas" onClose={() => setSpecialOpen(false)}><SpecialForm match={selectedMatch} home={teamsById.get(selectedMatch.homeTeamId)} away={teamsById.get(selectedMatch.awayTeamId)} onSave={(next) => { updateMatch(selectedMatch.id, () => next, 'Keputusan khas disimpan'); setSpecialOpen(false); }} /></Modal>}
    {editOpen && selectedMatch && <Modal title="Pembetulan skor akhir" onClose={() => setEditOpen(false)}><EditResultForm key={`${selectedMatch.id}-${selectedMatch.updatedAt || ''}`} match={selectedMatch} onSave={(next) => { updateMatch(selectedMatch.id, () => next, 'Skor akhir dibetulkan'); setEditOpen(false); }} /></Modal>}
    {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
  </div>;
}
