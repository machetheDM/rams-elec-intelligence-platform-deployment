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
    ignores: ["node_modules/**", ".next/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
