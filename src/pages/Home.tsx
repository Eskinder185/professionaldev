import React from "react";
import PDCoach from "../components/chat/PDCoach";
import HomeHero from "../components/home/HomeHero";
import HomePillars from "../components/home/HomePillars";
import HomeFeaturedTools from "../components/home/HomeFeaturedTools";
import HomeProgressValue from "../components/home/HomeProgressValue";
import HomeFinalCta from "../components/home/HomeFinalCta";

export default function Home() {
  return (
    <div className="w-full pb-6">
      <HomeHero />
      <HomePillars />
      <HomeFeaturedTools />
      <HomeProgressValue />
      <HomeFinalCta />
      <PDCoach />
    </div>
  );
}
