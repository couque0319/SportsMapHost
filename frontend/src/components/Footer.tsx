import { MapPin, Mail, Phone } from "lucide-react";

const Footer = () => {
  return (
    <footer id="contact" className="bg-foreground/5 border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="font-bold text-foreground">전국 생활체육</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              전국민의 건강한 생활체육 문화를 위한 종합 정보 포털
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">서비스</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">시설찾기</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">대회안내</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">프로그램</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">소식</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">지원</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">이용안내</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">자주묻는질문</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">공지사항</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">문의하기</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">연락처</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" />
                <span>1588-0000</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <span>sports@korea.go.kr</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 전국 생활체육 포털. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export { Footer };
export default Footer;