import Hero from "../components/HeroSection";
import EventsSection from "../components/EventsSection";
import BrowseByVibe from "@/components/BrowseByVibe";
import TrendingThisWeek from "../components/TrendingThisWeek";
import DineNearby from "../components/DineNearby";
import HowItWorks from "../components/HowItWorks";
export default function HomePage() {
  return (
    <>
      <Hero />
      <EventsSection />
      <BrowseByVibe/>
      <TrendingThisWeek/>
      <DineNearby />
      <HowItWorks />
    </>
  );
}