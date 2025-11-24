// src/pages/HomePage.tsx
import { FC } from "react";
import { useNavigate } from "react-router-dom";
import Hero from "../components/Hero";
import FacilityFinder from "../components/FacilityFinder";
import News from "../components/News";
import HomeProgramSection from "../components/HomeProgramSection";

type HomePageProps = {
  // 상단 헤더/히어로에서 공통으로 쓸 문의하기 열기 함수
  onOpenContact: () => void;
};

const HomePage: FC<HomePageProps> = ({ onOpenContact }) => {
  const navigate = useNavigate();

  const handleGoFacilities = () => {
    navigate("/facilities");
  };

  const handleGoPrograms = () => {
    navigate("/programs");
  };

  return (
    <>
      <Hero
        onClickFacilities={handleGoFacilities}
        onClickContact={onOpenContact}
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10">
        {/* 시설 찾기 */}
        <FacilityFinder />

        {/* 공공체육시설 프로그램 섹션 */}
        <section id="programs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">공공체육시설 프로그램</h2>
            <button
              className="text-sm text-sky-600 hover:underline"
              onClick={handleGoPrograms}
            >
              더보기
            </button>
          </div>

          <HomeProgramSection limit={4} />
        </section>

        {/* 뉴스/소식 */}
        <News />
      </div>
    </>
  );
};

export default HomePage;
