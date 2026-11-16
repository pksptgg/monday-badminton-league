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

function isoDay(date) {
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
