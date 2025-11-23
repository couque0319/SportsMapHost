import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { Card } from "../components/ui/card";

interface Program {
  id: number;
  name: string;
  description: string | null;
  target_group: string | null;
  age_min: number | null;
  age_max: number | null;
  schedule: string | null;
  price: string | null;
  homepage_url: string | null;
  created_at: string | null;
}

const cleanName = (raw: string): string => {
  if (!raw) return "";

  // 0) 공백 정리
  let text = raw.replace(/\s+/g, " ").trim();

  // 1) 문자열이 거의 두 번 반복된 형태인지 검사해서 반으로 자르기
  if (text.length > 40) {
    const mid = Math.floor(text.length / 2);
    const first = text.slice(0, mid).trim();
    const second = text.slice(mid).trim();

    // 앞쪽 15글자가 뒷부분 시작에도 그대로 나오면
    // "X X" 구조라고 보고 앞부분만 사용
    const probe = first.slice(0, 15);
    if (probe && second.startsWith(probe)) {
      text = first;
    }
  }

  // 2) 단어 단위로 한 번 더 중복 제거 (순서는 유지)
  const seen = new Set<string>();
  const tokens = text.split(" ");
  const deduped: string[] = [];

  for (const t of tokens) {
    const key = t.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(key);
  }

  text = deduped.join(" ");

  // 3) 너무 길면 앞부분만 노출하고 말줄임
  const MAX_LEN = 60; // 필요하면 50~70 사이로 조절
  if (text.length > MAX_LEN) {
    return text.slice(0, MAX_LEN) + "…";
  }

  return text;
};

const formatPrice = (raw: string | number | null): string => {
  if (raw === null || raw === undefined || raw === "") return "문의 요망";

  const n =
    typeof raw === "number"
      ? raw
      : Number(typeof raw === "string" ? raw.trim() : raw);

  if (Number.isNaN(n)) {
    // 숫자로 못 바꾸면 원본 그대로 보여주기
    return String(raw);
  }

  // 10000 -> "10,000원"
  return n.toLocaleString("ko-KR") + "원";
};


const formatAgeRange = (min: number | null, max: number | null) => {
  if (min == null && max == null) return "전체 연령";
  if (min != null && max != null) return `${min} ~ ${max}세`;
  if (min != null) return `${min}세 이상`;
  return `${max}세 이하`;
};

const ProgramListPage = () => {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["programs"],
    queryFn: async (): Promise<Program[]> => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const handleClick = (id: number) => {
    navigate(`/programs/${id}`);
  };

  if (isLoading) {
    return <div className="p-6">프로그램을 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">
        프로그램 정보를 불러오는 중 문제가 발생했습니다.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="p-6">등록된 프로그램이 없습니다.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-center">전체 프로그램</h1>

      <div className="space-y-4">
        {data.map((item) => (
          <Card
            key={item.id}
            className="cursor-pointer rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            onClick={() => handleClick(item.id)}
          >
            {/* 위쪽: 제목 + 태그들 */}
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <h2 className="text-base font-semibold leading-relaxed md:text-lg line-clamp-2">
                {cleanName(item.name)}
              </h2>

              <div className="mt-1 flex flex-wrap gap-2 text-xs md:mt-0 md:justify-end">
                <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">
                  {item.target_group ?? "대상 정보 없음"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  {formatAgeRange(item.age_min, item.age_max)}
                </span>
              </div>
            </div>

            {/* 가운데: 설명 요약 */}
            {item.description && (
              <p className="mt-3 text-sm leading-relaxed text-slate-700 line-clamp-2">
                {item.description}
              </p>
            )}

            {/* 아래쪽: 일정 / 가격 등 메타 정보 */}
            <div className="mt-4 flex flex-col gap-1 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-slate-600">
                  일정
                </span>
                <span className="whitespace-pre-line">
                  {item.schedule ?? "일정 정보 없음"}
                </span>
              </div>

              <div className="mt-3 flex flex-col items-start gap-1 md:mt-0 md:items-end">
                <span className="font-medium text-slate-600">참가비</span>
                <span>{formatPrice(item.price)}</span>
                {item.homepage_url && (
                  <span className="mt-1 text-[11px] text-sky-600">
                    상세 신청 정보는 카드 클릭 후 확인
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProgramListPage;
