// scripts/update_is_public_from_bigdata.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 로드
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 누락: SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// JSON 파일 경로
const JSON_PATH = path.join(
  __dirname,
  '..',
  '청소년 유아동 이용가능 체육시설 프로그램.json'
);

// 문자열 정규화
function norm(s) {
  if (!s) return '';
  return String(s).trim().replace(/\s+/g, '').toLowerCase();
}

async function run() {
  console.log('[INFO] JSON 로드 중:', JSON_PATH);
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const rows = JSON.parse(raw);
  console.log('[INFO] JSON 레코드 수:', rows.length);

  // JSON에서 공공시설 이름만 추출
  const publicNames = new Set();
  for (const r of rows) {
    if (r.FCLTY_FLAG_NM === '공공') {
      publicNames.add(norm(r.FCLTY_NM));
    }
  }
  console.log('[INFO] JSON 기준 공공시설 이름 수:', publicNames.size);

  // 1) 모든 시설을 민간(false)으로 초기화
  console.log('[STEP 1] 모든 시설을 민간으로 초기화...');
  const { error: rpcError } = await supabase.rpc('set_all_facilities_private');
  if (rpcError) {
    console.error('[ERROR] set_all_facilities_private 실패:', rpcError);
    process.exit(1);
  }

  // 2) facilities 전체 로드해서 이름 매칭
  const { data: facilities, error: facError } = await supabase
    .from('facilities')
    .select('id, name');

  if (facError) {
    console.error('[ERROR] facilities 조회 실패:', facError);
    process.exit(1);
  }

  console.log('[INFO] DB facilities 행 수:', facilities.length);

  const publicIds = [];
  for (const f of facilities) {
    const key = norm(f.name);
    if (publicNames.has(key)) {
      publicIds.push(f.id);
    }
  }

  console.log(
    `[INFO] 공공으로 설정될 시설 수: ${publicIds.length} / ${facilities.length}`
  );

  if (publicIds.length === 0) {
    console.log('[INFO] 매칭된 공공시설이 없어서 업데이트할 것이 없습니다.');
    return;
  }

  // 3) 매칭된 id 들만 is_public = true 로 update
  console.log('[STEP 2] 공공시설만 다시 true 설정 (UPDATE)...');

  const chunkSize = 500;
  for (let i = 0; i < publicIds.length; i += chunkSize) {
    const chunk = publicIds.slice(i, i + chunkSize);

    const { error: updError } = await supabase
      .from('facilities')
      .update({ is_public: true })
      .in('id', chunk);

    if (updError) {
      console.error('[ERROR] UPDATE 실패:', updError);
      process.exit(1);
    }

    console.log(`[UPDATE] ${i + chunk.length} / ${publicIds.length}`);
  }

  console.log('🎯 is_public 갱신 완료!');
}

run().catch((e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
