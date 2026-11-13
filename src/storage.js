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

export function subscribeLeague(onChange) {
  if (!online) return () => {};
  const channel = supabase.channel('league-live')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'league_state', filter: 'id=eq.1' }, (payload) => {
      onChange(payload.new.data);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
