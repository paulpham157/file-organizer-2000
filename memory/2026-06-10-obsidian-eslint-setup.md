# Obsidian community review ESLint setup (2026-06-10)

## Problem
ObsidianReviewBot reported: "The source code review encountered a fatal error… ESLint cannot parse."

## Root causes
1. Legacy root `.eslintrc` without `eslint-plugin-obsidianmd` or flat config
2. `packages/plugin/tsconfig.json` included only `src/**/*` but plugin source lives at package root (no `src/` folder)
3. Type-aware obsidian rules crashed on `packages/plugin/esbuild.config.mjs`

## Fix applied
- Added root `eslint.config.mjs` matching obsidian-sample-plugin (eslint 9 + typescript-eslint + eslint-plugin-obsidianmd 0.3.0)
- Scoped lint to `packages/plugin/**/*.{ts,tsx}`; ignore other monorepo packages and `**/*.mjs` build scripts
- Fixed `packages/plugin/tsconfig.json` to include `**/*.ts` and `**/*.tsx`
- Removed legacy `.eslintrc` and `.eslintignore` (use `globalIgnores` in flat config)
- Root `pnpm lint` → `eslint packages/plugin`

## Local usage
```bash
pnpm install   # from repo root
pnpm lint              # dev: plugin-focused, excludes other monorepo packages
pnpm lint:obsidian-scan # bot-like: scanner ignore list, packages/plugin only
npm run lint:obsidian-scan  # same, via npm (matches CI)
```

Scanner ignore patterns live in `eslint/scanner-ignores.mjs` (from Obsidian team, 2026-06). The review bot uses its own copy of that list and does not read this repo's eslint config. `lint:obsidian-scan` is the closest local approximation for plugin TS.

If you see `ERR_PNPM_BAD_PM_VERSION`, either upgrade pnpm (`npm i -g pnpm@10.8.1`) or rely on `.npmrc` `package-manager-strict=false`. You can also run eslint directly: `./node_modules/.bin/eslint packages/plugin`.

## Remaining work for community review
After setup, lint completes but reports ~2000 violations (no-console, no-restricted-globals/fetch, no-explicit-any, floating promises, etc.). Fix incrementally before resubmitting to obsidian-releases.

## Dynamic script scan (React 19)
ObsidianReviewBot flags `createElement("script")` in release `main.js`. All 3 hits came from bundled **React 19** `react-dom` (hoistable resource APIs), not plugin source. **Fix:** pin plugin to `catalog:react18` (18.3.1) — React 18 client bundle has zero script injections. Verify after build: `grep -c 'createElement("script")' main.js` → 0.
