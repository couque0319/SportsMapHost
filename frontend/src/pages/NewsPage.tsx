// frontend/src/pages/NewsPage.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";

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

export default function NewsPage() {
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // ✅ 크롤링 기반 /api/events 호출 (page/size 파라미터 필요 없음)
        const res = await fetch("/api/events");
        if (!res.ok) {
          throw new Error(`이벤트 API 호출 실패: ${res.status}`);
        }

        const json = await res.json();
        const raw = json?.data;

        if (!Array.isArray(raw)) {
          throw new Error("이벤트 데이터 형식이 올바르지 않습니다.");
        }

        // ✅ 백엔드에서 이미 ExternalEvent 형태로 내려주므로 그대로 사용
        const items = raw as ExternalEvent[];

        // 필요하면 여기서 정렬 추가 (예: 제목 순)
        // const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));

        setEvents(items);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "소식 데이터를 불러오는 중 오류가 발생했습니다.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          소식 및 공지 전체 보기
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600">
          지자체 생활체육 프로그램과 관련된 소식을 카드 형태로 한 눈에
          확인할 수 있습니다.
        </p>
      </header>

      {loading && (
        <div className="text-center py-10 text-slate-500">
          소식을 불러오는 중입니다...
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-10 text-red-500 text-sm">{error}</div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="text-center py-10 text-slate-500 text-sm">
          현재 표시할 소식이 없습니다.
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((item) => (
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

                <h2 className="font-semibold text-base sm:text-lg mb-1 line-clamp-2">
                  {item.title}
                </h2>

                {item.venue && (
                  <p className="text-xs text-slate-500 mb-1">
                    장소: {item.venue}
                  </p>
                )}

                {item.excerpt && (
                  <p className="text-xs sm:text-sm text-slate-600 mb-2 line-clamp-4">
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
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    자세히 보기
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
