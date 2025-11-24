// backend/src/routes/events.routes.js
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

// 서울시 생활체육포털 "우리동네 프로그램" (자치구 프로그램 목록)
const SEOUL_LOCAL_PROGRAM_URL =
  "https://sports.seoul.go.kr/main/board/8/board_list.do";

async function fetchSeoulLocalPrograms(limit = 30) {
  const res = await axios.get(SEOUL_LOCAL_PROGRAM_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const $ = cheerio.load(res.data);
  const events = [];

  // 자치구 프로그램 테이블의 각 행을 순회 (번호 / 자치구 / 강습명 / 프로그램 내용)
  $("table tbody tr").each((idx, el) => {
    if (events.length >= limit) return;

    const tds = $(el).find("td");
    if (tds.length < 4) return;

    const no = $(tds[0]).text().trim();
    const gu = $(tds[1]).text().trim();
    const lessonName = $(tds[2]).text().trim(); // 강습명
    const programText = $(tds[3]).text().trim(); // 프로그램 내용 (유아체육, 헬스 등)
    const href = $(tds[3]).find("a").attr("href") || "";

    const link = href
      ? new URL(href, SEOUL_LOCAL_PROGRAM_URL).toString()
      : undefined;

    const title = `[${gu}] ${lessonName}`;
    const venue = `${gu} 생활체육 프로그램`;

    events.push({
      id: no || `${gu}-${idx}`,
      title,
      dateText: "상시 운영 (상세 페이지 참고)",
      venue,
      category: "생활체육",
      excerpt: programText,
      link,
      startDate: undefined,
      endDate: undefined,
      dDayLabel: undefined,
    });
  });

  console.log("[/api/events] 서울시 크롤링 결과 개수:", events.length);
  return events;
}

router.get("/", async (req, res) => {
  try {
    const list = await fetchSeoulLocalPrograms(30);

    res.json({
      source: "live",
      count: list.length,
      data: list,
    });
  } catch (err) {
    console.error("크롤링 오류:", err);
    res.status(500).json({
      error: "crawl_failed",
      message:
        err instanceof Error ? err.message : "생활체육 프로그램 크롤링 실패",
    });
  }
});

export default router;
