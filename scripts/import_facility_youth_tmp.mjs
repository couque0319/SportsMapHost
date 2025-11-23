// scripts/import_facility_youth_tmp.mjs
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// .env 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 .env 에 없습니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// JSON 파일 경로 (.env 와 같은 위치)
const JSON_PATH = path.resolve(process.cwd(), '청소년 유아동 이용가능 체육시설 프로그램.json');

function normalizeStr(v) {
  return (v ?? '').toString().trim();
}

async function main() {
  console.log('[INFO] JSON 로드 중:', JSON_PATH);
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const records = JSON.parse(raw);

  console.log('[INFO] JSON 레코드 수:', records.length);

  const map = new Map();

  for (const r of records) {
    const name = normalizeStr(r.FCLTY_NM);
    const addr = normalizeStr(r.FCLTY_ADDR);

    if (!name || !addr) continue;

    const flag = normalizeStr(r.FCLTY_FLAG_NM);
    const isPublic = flag.includes('공공');

    const key = `${name}||${addr}`;
    const prev = map.get(key);

    const merged = prev
      ? { ...prev, is_public: prev.is_public || isPublic }
      : {
          facility_name: name,
          address: addr,
          is_public: isPublic,
        };

    map.set(key, merged);
  }

  const rows = Array.from(map.values());
  console.log('[INFO] distinct 시설 수:', rows.length);

  // --- 수정된 초기화 코드 ---
  console.log('[STEP] facility_youth_tmp 초기화...');
  {
    const { error } = await supabase
      .from('facility_youth_tmp')
      .delete()
      .neq('facility_name', null); // 전체 삭제 안전하게

    if (error) {
      console.error('[ERROR] 초기화 실패:', error);
      process.exit(1);
    }
  }

  console.log('[STEP] facility_youth_tmp 신규 데이터 삽입 중...');

  const chunkSize = 200;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const { error } = await supabase.from('facility_youth_tmp').insert(
      chunk.map((r) => ({
        facility_name: r.facility_name,
        address: r.address,
        is_public: r.is_public,
      }))
    );

    if (error) {
      console.error('[ERROR] 삽입 실패:', error);
      process.exit(1);
    }

    inserted += chunk.length;
    console.log(`[PROGRESS] ${inserted} / ${rows.length}`);
  }

  console.log('✅ facility_youth_tmp 로드 완료');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
