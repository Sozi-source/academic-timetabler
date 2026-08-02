import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    // Next.js generated files
    ".next/**",
    ".next-corrupt*/**",

    // Build outputs
    "out/**",
    "build/**",
    "coverage/**",
    "dist/**",

    // Next.js generated
    "next-env.d.ts",
  ]),
]);