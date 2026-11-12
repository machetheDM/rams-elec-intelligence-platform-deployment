import type { Config } from "tailwindcss";

// =============================================================================
// Design tokens — the company's own colours, not a generic Tailwind palette
// =============================================================================
// These were retuned from stock amber/slate to Rams @Elec's actual charcoal and
// gold, taken from the Manager app's Colors.xaml via docs/ui-direction.md. The
// token NAMES did not change, so every component picked the new palette up
// without being edited — which is the whole point of the frontend separation
// rule in CLAUDE.md.
//
// The four anchors from the company's system land on specific slots:
//   brand-500       #FFC529  BrandGold   — the one accent
//   industrial-950  #12131B  Surface     — page ground
//   industrial-900  #222736  CardBg      — cards, inputs, raised surfaces
//   industrial-400  #A5AEBE  TextSecondary
//
// CONTRAST. Gold on charcoal is ~11.9:1, comfortably AA (and AAA). Gold on
// white is ~1.7:1 and fails outright, so gold is a text colour on dark grounds
// ONLY, and a gold *background* always carries industrial-950 text, never white.
//
// NO THIRD ACCENT. ui-direction.md is explicit: BrandGold is the accent; red,
// green and blue are semantic only. The logo's own red (#E31B38) belongs to the
// mark and to danger states — never to buttons, links or headings.
// =============================================================================

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Gold. Anchored on BrandGold #FFC529 at 500.
        brand: {
          50: "#fff9e6",
          100: "#fff0bf",
          200: "#ffe694",
          300: "#ffdb69",
          400: "#ffd147",
          500: "#ffc529",
          600: "#e0a800",
          700: "#b88700",
          800: "#8f6900",
          900: "#6b4f00",
          950: "#3d2d00",
        },
        // Charcoal. Anchored on Surface #12131B (950), CardBg #222736 (900)
        // and TextSecondary #A5AEBE (400).
        industrial: {
          50: "#f7f9fb",
          100: "#edf0f4",
          200: "#dce1e8",
          300: "#c2c9d4",
          400: "#a5aebe",
          500: "#6b7589",
          600: "#4a5268",
          700: "#3a4155",
          800: "#2e3346",
          900: "#222736",
          950: "#12131b",
        },
        // The logo mark's red. Named so it can never be mistaken for an accent.
        mark: {
          DEFAULT: "#e31b38",
        },
      },
      fontFamily: {
        // Both self-hosted by next/font (see app/layout.site.tsx). The served
        // CSP allows font-src 'self' only, which works precisely because
        // next/font downloads at build time and serves from /_next/static.
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-archivo)", "Archivo", "Inter", "system-ui", "sans-serif"],
      },
      // Deliberately minimal. The previous config carried a `pulse-glow`
      // keyframe that put an amber halo behind the emergency button — one of
      // the clearest "generated template" tells, and a distraction on a page
      // whose job is a phone number. Fades stay; glows do not.
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
