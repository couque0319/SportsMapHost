// frontend/src/App.tsx
import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
// 또는 Index를 쓰고 싶으면 위 줄 대신: import Index from "./pages/Index";
import Facilities from "./pages/Facilities";
import ProgramListPage from "./pages/ProgramListPage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import NotFound from "./pages/NotFound";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ContactDialog from "./components/ContactDialog";
import "./App.css";

function App() {
  const [contactOpen, setContactOpen] = useState(false);

  const handleOpenContact = () => setContactOpen(true);
  const handleCloseContact = () => setContactOpen(false);

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        {/* 헤더에 문의하기 핸들러 전달 */}
        <Header onContactClick={handleOpenContact} />

        <main className="flex-1 pt-16">
          <Routes>
            {/* 홈 페이지에도 같은 핸들러 전달 */}
            <Route
              path="/"
              element={<HomePage onOpenContact={handleOpenContact} />}
            />
            {/* Index를 쓰고 싶으면 위 한 줄을 이렇게 바꾸면 됨:
                <Route path="/" element={<Index />} /> */}
            <Route path="/facilities" element={<Facilities />} />
            <Route path="/programs" element={<ProgramListPage />} />
            <Route path="/programs/:id" element={<ProgramDetailPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* 전역 문의하기 다이얼로그 */}
        <ContactDialog open={contactOpen} onClose={handleCloseContact} />

        <Footer /> {/* ✅ Footer는 딱 여기 한 번만 */}
      </div>
    </BrowserRouter>
  );
}

export default App;
