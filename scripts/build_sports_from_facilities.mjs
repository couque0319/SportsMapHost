// scripts/build_sports_from_facilities.mjs
// facilities.type → (정규화) → sports / facility_sports 자동 생성 (개선 버전)

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('[ERROR] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// ────────────────────────────────────────
// 1. 타입 문자열 분리
// ────────────────────────────────────────

/**
 * "하강시설(짚라인)" → { base: "하강시설", variant: "짚라인" }
 * "기타 체육시설(풋살장)" → { base: "기타 체육시설", variant: "풋살장" }
 * "수영장" → { base: "수영장", variant: null }
 */
function splitType(rawType) {
  if (!rawType) return { base: null, variant: null };

  const t = String(rawType).trim();
  const m = t.match(/^(.+?)\s*\((.+)\)\s*$/); // "앞부분(괄호안)" 패턴

  if (!m) return { base: t, variant: null };

  return {
    base: m[1].trim(),
    variant: m[2].trim(),
  };
}

// ────────────────────────────────────────
// 2. 스포츠 이름 매핑 규칙
//    - “에코타”, “대구숲” 같은 건 절대 매칭 안 되게 함
// ────────────────────────────────────────

/**
 * 명백히 “종목이 아닌 것”으로 보이는 단어들
 *  - 테마파크/리조트/숲/파크/에코타/그외/기타/미인쇄분 등
 *  - 이 단어만 있는 candidate는 버린다.
 */
const TRASH_WORD_RE = /(그외|기타|미인쇄분|테마파크|리조트|대구숲|숲|파크|에코타)/;

/**
 * 스포츠 매핑 규칙
 *  - 순서대로 검사해서 첫 번째로 매칭되는 규칙을 사용
 *  - “포함 여부” 기준으로 캐치 → 에코타처럼 종목과 상관없는 단어는 걸리지 않음
 */
const SPORT_RULES = [
  { re: /풋살/,                             name: '풋살장' },
  { re: /파크골프|파크 골프|그라운드골프/,  name: '파크골프장' },
  { re: /축구/,                             name: '축구장' },
  { re: /야구/,                             name: '야구장' },
  { re: /테니스/,                           name: '테니스장' },
  { re: /수영/,                             name: '수영장' },
  { re: /빙상/,                             name: '빙상장' },
  { re: /육상경기장|육상/,                  name: '육상경기장' },
  { re: /게이트볼/,                         name: '게이트볼장' },
  { re: /롤러스케이트|롤러/,                name: '롤러스케이트장' },
  { re: /사격/,                             name: '사격장' },
  { re: /국궁/,                             name: '국궁장' },
  { re: /양궁/,                             name: '양궁장' },
  { re: /승마/,                             name: '승마장' },
  { re: /골프연습|골프 연습/,               name: '골프연습장' },
  { re: /조정|카누/,                        name: '조정카누장' },
  { re: /요트/,                             name: '요트장' },
  { re: /스포츠클라이밍|클라이밍/,          name: '스포츠클라이밍' },
  { re: /하강시설|짚라인/,                  name: '짚라인' },
  { re: /수상하강/,                         name: '수상하강시설' },
  { re: /드론/,                             name: '드론(레이싱)' },
  { re: /X-?Game|엑스게임|보드/,            name: 'X-Game(보드)' },
  { re: /ATV/,                              name: 'ATV' },
  { re: /스키점프/,                         name: '스키점프경기장' },
  { re: /바이애슬론/,                       name: '바이애슬론경기장' },
  { re: /크로스컨트리/,                     name: '크로스컨트리경기장' },
  { re: /봅슬레이|루지|스켈레톤/,           name: '봅슬레이·루지·스켈레톤경기장' },
  { re: /구기체육관/,                       name: '구기체육관' },
  { re: /투기체육관/,                       name: '투기체육관' },
  { re: /생활체육관/,                       name: '생활체육관' },
  // 필요하면 여기 계속 추가 가능
];

/**
 * 하나의 후보 문자열(c)에서 표준 스포츠명을 찾는 함수
 */
function mapToCanonicalSport(c) {
  if (!c) return null;

  const s = String(c).trim();
  if (!s) return null;

  // 완전 쓰레기 단어만 있는 경우는 버린다
  if (TRASH_WORD_RE.test(s) && s.replace(TRASH_WORD_RE, '').trim() === '') {
    return null;
  }

  for (const rule of SPORT_RULES) {
    if (rule.re.test(s)) {
      return rule.name;
    }
  }

  return null;
}

/**
 * 최종 정규화 함수
 *  - base / variant / rawType 에서 스포츠명 후보를 뽑아 RULES로 매칭
 *  - 하나라도 매칭되면 그 표준 이름을 리턴
 *  - 아무것도 매칭 안 되면 null (→ 아예 스포츠 태그를 안 달음)
 */
function normalizeSportName(base, variant, rawType) {
  const candidates = [];

  if (variant) candidates.push(variant);
  if (base) candidates.push(base);
  if (rawType) candidates.push(rawType);

  for (const c of candidates) {
    const sport = mapToCanonicalSport(c);
    if (sport) return sport;
  }

  return null; // 에코타 같은 건 여기로 빠짐 → sports에 안 들어감
}

/**
 * sports.code 생성
 *  - "풋살장" → "SPORT_풋살장"
 */
function makeSportCode(sportName) {
  if (!sportName) return null;
  return `SPORT_${sportName.replace(/\s+/g, '_')}`;
}

// ────────────────────────────────────────
// 3. facilities.type → sports 생성
// ────────────────────────────────────────
async function buildSportsFromFacilities() {
  const { data: facRows, error: facError } = await supabase
    .from('facilities')
    .select('type')
    .not('type', 'is', null)
    .neq('type', '');

  if (facError) {
    console.error('[ERROR] facilities type 조회 실패:', facError);
    throw facError;
  }

  const sportNameSet = new Set();

  for (const row of facRows) {
    const rawType = row.type;
    const { base, variant } = splitType(rawType);
    const sportName = normalizeSportName(base, variant, rawType);
    if (!sportName) continue; // 매칭 안 된 시설은 종목 없음
    sportNameSet.add(sportName);
  }

  const distinctSportNames = Array.from(sportNameSet);
  console.log('[INFO] 정규화된 distinct 종목명 개수 =', distinctSportNames.length);
  console.log('[INFO] 종목 목록 예시 =', distinctSportNames.slice(0, 20));

  const sportsRows = distinctSportNames.map((name) => ({
    code: makeSportCode(name),
    name,
    color: null,
    icon: null,
  }));

  const { error: upsertError } = await supabase
    .from('sports')
    .upsert(sportsRows, { onConflict: 'code' });

  if (upsertError) {
    console.error('[ERROR] sports upsert 실패:', upsertError);
    throw upsertError;
  }

  console.log('✅ sports 테이블 생성/갱신 완료 (행 수:', sportsRows.length, ')');
}

// ────────────────────────────────────────
// 4. facility_sports 링크 생성
// ────────────────────────────────────────
async function buildFacilitySportsLinks() {
  const { data: sportsRows, error: sportsError } = await supabase
    .from('sports')
    .select('id, name');

  if (sportsError) {
    console.error('[ERROR] sports 조회 실패:', sportsError);
    throw sportsError;
  }

  const sportIdByName = new Map();
  for (const s of sportsRows) {
    sportIdByName.set(s.name, s.id);
  }

  const { data: facRows, error: facError } = await supabase
    .from('facilities')
    .select('id, type')
    .not('type', 'is', null)
    .neq('type', '');

  if (facError) {
    console.error('[ERROR] facilities 조회 실패:', facError);
    throw facError;
  }

  console.log('[INFO] facility_sports 생성 대상 시설 수 =', facRows.length);

  const links = [];

  for (const fac of facRows) {
    const rawType = fac.type;
    const { base, variant } = splitType(rawType);
    const sportName = normalizeSportName(base, variant, rawType);
    if (!sportName) continue; // 종목 못 찾으면 링크 만들지 않음

    const sportId = sportIdByName.get(sportName);
    if (!sportId) continue;

    links.push({
      facility_id: fac.id,
      sport_id: sportId,
    });
  }

  // facility_id + sport_id 조합 중복 제거
  const dedupeSet = new Set();
  const dedupedLinks = [];

  for (const link of links) {
    const key = `${link.facility_id}|${link.sport_id}`;
    if (dedupeSet.has(key)) continue;
    dedupeSet.add(key);
    dedupedLinks.push(link);
  }

  console.log('[INFO] 중복 제거 후 링크 수 =', dedupedLinks.length);

  const BATCH_SIZE = 1000;
  let processed = 0;

  while (processed < dedupedLinks.length) {
    const slice = dedupedLinks.slice(processed, processed + BATCH_SIZE);

    const { error: linkError } = await supabase
      .from('facility_sports')
      .upsert(slice, { onConflict: 'facility_id,sport_id' });

    if (linkError) {
      console.error('[ERROR] facility_sports upsert 실패:', linkError);
      throw linkError;
    }

    console.log(
      `[UPSERT facility_sports] ${processed + 1} ~ ${processed + slice.length} / ${dedupedLinks.length}`
    );

    processed += slice.length;
  }

  console.log('✅ facility_sports 링크 생성 완료');
}

// ────────────────────────────────────────
// 5. 실행 플로우
// ────────────────────────────────────────
async function run() {
  console.log('--- 1) sports 생성 (정규화된 종목명 기준) ---');
  await buildSportsFromFacilities();

  console.log('--- 2) facility_sports 링크 생성 ---');
  await buildFacilitySportsLinks();

  console.log('🎉 sports / facility_sports 구성이 완료되었습니다. (개선 규칙 적용)');
}

run().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
