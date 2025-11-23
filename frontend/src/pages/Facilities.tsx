// frontend/src/pages/Facilities.tsx
import FacilityFinder from "@/components/FacilityFinder";
import Competitions from "@/components/Competitions";

const Facilities = () => {
  return (
    <div className="min-h-screen">
      {/* Header는 App.tsx에서 이미 렌더됨 */}
      <main className="pt-16 space-y-16">
        {/* 1) 시설 지도 + 리스트 */}
        <FacilityFinder />

        {/* 2) 공공시설 프로그램 안내 섹션 */}
        <Competitions />
      </main>
      {/* Footer는 App.tsx에서 자동 렌더됨 */}
    </div>
  );
};

export default Facilities;
