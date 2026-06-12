import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

const pluginDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "packages/plugin");

export default tseslint.config(
  globalIgnores([
    "node_modules",
    "packages/web/**",
    "packages/mobile/**",
    "packages/landing/**",
    "packages/release-notes/**",
    "dist",
    "release-artifacts",
    "main.js",
    "styles.css",
    "main.css",
    "data.json",
    "checksums.txt",
    "versions.json",
    "**/*.mjs",
    "**/release.js",
    "**/postcss.config.js",
    "**/tailwind.config.js",
    "**/jest.config.*",
    "packages/plugin/**/*.test.ts",
  ]),
  {
    files: ["packages/plugin/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "manifest.json"],
        },
        tsconfigRootDir: pluginDir,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["package.json"],
    rules: {
      "depend/ban-dependencies": "off",
      "obsidianmd/no-plugin-as-component": "off",
    },
  },
);
