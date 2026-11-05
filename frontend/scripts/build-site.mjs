#!/usr/bin/env node
/**
 * Build the PUBLIC static export -> frontend/out/
 *
 * Run it with:  npm run build:site  (from frontend/)
 *
 * This exists only to set BUILD_TARGET cross-platform. `BUILD_TARGET=site next
 * build` is fine in bash, but npm runs scripts through cmd.exe on Windows,
 * where that syntax is a parse error and the dev machine here is Windows. The
 * usual answer is a cross-env dependency; this is a few lines and no dependency.
 *
 * next.config.ts reads BUILD_TARGET and switches to `output: "export"` with
 * pageExtensions limited to the `site.*` files. See the comment there.
 *
 * The verifier below mirrors `deploy/server/ship-site.sh` in the Manager app
 * repository, which refuses a build containing any of these paths. Failing
 * here means a laptop build fails the same way the deploy would, three minutes
 * earlier and with a clearer message.
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const OUT = join(process.cwd(), "out");

/** Must not exist in the export: these pages run on invented data. */
const FORBIDDEN = [
  "admin",
  "dashboard",
  "equipment",
  "service-history",
  "compliance",
  "chatbot",
  "login",
  "api",
];

/** The server needs both: 404.html is served for every unknown path. */
const REQUIRED = ["index.html", "404.html"];

// Resolve Next's CLI and run it on this Node. Passing an args array with
// shell:true raises Node's DEP0190 (the args are concatenated, not escaped).
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

const build = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: { ...process.env, BUILD_TARGET: "site" },
});

if (build.status !== 0) process.exit(build.status ?? 1);

// One directory read, then pure string comparison. Cheaper and more correct
// than probing each path twice (folder form and .html form) -- and it keeps
// eslint-plugin-security quiet without a disable comment, because the rule
// fires on per-path existsSync() calls built from a variable, not on a single
// listing of a constant directory.
const published = new Set(readdirSync(OUT));

let failed = false;

for (const path of FORBIDDEN) {
  // Both forms: a folder (trailingSlash on) and a flat .html file (off).
  const asDir = published.has(path);
  const asFile = published.has(`${path}.html`);
  if (asDir || asFile) {
    console.error(
      `  FAIL  out/${path}${asFile ? ".html" : "/"} exists — the deploy will refuse this build`,
    );
    failed = true;
  }
}

for (const file of REQUIRED) {
  if (!published.has(file)) {
    console.error(`  FAIL  out/${file} is missing — the server needs it`);
    failed = true;
  }
}

if (failed) {
  console.error(
    "\nA public route is probably named page.tsx instead of page.site.tsx,\n" +
      "or a private route was renamed into the site build. See next.config.ts.",
  );
  process.exit(1);
}

console.log(
  `\n  out/ verified: none of ${FORBIDDEN.length} private paths present, ${REQUIRED.join(" and ")} present.`,
);
