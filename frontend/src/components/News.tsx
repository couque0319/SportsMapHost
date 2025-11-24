// frontend/src/components/News.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ChevronRight } from "lucide-react";

export type ExternalEvent = {
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

        // 🔥 크롤링 기반 events API 호출
        const res = await fetch("/api/events");
        if (!res.ok) {
          throw new Error(`이벤트 API 호출 실패: ${res.status}`);
        }

        const json = await res.json();
        setSource((json?.source as "live" | "cache" | undefined) ?? null);

        if (!Array.isArray(json?.data)) {
          throw new Error("이벤트 데이터 형식이 올바르지 않습니다.");
        }

        const items = json.data as ExternalEvent[];
        setEvents(items);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "소식을 불러오는 중 오류가 발생했습니다.";
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
              서울시·지자체 생활체육 프로그램 최신 소식입니다.
              {source && (
                <span className="ml-2 text-xs text-slate-500">
                  ({source === "live" ? "실시간 업데이트" : "캐시"})
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

        {/* 로딩 */}
        {loading && (
          <div className="text-center py-10 text-slate-500">
            소식을 불러오는 중입니다...
          </div>
        )}

        {/* 에러 */}
        {error && !loading && (
          <div className="text-center py-10 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* 빈 데이터 */}
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">
            현재 표시할 소식이 없습니다.
          </div>
        )}

        {/* 데이터 카드 3개만 미리보기 */}
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
                      {item.category || "생활체육"}
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
            더보기 <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export { News };
export default News;
