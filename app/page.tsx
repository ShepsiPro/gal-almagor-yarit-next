import type { Metadata } from "next";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import Categories from "@/components/Categories";
import Quote from "@/components/Quote";
import About from "@/components/About";
import WhyUs from "@/components/WhyUs";
import Partners from "@/components/Partners";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import { SIMULATOR_ENABLED } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <Stats />
      <Categories />
      {SIMULATOR_ENABLED && <Quote />}
      <About />
      <WhyUs />
      <Partners />
      <Contact />
      <Footer />
    </>
  );
}
