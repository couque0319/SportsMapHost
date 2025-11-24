// frontend/src/App.tsx
import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import Facilities from "./pages/Facilities";
import ProgramListPage from "./pages/ProgramListPage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import NewsPage from "./pages/NewsPage"; // ✅ 여기 중요!
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
        <Header onContactClick={handleOpenContact} />

        <main className="flex-1 pt-16">
          <Routes>
            <Route
              path="/"
              element={<HomePage onOpenContact={handleOpenContact} />}
            />

            <Route path="/facilities" element={<Facilities />} />
            <Route path="/programs" element={<ProgramListPage />} />
            <Route path="/programs/:id" element={<ProgramDetailPage />} />

            {/* ✅ 소식/공지 전체 페이지 */}
            <Route path="/news" element={<NewsPage />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <ContactDialog open={contactOpen} onClose={handleCloseContact} />
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
