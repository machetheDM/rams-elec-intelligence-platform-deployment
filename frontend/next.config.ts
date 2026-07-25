import type { NextConfig } from "next";

// =============================================================================
// Content Security Policy (CSP)
// =============================================================================
// Restricts which resources the browser is allowed to load. This is the
// single most important security header — it prevents XSS, data injection,
// and unauthorised resource loading.
//
// Directive explanations:
//   default-src 'self'     — Only load resources from our own domain by default
//   script-src             — Scripts from our domain + CDN (jsdelivr for libraries)
//                             'unsafe-inline' is needed for Next.js client hydration
//   style-src              — Styles from our domain + Google Fonts
//   font-src               — Fonts from Google Fonts CDN only
//   img-src                — Images from our domain, data URIs, and any HTTPS source
//   connect-src            — API calls only to our own API domain
//   frame-ancestors 'none' — Prevent embedding in iframes (anti-clickjacking)
//   base-uri 'self'        — Prevent base tag injection
//   form-action 'self'     — Forms can only submit to our domain
//   upgrade-insecure-requests — Auto-upgrade HTTP to HTTPS
// =============================================================================
// DEVELOPMENT RELAXATIONS — never applied to a production build.
//
// Next.js dev mode runs React Fast Refresh, which evaluates modules via
// eval(). Without 'unsafe-eval' the dev runtime throws
//   "Uncaught EvalError: ... 'unsafe-eval' is not an allowed source of script"
// inside @next/react-refresh-utils, which kills hydration for the ENTIRE
// page — every client component silently stops working while the
// server-rendered HTML still looks correct. Production never needs eval,
// so the shipped policy stays strict.
//
// Dev also needs:
//   - ws:/wss: for the HMR websocket
//   - http://localhost:* so the browser can reach the FastAPI services
//     (the load-shedding widget calls its service directly)
//   - NO upgrade-insecure-requests, which would rewrite http://localhost
//     to https:// and break every local request
const isDev = process.env.NODE_ENV === "development";

const CSP_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.jsdelivr.net`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  `connect-src 'self'${isDev ? " ws://localhost:* http://localhost:*" : ""} https://api.ramsatelec.co.za`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// =============================================================================
// HTTP Security Headers
// =============================================================================
// Applied to every response. These headers implement defence-in-depth
// against common web attacks. See docs/security-pipeline.md for details.
// =============================================================================
const securityHeaders = [
  // Prevent clickjacking by blocking all iframe embedding
  { key: "X-Frame-Options", value: "DENY" },

  // Prevent MIME type sniffing (forces browser to respect Content-Type)
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Only send Referer header for same-origin requests; strip path for cross-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Content Security Policy — the main XSS defence
  { key: "Content-Security-Policy", value: CSP_POLICY },

  // Restrict browser features (camera, mic, etc.) — none needed for this app
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },

  // Legacy XSS filter — set to 0 because CSP handles XSS; avoids false positives
  { key: "X-XSS-Protection", value: "0" },

  // Prevent cross-origin window interactions (spectre mitigation)
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },

  // Prevent cross-origin resource loading of our assets
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Apply security headers to ALL routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
