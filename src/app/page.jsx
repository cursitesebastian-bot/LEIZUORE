import Hero from "../components/HeroSection";
import EventsSection from "../components/EventsSection";
import BrowseByVibe from "@/components/BrowseByVibe";
import TrendingThisWeek from "../components/TrendingThisWeek";
export default function HomePage() {
  return (
    <>
      <Hero />
      <EventsSection />
      <BrowseByVibe/>
      <TrendingThisWeek/>
    </>
  );
}