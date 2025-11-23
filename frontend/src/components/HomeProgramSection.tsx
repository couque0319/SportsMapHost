// src/components/HomeProgramSection.tsx
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { Card } from "./ui/card";

// 제목 중복 제거 + 길이 제한
const cleanName = (raw: string): string => {
  if (!raw) return "";

  let text = raw.replace(/\s+/g, " ").trim();

  // 1) 앞/뒤가 비슷한 패턴이면 앞부분만 사용
  if (text.length > 40) {
    const mid = Math.floor(text.length / 2);
    const first = text.slice(0, mid).trim();
    const second = text.slice(mid).trim();

    const probe = first.slice(0, 15);
    if (probe && second.startsWith(probe)) text = first;
  }

  // 2) 단어 중복 제거
  const seen = new Set<string>();
  const unique = text
    .split(" ")
    .filter((w) => {
      const key = w.trim();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ");

  // 3) 너무 길면 축약
  return unique.length > 55 ? unique.slice(0, 55) + "…" : unique;
};

const formatAgeRange = (min: number | null, max: number | null): string => {
  if (min == null && max == null) return "전체 연령";
  if (min != null && max != null) return `${min} ~ ${max}세`;
  if (min != null) return `${min}세 이상`;
  return `${max}세 이하`;
};

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
}

interface HomeProgramSectionProps {
  limit?: number;
}

const HomeProgramSection = ({ limit = 4 }: HomeProgramSectionProps) => {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<Program[]>({
    queryKey: ["home-programs", { limit }],
    queryFn: async () => {
      let query = supabase
        .from("programs")
        .select(
          "id, name, description, target_group, age_min, age_max, schedule, price, homepage_url"
        )
        .order("created_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleClickCard = (program: Program) => {
    navigate(`/programs/${program.id}`);
  };

  if (isLoading) {
    return (
      <div className="text-sm text-slate-500">프로그램을 불러오는 중...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        프로그램 정보를 불러오는 중 문제가 발생했습니다.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        현재 등록된 프로그램이 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {data.map((program) => (
        <Card
          key={program.id}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          onClick={() => handleClickCard(program)}
        >
          {/* 제목 */}
          <h3 className="mb-3 line-clamp-2 text-lg font-semibold leading-snug">
            {cleanName(program.name)}
          </h3>

          {/* 메타 정보 */}
          <p className="text-sm text-slate-600">
            유형: {program.target_group ?? "미정"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            대상: {formatAgeRange(program.age_min, program.age_max)}
          </p>
        </Card>
      ))}
    </div>
  );
};

export default HomeProgramSection;
