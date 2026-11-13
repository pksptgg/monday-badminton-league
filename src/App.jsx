import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, CalendarDays, Check, ChevronRight, Clock3, Edit3,
  LockKeyhole, LogOut, Medal, Plus, RotateCcw, Share2, ShieldCheck,
  Trophy, Tv, Undo2, UserPlus, Users, X,
} from 'lucide-react';
import { addPoint, completeSpecial, overrideMatch, undoPoint } from './domain.js';
import { generateRoundRobin } from './schedule.js';
import { calculateStandings } from './standings.js';
import { calculatePairStats, calculatePlayerStats } from './stats.js';
import { changeAdminPin, loadLeague, online, saveLeague, subscribeLeague, verifyAdminPin } from './storage.js';

const FINAL = new Set(['completed', 'walkover', 'retired']);
const statusText = { scheduled: 'Akan datang', live: 'Sedang berlangsung', completed: 'Selesai', walkover: 'Walkover', retired: 'Retired', postponed: 'Ditangguhkan' };
const navItems = [
  ['home', 'Utama', Activity], ['fixtures', 'Jadual', CalendarDays],
  ['standings', 'Kedudukan', Trophy], ['teams', 'Team', Users], ['stats', 'Statistik', Medal],
];

function formatDate(date) {
  return new Intl.DateTimeFormat('ms-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}
function finalLabel(match) {
  if (match.status === 'walkover') return 'W/O';
  if (match.status === 'retired') return 'RET';
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
function Scoreboard({ match, home, away, tv = false }) {
  const isFinal = FINAL.has(match.status);
  const homeScore = isFinal ? match.gamesWon.home : match.current.home;
  const awayScore = isFinal ? match.gamesWon.away : match.current.away;
  return <div className={`scoreboard ${tv ? 'tv-scoreboard' : ''}`}>
    <div className="score-top"><StatusPill match={match} /><span>Pusingan {match.round} · Court {match.court}</span><span>{formatDate(match.date)}</span></div>
    <div className="score-main">
      <div className={`score-team home ${match.winnerId === home.id ? 'winner' : ''}`}>
        <TeamMark team={home} large /><div><h2>{home.name}</h2><p><PlayerNames team={home} ids={match.homePlayerIds || []} /></p></div>
      </div>
      <div className="score-number home-score">{homeScore}</div>
      <div className="score-divider"><span>VS</span><small>{isFinal ? 'GAME' : `GAME ${Math.min(match.games.length + 1, 3)}`}</small></div>
      <div className="score-number away-score">{awayScore}</div>
      <div className={`score-team away ${match.winnerId === away.id ? 'winner' : ''}`}>
        <TeamMark team={away} large /><div><h2>{away.name}</h2><p><PlayerNames team={away} ids={match.awayPlayerIds || []} /></p></div>
      </div>
    </div>
    <div className="game-strip">
      {[0, 1, 2].map((index) => {
        const game = match.games[index];
        return <div className={!game ? 'empty' : ''} key={index}><span>G{index + 1}</span><strong>{game ? `${game.home} : ${game.away}` : '– : –'}</strong></div>;
      })}
      {isFinal && <div className="result-tag"><Check size={15} />{finalLabel(match)}</div>}
    </div>
  </div>;
}
function FixtureCard({ match, home, away, onOpen, isAdmin, onPostpone }) {
  return <article className={`fixture-card ${match.status}`}>
    <div className="fixture-meta"><span>PERLAWANAN {match.matchNumber}</span><StatusPill match={match} /></div>
    <button className="fixture-teams" onClick={onOpen}>
      <div><TeamMark team={home} /><strong>{home.name}</strong><small><PlayerNames team={home} ids={match.homePlayerIds || []} /></small></div>
      <span className="fixture-score">{FINAL.has(match.status) ? finalLabel(match) : match.status === 'live' ? `${match.current.home} : ${match.current.away}` : 'VS'}</span>
      <div><TeamMark team={away} /><strong>{away.name}</strong><small><PlayerNames team={away} ids={match.awayPlayerIds || []} /></small></div>
    </button>
    <div className="fixture-foot"><span>{formatDate(match.date)}</span>{isAdmin && <div><button onClick={onOpen} className="text-btn">{FINAL.has(match.status) ? 'Semak' : 'Buka skor'}<ChevronRight size={15} /></button>{['scheduled', 'postponed'].includes(match.status) && <button onClick={onPostpone} className="text-btn muted">{match.status === 'postponed' ? 'Aktifkan' : 'Tangguh'}</button>}</div>}</div>
  </article>;
}
function StandingsTable({ rows, compact = false }) {
  return <div className="table-wrap"><table className="standings-table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>M</th><th>K</th><th className="emphasis">Mata</th>{!compact && <><th>Game +/−</th><th>Mata +/−</th></>}</tr></thead><tbody>
    {rows.map((row) => <tr key={row.id}><td><span className={`rank ${row.rank <= 3 ? 'top' : ''}`}>{row.rank}</span></td><td><div className="table-team"><TeamMark team={row} /><strong>{row.name}</strong></div></td><td>{row.played}</td><td>{row.won}</td><td>{row.lost}</td><td className="points-cell">{row.leaguePoints}</td>{!compact && <><td className={row.gameDifference > 0 ? 'positive' : ''}>{row.gameDifference > 0 ? '+' : ''}{row.gameDifference}</td><td className={row.pointDifference > 0 ? 'positive' : ''}>{row.pointDifference > 0 ? '+' : ''}{row.pointDifference}</td></>}</tr>)}
  </tbody></table></div>;
}
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
  const initial = match.games.length ? match.games : [{ home: 0, away: 0 }, { home: 0, away: 0 }];
  const [count, setCount] = useState(initial.length === 3 ? 3 : 2);
  const [games, setGames] = useState([...initial, { home: 0, away: 0 }].slice(0, 3));
  const [error, setError] = useState('');
  const update = (index, side, value) => setGames(games.map((game, gameIndex) => gameIndex === index ? { ...game, [side]: value } : game));
  const submit = () => {
    try { onSave(overrideMatch(match, games.slice(0, count))); } catch (reason) { setError('Skor tidak sah. Semak format 21 mata, beza 2 dan had 30.'); }
  };
  return <div className="stack-form"><p>Guna ini untuk pembetulan keputusan akhir. Semua game mesti sah.</p>
    <label>Bilangan game<select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={2}>2 game</option><option value={3}>3 game</option></select></label>
    {games.slice(0, count).map((game, index) => <div className="edit-game" key={index}><span>Game {index + 1}</span><input aria-label={`Game ${index + 1} home`} type="number" min="0" max="30" value={game.home} onChange={(event) => update(index, 'home', event.target.value)} /><b>:</b><input aria-label={`Game ${index + 1} away`} type="number" min="0" max="30" value={game.away} onChange={(event) => update(index, 'away', event.target.value)} /></div>)}
    {error && <p className="form-error">{error}</p>}<button className="primary-btn full" onClick={submit}>Simpan pembetulan</button>
  </div>;
}
function LineupSelect({ label, team, ids, onChange, disabled }) {
  return <div className="lineup"><span>{label}</span><div>{[0, 1].map((index) => <select key={index} disabled={disabled} value={ids[index] || ''} onChange={(event) => { const next = [...ids]; next[index] = event.target.value; onChange(next); }}><option value="">Pilih pemain</option>{team.players.map((player) => <option key={player.id} value={player.id} disabled={ids.includes(player.id) && ids[index] !== player.id}>{player.name}</option>)}</select>)}</div></div>;
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
  const [roundFilter, setRoundFilter] = useState('all');
  const [toast, setToast] = useState('');
  const leagueRef = useRef(null);
  const revision = useRef(0);
  const pending = useRef(0);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    loadLeague().then((data) => { leagueRef.current = data; setLeague(data); }).catch((error) => setLoadError(error.message));
    return subscribeLeague((data) => {
      if (pending.current === 0) { leagueRef.current = data; setLeague(data); }
    });
  }, []);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); } }, [toast]);

  const teamsById = useMemo(() => new Map((league?.teams || []).map((team) => [team.id, team])), [league]);
  const standings = useMemo(() => league ? calculateStandings(league.teams, league.matches) : [], [league]);
  const playerStats = useMemo(() => league ? calculatePlayerStats(league.teams, league.matches) : [], [league]);
  const pairStats = useMemo(() => league ? calculatePairStats(league.teams, league.matches) : [], [league]);
  const selectedMatch = league?.matches.find((match) => match.id === selectedMatchId);
  const currentRound = useMemo(() => {
    if (!league) return 1;
    return league.matches.find((match) => !FINAL.has(match.status))?.round || Math.max(...league.matches.map((match) => match.round));
  }, [league]);
  const activeMatch = useMemo(() => {
    if (!league) return null;
    return league.matches.find((match) => match.status === 'live') || league.matches.find((match) => match.round === currentRound && !FINAL.has(match.status)) || [...league.matches].reverse().find((match) => FINAL.has(match.status));
  }, [league, currentRound]);

  function commit(next, message = 'Perubahan disimpan') {
    leagueRef.current = next;
    setLeague(next);
    const ownRevision = ++revision.current;
    pending.current++;
    queue.current = queue.current.then(() => saveLeague(next, adminPin)).then((saved) => {
      if (ownRevision === revision.current) { leagueRef.current = saved; setLeague(saved); }
      setToast(message);
    }).catch((error) => setToast(error.message || 'Gagal menyimpan. Cuba lagi.')).finally(() => { pending.current--; });
  }
  function updateMatch(id, updater, message) {
    const next = { ...leagueRef.current, matches: leagueRef.current.matches.map((match) => match.id === id ? updater(match) : match) };
    commit(next, message);
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
    const table = standings.map((row) => `${row.rank}. ${row.name} — ${row.leaguePoints} mata`).join('\n');
    const text = `*${league.name}* 🏸\n${league.season}\n\n*KEPUTUSAN*\n${results.length ? results.join('\n') : 'Belum ada keputusan.'}\n\n*KEDUDUKAN*\n${table}\n\nSkor live: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }
  function resetSchedule() {
    if (!window.confirm('Ini akan memadam semua keputusan dan menjana semula jadual round robin. Teruskan?')) return;
    const matches = generateRoundRobin(league.teams.map((team) => team.id)).map((match) => ({ ...match, homePlayerIds: teamsById.get(match.homeTeamId).players.slice(0, 2).map((player) => player.id), awayPlayerIds: teamsById.get(match.awayTeamId).players.slice(0, 2).map((player) => player.id) }));
    commit({ ...league, matches }, 'Jadual baharu dijana');
  }

  if (loadError) return <main className="fatal"><h1>Monday Badminton League</h1><p>Sambungan database gagal: {loadError}</p><button className="primary-btn" onClick={() => window.location.reload()}>Cuba lagi</button></main>;
  if (!league) return <main className="loading"><div className="brand-loader"><Trophy /></div><h1>Monday Badminton League</h1><p>Menyediakan court…</p></main>;

  const roundFixtures = league.matches.filter((match) => match.round === currentRound);
  const playingIds = new Set(roundFixtures.flatMap((match) => [match.homeTeamId, match.awayTeamId]));
  const byeTeam = league.teams.find((team) => !playingIds.has(team.id));
  const completedCount = league.matches.filter((match) => FINAL.has(match.status)).length;

  if (tvMode && selectedMatch) return <main className="tv-mode"><div className="tv-head"><div className="brand inverse"><span className="brand-icon"><Trophy size={26} /></span><div><strong>MONDAY</strong><span>BADMINTON LEAGUE</span></div></div><button className="light-btn" onClick={() => setTvMode(false)}><ArrowLeft size={18} />Keluar mod TV</button></div><Scoreboard match={selectedMatch} home={teamsById.get(selectedMatch.homeTeamId)} away={teamsById.get(selectedMatch.awayTeamId)} tv /><div className="tv-footer"><span>{league.season}</span><span>Best of 3 · 21 mata · Had 30</span><span className="live-dot">{selectedMatch.status === 'live' ? 'LIVE' : 'SCOREBOARD'}</span></div></main>;

  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <button className="brand" onClick={() => setView('home')}><span className="brand-icon"><Trophy size={25} /></span><div><strong>MONDAY</strong><span>BADMINTON LEAGUE</span></div></button>
      <div className="header-actions"><span className={`connection ${online ? 'online' : 'local'}`}><span />{online ? 'Live online' : 'Demo peranti ini'}</span><button className="share-btn" onClick={shareWhatsapp}><Share2 size={17} /><span>Kongsi</span></button><button className={isAdmin ? 'admin-active' : 'admin-btn'} onClick={() => isAdmin ? setSettingsOpen(true) : setPinOpen(true)}><ShieldCheck size={17} />{isAdmin ? 'Admin aktif' : 'Admin'}</button></div>
    </div><div className="color-line"><i /><i /><i /></div></header>

    <nav className="main-nav" aria-label="Navigasi utama"><div>{navItems.map(([id, label, Icon]) => <button className={view === id ? 'active' : ''} key={id} onClick={() => setView(id)}><Icon size={18} /><span>{label}</span></button>)}</div></nav>

    <main className="page-content">
      {view === 'home' && <>
        <section className="page-intro"><div><span className="eyebrow">{league.season} · SINGLE ROUND ROBIN</span><h1>Malam badminton,<br /><em>semua mata dikira.</em></h1></div><div className="season-progress"><span>PERKEMBANGAN LIGA</span><strong>{completedCount}<small> / {league.matches.length} perlawanan</small></strong><div><i style={{ width: `${completedCount / league.matches.length * 100}%` }} /></div></div></section>
        <section className="hero-score"><div className="section-heading"><div><span className="eyebrow">COURT 1</span><h2>{activeMatch.status === 'live' ? 'Live sekarang' : FINAL.has(activeMatch.status) ? 'Keputusan terkini' : 'Perlawanan seterusnya'}</h2></div><div className="heading-actions"><button className="light-btn" onClick={() => { setSelectedMatchId(activeMatch.id); setTvMode(true); }}><Tv size={18} />Mod TV</button>{isAdmin && <button className="primary-btn" onClick={() => openMatch(activeMatch)}><Activity size={18} />Buka scoring</button>}</div></div><Scoreboard match={activeMatch} home={teamsById.get(activeMatch.homeTeamId)} away={teamsById.get(activeMatch.awayTeamId)} /></section>
        <div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">PUSINGAN {currentRound}</span><h2>Jadual sesi ini</h2></div><button className="text-btn" onClick={() => setView('fixtures')}>Semua jadual<ChevronRight size={16} /></button></div><div className="compact-fixtures">{roundFixtures.map((match) => <button key={match.id} onClick={() => openMatch(match)}><span>{teamsById.get(match.homeTeamId).name}</span><strong>{FINAL.has(match.status) ? finalLabel(match) : match.status === 'live' ? `${match.current.home} : ${match.current.away}` : 'VS'}</strong><span>{teamsById.get(match.awayTeamId).name}</span></button>)}</div>{byeTeam && <div className="bye-note"><Clock3 size={17} /><span><strong>{byeTeam.name}</strong> bye pada pusingan ini. Tiada mata diberikan.</span></div>}</section>
          <section className="panel"><div className="panel-head"><div><span className="eyebrow">LIGA</span><h2>Kedudukan semasa</h2></div><button className="text-btn" onClick={() => setView('standings')}>Penuh<ChevronRight size={16} /></button></div><StandingsTable rows={standings.slice(0, 5)} compact /></section></div>
      </>}

      {view === 'fixtures' && <section><div className="page-title"><div><span className="eyebrow">21 PERLAWANAN · 7 PUSINGAN</span><h1>Jadual perlawanan</h1><p>Setiap team bertemu sekali. Satu team berehat setiap pusingan.</p></div><label className="round-filter">Pusingan<select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value)}><option value="all">Semua</option>{[1, 2, 3, 4, 5, 6, 7].map((round) => <option key={round} value={round}>Pusingan {round}</option>)}</select></label></div><div className="fixtures-list">{league.matches.filter((match) => roundFilter === 'all' || match.round === Number(roundFilter)).map((match) => <FixtureCard key={match.id} match={match} home={teamsById.get(match.homeTeamId)} away={teamsById.get(match.awayTeamId)} isAdmin={isAdmin} onOpen={() => openMatch(match)} onPostpone={() => updateMatch(match.id, (current) => ({ ...current, status: current.status === 'postponed' ? 'scheduled' : 'postponed' }), match.status === 'postponed' ? 'Perlawanan diaktifkan semula' : 'Perlawanan ditangguhkan')} />)}</div></section>}

      {view === 'standings' && <section><div className="page-title"><div><span className="eyebrow">KEDUDUKAN LIGA</span><h1>Siapa di depan?</h1><p>Menang 2 mata · Kalah 1 mata · Walkover 0 mata</p></div><button className="light-btn" onClick={shareWhatsapp}><Share2 size={18} />Kongsi ke WhatsApp</button></div><div className="standings-panel"><StandingsTable rows={standings} /></div><div className="rules-note"><strong>Jika sama mata:</strong> beza game menang–kalah → beza mata badminton → kedudukan dikongsi. Team bye tidak mendapat mata.</div></section>}

      {view === 'teams' && <section><div className="page-title"><div><span className="eyebrow">7 TEAM · DOUBLES</span><h1>Team & pemain</h1><p>Setiap pemain mewakili satu team sahaja.</p></div>{isAdmin && <button className="light-btn" onClick={resetSchedule}><RotateCcw size={17} />Jana semula liga</button>}</div><div className="team-grid">{league.teams.map((team) => <article className="team-card" key={team.id}><div className="team-card-head"><TeamMark team={team} large />{isAdmin ? <input className="team-name-input" defaultValue={team.name} onBlur={(event) => { if (event.target.value.trim() && event.target.value !== team.name) commit({ ...league, teams: league.teams.map((item) => item.id === team.id ? { ...item, name: event.target.value.trim() } : item) }, 'Nama team dikemas kini'); }} /> : <h2>{team.name}</h2>}<span>{team.players.length} pemain</span></div><div className="player-list">{team.players.map((player, index) => <div key={player.id}><span>{String(index + 1).padStart(2, '0')}</span>{isAdmin ? <input defaultValue={player.name} onBlur={(event) => { if (event.target.value.trim() && event.target.value !== player.name) commit({ ...league, teams: league.teams.map((item) => item.id === team.id ? { ...item, players: item.players.map((person) => person.id === player.id ? { ...person, name: event.target.value.trim() } : person) } : item) }, 'Nama pemain dikemas kini'); }} /> : <strong>{player.name}</strong>}</div>)}</div>{isAdmin && <form className="add-player" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.player; if (!input.value.trim()) return; const player = { id: `${team.id}-P${Date.now()}`, name: input.value.trim() }; commit({ ...league, teams: league.teams.map((item) => item.id === team.id ? { ...item, players: [...item.players, player] } : item) }, 'Pemain ditambah'); input.value = ''; }}><input name="player" placeholder="Nama pemain baharu" /><button aria-label={`Tambah pemain ${team.name}`}><Plus size={18} /></button></form>}</article>)}{isAdmin && <article className="team-card add-team"><UserPlus size={28} /><h2>Tambah team</h2><p>Team baharu akan masuk apabila jadual liga dijana semula.</p><form onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.team; if (!input.value.trim()) return; const id = `T${Date.now()}`; commit({ ...league, teams: [...league.teams, { id, name: input.value.trim(), players: [] }] }, 'Team ditambah'); input.value = ''; }}><input name="team" placeholder="Nama team" required /><button className="primary-btn"><Plus size={17} />Tambah</button></form></article>}</div></section>}

      {view === 'stats' && <section><div className="page-title"><div><span className="eyebrow">REKOD SEBENAR</span><h1>Statistik liga</h1><p>Prestasi pemain dan kombinasi pasangan sepanjang musim.</p></div></div>{completedCount === 0 ? <EmptyStats /> : <><div className="stat-leaders"><div><span>KEDUDUKAN TERATAS</span><strong>{standings[0].name}</strong><small>{standings[0].leaguePoints} mata liga</small></div><div><span>PALING BANYAK MENANG</span><strong>{playerStats[0].name}</strong><small>{playerStats[0].won} kemenangan · {playerStats[0].teamName}</small></div><div><span>PASANGAN TERBAIK</span><strong>{pairStats[0]?.names.join(' / ') || '—'}</strong><small>{pairStats[0] ? `${pairStats[0].winRate}% kadar menang` : 'Belum ada data'}</small></div></div><div className="stats-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">INDIVIDU</span><h2>Rekod pemain</h2></div></div><div className="player-stats">{playerStats.filter((player) => player.played).map((player) => <div key={player.id}><div><strong>{player.name}</strong><span>{player.teamName}</span></div><div className="win-bar"><i style={{ width: `${player.winRate}%` }} /></div><span>{player.won}M / {player.lost}K</span><b>{player.winRate}%</b></div>)}</div></section><section className="panel"><div className="panel-head"><div><span className="eyebrow">DOUBLES</span><h2>Kombinasi pasangan</h2></div></div><div className="pair-list">{pairStats.map((pair, index) => <div key={pair.key}><span className="pair-rank">{index + 1}</span><div><strong>{pair.names.join(' / ')}</strong><small>{pair.teamName} · {pair.played} perlawanan</small></div><b>{pair.winRate}%</b></div>)}</div></section></div></>}</section>}
    </main>

    <footer><span>Monday Badminton League · {league.season}</span><span>21 mata · Best of 3 · Satu court</span></footer>

    {pinOpen && <Modal title="Akses admin" onClose={() => setPinOpen(false)}><PinForm onSubmit={login} busy={pinBusy} error={pinError} /></Modal>}
    {settingsOpen && <Modal title="Tetapan admin" onClose={() => setSettingsOpen(false)}><div className="stack-form"><p>Mod admin aktif. Semua perubahan akan dikongsi kepada paparan live.</p><button className="light-btn full" onClick={() => { const current = adminPin; const next = window.prompt('PIN baharu (6 digit):'); if (!next) return; changeAdminPin(current, next).then(() => { sessionStorage.setItem('mbl-admin-pin', next); setAdminPin(next); setSettingsOpen(false); setToast('PIN berjaya ditukar'); }).catch((error) => window.alert(error.message)); }}><LockKeyhole size={18} />Tukar PIN</button><button className="danger-outline full" onClick={logout}><LogOut size={18} />Keluar mod admin</button></div></Modal>}

    {selectedMatch && !tvMode && <Modal title={isAdmin ? 'Live scoring' : 'Butiran perlawanan'} onClose={closeMatch} wide><Scoreboard match={selectedMatch} home={teamsById.get(selectedMatch.homeTeamId)} away={teamsById.get(selectedMatch.awayTeamId)} />
      {isAdmin ? <div className="scoring-console"><div className="lineups"><LineupSelect label={teamsById.get(selectedMatch.homeTeamId).name} team={teamsById.get(selectedMatch.homeTeamId)} ids={selectedMatch.homePlayerIds || []} disabled={selectedMatch.status === 'live'} onChange={(ids) => updateMatch(selectedMatch.id, (match) => ({ ...match, homePlayerIds: ids }))} /><LineupSelect label={teamsById.get(selectedMatch.awayTeamId).name} team={teamsById.get(selectedMatch.awayTeamId)} ids={selectedMatch.awayPlayerIds || []} disabled={selectedMatch.status === 'live'} onChange={(ids) => updateMatch(selectedMatch.id, (match) => ({ ...match, awayPlayerIds: ids }))} /></div>
        <div className="point-buttons"><button className="point-home" disabled={FINAL.has(selectedMatch.status)} onClick={() => updateMatch(selectedMatch.id, (match) => addPoint(match, 'home'), 'Skor dikemas kini')}><span>+1 MATA</span><strong>{teamsById.get(selectedMatch.homeTeamId).name}</strong></button><button className="point-away" disabled={FINAL.has(selectedMatch.status)} onClick={() => updateMatch(selectedMatch.id, (match) => addPoint(match, 'away'), 'Skor dikemas kini')}><span>+1 MATA</span><strong>{teamsById.get(selectedMatch.awayTeamId).name}</strong></button></div>
        <div className="score-tools"><button className="light-btn" disabled={!selectedMatch.pointLog.length} onClick={() => updateMatch(selectedMatch.id, undoPoint, 'Satu rally dibatalkan')}><Undo2 size={18} />Undo rally</button><button className="light-btn" onClick={() => setEditOpen(true)}><Edit3 size={18} />Betulkan skor</button><button className="light-btn" onClick={() => { setSelectedMatchId(selectedMatch.id); setTvMode(true); }}><Tv size={18} />Mod TV</button><button className="danger-outline" disabled={FINAL.has(selectedMatch.status)} onClick={() => setSpecialOpen(true)}>Walkover / Retired</button></div>
      </div> : <div className="public-match-note"><Activity size={18} />Paparan ini dikemas kini oleh admin. Skor live muncul secara automatik.</div>}
    </Modal>}

    {specialOpen && selectedMatch && <Modal title="Keputusan khas" onClose={() => setSpecialOpen(false)}><SpecialForm match={selectedMatch} home={teamsById.get(selectedMatch.homeTeamId)} away={teamsById.get(selectedMatch.awayTeamId)} onSave={(next) => { updateMatch(selectedMatch.id, () => next, 'Keputusan khas disimpan'); setSpecialOpen(false); }} /></Modal>}
    {editOpen && selectedMatch && <Modal title="Pembetulan skor akhir" onClose={() => setEditOpen(false)}><EditResultForm key={`${selectedMatch.id}-${selectedMatch.updatedAt || ''}`} match={selectedMatch} onSave={(next) => { updateMatch(selectedMatch.id, () => next, 'Skor akhir dibetulkan'); setEditOpen(false); }} /></Modal>}
    {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
  </div>;
}
