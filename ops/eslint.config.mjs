import js from "@eslint/js";
import tseslint from "typescript-eslint";

/*
 * typescript-eslint only. eslint-config-next was tried and dropped: it pins an
 * eslint-plugin-react that crashes on ESLint 10 (`getFilename is not a
 * function`). `next build` runs Next's own checks anyway, so nothing is lost.
 */
export default [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node CLI scripts, not bundled by Next, so they need Node globals declared.
    files: ["scripts/**/*.mjs", "*.mjs", "*.cjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
