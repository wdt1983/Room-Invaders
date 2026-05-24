import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno Edge Functions live under supabase/functions/. They import
    // from URLs (`https://esm.sh/...`) and use Deno APIs that don't
    // resolve in Node/Next — they're deployed separately via the
    // Supabase CLI. Lint them with `deno lint` inside that directory
    // if needed.
    "supabase/**",
  ]),
]);

export default eslintConfig;
