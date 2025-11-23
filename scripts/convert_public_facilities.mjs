// scripts/convert_public_facilities.mjs
// 2024 전국 공공체육시설현황.xlsx → 필요한 필드만 추출 + public_id 생성 + 중복 제거

import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

// 1) 엑셀 파일 경로 (SportsMap 루트에 xlsx를 두었다고 가정)
//   필요하면 파일 경로를 네 환경에 맞게 수정해도 됨.
const EXCEL_PATH = path.join(
  process.cwd(),
  '2024 전국 공공체육시설현황.xlsx'
);

// 2) 건너뛸 시트들 (표지, 요약 시트 등)
const SKIP_SHEETS = new Set([
  '표지',
  '일반개요',
  '공공체육시설의분류기준',
  '연도별현황',
  '설치주체별현황',
  '시도별현황',
  'Sheet1'
]);

// 3) 엑셀 파일 읽기
const workbook = xlsx.readFile(EXCEL_PATH, { cellDates: false });
console.log('[INFO] 엑셀 시트 목록:', workbook.SheetNames);

// ────────────────────────────────────────
// 헤더 행 자동 탐지 (앞 5행 중에서 "시설명/주소/위치" 포함된 행 찾기)
// ────────────────────────────────────────
function detectHeaderRow(rows) {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    const line = row.map((v) => (v == null ? '' : String(v))).join('|');

    if (
      line.includes('시설명') ||
      line.includes('공공체육시설명') ||
      line.includes('주소') ||
      line.includes('위치')
    ) {
      return { headerRowIndex: i, headerRow: row };
    }
  }
  // 못 찾으면 0행을 헤더로 사용
  return { headerRowIndex: 0, headerRow: rows[0] };
}

// ────────────────────────────────────────
// 헤더 행에서 각 컬럼 인덱스 찾기
// ────────────────────────────────────────
function findColumnIndexes(headerRow) {
  const findIdx = (keywords) =>
    headerRow.findIndex(
      (v) =>
        typeof v === 'string' &&
        keywords.some((kw) => v.toString().includes(kw))
    );

  const idxName = findIdx(['공공체육시설명', '시설명']); // 시설명
  const idxAddr = findIdx(['주소', '위치']);             // 주소/위치(도로명/지번)
  const idxSido = findIdx(['시도']);                    // 시도
  const idxSigungu = findIdx(['시군구', '구·군', '시군']); // 시군구 비슷한 표현들

  return { idxName, idxAddr, idxSido, idxSigungu };
}

// ────────────────────────────────────────
// public_id 생성 규칙
//  → 레저스포츠 import와 맞춰서 [시도 | 시군구 | 시설명 | 종목] 조합
// ────────────────────────────────────────
function makePublicId({ sido, sigungu, name, sport_type }) {
  return [
    sido ?? '',
    sigungu ?? '',
    name ?? '',
    sport_type ?? '',
  ].join('|');
}

// 시트 전체를 돌면서 데이터 추출 + public_id 생성 + 중복 제거
const mapByPublicId = new Map(); // key: public_id, value: row

for (const sheetName of workbook.SheetNames) {
  if (SKIP_SHEETS.has(sheetName)) {
    console.log(`[SKIP] ${sheetName}`);
    continue;
  }

  const ws = workbook.Sheets[sheetName];
  if (!ws) continue;

  // sheet 전체를 2D 배열로 읽기 (각 행 = 배열)
  const rawRows = xlsx.utils.sheet_to_json(ws, {
    header: 1,  // 1차원 배열 행
    defval: null
  });

  if (rawRows.length === 0) {
    console.log(`[WARN] ${sheetName} 시트에 데이터가 없음.`);
    continue;
  }

  // 헤더 행 자동 탐지
  const { headerRowIndex, headerRow } = detectHeaderRow(rawRows);
  const { idxName, idxAddr, idxSido, idxSigungu } = findColumnIndexes(headerRow);

  if (idxName === -1 || idxAddr === -1) {
    console.log(
      `[WARN] ${sheetName} 시트에서 시설명/주소 컬럼을 찾을 수 없음. (idxName=${idxName}, idxAddr=${idxAddr})`
    );
    continue;
  }

  console.log(
    `[USE] ${sheetName} (헤더: ${headerRowIndex + 1}행, 시설명 idx=${idxName}, 주소 idx=${idxAddr}, 시도 idx=${idxSido}, 시군구 idx=${idxSigungu})`
  );

  // 실제 데이터는 headerRowIndex + 1 행부터 끝까지
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row) continue;

    const name = row[idxName];
    const addr = row[idxAddr];

    // 이름/주소가 비어 있으면 건너뛰기 (합계행, 빈 행, 기타 주석 등)
    if (!name || !addr) continue;

    const rawSido = idxSido !== -1 ? row[idxSido] : null;
    const rawSigungu = idxSigungu !== -1 ? row[idxSigungu] : null;

    const sido = rawSido ? String(rawSido).trim() : null;
    const sigungu = rawSigungu ? String(rawSigungu).trim() : null;

    const cleanName = String(name).trim();
    const cleanAddr = String(addr).trim();
    const sport_type = sheetName.trim(); // 시트 이름을 종목/시설 유형으로 사용

    const public_id = makePublicId({
      sido,
      sigungu,
      name: cleanName,
      sport_type,
    });

    // 같은 public_id가 이미 있다면 덮어쓰기 → 엑셀 내 중복 제거
    mapByPublicId.set(public_id, {
      public_id,
      name: cleanName,
      address: cleanAddr,
      sido,
      sigungu,
      sport_type,
    });
  }
}

// Map → 배열로 변환
const allRows = Array.from(mapByPublicId.values());

// JSON 파일로 저장
const OUTPUT_PATH = path.join(process.cwd(), 'public_facilities_basic.json');
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allRows, null, 2), 'utf-8');

console.log('------------------------------------------');
console.log('[DONE] 추출된 시설 개수 (public_id 기준 중복 제거 후):', allRows.length);
console.log('[OUTPUT]', OUTPUT_PATH);
