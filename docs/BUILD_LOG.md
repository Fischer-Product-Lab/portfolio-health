# Portfolio Health — Build Log

## Status

| Field | Value |
|---|---|
| Repo | `Fischer-Product-Lab/portfolio-health` |
| Branch | `main` (production) |
| Live URL | **Not yet deployed publicly** — deployment target pending owner decision (see Deployment notes) |
| Gates | `npm test` (13 tests) · `npm run lint` · `npm run build` · `tsc --noEmit` — all green |

## What V1 is

An executive ITSM operating dashboard over synthetic ServiceNow-style data: computed portfolio/service health with explainable reasons, record tables with lineage-linked drawers, a trailing twelve-month release calendar, and an About/suite view. Read-only, synthetic-only, no env vars. See `docs/portfolio-health-prd.md` and `docs/highlights.md`.

## Architecture decisions

- **Deterministic engines as the centerpiece.** `lib/health.ts` exposes `computeServiceHealth` and `computePortfolioHealth` — pure functions with deduction-based scoring, hard governance gates (open P1 / ≥2 overdue RCAs force At Risk), and `reasons[]`. The UI renders only engine output; bands are never stored or hand-typed.
- **Typed data module as single source of truth.** All records live in `data/portfolio-health.ts`; thin display adapters in `app/page.tsx` preserve the original UI's row shapes, filters, and drawers.
- **Seed-not-engine tuning.** Each of the eight seeded services must resolve to an intended band (asserted in tests). When a service missed its band during development, seed records were adjusted — the scoring rules were never bent.
- **Release identity with compatibility.** Releases moved from change-id keys to `REL######` ids with a `changeId` parent; calendar deep links resolve either id, so pre-existing URLs keep working.
- **Curated headlines vs computed truth.** Portfolio-level headline KPI figures are curated display values; anything presented as a health verdict (band, score, signals, reasons) is computed.

## Toolchain notes

- **Runtime:** Next.js App Router via [vinext](https://github.com/cloudflare/vinext) (Vite-based), React 19, TypeScript strict, npm. This differs from the suite's stock-Next siblings; the toolchain was intentionally preserved rather than migrated during V1.
- **Tests:** Node's built-in runner imports the TypeScript sources directly. On Node 22 this requires `--experimental-strip-types` (harmless no-op on Node ≥ 23). Type-only imports use `import type` so stripped modules stay runnable.
- **Windows quirk:** `node --test <directory>` failed to resolve on Windows; test files are listed explicitly in the `test` script.
- **Project location:** keep the working copy outside OneDrive — sync locks on generated directories cause build failures.

## Deployment notes (owner decision pending)

`npm run build` produces a Cloudflare-workers-style output (`dist/`), not a stock `next build` output. That means a plain Vercel import of this repo will **not** deploy as-is. Options, in rough order of effort:

1. **Keep current private hosting** (works today; not public).
2. **Deploy the worker to Cloudflare** (Workers/Pages via wrangler) — closest to the current build output.
3. **Migrate scripts to stock `next build`** for a standard Vercel deploy matching the suite's siblings — a contained follow-up PR (swap `vinext` scripts, verify SSR/SSG behavior, drop worker-specific config).

No public live URL is claimed until the owner confirms a deploy. When one exists, update: `README.md` (header), this file's status block, `docs/portfolio-health-prd.md` (status line), `docs/highlights.md`, and the About view if the suite links change.

## GitHub hardening

- `.github/dependabot.yml` — weekly npm + github-actions updates, grouped minor/patch
- `.github/workflows/codeql.yml` — CodeQL on push/PR to `main` + weekly schedule
- Vulnerability alerts + automated security fixes enabled via API; secret scanning per org defaults
- Squash-merge-only posture on `main`; no force-push

## Build order (as executed)

1. Typed data extraction from the single-page prototype into `data/`
2. Deterministic engines + tests (`lib/health.ts`, `tests/health.test.mjs`) — bands asserted before UI wiring
3. Overview wired to computed portfolio health; service scorecards hardened with engine signals and reasons
4. Drawer lineage (incident ↔ problem ↔ change ↔ release) with clickable navigation
5. About & suite view; sidebar suite links
6. README / SECURITY.md / threat model; public packaging (this log)
