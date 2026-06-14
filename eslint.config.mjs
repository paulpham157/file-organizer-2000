import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

const pluginDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "packages/plugin");
const pluginFiles = ["packages/plugin/**/*.{ts,tsx}"];

export default tseslint.config(
  globalIgnores([
    "node_modules",
    ".pnpm-store",
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
    "test-release.js",
    "scripts/**",
    "**/*.mjs",
    "**/release.js",
    "**/postcss.config.js",
    "**/tailwind.config.js",
    "**/jest.config.*",
    "packages/plugin/**/*.test.ts",
    "packages/plugin/**/__mocks__/**",
  ]),
  {
    files: pluginFiles,
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
  ...obsidianmd.configs.recommended.map((config) =>
    config.files ? config : { ...config, files: pluginFiles },
  ),
  {
    files: ["package.json"],
    rules: {
      "depend/ban-dependencies": "off",
      "obsidianmd/no-plugin-as-component": "off",
    },
  },
);
