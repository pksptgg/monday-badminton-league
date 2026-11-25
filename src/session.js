// Daily play session: the "Petang ni" announcement and the admin's
// "Siapa hadir" ticks last until the session cut-off (default 7:00 pm, device time).
// After that the home page returns to its default state; unplayed matches simply
// stay "Belum main" and come back in the suggestions next session.
export const DEFAULT_CUTOFF = '19:00';

export function normalizeCutoff(value) {
  if (typeof value !== 'string') return DEFAULT_CUTOFF;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return DEFAULT_CUTOFF;
  return value;
}

function atTime(day, cutoff) {
  const [hours, minutes] = normalizeCutoff(cutoff).split(':').map(Number);
  const at = new Date(day);
  at.setHours(hours, minutes, 0, 0);
  return at;
}

// The first cut-off strictly after `from`.
export function nextCutoff(cutoff, from = new Date()) {
  const at = atTime(from, cutoff);
  if (at <= from) at.setDate(at.getDate() + 1);
  return at;
}

export function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Is the saved announcement (or presence list) still within its session?
export function isSessionActive(entry, cutoff, now = new Date()) {
  if (!entry) return false;
  if (entry.validUntil) return now.getTime() < Date.parse(entry.validUntil);
  // Older announcements only carry the day they were made.
  return entry.date === isoDay(now) && now < atTime(now, cutoff);
}

export function formatClock(cutoff) {
  const [hours, minutes] = normalizeCutoff(cutoff).split(':').map(Number);
  const h12 = hours % 12 || 12;
  const part = hours < 12 ? 'pg' : hours < 20 ? 'ptg' : 'mlm';
  return `${h12}:${String(minutes).padStart(2, '0')} ${part}`;
}

// The club plays on Monday and Tuesday only. The next session is today while
// today is a play day before the cut-off; otherwise the next Monday/Tuesday.
// After Tuesday's session the next session is the following Monday.
export const PLAY_DAYS = [1, 2]; // Isnin, Selasa

export function nextPlayDay(cutoff, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    if (!PLAY_DAYS.includes(day.getDay())) continue;
    if (offset === 0 && now >= atTime(now, cutoff)) continue;
    return day;
  }
  return start;
}

// The cut-off moment on a given play day: an announced list stays up until then.
export function cutoffOn(day, cutoff) {
  return atTime(day, cutoff);
}

// How to name an announced session: "Petang ni" on the day itself, "Esok
// petang" the day before, otherwise the weekday and date ("Isnin, 30 Nov").
export function sessionLabel(dateIso, now = new Date()) {
  const today = isoDay(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateIso === today) return 'Petang ni';
  if (dateIso === isoDay(tomorrow)) return 'Esok petang';
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][date.getDay()];
  const monthName = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'][month - 1];
  return `${weekday}, ${day} ${monthName}`;
}
