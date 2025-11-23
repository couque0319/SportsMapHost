// backend/src/services/programs.service.js
import { supabase } from './supabaseClient.js';

/**
 * 메인 화면용 프로그램 카드 목록 가져오기
 * - programs + facilities 조인
 * - 최근 등록 순으로 정렬
 */
export async function getProgramHighlights(limit = 3) {
  const { data, error } = await supabase
    .from('programs')
    .select(
      `
      id,
      name,
      target_group,
      schedule,
      price,
      homepage_url,
      facility:facility_id (
        id,
        name,
        address,
        sido,
        sigungu
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getProgramHighlights error:', error);
    throw error;
  }

  // frontend에서 쓰기 편하도록 형태 변환
  return (data || []).map((row) => ({
    id: row.id,
    programName: row.name,
    targetGroup: row.target_group,
    schedule: row.schedule,
    price: row.price,
    homepageUrl: row.homepage_url,
    facilityName: row.facility?.name ?? '',
    address:
      row.facility?.address ??
      [row.facility?.sido, row.facility?.sigungu].filter(Boolean).join(' '),
  }));
}
