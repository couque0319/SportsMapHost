// scripts/import_bigdata_bundle.mjs

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// ---------- 1) 환경변수 로드 & Supabase 클라이언트 ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL =', SUPABASE_URL);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 비어있습니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- 2) JSON 파일 읽기 ----------
// ※ 여기에서 네가 저장한 JSON 파일 경로에 맞게 파일명만 바꿔줘
const jsonPath = path.resolve(process.cwd(), 'data', 'bigdata_bundle.json');

if (!fs.existsSync(jsonPath)) {
  console.error('❌ JSON 파일을 찾을 수 없습니다:', jsonPath);
  process.exit(1);
}

const raw = fs.readFileSync(jsonPath, 'utf8');
let rows;
try {
  rows = JSON.parse(raw);
} catch (e) {
  console.error('❌ JSON 파싱 실패:', e);
  process.exit(1);
}

if (!Array.isArray(rows)) {
  console.error('❌ JSON 최상위 구조가 배열이 아닙니다. [ { ... }, ... ] 형태인지 확인해 주세요.');
  process.exit(1);
}

console.log(`[INFO] 총 ${rows.length} 개 레코드 로드 완료`);

// ---------- 3) 도우미 함수들 ----------

// 시설 키: "시설명 + 주소" 조합으로 중복 관리
function buildFacilityKey(row) {
  return `${row.FCLTY_NM || ''}||${row.FCLTY_ADDR || ''}`;
}

const facilityCache = new Map();      // key -> facility_id
const clearedTransports = new Set();  // transport 한 번 삭제한 facility_id 기억

// 3-1) facilities 에서 찾거나, 없으면 새로 INSERT
async function getOrCreateFacility(row) {
  const key = buildFacilityKey(row);
  if (facilityCache.has(key)) {
    return facilityCache.get(key);
  }

  const name = row.FCLTY_NM?.trim();
  const address = row.FCLTY_ADDR?.trim();

  if (!name || !address) {
    throw new Error('시설명(FCLTY_NM) 또는 주소(FCLTY_ADDR)가 비어있는 레코드입니다.');
  }

  // 1) 기존 시설 찾기
  const { data: existing, error: selectError } = await supabase
    .from('facilities')
    .select('id')
    .eq('name', name)
    .eq('address', address)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  let facilityId;

  if (existing) {
    facilityId = existing.id;
  } else {
    // 2) 없으면 새로 INSERT
    const insertPayload = {
      name,
      address,
      lat: row.FCLTY_LA ? Number(row.FCLTY_LA) : null,
      lon: row.FCLTY_LO ? Number(row.FCLTY_LO) : null,
      phone: row.FCLTY_TEL_NO ?? null,
      sido: row.CTPRVN_NM ?? null,
      sigungu: row.SIGNGU_NM ?? null,
      type: row.FCLTY_TY_NM || row.INDUTY_NM || null,
      is_public: row.FCLTY_FLAG_NM === '공공',
      // facilities 테이블에 homepage_url 같은 컬럼이 있다면 같이 매핑 가능
      // homepage_url: row.HMPG_URL ?? null,
      source: 'bigdata_bundle'   // facilities 에 source 컬럼이 있으면 쓰고, 없으면 제거
    };

    const { data: inserted, error: insertError } = await supabase
      .from('facilities')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }
    facilityId = inserted.id;
  }

  facilityCache.set(key, facilityId);
  return facilityId;
}

// 3-2) facility_transports 갱신 (1R~5R)
async function upsertTransports(facilityId, row) {
  // 한 시설에 대해서는 최초 1번만 기존 데이터 싹 삭제
  if (!clearedTransports.has(facilityId)) {
    const { error: delError } = await supabase
      .from('facility_transports')
      .delete()
      .eq('facility_id', facilityId);

    if (delError) {
      throw delError;
    }
    clearedTransports.add(facilityId);
  }

  const transportRows = [];

  for (let i = 1; i <= 5; i++) {
    const stopType = row[`PBTRNSP_FCLTY_SDIV_${i}R_NM`];
    const stopName = row[`BSTP_SUBWAYST_${i}R_NM`];
    const walkDistStr = row[`WLKG_DSTNC_${i}R_VALUE`];
    const walkTimeStr = row[`WLKG_MVMN_${i}R_TIME`];
    const stopLatStr = row[`PBTRNSP_FCLTY_${i}R_LA`];
    const stopLonStr = row[`PBTRNSP_FCLTY_${i}R_LO`];

    // 정류장/역 이름이 없으면 스킵
    if (!stopName && !stopType) continue;

    const distance_m = walkDistStr ? Number(walkDistStr) : null;
    const walk_time_min = walkTimeStr
      ? Math.round(Number(walkTimeStr) / 60)    // 초 → 분
      : null;

    transportRows.push({
      facility_id: facilityId,
      rank: i,
      stop_name: stopName || null,
      stop_type: stopType || null,
      distance_m,
      walk_time_min,
      routes: null, // 이 JSON에 노선 정보는 없으니 일단 비워둠
      lat: stopLatStr ? Number(stopLatStr) : null,
      lon: stopLonStr ? Number(stopLonStr) : null,
      source: 'bigdata_bundle'
    });
  }

  if (transportRows.length === 0) return;

  const { error } = await supabase
    .from('facility_transports')
    .insert(transportRows);

  if (error) {
    throw error;
  }
}

// 3-3) programs 테이블에 강좌 1개 추가
async function insertProgram(facilityId, row) {
  if (!row.PROGRM_NM) {
    // 강좌 정보가 없는 레코드일 수도 있으니 스킵
    return;
  }

  const week = row.PROGRM_ESTBL_WKDAY_NM || '';      // 예: '월화수목금'
  const time = row.PROGRM_ESTBL_TIZN_VALUE || '';    // 예: '07:00~07:50'
  const begin = row.PROGRM_BEGIN_DE || '';           // 예: '20251101'
  const end = row.PROGRM_END_DE || '';

  const scheduleParts = [];
  if (week) scheduleParts.push(week);
  if (time) scheduleParts.push(time);
  if (begin || end) scheduleParts.push(`${begin}~${end}`);
  const schedule = scheduleParts.join(' ');

  const descParts = [];
  if (row.SAFE_MANAGT_CN) descParts.push(`안전관리: ${row.SAFE_MANAGT_CN}`);
  if (row.EDC_GOAL_CN) descParts.push(`교육목표: ${row.EDC_GOAL_CN}`);
  const description = descParts.join('\n');

  const payload = {
    facility_id: facilityId,
    name: row.PROGRM_NM,
    description: description || null,
    target_group: row.PROGRM_TRGET_NM || null,   // 예: '성인/청소년'
    age_min: null,
    age_max: null,
    schedule: schedule || null,
    price: row.PROGRM_PRC ? String(row.PROGRM_PRC) : null,
    homepage_url: row.HMPG_URL || null,
    source: 'bigdata_bundle'
  };

  const { error } = await supabase
    .from('programs')
    .insert(payload);

  if (error) {
    throw error;
  }
}

// ---------- 4) 메인 실행 루프 ----------

async function run() {
  console.log('[INFO] import_bigdata_bundle 시작');

  let processed = 0;
  for (const row of rows) {
    try {
      const facilityId = await getOrCreateFacility(row);
      await upsertTransports(facilityId, row);
      await insertProgram(facilityId, row);

      processed++;
      if (processed % 100 === 0) {
        console.log(`[INFO] ${processed} / ${rows.length} 처리 완료`);
      }
    } catch (err) {
      console.error('❌ 레코드 처리 중 오류 발생:', err);
      // 계속 진행할 거면 여기서 continue, 완전 중단하고 싶으면 throw
    }
  }

  console.log(`[DONE] 총 ${processed} 개 레코드 처리 완료`);
}

run()
  .then(() => {
    console.log('[END]');+
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 스크립트 전체 실패:', err);
    process.exit(1);
  });
