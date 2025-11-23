// src/components/ProgramCard.tsx
import { FC } from "react";
import { Card } from "./ui/card";

export interface Program {
  id: string | number;
  title: string;
  center_name?: string | null;
  sport_type?: string | null;
  region?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface ProgramCardProps {
  program: Program;
  onClick?: (program: Program) => void;
}

const ProgramCard: FC<ProgramCardProps> = ({ program, onClick }) => {
  const handleClick = () => {
    if (onClick) onClick(program);
  };

  return (
    <Card
      className="cursor-pointer p-4 transition-shadow hover:shadow-md"
      onClick={handleClick}
    >
      <h3 className="line-clamp-1 text-base font-semibold">{program.title}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {program.center_name ?? "주최 기관 정보 없음"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {program.sport_type && (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
            #{program.sport_type}
          </span>
        )}
        {program.region && (
          <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">
            {program.region}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {program.start_date && program.end_date
          ? `${program.start_date} ~ ${program.end_date}`
          : "상시 모집 / 기간 정보 없음"}
      </p>
    </Card>
  );
};

export default ProgramCard;
