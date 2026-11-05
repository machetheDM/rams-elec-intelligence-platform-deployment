import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

// Loaded via next/font rather than raw <link> tags in a manual <head>.
// React 19 hoists <link> elements, so hand-writing <head> in an App Router
// root layout reorders them relative to Next's own scripts — the server
// HTML then mismatches the client tree, hydration throws, and React bails
// on the ENTIRE root (every client component silently stops working).
//
// next/font also self-hosts the files at build time and serves them from
// /_next/static. That is what lets the production CSP allow `font-src 'self'`
// with no font host at all.
//
// WEIGHTS ARE DELIBERATELY FEW. Inter previously requested seven (300–900).
// Each weight is a separate file to fetch at build and to ship to the visitor,
// and next/font gives up on a weight after 3s — on a slow link that silently
// produces a fallback font with no error (see CLAUDE.md). Four and three are
// what the design actually uses.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Display face. A sturdy grotesque rather than a fashion serif: this is a
// contractor's site, and the headings sit above phone numbers and compliance
// certificates, not editorial photography.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  // www redirects to the bare domain on the server, so canonical URLs resolve
  // against it (contract section 3).
  metadataBase: new URL("https://ramsatelec.co.za"),
  title: {
    default: "Rams @Elec — electrical and refrigeration, Gauteng and Limpopo",
    template: "%s | Rams @Elec",
  },
  description:
    "Cold rooms, refrigeration, electrical installations and CoC, HVAC and emergency call-outs across Gauteng and Limpopo. Phone us, or send an enquiry and we will come back to you.",
  keywords: [
    "electrical",
    "refrigeration",
    "cold room",
    "HVAC",
    "certificate of compliance",
    "CoC",
    "SANS 10142",
    "Gauteng",
    "Limpopo",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Rams @Elec — electrical and refrigeration, Gauteng and Limpopo",
    description:
      "Cold rooms, refrigeration, electrical installations and CoC, HVAC and emergency call-outs.",
    url: "/",
    siteName: "Rams @Elec",
    locale: "en_ZA",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`dark ${inter.variable} ${archivo.variable}`}>
      <body className="flex min-h-screen flex-col bg-industrial-950 font-sans text-industrial-100 antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
