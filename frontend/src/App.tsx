// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
// 또는 Index를 쓰고 싶으면 위 줄 대신: import Index from "./pages/Index";
import Facilities from "./pages/Facilities";
import ProgramListPage from "./pages/ProgramListPage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import NotFound from "./pages/NotFound";
import Header from "./components/Header";
import Footer from "./components/Footer";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pt-16">
          <Routes>
            <Route path="/" element={<HomePage />} />
            {/* Index를 쓰고 싶으면 위 한 줄을 이렇게 바꾸면 됨:
                <Route path="/" element={<Index />} /> */}
            <Route path="/facilities" element={<Facilities />} />
            <Route path="/programs" element={<ProgramListPage />} />
            <Route path="/programs/:id" element={<ProgramDetailPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer /> {/* ✅ Footer는 딱 여기 한 번만 */}
      </div>
    </BrowserRouter>
  );
}

export default App;
