// src/components/Hero.tsx
import { FC } from "react";

interface HeroProps {
  onClickFacilities: () => void;
  onClickContact: () => void;
}

const Hero: FC<HeroProps> = ({ onClickFacilities, onClickContact }) => {
  return (
    <section
      className="
        relative w-full py-16 text-white 
        bg-cover bg-center bg-no-repeat
      "
      style={{
        backgroundImage: `url('/src/assets/hero-sports.jpg')`,
      }}
    >
      {/* 어두운 오버레이로 텍스트 가독성 향상 */}
      <div className="absolute inset-0 bg-black/50"></div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 md:flex-row md:items-center">
        <div className="flex-1 space-y-4">
          <h1 className="text-3xl font-bold md:text-4xl leading-snug">
            내 주변 스포츠 시설·프로그램을 한눈에
          </h1>

          <p className="text-sm text-slate-200 md:text-base leading-relaxed">
            공공체육시설, 레저스포츠, 민간시설까지 종목·지역별로 검색하고 실제
            운영 중인 프로그램을 확인해 보세요.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={onClickFacilities}
              className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold hover:bg-sky-400 shadow-md"
            >
              내 주변 체육시설 찾기
            </button>

            <button
              onClick={onClickContact}
              className="rounded-full border border-white/50 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10 backdrop-blur-md"
            >
              문의하기
            </button>
          </div>
        </div>

        <div className="flex-1">
          <div className="rounded-2xl bg-black/40 backdrop-blur-md p-5 text-sm text-slate-200 shadow-lg">
            스포츠맵에서 지역별 시설을 한 번에 탐색하고,
            공공체육시설에서 진행하는 다양한 프로그램을 찾아보세요.
          </div>
        </div>
      </div>
    </section>
  );
};

export { Hero };
export default Hero;
