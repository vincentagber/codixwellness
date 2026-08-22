import js from "@eslint/js";
import globals from "globals";
import html from "eslint-plugin-html";

export default [
  {
    files: ["**/*.js", "**/*.html"],
    plugins: { html },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        PRODUCTS: "readonly",
        SAMPLE_SEARCH_PRODUCTS: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Data globals are shared across non-module <script> files.
      "no-unused-vars": "off",
      "no-redeclare": ["error", { builtinGlobals: false }],
    },
  },
  {
    ignores: ["node_modules/", "css/tailwind.css"],
  },
];
