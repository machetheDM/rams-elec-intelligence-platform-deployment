import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Rams @Elec | Professional Electrical & Refrigeration Services",
  description:
    "15+ Years of industrial mastery. AI-powered electrical and refrigeration engineering — instant quoting, load-shedding intelligence, and 24/7 emergency response across Gauteng and Limpopo.",
  keywords: ["electrical", "refrigeration", "cold room", "HVAC", "load shedding", "SANS 10142", "Polokwane", "Gauteng", "Limpopo"],
  openGraph: {
    title: "Rams @Elec | Engineering Reliability, Powered by AI",
    description: "South Africa's most advanced electrical and refrigeration services.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Intentionally raw <link> tags for now — migrating to next/font/google
          is a font-loading *mechanism* change best done alongside the v0.dev
          visual redesign rather than as an isolated lint fix.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-industrial-950 text-industrial-100 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
