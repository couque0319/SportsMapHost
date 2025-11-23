/* scripts/geocode_facilities_from_supabase.mjs */
/* eslint-disable no-console */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fetch from 'node-fetch';

// -------------------- .env.geocode 로드 --------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.geocode'),
});

console.log('[dotenv] env loaded from .env.geocode');
console.log('[DEBUG] SUPABASE_URL        =', process.env.SUPABASE_URL);
console.log('[DEBUG] KAKAO_REST_API_KEY  =', process.env.KAKAO_REST_API_KEY);
console.log('[DEBUG] JUSO_API_KEY        =', process.env.JUSO_API_KEY ? '(set)' : '(missing)');

// -------------------- 환경 변수 --------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const JUSO_API_KEY = process.env.JUSO_API_KEY;
const TABLE_NAME = process.env.SUPABASE_TABLE_NAME || 'facilities';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
}
if (!KAKAO_REST_API_KEY) {
  throw new Error('KAKAO_REST_API_KEY가 설정되지 않았습니다.');
}
if (!JUSO_API_KEY) {
  throw new Error('JUSO_API_KEY(도로명주소 API 키)가 설정되지 않았습니다.');
}

// -------------------- 테이블 컬럼명 매핑 --------------------
// facilities 테이블 실제 컬럼명
const NAME_COLUMN = 'name';
const ADDRESS_COLUMN = 'address';
const SIDO_COLUMN = 'sido';
const SIGUNGU_COLUMN = 'sigungu';

// Supabase REST API 기본 URL (PostgREST)
const REST_URL = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`;

// -------------------- 공통 유틸 --------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * 주소 문자열 전처리:
 * - [우편번호] 제거 (예: [07062])
 * - 괄호 안 내용 제거 (예: (구의동))
 * - 연속 공백 정리
 */
function preprocessAddress(raw) {
  if (!raw) return '';
  let s = String(raw);

  // [12345] 형태 우편번호 제거
  s = s.replace(/\[\d{5}\]/g, ' ');

  // 괄호 안 내용 제거 (예: (연향동), (화명동), (연동 123-4))
  s = s.replace(/\(.+?\)/g, ' ');

  // 연속 공백 정리
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

function buildFullAddress(row) {
  const base = preprocessAddress(row[ADDRESS_COLUMN]); // 원본 address 정리
  const parts = [];

  const sido = row.sido;
  const sigungu = row.sigungu;

  // base 안에 이미 있지 않은 경우에만 붙이기
  if (sido && !base.includes(sido)) {
    parts.push(sido);
  }
  if (sigungu && !base.includes(sigungu)) {
    parts.push(sigungu);
  }

  parts.push(base);

  return parts.join(' ');
}

// -------------------- JUSO (도로명주소 API) --------------------

/**
 * 행안부 도로명주소 API로 주소 정규화
 * @param {string} rawAddress
 * @returns {Promise<{normalized: string|null, used: 'road'|'jibun'|null}>}
 */
async function normalizeAddressWithJuso(rawAddress) {
  const keyword = preprocessAddress(rawAddress);
  if (!keyword) return { normalized: null, used: null };

  const url = new URL('https://www.juso.go.kr/addrlink/addrLinkApi.do');
  url.searchParams.set('confmKey', JUSO_API_KEY);
  url.searchParams.set('currentPage', '1');
  url.searchParams.set('countPerPage', '1');
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('resultType', 'json');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text();
    console.log('[WARN] JUSO API 요청 실패:', res.status, res.statusText, '-', text);
    return { normalized: null, used: null };
  }

  const data = await res.json();
  const jusoList = data?.results?.juso;

  if (!Array.isArray(jusoList) || jusoList.length === 0) {
    console.log('[INFO] JUSO 결과 없음:', keyword);
    return { normalized: null, used: null };
  }

  const first = jusoList[0];
  const roadAddr = first.roadAddr;   // 도로명 주소
  const jibunAddr = first.jibunAddr; // 지번 주소

  if (roadAddr && roadAddr.trim() !== '') {
    return { normalized: roadAddr.trim(), used: 'road' };
  }
  if (jibunAddr && jibunAddr.trim() !== '') {
    return { normalized: jibunAddr.trim(), used: 'jibun' };
  }

  return { normalized: null, used: null };
}

// -------------------- Kakao 지오코딩 + 키워드 검색 --------------------

/**
 * Kakao 주소 검색 API로 좌표 변환
 */
async function geocodeWithKakaoAddress(addressForKakao) {
  if (!addressForKakao) return { lat: null, lng: null };

  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.searchParams.set('query', addressForKakao);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  });

  if (!res.ok) {
    console.log('[WARN] Kakao 주소 API 요청 실패:', res.status, res.statusText, '| 주소 =', addressForKakao);
    return { lat: null, lng: null };
  }

  const data = await res.json();

  if (!data.documents || data.documents.length === 0) {
    console.log('[INFO] Kakao 주소 지오코딩 결과 없음:', addressForKakao);
    return { lat: null, lng: null };
  }

  const best = data.documents[0];
  const lng = parseFloat(best.x); // 경도
  const lat = parseFloat(best.y); // 위도

  return { lat, lng };
}

/**
 * Kakao 키워드(장소) 검색 API로 좌표 변환
 */
async function geocodeWithKakaoKeyword(keyword) {
  if (!keyword) return { lat: null, lng: null };

  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', keyword);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  });

  if (!res.ok) {
    console.log('[WARN] Kakao 키워드 API 요청 실패:', res.status, res.statusText, '| 키워드 =', keyword);
    return { lat: null, lng: null };
  }

  const data = await res.json();

  if (!data.documents || data.documents.length === 0) {
    console.log('[INFO] Kakao 키워드 검색 결과 없음:', keyword);
    return { lat: null, lng: null };
  }

  const best = data.documents[0];
  const lng = parseFloat(best.x);
  const lat = parseFloat(best.y);
  return { lat, lng };
}

/**
 * 전체 파이프라인:
 *   (name, sido, sigungu, rawAddress)
 *   → 주소 전처리(+sido/sigungu 붙이기)
 *   → JUSO (정규화)
 *   → Kakao 주소 지오코딩
 *   → 실패 시 Kakao 키워드 검색 (sido+sigungu+name → name)
 */
async function resolveLatLng({ name, rawAddress, sido, sigungu }) {
  const preAddr = preprocessAddress(rawAddress);

  // 행정구역 정보가 있으면 풀 주소로 합치기
  let baseAddr = [sido, sigungu, preAddr].filter(Boolean).join(' ').trim();

  // 1단계: JUSO로 주소 정규화
  const { normalized, used } = await normalizeAddressWithJuso(baseAddr || preAddr);

  let forKakao = baseAddr || preAddr;
  if (normalized) {
    forKakao = normalized;
    console.log('    JUSO 정규화 성공:', used, '=>', normalized);
  } else {
    console.log('    JUSO 정규화 실패, 전처리 주소로 Kakao 시도:', forKakao);
  }

  // 2단계: Kakao 주소 지오코딩
  let { lat, lng } = await geocodeWithKakaoAddress(forKakao);
  if (lat != null && lng != null) return { lat, lng };

  // 3단계: Kakao 키워드 검색 (sido + sigungu + name)
  const keyword1 = [sido, sigungu, name].filter(Boolean).join(' ');
  ({ lat, lng } = await geocodeWithKakaoKeyword(keyword1));
  if (lat != null && lng != null) {
    console.log('    키워드 검색 성공 (행정구역+이름):', keyword1);
    return { lat, lng };
  }

  // 4단계: 시설명만으로 검색
  ({ lat, lng } = await geocodeWithKakaoKeyword(name));
  if (lat != null && lng != null) {
    console.log('    키워드 검색 성공 (이름만):', name);
    return { lat, lng };
  }

  console.log('    지오코딩 완전 실패:', name, '|', rawAddress);
  return { lat: null, lng: null };
}

// -------------------- Supabase REST 연동 --------------------

/**
 * 아직 좌표가 없고, geocode_failed = false 인 레코드들을 배치로 불러오기
 */
async function fetchBatchWithoutCoords(limit = 100) {
  const url = new URL(REST_URL);

  // select=name,address,sido,sigungu,lat,lng,geocode_failed
  url.searchParams.set(
  'select',
  `${NAME_COLUMN},${ADDRESS_COLUMN},sido,sigungu,lat,lng,geocode_failed`,
);
  url.searchParams.append('lat', 'is.null');
  url.searchParams.append('lng', 'is.null');
  url.searchParams.append(ADDRESS_COLUMN, 'not.is.null');
  //url.searchParams.append('geocode_failed', 'eq.false');
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: supabaseHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Supabase REST select 에러: ${res.status} ${res.statusText} - ${text}`,
    );
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * address 기준으로 업데이트
 * - geocode 성공: lat/lon/lng 채우고 geocode_failed = false
 * - geocode 실패: geocode_failed = true 만 세팅
 */
async function updateByAddress(address, lat, lng) {
  const url = new URL(REST_URL);
  url.searchParams.append(ADDRESS_COLUMN, `eq.${address}`);
  url.searchParams.append('lat', 'is.null');
  url.searchParams.append('lng', 'is.null');

  let body;

  if (lat != null && lng != null) {
    body = {
      lat,
      lon: lng,
      lng,
      geocode_failed: false,
    };
  } else {
    body = {
      geocode_failed: true,
    };
  }

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: supabaseHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.log(
      '[ERROR] 업데이트 실패 (address 기준):',
      address,
      res.status,
      res.statusText,
      '-',
      text,
    );
  } else {
    if (lat != null && lng != null) {
      console.log('[OK] 좌표 업데이트 성공:', address, lat, lng);
    } else {
      console.log('[OK] 지오코딩 실패 플래그만 설정:', address);
    }
  }
}

// -------------------- main 루프 --------------------

async function main() {
  console.log('[START] 지오코딩 스크립트 시작, 테이블 =', TABLE_NAME);

  let totalProcessed = 0;

  while (true) {
    const batch = await fetchBatchWithoutCoords(50);

    if (batch.length === 0) {
      console.log('[DONE] 더 이상 처리할 레코드가 없습니다.');
      break;
    }

    console.log(`[INFO] 새 배치: ${batch.length} 건 처리 예정`);

    for (const row of batch) {
  const facilityName = row[NAME_COLUMN];
  const originalAddress = row[ADDRESS_COLUMN];
  const fullAddress = buildFullAddress(row); // sido/sigungu 포함해서 전체 주소 만들기

  console.log(
    '  ▶ 지오코딩 대상:',
    facilityName ?? '(이름 없음)',
    '| 주소:',
    fullAddress,
  );

  const { lat, lng } = await resolveLatLng(fullAddress);

  // DB 업데이트는 여전히 "원래 address 컬럼 기준"으로 검색해서 업데이트
  await updateByAddress(originalAddress, lat, lng);

  totalProcessed += 1;

  await sleep(200); // 쿼터 보호
}


    console.log('[PROGRESS] 현재까지 처리:', totalProcessed, '건');
  }

  console.log('[END] 전체 지오코딩 작업 종료. 총 처리:', totalProcessed, '건');
}

// -------------------- 실행 --------------------

main().catch((e) => {
  console.error('[FATAL] 스크립트 실패:', e);
  process.exit(1);
});
