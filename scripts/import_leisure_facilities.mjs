// scripts/import_leisure_facilities.mjs
// 레저스포츠 시설 공공데이터 → Supabase facilities 테이블로 적재 스크립트

import dotenv from 'dotenv';
dotenv.config({ path: './.env' }); // SportsMap 루트의 .env 사용

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// ────────────────────────────────────────
// 1. 환경변수 로드 & 검증
// ────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openApiEndpoint = process.env.OPENAPI_ENDPOINT;
const openApiKey = process.env.OPENAPI_KEY;

console.log('[ENV] SUPABASE_URL      =', supabaseUrl);
console.log('[ENV] OPENAPI_ENDPOINT  =', openApiEndpoint);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('[ERROR] Supabase 환경변수(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.');
  process.exit(1);
}
if (!openApiEndpoint || !openApiKey) {
  console.error('[ERROR] OPENAPI_ENDPOINT / OPENAPI_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

// Supabase Client (service_role 사용: 서버 측에서만 사용!)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// ────────────────────────────────────────
// 2. 공공데이터 API 호출
// ────────────────────────────────────────
async function fetchLeisureFacilities(pageNo = 1, numOfRows = 100) {
  console.log(`페이지 ${pageNo} 요청 중...`);

  const res = await axios.get(openApiEndpoint, {
    params: {
      serviceKey: openApiKey,
      pageNo,
      numOfRows,
      resultType: 'json',
    },
  });

  console.log('API status =', res.status, res.statusText);

  const body = res.data?.response?.body;
  if (!body) {
    console.log('[WARN] 응답 body 없음:', res.data);
    return { items: [], totalCount: 0 };
  }

  let items = body.items?.item ?? [];
  if (!Array.isArray(items)) {
    items = [items];
  }

  const totalCount = Number(body.totalCount ?? items.length);

  return { items, totalCount };
}

// ────────────────────────────────────────
// 3. API → facilities 행으로 매핑
//    facilities 테이블 컬럼:
//    public_id, name, address, lat, lon, type, phone,
//    sido, sigungu, is_public, homepage_url, road_addr,
//    road_daddr, jibun_addr, created_at, updated_at ...
// ────────────────────────────────────────
function makePublicId(item) {
  // 시도 + 시군구 + 시설명 + 종목명을 합쳐 내부 유니크키로 사용
  return [
    item.ctpv_nm ?? '',
    item.sgg_nm ?? '',
    item.faci_nm ?? '',
    item.code_nm ?? '',
  ].join('|');
}

function mapItemToFacilityRow(item) {
  const roadAddr = item.faci_road_addr ?? null;
  const jibunAddr = item.faci_post_addr ?? null;

  const nowIso = new Date().toISOString();

  return {
    public_id: makePublicId(item),

    name: item.faci_nm ?? null,
    type: item.code_nm ?? null, // 시설종목명

    homepage_url: item.homepage_url ?? null,
    phone: item.faci_tel_no ?? null,

    // 행정구역
    sido: item.ctpv_nm ?? null,
    sigungu: item.sgg_nm ?? null,

    // 주소 컬럼들
    road_addr: roadAddr,
    road_daddr: item.faci_road_daddr ?? null,
    jibun_addr: jibunAddr,
    address: roadAddr || jibunAddr,

    // 지금은 좌표 정보가 없으므로 null
    lat: null,
    lon: null,

    is_public: true,

    // 타임스탬프
    created_at: nowIso,
    updated_at: nowIso,
  };
}

// ────────────────────────────────────────
// 4. 같은 public_id 중복 제거 (배치 내부)
//    → Postgres 21000 에러 예방
// ────────────────────────────────────────
function dedupeByPublicId(rows) {
  const map = new Map(); // key: public_id, value: row
  for (const row of rows) {
    if (!row.public_id) continue;
    map.set(row.public_id, row); // 같은 key가 여러 번 나오면 마지막 것으로 덮어씀
  }
  return Array.from(map.values());
}

// ────────────────────────────────────────
// 5. Supabase에 upsert
// ────────────────────────────────────────
async function saveFacilitiesToSupabase(items) {
  const rows = items.map(mapItemToFacilityRow);
  const dedupedRows = dedupeByPublicId(rows);

  console.log(
    `[UPSERT] 이번 페이지 원본 ${rows.length}개 → 중복 제거 후 ${dedupedRows.length}개`
  );

  const { error } = await supabase
    .from('facilities')
    .upsert(dedupedRows, { onConflict: 'public_id' });

  if (error) {
    console.error('Supabase error:', error);
    throw error;
  }

  console.log(`Upsert 완료: ${dedupedRows.length}개`);
}

// ────────────────────────────────────────
// 6. 메인 루프: 페이지 돌면서 전체 import
// ────────────────────────────────────────
async function runImport() {
  let pageNo = 1;
  const numOfRows = 100; // 한 번에 100개씩
  let processed = 0;
  let totalCount = null;

  while (true) {
    const { items, totalCount: apiTotal } = await fetchLeisureFacilities(
      pageNo,
      numOfRows
    );

    if (totalCount === null) {
      totalCount = apiTotal;
    }

    if (!items.length) {
      console.log('[INFO] 더 이상 가져올 데이터가 없습니다.');
      break;
    }

    await saveFacilitiesToSupabase(items);

    processed += items.length;
    console.log(`진행 상황: ${processed} / ${totalCount}`);

    if (processed >= totalCount) {
      console.log('[INFO] totalCount에 도달하여 종료합니다.');
      break;
    }

    pageNo++;
  }

  console.log('✅ 전체 Import 완료!');
}

// ────────────────────────────────────────
// 7. 실행
// ────────────────────────────────────────
runImport().catch((err) => {
  console.error('[FATAL] Import 실패:', err);
  process.exit(1);
});
