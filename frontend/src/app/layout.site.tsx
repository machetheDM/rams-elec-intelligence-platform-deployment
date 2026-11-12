import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

// Loaded via next/font rather than raw <link> tags in a manual <head>.
// React 19 hoists <link> elements, so hand-writing <head> in an App Router
// root layout reorders them relative to Next's own scripts — the server
// HTML then mismatches the client tree, hydration throws, and React bails
// on the ENTIRE root (every client component silently stops working).
// next/font also self-hosts the files, removing the render-blocking
// round-trip to fonts.googleapis.com.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

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
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="antialiased bg-industrial-950 text-industrial-100 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
