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

- **Runtime:** Next.js App Router (stock `next build` with `output: "export"` — fully static site in `out/`), React 19, TypeScript strict, npm. V1 was originally built on a Vite-based Next runtime and migrated to stock Next for the public Vercel deploy; the app code needed only one change (static `metadata` instead of request-header-derived OpenGraph URLs, which are incompatible with static export).
- **Tests:** Node's built-in runner imports the TypeScript sources directly. On Node 22 this requires `--experimental-strip-types` (harmless no-op on Node ≥ 23). Type-only imports use `import type` so stripped modules stay runnable. The rendered-HTML test asserts against the exported `out/index.html` — the actual deployable artifact.
- **Windows quirk:** `node --test <directory>` failed to resolve on Windows; test files are listed explicitly in the `test` script.
- **Project location:** keep the working copy outside OneDrive — sync locks on generated directories cause build failures.

## Deployment notes

The build is a fully static export — a standard Vercel import of this repo deploys with defaults (framework auto-detected, no env vars). Steps: [vercel.com/new](https://vercel.com/new) → import `Fischer-Product-Lab/portfolio-health` → Deploy. Every push to `main` auto-redeploys.

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
