// scripts/import_youth_programs.mjs
// 청소년/유아동 이용가능 체육시설 프로그램 + 인근 대중교통 정보를
// facilities / programs / facility_transports 테이블에 적재하는 스크립트 (배치 upsert 버전)
//
// - JSON 파일 이름: "청소년 유아동 이용가능 체육시설 프로그램.json"
// - JSON 파일 위치: 프로젝트 루트 ( .env 와 같은 위치 )
// - 여러 번 실행해도 중복 레코드가 쌓이지 않도록 upsert + UNIQUE 제약을 사용

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------
// 0. 환경 변수 체크 & Supabase 클라이언트 생성
// ---------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env에 설정되어 있지 않습니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------
// 1. JSON 파일 경로
// ---------------------------------------------------------------------
const JSON_FILE_NAME = "청소년 유아동 이용가능 체육시설 프로그램.json";
const jsonPath = path.join(__dirname, "..", JSON_FILE_NAME);

// ---------------------------------------------------------------------
// 2. 공통 유틸 함수들
// ---------------------------------------------------------------------
const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toInt = (v) => {
  const n = toNumber(v);
  return n === null ? null : Math.round(n);
};

const formatDate = (yyyymmdd) => {
  if (!yyyymmdd || typeof yyyymmdd !== "string" || yyyymmdd.length !== 8) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
};

// 대상 그룹 정규화: 유아/아동/청소년/성인/노인 등으로 묶어줌
function normalizeTargetGroup(raw) {
  if (!raw || typeof raw !== "string") return null;

  const text = raw.replace(/\s+/g, ""); // 공백 제거
  const tags = [];

  if (/유아|영유아|유아동|아동|어린이|키즈/i.test(text)) tags.push("유아/아동");
  if (/청소년|중학생|고등학생|중고생|청년/i.test(text)) tags.push("청소년");
  if (/성인|일반/i.test(text)) tags.push("성인");
  if (/노인|시니어|어르신/i.test(text)) tags.push("노인");

  if (tags.length === 0) {
    // 어떤 패턴에도 안 걸리면 원본 반환
    return raw.trim();
  }
  // 중복 제거 후 합치기
  return Array.from(new Set(tags)).join("/");
}

// 스케줄 텍스트 만들기: "YYYY-MM-DD~YYYY-MM-DD / 요일 / 시간"
function buildSchedule(row) {
  const begin = formatDate(row.PROGRM_BEGIN_DE);
  const end = formatDate(row.PROGRM_END_DE);
  const range = begin && end ? `${begin}~${end}` : "";
  const weekday = row.PROGRM_ESTBL_WKDAY_NM || "";
  const time = row.PROGRM_ESTBL_TIZN_VALUE || "";

  return [range, weekday, time].filter((v) => v && v.trim() !== "").join(" / ");
}

// 대중교통 정보 추출 (최대 5개 랭크)
function extractTransports(row) {
  const transports = [];

  for (let i = 1; i <= 5; i++) {
    const stopName = row[`BSTP_SUBWAYST_${i}R_NM`];
    const stopType = row[`PBTRNSP_FCLTY_SDIV_${i}R_NM`]; // 버스/지하철 등
    const walkDist = toNumber(row[`WLKG_DSTNC_${i}R_VALUE`]); // 도보 거리(m)
    const straightDist = toNumber(row[`STRT_DSTNC_${i}R_VALUE`]); // 직선거리(m)
    const walkTimeSec = toNumber(row[`WLKG_MVMN_${i}R_TIME`]); // 초 단위
    const lat = toNumber(row[`PBTRNSP_FCLTY_${i}R_LA`]);
    const lon = toNumber(row[`PBTRNSP_FCLTY_${i}R_LO`]);

    if (!stopName && !stopType) continue;

    const distance_m = walkDist ?? straightDist ?? null;
    const walk_time_min = walkTimeSec != null ? Math.round(walkTimeSec / 60) : null;

    transports.push({
      stop_name: stopName || null,
      stop_type: stopType || null,
      distance_m: distance_m != null ? Math.round(distance_m) : null,
      walk_time_min,
      routes: null, // 노선 정보는 이 데이터셋에 없으므로 일단 null
      lat,
      lon,
    });
  }

  return transports;
}

// ---------------------------------------------------------------------
// 3. facilities 전체를 로드해서 "이름|시도|시군구" → id 인덱스 생성
// ---------------------------------------------------------------------
let facilityIndex = null; // Map<string, number>

async function loadFacilitiesIndex() {
  console.log("[INFO] facilities 인덱스 로드 중...");

  const { data, error } = await supabase
    .from("facilities")
    .select("id, name, sido, sigungu");

  if (error) {
    console.error("[FATAL] facilities 전체 조회 실패:", error.message || error);
    process.exit(1);
  }

  const map = new Map();
  for (const f of data) {
    const key = `${f.name}|${f.sido || ""}|${f.sigungu || ""}`;
    // 중복 key 가 있을 수 있지만, 첫 번째만 사용
    if (!map.has(key)) {
      map.set(key, f.id);
    }
  }

  console.log("[INFO] facilities 인덱스 로드 완료, 개수 =", map.size);
  return map;
}

// ---------------------------------------------------------------------
// 4. JSON 한 레코드 → facility 찾기/생성
//    대부분은 이미 facilities 에 있으므로, 인덱스에서 바로 찾고,
//    없는 경우에만 INSERT
// ---------------------------------------------------------------------
async function findOrCreateFacility(row) {
  const name = row.FCLTY_NM;
  const address = row.FCLTY_ADDR || null;
  const sido = row.CTPRVN_NM || null;
  const sigungu = row.SIGNGU_NM || null;
  const type = row.INDUTY_NM || row.FCLTY_TY_NM || null;
  const phone = row.FCLTY_TEL_NO || null;
  const lat = toNumber(row.FCLTY_LA);
  const lon = toNumber(row.FCLTY_LO);
  const homepage = row.HMPG_URL || null;

  if (!name) return null;

  const key = `${name}|${sido || ""}|${sigungu || ""}`;

  // 1) 인덱스에서 먼저 찾기
  if (facilityIndex.has(key)) {
    return facilityIndex.get(key);
  }

  // 2) 정말 없으면 새로 INSERT (드문 케이스)
  const insertData = {
    name,
    address,
    road_addr: address,
    sido,
    sigungu,
    type,
    phone,
    lat,
    lon,
    homepage_url: homepage,
    is_public: true,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("facilities")
    .insert(insertData)
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.warn(
      "[WARN] facilities INSERT 실패, 이 시설은 스킵:",
      name,
      insertErr ? (insertErr.message || String(insertErr)).slice(0, 120) : ""
    );
    return null;
  }

  facilityIndex.set(key, inserted.id);
  return inserted.id;
}

// ---------------------------------------------------------------------
// 5. programs / facility_transports 배치 upsert 설정
// ---------------------------------------------------------------------
const PROGRAM_BATCH_SIZE = 500;
const TRANSPORT_BATCH_SIZE = 500;

let programBatch = [];
let transportBatch = [];

// 한 실행 내 중복 방지용 키
const programKeyCache = new Set(); // `${facilityId}|${name}|${schedule}|${target_group}`
const transportKeyCache = new Set(); // `${facilityId}|${stop_name}|${stop_type}`

// 프로그램 배치 flush
async function flushProgramBatch() {
  if (programBatch.length === 0) return;

  const batch = programBatch;
  programBatch = [];

  try {
    const { error } = await supabase
      .from("programs")
      .upsert(batch, {
        onConflict: "facility_id,name,schedule,target_group",
      });

    if (error) {
      console.warn(
        "[WARN] program 배치 upsert 실패:",
        (error.message || String(error)).slice(0, 200)
      );
    }
  } catch (e) {
    console.warn(
      "[WARN] program 배치 upsert 예외:",
      (e.message || String(e)).slice(0, 200)
    );
  }
}

// 대중교통 배치 flush
async function flushTransportBatch() {
  if (transportBatch.length === 0) return;

  const batch = transportBatch;
  transportBatch = [];

  try {
    const { error } = await supabase
      .from("facility_transports")
      .upsert(batch, {
        onConflict: "facility_id,stop_name,stop_type",
      });

    if (error) {
      console.warn(
        "[WARN] facility_transports 배치 upsert 실패:",
        (error.message || String(error)).slice(0, 200)
      );
    }
  } catch (e) {
    console.warn(
      "[WARN] facility_transports 배치 upsert 예외:",
      (e.message || String(e)).slice(0, 200)
    );
  }
}

// 개별 row -> 프로그램 레코드 생성 + 배치에 push
async function upsertProgramBatched(facilityId, row) {
  const rawTarget = row.PROGRM_TRGET_NM || "";
  const normalizedTarget = normalizeTargetGroup(rawTarget);

  const name = row.PROGRM_NM || "이름미상 프로그램";
  const schedule = buildSchedule(row);
  const priceText = row.PROGRM_PRC ? String(row.PROGRM_PRC) : null;

  const key = `${facilityId}|${name}|${schedule}|${normalizedTarget || ""}`;
  if (programKeyCache.has(key)) return;
  programKeyCache.add(key);

  const descParts = [];
  if (row.PROGRM_TY_NM) descParts.push(`유형: ${row.PROGRM_TY_NM}`);
  if (row.EDC_GOAL_CN) descParts.push(`교육 목표: ${row.EDC_GOAL_CN}`);
  if (row.SAFE_MANAGT_CN) descParts.push(`안전관리: ${row.SAFE_MANAGT_CN}`);
  if (row.LDR_QUALF_CN) descParts.push(`강사 자격: ${row.LDR_QUALF_CN}`);

  const description = descParts.length > 0 ? descParts.join("\n") : null;

  programBatch.push({
    facility_id: facilityId,
    name,
    description,
    target_group: normalizedTarget,
    age_min: null,
    age_max: null,
    schedule,
    price: priceText,
    homepage_url: row.HMPG_URL || null,
    source: "youth_programs_bigdata_2024",
    updated_at: new Date().toISOString(),
  });

  if (programBatch.length >= PROGRAM_BATCH_SIZE) {
    await flushProgramBatch();
  }
}

// 개별 row -> 대중교통 레코드 생성 + 배치에 push
async function upsertTransportsBatched(facilityId, row) {
  const transports = extractTransports(row);
  if (transports.length === 0) return;

  for (const t of transports) {
    const key = `${facilityId}|${t.stop_name || ""}|${t.stop_type || ""}`;
    if (transportKeyCache.has(key)) continue;
    transportKeyCache.add(key);

    transportBatch.push({
      facility_id: facilityId,
      stop_name: t.stop_name,
      stop_type: t.stop_type,
      distance_m: t.distance_m,
      walk_time_min: t.walk_time_min,
      routes: t.routes,
      lat: t.lat,
      lon: t.lon,
      source: "youth_programs_bigdata_2024",
      created_at: new Date().toISOString(),
    });

    if (transportBatch.length >= TRANSPORT_BATCH_SIZE) {
      await flushTransportBatch();
    }
  }
}

// ---------------------------------------------------------------------
// 6. 메인 실행 로직
// ---------------------------------------------------------------------
async function main() {
  // 0) JSON 존재 여부 확인
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ JSON 파일을 찾을 수 없습니다: ${jsonPath}`);
    process.exit(1);
  }

  // 1) facilities 인덱스 로드
  facilityIndex = await loadFacilitiesIndex();

  // 2) JSON 읽기 및 파싱
  const raw = fs.readFileSync(jsonPath, "utf8");
  let rows;
  try {
    const parsed = JSON.parse(raw);
    rows = Array.isArray(parsed) ? parsed : parsed.data || [];
  } catch (e) {
    console.error("❌ JSON 파싱 실패:", e.message || e);
    process.exit(1);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("❌ JSON 안에 레코드가 없습니다.");
    process.exit(1);
  }

  console.log(`[INFO] JSON 경로: ${jsonPath}`);
  console.log(`[INFO] 총 ${rows.length} 개 레코드 처리 시작`);

  let processed = 0;

  for (const row of rows) {
    processed += 1;

    try {
      const facilityId = await findOrCreateFacility(row);
      if (!facilityId) continue;

      await upsertProgramBatched(facilityId, row);
      await upsertTransportsBatched(facilityId, row);
    } catch (e) {
      console.warn(
        "[WARN] 레코드 처리 중 예외 발생, 이 레코드는 스킵:",
        (e.message || String(e)).slice(0, 160)
      );
    }

    if (processed % 1000 === 0) {
      console.log(`[PROGRESS] ${processed} / ${rows.length}`);
    }
  }

  // 3) 남은 배치 flush
  await flushProgramBatch();
  await flushTransportBatch();

  console.log("✅ import_youth_programs 배치 작업이 완료되었습니다.");
}

// ---------------------------------------------------------------------
// 7. 실행
// ---------------------------------------------------------------------
main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ 스크립트 전체 실행 중 오류:", e.message || e);
    process.exit(1);
  });
