// backend/src/services/localSportsService.js
import axios from "axios";
import * as cheerio from "cheerio";

/**
 * 서울시 생활체육포털 - 우리동네 프로그램 (자치구 프로그램) 크롤링
 * https://sports.seoul.go.kr/main/board/8/board_list.do
 */
const SEOUL_LOCAL_PROGRAM_URL =
  "https://sports.seoul.go.kr/main/board/8/board_list.do";

// 간단 D-Day 계산용 (기간 정보가 있는 페이지 크롤링으로 확장할 때 사용)
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateString(input) {
  if (!input) return null;
  const normalized = input.replace(/\./g, "-").trim();
  const match = normalized.match(/(\d{4})[-](\d{1,2})[-](\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

function calcDDayLabel(startRaw, endRaw) {
  if (!startRaw && !endRaw) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = parseDateString(startRaw);
  const end = parseDateString(endRaw);

  if (start) {
    const diff = Math.round((start.getTime() - today.getTime()) / MS_PER_DAY);
    if (diff > 0) return `D-${diff}`;
    if (diff === 0) return "D-DAY";
    if (end && end.getTime() < today.getTime()) return "종료";
    return "진행중";
  }

  if (!start && end) {
    const diff = Math.round((end.getTime() - today.getTime()) / MS_PER_DAY);
    if (diff > 0) return `D-${diff}`;
    if (diff === 0) return "D-DAY";
    if (diff < 0) return "종료";
  }

  return undefined;
}

/**
 * 서울 생활체육포털 자치구 프로그램 목록 크롤링
 * - 현재 페이지(1페이지)에서 번호/자치구/강습명/프로그램 내용만 가져옴
 * - 기간/장소는 상세 페이지로 들어가서 크롤링하는 확장 버전도 나중에 추가 가능
 */
export async function fetchSeoulLocalPrograms(limit = 30) {
  const res = await axios.get(SEOUL_LOCAL_PROGRAM_URL, {
    // 혹시 인코딩 문제 생기면 headers에 User-Agent 정도만 추가
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const html = res.data;
  const $ = cheerio.load(html);

  const events = [];

  // 테이블 구조에 따라 조정해야 하는 부분 (기본 패턴)
  // 1) 자치구 프로그램 리스트 테이블을 찾고
  // 2) tbody > tr 하나씩 돌면서 td들을 읽는다.
  $("table tbody tr").each((idx, el) => {
    if (events.length >= limit) return;

    const $row = $(el);
    const tds = $row.find("td");
    if (tds.length < 4) return; // 헤더나 광고 같은 행 스킵

    // [번호, 자치구, 강습명, 프로그램 내용] 구조라고 가정
    const no = $(tds[0]).text().trim();
    const gu = $(tds[1]).text().trim();
    const lessonName = $(tds[2]).text().trim();
    const programText = $(tds[3]).text().trim();

    // 상세페이지 링크가 td[3] 안의 <a> 태그로 들어오는 경우
    const detailHref = $(tds[3]).find("a").attr("href") || "";
    const absoluteLink = detailHref
      ? new URL(detailHref, SEOUL_LOCAL_PROGRAM_URL).toString()
      : undefined;

    const title = `[${gu}] ${lessonName}`;
    const dateText = "상시 / 홈페이지 참고"; // 지금 단계에서는 기간 정보 없음
    const venue = `${gu} 지역 생활체육 프로그램`;
    const category = "생활체육 프로그램";

    // (옵션) 나중에 상세 페이지에서 기간을 파싱하면 startDate / endDate 채우기
    const startDate = undefined;
    const endDate = undefined;
    const dDayLabel = calcDDayLabel(startDate, endDate);

    events.push({
      id: no || `${gu}-${idx}`,
      title,
      dateText,
      venue,
      category,
      excerpt: programText,
      link: absoluteLink,
      startDate,
      endDate,
      dDayLabel,
    });
  });

  return events;
}

/**
 * 앞으로 부산/대구/광역시, 각 자치구 사이트까지 확장할 경우
 * fetchXxxLocalPrograms 를 여러 개 만들고 여기서 합치는 구조로 두면 됨.
 */
export async function fetchAllLocalPrograms() {
  const seoul = await fetchSeoulLocalPrograms(30);
  // const busan = await fetchBusanPrograms(...);
  // const daegu = await fetchDaeguPrograms(...);

  return [...seoul /*, ...busan, ...daegu */];
}
