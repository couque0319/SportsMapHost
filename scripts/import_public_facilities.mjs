// scripts/update_is_public_from_json.mjs
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ───────────────────
// 1. Supabase 연결
// ───────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ───────────────────
// 2. JSON 파일 로드
// ───────────────────
const JSON_PATH = path.join(process.cwd(), "public_facilities_basic.json");

if (!fs.existsSync(JSON_PATH)) {
  console.error("[ERROR] JSON 파일이 없습니다:", JSON_PATH);
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
console.log("[INFO] JSON 로드:", rows.length, "행");

// JSON → {name, sido, sigungu} 추출 (필요한 정보만)
function extractKey(row) {
  return {
    name: (row.name || "").trim(),
    sido: (row.sido || "").trim(),
    sigungu: (row.sigungu || "").trim(),
  };
}

// ───────────────────
// 3. is_public 전체 false 초기화
// ───────────────────
async function resetIsPublic() {
  console.log("[RESET] is_public = false 초기화");
  const { error } = await supabase
    .from("facilities")
    .update({ is_public: false })
    .neq("id", 0);

  if (error) throw error;
}

// ───────────────────
// 4. JSON 기준으로 is_public = true 업데이트
// ───────────────────
async function applyIsPublic() {
  let success = 0;
  let fail = 0;

  for (const r of rows) {
    const key = extractKey(r);

    if (!key.name || !key.sido) {
      fail++;
      continue;
    }

    const { data, error } = await supabase
      .from("facilities")
      .update({ is_public: true })
      .match({
        name: key.name,
        sido: key.sido,
        sigungu: key.sigungu,
      })
      .select("id");

    if (error) {
      console.warn("[WARN] 업데이트 실패:", key);
      fail++;
      continue;
    }

    if (data && data.length > 0) {
      success += data.length;
    } else {
      fail++;
    }
  }

  console.log("[RESULT] is_public 업데이트 완료");
  console.log("성공:", success);
  console.log("매칭 실패:", fail);

  const { count } = await supabase
    .from("facilities")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true);

  console.log("[CHECK] 공공시설 수:", count);
}

// ───────────────────
// 5. 실행
// ───────────────────
async function main() {
  await resetIsPublic();
  await applyIsPublic();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
