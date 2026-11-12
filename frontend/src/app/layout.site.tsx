import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

// Loaded via next/font rather than raw <link> tags in a manual <head>.
// React 19 hoists <link> elements, so hand-writing <head> in an App Router
// root layout reorders them relative to Next's own scripts — the server
// HTML then mismatches the client tree, hydration throws, and React bails
// on the ENTIRE root (every client component silently stops working).
//
// SELF-HOSTED FILES, NOT next/font/google. This is the important part.
//
// next/font/google fetches each face from fonts.googleapis.com AT BUILD TIME,
// with a 3s timeout and three retries. This machine reaches that host in about
// 4.4s, so the fetch is a race — and it loses in two different ways:
//
//   dev server  the build SUCCEEDS and silently ships a fallback face
//               ("Failed to download 'Inter'... Using fallback font instead.")
//   docker      the build FAILS outright:
//               "An error occurred in `next/font`.
//                TypeError: Cannot read properties of null (reading '1')"
//
// That is why `Build Docker Images` and the Trivy job's identical `docker build`
// disagreed on the same commit eight seconds apart: one won the race, one did
// not. A build that depends on a third-party host being fast is not a build.
//
// The files are committed (84 KB for both). Google serves these two families as
// VARIABLE fonts, so one file per family covers every weight — the four Inter
// weight URLs returned byte-identical files, which is why there is one here and
// a weight RANGE rather than four faces.
//
// This also keeps the production CSP honest: `font-src 'self'` works because
// nothing is ever fetched from a font host, at build time or at run time.
const inter = localFont({
  src: "./fonts/Inter-variable.woff2",
  weight: "400 700",
  variable: "--font-inter",
  display: "swap",
});

const archivo = localFont({
  src: "./fonts/Archivo-variable.woff2",
  weight: "600 800",
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
