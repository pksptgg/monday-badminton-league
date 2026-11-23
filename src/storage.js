import { createClient } from '@supabase/supabase-js';
import { createSeedLeague, DEFAULT_PIN } from './seed.js';

const STORAGE_KEY = 'monday-badminton-league-v1';
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const online = Boolean(url && anonKey);
const supabase = online ? createClient(url, anonKey) : null;

export async function loadLeague() {
  if (online) {
    const { data, error } = await supabase.from('league_state').select('data').eq('id', 1).single();
    if (error) throw error;
    return data.data;
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  const seed = createSeedLeague();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

export async function verifyAdminPin(pin) {
  if (online) {
    const { data, error } = await supabase.rpc('verify_admin_pin', { input_pin: pin });
    if (error) throw error;
    return Boolean(data);
  }
  const configured = localStorage.getItem(`${STORAGE_KEY}-pin`) || DEFAULT_PIN;
  return pin === configured;
}

export async function saveLeague(league, pin) {
  const next = { ...league, updatedAt: new Date().toISOString() };
  if (online) {
    const { data, error } = await supabase.rpc('update_league_state', { input_pin: pin, input_data: next });
    if (error) throw error;
    if (!data) throw new Error('PIN admin tidak sah atau sesi telah tamat.');
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

// Save a single match. Online this only replaces that match on the server, so
// two scorers on different courts never overwrite each other; the latest full
// league (including the other court's points) is returned.
export async function saveMatch(match, pin) {
  if (online) {
    const { data, error } = await supabase.rpc('update_league_match', { input_pin: pin, input_match: match });
    if (error) throw error;
    if (!data) throw new Error('PIN admin tidak sah atau sesi telah tamat.');
    return data;
  }
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || createSeedLeague();
  const replace = (list) => list.map((item) => item.id === match.id ? match : item);
  const next = { ...saved, matches: replace(saved.matches), ...(saved.playoff ? { playoff: { ...saved.playoff, matches: replace(saved.playoff.matches || []) } } : {}), updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function changeAdminPin(currentPin, newPin) {
  if (!/^\d{6}$/.test(newPin)) throw new Error('PIN mesti tepat 6 digit.');
  if (online) {
    const { data, error } = await supabase.rpc('change_admin_pin', { current_pin: currentPin, new_pin: newPin });
    if (error) throw error;
    if (!data) throw new Error('PIN semasa tidak sah.');
  } else {
    if (!await verifyAdminPin(currentPin)) throw new Error('PIN semasa tidak sah.');
    localStorage.setItem(`${STORAGE_KEY}-pin`, newPin);
  }
}

// onReconnect fires whenever the realtime channel comes back after a drop
// (phone slept, app switched, network change), so the caller can re-read
// any updates that were broadcast while it was disconnected.
export function subscribeLeague(onChange, onReconnect) {
  if (!online) return () => {};
  let joinedBefore = false;
  const channel = supabase.channel('league-live')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'league_state', filter: 'id=eq.1' }, (payload) => {
      onChange(payload.new.data);
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      if (joinedBefore && onReconnect) onReconnect();
      joinedBefore = true;
    });
  return () => { supabase.removeChannel(channel); };
}
