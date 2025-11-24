import { useEffect, useState } from "react";

export default function NewsSection() {
  const [events, setEvents] = useState([]);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/events?page=1&size=10");
        const json = await res.json();

        setSource(json.source);

        // API 구조에 맞춰 items만 추출 (문화광장 API 기준)
        const items =
          json?.data?.response?.body?.items?.item ??
          json?.data?.items ??
          json?.data ??
          [];

        setEvents(items);
      } catch (err) {
        console.error("Failed to load events", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <div className="text-center p-4">불러오는 중...</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">📢 생활체육 소식 & 행사 안내</h2>
      <p className="text-sm text-gray-500 mb-4">
        데이터 출처: {source === "live" ? "실시간 API" : "캐시된 데이터"}
      </p>

      <div className="grid gap-4">
        {events.map((ev, idx) => (
          <div
            key={idx}
            className="border rounded-lg p-4 shadow-sm bg-white"
          >
            <h3 className="font-semibold text-lg mb-1">
              {ev.title || ev.eventNm || "행사명 없음"}
            </h3>

            <p className="text-sm text-gray-600">
              기간: {ev.eventPeriod || ev.date || "정보 없음"}
            </p>

            <p className="text-sm text-gray-600">
              장소: {ev.venue || ev.place || "장소 정보 없음"}
            </p>

            {ev.reference && (
              <a
                href={ev.reference}
                className="text-blue-500 underline text-sm"
                target="_blank"
              >
                자세히 보기 →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
