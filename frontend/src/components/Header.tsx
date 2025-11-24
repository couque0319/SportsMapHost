// frontend/src/components/Header.tsx
import { FC, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, MapPin } from "lucide-react";

type HeaderProps = {
  onContactClick: () => void;
};

const Header: FC<HeaderProps> = ({ onContactClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinkClass =
    "px-3 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-accent";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* 로고/타이틀 영역 */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <Link to="/" className="text-base font-bold leading-tight">
                전국 생활체육 지도
              </Link>
              <p className="text-xs text-muted-foreground">
                공공데이터 기반 생활체육시설 정보 서비스
              </p>
            </div>
          </div>

          {/* 데스크톱 메뉴 */}
          <nav className="hidden items-center gap-4 md:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `${navLinkClass} ${isActive ? "bg-accent" : ""}`
              }
            >
              홈
            </NavLink>

            {/* 시설찾기: 별도 페이지로 이동 */}
            <NavLink
              to="/facilities"
              className={({ isActive }) =>
                `${navLinkClass} ${isActive ? "bg-accent" : ""}`
              }
            >
              시설 찾기
            </NavLink>

            {/* 프로그램/소식: 섹션으로 스크롤 */}
            <a href="#programs" className={navLinkClass}>
              프로그램
            </a>
            <a href="#news" className={navLinkClass}>
              소식
            </a>

            {/* ✅ 상단 문의하기 버튼 - Hero와 동일 동작 */}
            <Button size="sm" onClick={onContactClick}>
              문의하기
            </Button>
          </nav>

          {/* 모바일 메뉴 버튼 */}
          <button
            className="rounded-lg p-2 transition-colors hover:bg-accent md:hidden"
            onClick={() => setIsMenuOpen((v) => !v)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {isMenuOpen && (
          <nav className="mt-2 flex flex-col gap-2 pb-4 md:hidden">
            <NavLink
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `${navLinkClass} w-full ${isActive ? "bg-accent" : ""}`
              }
            >
              홈
            </NavLink>
            <NavLink
              to="/facilities"
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `${navLinkClass} w-full ${isActive ? "bg-accent" : ""}`
              }
            >
              시설 찾기
            </NavLink>
            <a
              href="#programs"
              className={`${navLinkClass} w-full`}
              onClick={() => setIsMenuOpen(false)}
            >
              프로그램
            </a>
            <a
              href="#news"
              className={`${navLinkClass} w-full`}
              onClick={() => setIsMenuOpen(false)}
            >
              소식
            </a>
            {/* ✅ 모바일에서도 문의하기 모달 열기 + 메뉴 닫기 */}
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                onContactClick();
                setIsMenuOpen(false);
              }}
            >
              문의하기
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
};

export { Header };
export default Header;
