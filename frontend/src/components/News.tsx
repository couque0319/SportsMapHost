import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ChevronRight } from "lucide-react";

const news = [
  {
    title: "2025년 생활체육 지원 사업 공고",
    excerpt: "전국 각 지자체별 생활체육 지원 사업 신청이 시작되었습니다. 12월 31일까지 신청 가능합니다.",
    date: "2025.11.22",
    category: "공지사항",
  },
  {
    title: "겨울철 체육시설 안전 이용 안내",
    excerpt: "겨울철 실내 체육시설 이용 시 안전 수칙을 안내드립니다. 모두의 안전한 운동을 위해 협조 부탁드립니다.",
    date: "2025.11.20",
    category: "안내",
  },
  {
    title: "전국 생활체육대회 성황리 종료",
    excerpt: "지난 주말 개최된 전국 생활체육대회가 5만여 명의 참가자와 함께 성황리에 마무리되었습니다.",
    date: "2025.11.18",
    category: "뉴스",
  },
  {
    title: "신규 체육시설 개관 안내",
    excerpt: "경기도 및 충청지역에 새로운 생활체육시설이 개관하였습니다. 다양한 프로그램을 이용하실 수 있습니다.",
    date: "2025.11.15",
    category: "시설",
  },
];

const News = () => {
  return (
    <section id="news" className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-4xl font-bold text-foreground mb-2">소식 및 공지</h2>
            <p className="text-muted-foreground">생활체육 관련 최신 소식을 확인하세요</p>
          </div>
          <Button variant="ghost" className="gap-2 hidden sm:flex hover:text-primary">
            더보기
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {news.map((item, index) => (
            <Card 
              key={index} 
              className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group border-l-4 border-l-primary hover:border-l-secondary"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                  {item.category}
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{item.date}</span>
                </div>
              </div>
              <h3 className="font-bold text-lg mb-2 text-foreground group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {item.excerpt}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Button variant="ghost" className="gap-2 hover:text-primary">
            더보기
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export { News };
export default News;