import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import securityPlugin from "eslint-plugin-security";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Registers eslint-plugin-security as the "security" namespace so
// .github/workflows/security.yml's `--rule 'security/detect-...'`
// overrides resolve to real rules instead of erroring on an unknown plugin.
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { security: securityPlugin },
    rules: {
      ...securityPlugin.configs.recommended.rules,
    },
  },
  {
    // out/ is the static export from `npm run build:site` — minified bundles,
    // not source. Without it here, running the site build and then `eslint .`
    // reports thousands of problems from the build output and the
    // --max-warnings 0 gate becomes unusable.
    ignores: ["node_modules/**", ".next/**", "out/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
