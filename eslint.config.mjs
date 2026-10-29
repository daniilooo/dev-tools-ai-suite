import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.angular/**",
      "**/coverage/**",
      "playwright-report/**",
      "test-results/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    // Limites de módulo (MODULE_MAP): core não depende de módulos de feature.
    files: ["apps/server/src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [{ group: ["**/modules/**"], message: "core não pode depender de módulos de feature." }],
        },
      ],
    },
  },
  {
    files: ["apps/web/**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
  },
);
