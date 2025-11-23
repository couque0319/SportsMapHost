import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "./ui/card";
import { supabase } from "../lib/supabaseClient";

interface Program {
  id: number;
  name: string;
  description: string | null;
  target_group: string | null;
}

const Competitions = () => {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    const fetchPrograms = async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, description, target_group")
        .order("created_at", { ascending: false })
        .limit(3);

      if (!error && data) {
        setPrograms(data);
      }
    };

    fetchPrograms();
  }, []);

  const handleDetail = (id: number) => {
    navigate(`/programs/${id}`);
  };

  return (
    <section className="bg-slate-50 py-16">
      <div className="mx-auto max-w-6xl space-y-6 px-4">
        <h2 className="text-lg font-semibold">공공체육시설 프로그램 안내</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {programs.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer p-4 hover:shadow-md"
              onClick={() => handleDetail(p.id)}
            >
              <h3 className="text-base font-semibold">{p.name}</h3>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                {p.description ?? "설명 없음"}
              </p>
              <p className="mt-2 text-xs">
                대상: {p.target_group ?? "미정"}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Competitions;
export { Competitions };
