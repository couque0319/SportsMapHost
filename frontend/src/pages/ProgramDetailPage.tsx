import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

interface ProgramDetail {
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

// 참가비를 원화 형식으로 포맷
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


const ProgramDetailPage = () => {
  const { id } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["program", id],
    enabled: !!id,
    queryFn: async (): Promise<ProgramDetail | null> => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-6">불러오는 중...</div>;
  if (error || !data)
    return <div className="p-6 text-red-500">프로그램을 찾을 수 없습니다.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Card className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">{data.name}</h1>

        {data.target_group && (
          <p className="text-sm text-slate-500">{data.target_group}</p>
        )}

        <p className="whitespace-pre-line text-sm">
          {data.description ?? "설명 없음"}
        </p>

        <div className="space-y-1 text-sm text-slate-700">
          <p>일정: {data.schedule ?? "정보 없음"}</p>
          <p>가격: {formatPrice(data.price)}</p>
          {data.age_min && data.age_max && (
            <p>
              연령: {data.age_min} ~ {data.age_max}세
            </p>
          )}
        </div>

        {data.homepage_url && (
          <Button asChild>
            <a href={data.homepage_url} target="_blank">
              신청 페이지로 이동
            </a>
          </Button>
        )}
      </Card>
    </div>
  );
};

export default ProgramDetailPage;
