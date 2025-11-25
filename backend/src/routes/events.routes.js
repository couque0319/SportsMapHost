// backend/src/routes/events.routes.js
import { Router } from 'express';
import axios from 'axios';

const router = Router();

// ----------------- 간단 캐시 -----------------
let cachedEvents = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

// ----------------- 유틸 함수 -----------------
function normalizeDateString(str) {
  if (!str) return undefined;
  // 2025-11-27, 2025.11.27 둘 다 허용
  const s = String(str).trim().replace(/\./g, '-');
  const m = s.match(/(\d{4})[-](\d{1,2})[-](\d{1,2})/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return undefined;

  const mm = String(mo).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// YYYY-MM-DD -> YYYY.MM.DD
function formatDateDot(str) {
  const n = normalizeDateString(str);
  if (!n) return undefined;
  const [y, m, d] = n.split('-');
  return `${y}.${m}.${d}`;
}

// D-day 계산용
function toDate(str) {
  const n = normalizeDateString(str);
  if (!n) return null;
  const [y, m, d] = n.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function makeDDayLabel(startRaw, endRaw) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = toDate(startRaw);
  const end = toDate(endRaw);

  if (start) {
    const diff = Math.round((start.getTime() - today.getTime()) / MS_PER_DAY);
    if (diff > 0) return `D-${diff}`;
    if (diff === 0) return 'D-DAY';
    if (end && end.getTime() < today.getTime()) return '종료';
    return '진행중';
  }

  if (!start && end) {
    const diff = Math.round((end.getTime() - today.getTime()) / MS_PER_DAY);
    if (diff > 0) return `D-${diff}`;
    if (diff === 0) return 'D-DAY';
    if (diff < 0) return '종료';
  }

  return undefined;
}

// ----------------- 서울시 데이터 -----------------
async function fetchSeoulEvents() {
  const base = process.env.SEOUL_STADIUM_API_BASE_URL;
  const key = process.env.SEOUL_STADIUM_API_KEY;

  if (!base || !key) {
    console.warn('[events] SEOUL_STADIUM_API_* 환경변수 없음');
    return [];
  }

  // 예: http://openapi.seoul.go.kr:8088/{KEY}/json/stadiumScheduleInfo/1/300/
  const url = `${base}/${key}/json/stadiumScheduleInfo/1/300/`;

  const { data } = await axios.get(url);
  const rows = data?.stadiumScheduleInfo?.row || [];

  return rows.map((row, idx) => {
    const seq = row.SCH_SEQ ?? String(idx);
    const title = row.TITLE ?? '제목 미정';

    const startDate = row.SDATE ? normalizeDateString(row.SDATE) : undefined;
    const endDate = row.EDATE ? normalizeDateString(row.EDATE) : undefined;

    let eventPeriod;
    const startDot = formatDateDot(row.SDATE);
    const endDot = formatDateDot(row.EDATE);
    if (startDot && endDot) {
      eventPeriod = `${startDot} ~ ${endDot}`;
    } else if (startDot || endDot) {
      eventPeriod = startDot || endDot;
    }

    const venue = row.CODE_TITLE_B || row.INST_NM || undefined;
    const category = '서울시 체육시설 공연행사';

    // 간단 요약: 시간, 연령, 대상, 비용
    const summaryParts = [];
    if (row.USE_TIME) summaryParts.push(`시간: ${row.USE_TIME}`);
    if (row.USE_AGE) summaryParts.push(`연령: ${row.USE_AGE}`);
    if (row.USE_TARGET) summaryParts.push(`대상: ${row.USE_TARGET}`);
    if (row.USE_PAY) summaryParts.push(`이용료: ${row.USE_PAY}`);
    const summary = summaryParts.join(' / ');

    const link = row.URL || row.HMPG_URL || undefined;

    return {
      source: 'SEOUL',
      id: `SEOUL-${seq}`,
      seq: String(seq),
      title,
      eventNm: title,
      eventName: title,
      startDate,
      endDate,
      eventPeriod,
      date: eventPeriod,
      venue,
      place: venue,
      category,
      summary,
      contents: summary,
      link,
      url: link,
    };
  });
}

// ----------------- 경기도 데이터 -----------------
async function fetchGyeonggiEvents(page = 1, size = 100) {
  const base = process.env.GG_EVENT_API_BASE_URL;
  const key = process.env.GG_EVENT_API_KEY;

  if (!base || !key) {
    console.warn('[events] GG_EVENT_API_* 환경변수 없음');
    return [];
  }

  // 예: https://openapi.gg.go.kr/GGCULTUREVENTSTUS?KEY=...&Type=json&pIndex=1&pSize=100
  const { data } = await axios.get(base, {
    params: {
      KEY: key,
      Type: 'json',
      pIndex: page,
      pSize: size,
    },
  });

  const root = data?.GGCULTUREVENTSTUS;
  let rows = [];

  if (Array.isArray(root)) {
    const body = root.find((x) => Array.isArray(x.row));
    rows = body?.row || [];
  } else if (root?.row) {
    rows = root.row;
  }

  return rows.map((row, idx) => {
    const title = row.TITLE || '제목 미정';
    const begin = row.BEGIN_DE ? normalizeDateString(row.BEGIN_DE) : undefined;
    const end = row.END_DE ? normalizeDateString(row.END_DE) : undefined;

    const beginDot = formatDateDot(row.BEGIN_DE);
    const endDot = formatDateDot(row.END_DE);
    let eventPeriod;
    if (beginDot && endDot) {
      eventPeriod = `${beginDot} ~ ${endDot}`;
    } else if (beginDot || endDot) {
      eventPeriod = beginDot || endDot;
    }

    const venue = row.INST_NM || row.HOST_INST_NM || undefined;
    const category = row.CATEGORY_NM || '경기도 문화행사';

    const summaryParts = [];
    if (row.EVENT_TM_INFO) summaryParts.push(`시간: ${row.EVENT_TM_INFO}`);
    if (row.PARTCPT_EXPN_INFO) summaryParts.push(`비용: ${row.PARTCPT_EXPN_INFO}`);
    if (row.TELNO_INFO) summaryParts.push(`문의: ${row.TELNO_INFO}`);
    const summary = summaryParts.join(' / ');

    const link = row.URL || row.HMPG_URL || undefined;

    return {
      source: 'GG',
      id: `GG-${idx}-${row.TITLE ?? ''}`,
      seq: String(idx),
      title,
      eventNm: title,
      eventName: title,
      startDate: begin,
      endDate: end,
      eventPeriod,
      date: eventPeriod,
      venue,
      place: venue,
      category,
      summary,
      contents: summary,
      link,
      url: link,
    };
  });
}

// ----------------- /api/events -----------------
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      size = '20',
      forceRefresh = 'false',
    } = req.query;

    const pageNum = Number(page) || 1;
    const sizeNum = Number(size) || 20;
    const now = Date.now();
    const shouldForceRefresh = forceRefresh === 'true';

    // 캐시 사용
    if (
      cachedEvents &&
      !shouldForceRefresh &&
      now - lastFetchedAt < CACHE_TTL_MS
    ) {
      const startIdx = (pageNum - 1) * sizeNum;
      const paged = cachedEvents.slice(startIdx, startIdx + sizeNum);

      return res.json({
        source: 'cache',
        lastFetchedAt,
        total: cachedEvents.length,
        data: paged,
      });
    }

    // 서울 + 경기 병렬 호출
    const [seoulEvents, ggEvents] = await Promise.all([
      fetchSeoulEvents(),
      fetchGyeonggiEvents(1, 200), // 경기도는 넉넉하게 200개 정도 조회
    ]);

    // 하나라도 에러 나면 빈 배열로 떨어지도록 안전하게 작성했음
    const allEvents = [...seoulEvents, ...ggEvents];

    // 기본 정렬: 시작일 오름차순
    allEvents.sort((a, b) => {
      const aDate = toDate(a.startDate || a.endDate);
      const bDate = toDate(b.startDate || b.endDate);
      if (!aDate || !bDate) return 0;
      return aDate.getTime() - bDate.getTime();
    });

    cachedEvents = allEvents;
    lastFetchedAt = now;

    const startIdx = (pageNum - 1) * sizeNum;
    const paged = allEvents.slice(startIdx, startIdx + sizeNum);

    return res.json({
      source: 'live',
      lastFetchedAt,
      total: allEvents.length,
      data: paged,
    });
  } catch (err) {
    console.error('[GET /api/events] error:', err?.message || err);

    return res.status(500).json({
      error: 'failed_to_fetch_events',
      message: err?.message || '이벤트 데이터를 불러오는 중 오류가 발생했습니다.',
    });
  }
});

export default router;
