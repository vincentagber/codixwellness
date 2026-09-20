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
        ...globals.node,
        CodixAPI: "readonly",
        CodixCurrency: "readonly",
        PaystackPop: "readonly",
        tailwind: "readonly",
        PRODUCTS: "readonly",
        PRODUCT_DATABASE: "readonly",
        SEARCH_SUGGESTIONS: "readonly",
        SAMPLE_SEARCH_PRODUCTS: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Shared non-module script globals & friendly rules
      "no-unused-vars": "off",
      "no-redeclare": ["error", { builtinGlobals: false }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    ignores: ["node_modules/", "css/tailwind.css"],
  },
];
