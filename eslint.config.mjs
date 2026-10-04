import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Layer boundaries (see docs/architecture):
 *   domain      -> imports nothing from application, infra, app, or frameworks
 *   application -> may import domain and infra; never app (UI)
 *   app (UI)    -> may import application and domain; never the database directly
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/application/*", "@/infra/*", "@/app/*", "../application/*", "../infra/*", "../app/*"],
              message: "The domain core must stay framework- and infrastructure-free.",
            },
            {
              group: ["next", "next/*", "react", "react-dom", "pg", "drizzle-orm", "drizzle-orm/*"],
              message: "The domain core must stay framework- and infrastructure-free.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/app/*"], message: "The application layer must not depend on the UI." }] },
      ],
    },
  },
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/infra/db/*", "pg", "drizzle-orm", "drizzle-orm/*"],
              message: "UI code must go through application commands/queries, never the database.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
