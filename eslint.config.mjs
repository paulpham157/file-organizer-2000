import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";
import {
  obsidianScannerIgnores,
  repoReleaseIgnores,
} from "./eslint/scanner-ignores.mjs";

const obsidianScan = process.env.OBSIDIAN_SCAN === "1";
const pluginDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "packages/plugin");
const pluginFiles = ["packages/plugin/**/*.{ts,tsx}"];

/** Excluded for fast dev lint only; not excluded when OBSIDIAN_SCAN=1. */
const devMonorepoIgnores = [
  "packages/web/**",
  "packages/mobile/**",
  "packages/landing/**",
  "packages/release-notes/**",
];

export default tseslint.config(
  globalIgnores([
    ...obsidianScannerIgnores,
    ...repoReleaseIgnores,
    ...(obsidianScan ? [] : devMonorepoIgnores),
  ]),
  {
    files: pluginFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs"],
        },
        tsconfigRootDir: pluginDir,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended.map((config) => {
    const isPackageJsonConfig =
      Array.isArray(config.files) &&
      config.files.length === 1 &&
      config.files[0] === "package.json";

    if (isPackageJsonConfig) {
      return config;
    }

    return { ...config, files: pluginFiles };
  }),
  {
    files: ["package.json"],
    rules: {
      "depend/ban-dependencies": "off",
      "obsidianmd/no-plugin-as-component": "off",
    },
  },
);
