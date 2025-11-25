// frontend/src/components/News.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ChevronRight } from "lucide-react";

type ExternalEvent = {
  id: string;
  title: string;
  dateText: string;
  venue?: string;
  category?: string;
  excerpt?: string;
  link?: string;
  startDate?: string;
  endDate?: string;
  dDayLabel?: string;
};

type RawEvent = {
  id?: string;
  seq?: string;
  title?: string;
  eventNm?: string;
  eventName?: string;
  startDate?: string;
  endDate?: string;
  eventPeriod?: string;
  date?: string;
  venue?: string;
  place?: string;
  category?: string;
  sport?: string;
  summary?: string;
  contents?: string;
  link?: string;
  url?: string;
  [key: string]: unknown;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateString(input?: string): Date | null {
  if (!input) return null;
  const normalized = input.replace(/\./g, "-").trim();
  const match = normalized.match(/(\d{4})[-](\d{1,2})[-](\d{1,2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

function formatDisplayPeriod(
  startRaw?: string,
  endRaw?: string,
  fallbackPeriod?: string,
  fallbackDate?: string,
): string {
  const startDate = parseDateString(startRaw);
  const endDate = parseDateString(endRaw);

  if (startDate && endDate) {
    return `${formatDateYMD(startDate)} ~ ${formatDateYMD(endDate)}`;
  }
  if (startDate && !endDate) {
    return formatDateYMD(startDate);
  }

  const looksLikeDate = (value?: string): boolean =>
    !!value &&
    /(\d{4})[^0-9]?(\d{1,2})[^0-9]?(\d{1,2})/.test(String(value));

  if (looksLikeDate(fallbackPeriod)) {
    return String(fallbackPeriod);
  }
  if (looksLikeDate(fallbackDate)) {
    return String(fallbackDate);
  }

  return "일정 미정";
}

function calcDDayLabel(startRaw?: string, endRaw?: string): string | undefined {
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

const News = () => {
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "cache" | null>(null);
  const navigate = useNavigate();

  const handleMoreClick = () => {
    navigate("/news");
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/events?page=1&size=12");
        if (!res.ok) {
          throw new Error(`이벤트 API 호출 실패: ${res.status}`);
        }

        const json = await res.json();
        setSource((json.source as "live" | "cache" | undefined) ?? null);
        const raw = json?.data;

        let items: RawEvent[] = [];
        if (Array.isArray(raw)) {
          items = raw as RawEvent[];
        } else if (Array.isArray(raw?.items)) {
          items = raw.items as RawEvent[];
        }

        const mapped: ExternalEvent[] = items.map((ev: RawEvent, idx: number) => {
          const id =
            (typeof ev.id === "string" && ev.id) ??
            (typeof ev.seq === "string" && ev.seq) ??
            String(idx);

          const title =
            (typeof ev.title === "string" && ev.title) ??
            (typeof ev.eventNm === "string" && ev.eventNm) ??
            (typeof ev.eventName === "string" && ev.eventName) ??
            "제목 미정";

          const rawStart =
            typeof ev.startDate === "string" ? ev.startDate : undefined;
          const rawEnd =
            typeof ev.endDate === "string" ? ev.endDate : undefined;

          let dateText = formatDisplayPeriod(
            rawStart,
            rawEnd,
            typeof ev.eventPeriod === "string" ? ev.eventPeriod : undefined,
            typeof ev.date === "string" ? ev.date : undefined,
          );

          if (/^-?\d{5,}$/.test(dateText)) {
            dateText = "일정 미정";
          }

          const venue =
            (typeof ev.venue === "string" && ev.venue) ??
            (typeof ev.place === "string" && ev.place) ??
            undefined;

          const category =
            (typeof ev.category === "string" && ev.category) ??
            (typeof ev.sport === "string" && ev.sport) ??
            "체육행사";

          const excerpt =
            (typeof ev.summary === "string" && ev.summary) ??
            (typeof ev.contents === "string" && ev.contents) ??
            "";

          const link =
            (typeof ev.link === "string" && ev.link) ??
            (typeof ev.url === "string" && ev.url) ??
            undefined;

          const dDayLabel = calcDDayLabel(rawStart, rawEnd);

          return {
            id,
            title,
            dateText,
            venue,
            category,
            excerpt,
            link,
            startDate: rawStart,
            endDate: rawEnd,
            dDayLabel,
          };
        });

        setEvents(mapped);
      } catch (err: unknown) {
        console.error("이벤트 불러오기 실패:", err);
        const message =
          err instanceof Error
            ? err.message
            : "이벤트를 불러오는 중 오류가 발생했습니다.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <section className="bg-slate-50 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              소식 및 공지
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              생활체육 행사와 관련된 최신 소식들을 한 곳에서 확인해보세요.
              {source && (
                <span className="ml-2 text-xs text-slate-500">
                  ({source === "live" ? "실시간 업데이트" : "캐시 데이터"})
                </span>
              )}
            </p>
          </div>

          <div className="hidden sm:block">
            <Button
              variant="ghost"
              className="gap-2 hover:text-primary"
              onClick={handleMoreClick}
            >
              더보기
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-10 text-slate-500">
            소식을 불러오는 중입니다...
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-10 text-red-500 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">
            현재 표시할 소식이 없습니다.
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {events.slice(0, 3).map((item) => (
              <Card
                key={item.id}
                className="p-4 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-xs font-medium text-blue-700">
                      {item.category || "체육행사"}
                    </div>
                    {item.dDayLabel && (
                      <div className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                        {item.dDayLabel}
                      </div>
                    )}
                  </div>

                  <h3 className="font-semibold text-base sm:text-lg mb-1 line-clamp-2">
                    {item.title}
                  </h3>

                  {item.venue && (
                    <p className="text-xs text-slate-500 mb-1">
                      장소: {item.venue}
                    </p>
                  )}

                  {item.excerpt && (
                    <p className="text-xs sm:text-sm text-slate-600 mb-2 line-clamp-3">
                      {item.excerpt}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.dateText || "일정 미정"}
                  </span>
                  {item.link && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-0 text-xs"
                      asChild
                    >
                      <a href={item.link} target="_blank" rel="noreferrer">
                        자세히 보기
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Button
            variant="ghost"
            className="gap-2 hover:text-primary"
            onClick={handleMoreClick}
          >
            더보기
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export { News };
export default News;
