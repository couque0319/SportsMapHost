// backend/src/routes/events.routes.js
import { Router } from "express";
import axios from "axios";
import { parseStringPromise } from "xml2js";

const router = Router();

// .env 에 넣어둔 서울시 공연행사 API 키
// 예) SEOUL_SPORT_EVENT_API_KEY=발급키
const SEOUL_API_KEY = process.env.SEOUL_SPORT_EVENT_API_KEY;

// 서비스명은 문서에서 본 그대로
const SERVICE_NAME = "stadiumScheduleInfo";

// 캐시 (1일 유지)
let cachedEvents = [];
let lastFetchedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// YYYYMMDD → YYYY-MM-DD 로 변환
function normalizeYyyyMmDd(input) {
  if (!input) return undefined;
  const s = String(input).trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// stadiumScheduleInfo 한 row → 프론트 RawEvent 형태로 매핑
function mapRowToRawEvent(row) {
  const get = (k) => (Array.isArray(row[k]) ? row[k][0] : row[k]);

  const schSeq = get("SCH_SEQ");
  const title = get("TITLE");
  const sdateRaw = get("SDATE");
  const edateRaw = get("EDATE");
  const useTime = get("USE_TIME");
  const useAge = get("USE_AGE");
  const useTarget = get("USE_TARGET");
  const usePay = get("USE_PAY");
  const linkUrl = get("LINK_URL");
  const regDate = get("REG_DATE");
  const updDate = get("UPD_DATE");
  const codeTitleA = get("CODE_TITLE_A");
  const codeTitleB = get("CODE_TITLE_B");

  const startDate = normalizeYyyyMmDd(sdateRaw);
  const endDate = normalizeYyyyMmDd(edateRaw);

  let periodText = "";
  if (startDate && endDate) {
    periodText = `${startDate} ~ ${endDate}`;
  } else if (startDate) {
    periodText = startDate;
  } else if (endDate) {
    periodText = endDate;
  } else if (regDate) {
    const nd = normalizeYyyyMmDd(regDate) ?? regDate;
    periodText = nd;
  }

  // ✅ 여기만 수정: 타입 지정 제거
  const extraParts = [];
  if (useTime) extraParts.push(`시간: ${useTime}`);
  if (useAge) extraParts.push(`연령: ${useAge}`);
  if (useTarget) extraParts.push(`대상: ${useTarget}`);
  if (usePay) extraParts.push(`이용료: ${usePay}`);
  const summary = extraParts.join(" / ");

  return {
    id: schSeq ?? "",
    seq: schSeq ?? "",
    title: title ?? "제목 미정",
    eventNm: title ?? "제목 미정",
    eventName: title ?? "제목 미정",
    startDate,
    endDate,
    eventPeriod: periodText,
    date: periodText,
    venue: codeTitleB || undefined,
    place: codeTitleB || undefined,
    category: codeTitleA || "서울시 체육시설 공연행사",
    sport: codeTitleA || undefined,
    summary,
    contents: summary,
    useTime,
    useAge,
    useTarget,
    usePay,
    regDate,
    updDate,
    link: linkUrl || undefined,
    url: linkUrl || undefined,
  };
}

// 실제 OpenAPI 호출 (XML → JSON 변환)
async function fetchStadiumSchedule(start = 1, end = 300) {
  if (!SEOUL_API_KEY) {
    throw new Error("SEOUL_SPORT_EVENT_API_KEY 환경변수가 없습니다.");
  }

  const url = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/xml/${SERVICE_NAME}/${start}/${end}/`;
  console.log("[stadiumScheduleInfo] 요청:", url);

  const { data: xml } = await axios.get(url, { responseType: "text" });

  const parsed = await parseStringPromise(xml, {
    explicitArray: true,
    trim: true,
  });

  const root = parsed?.[SERVICE_NAME];
  if (!root) return [];

  const rows = root.row ?? [];
  const arr = Array.isArray(rows) ? rows : [rows];

  return arr.map(mapRowToRawEvent);
}

// GET /api/events
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1) || 1;
    const size = Number(req.query.size ?? 20) || 20;
    const forceRefresh = String(req.query.forceRefresh ?? "false") === "true";

    const now = Date.now();

    // 캐시 사용
    if (
      !forceRefresh &&
      cachedEvents.length > 0 &&
      now - lastFetchedAt < CACHE_TTL_MS
    ) {
      const startIdx = (page - 1) * size;
      const endIdx = startIdx + size;
      return res.json({
        source: "cache",
        lastFetchedAt,
        total: cachedEvents.length,
        data: cachedEvents.slice(startIdx, endIdx),
      });
    }

    // 새로 호출
    const allEvents = await fetchStadiumSchedule(1, 500);
    cachedEvents = allEvents;
    lastFetchedAt = now;

    const startIdx = (page - 1) * size;
    const endIdx = startIdx + size;

    return res.json({
      source: "live",
      lastFetchedAt,
      total: allEvents.length,
      data: allEvents.slice(startIdx, endIdx),
    });
  } catch (err) {
    console.error("[GET /api/events] error:", err);
    return res.status(500).json({
      error: "failed_to_fetch_events",
      message: err instanceof Error ? err.message : "unknown_error",
    });
  }
});

export default router;
