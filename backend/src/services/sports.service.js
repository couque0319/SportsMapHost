import { supabase } from './supabaseClient.js';

export async function listSports() {
  const { data, error } = await supabase
    .from('sports')
    .select('id, code, name, color, icon')
    .order('id');

  if (error) throw error;

  return data || [];
}
