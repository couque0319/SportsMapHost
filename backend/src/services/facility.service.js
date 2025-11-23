import { supabase } from './supabaseClient.js';

export async function listFacilities({ sido, sigungu, q, page, pageSize }) {
  let query = supabase
    .from('facilities')
    .select(
      'id, name, address, lat, lon, sido, sigungu, phone, is_public, type',
      { count: 'exact' }
    );

  if (sido) query = query.eq('sido', sido);
  if (sigungu) query = query.eq('sigungu', sigungu);
  if (q) query = query.ilike('name', `%${q}%`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    items: data || [],
    page,
    pageSize,
    total: count ?? 0
  };
}

export async function getFacilityDetail(id) {
  const { data, error } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data;
}
