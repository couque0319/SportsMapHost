import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { FacilityFinder } from "@/components/FacilityFinder";
import { Competitions } from "@/components/Competitions";
import { News } from "@/components/News";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-16">
        <Hero />
        <FacilityFinder />
        <Competitions />
        <News />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
