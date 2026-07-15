# Portfolio Health

**Operational health, in one decision-ready view.**

Portfolio Health is an executive ITSM operating dashboard from **Fischer Product Lab**. It presents fictional ServiceNow-style incident, problem, change, and release data as a consolidated leadership view — flow, outcomes, risk, ownership, trend, and release timing — so a portfolio manager can move from awareness to accountability instead of reading ticket-count reports.

> **Synthetic demonstration.** Every record in this product is fictional. The ServiceNow feed indicator is simulated; there is no live integration, no authentication, and no write path. The app displays a persistent DEMO badge and synthetic-data labels in the shell.

## Screens

| View | What it answers |
|---|---|
| **Portfolio overview** | Computed portfolio health (score, band, reasons), leadership watchlist, ITSM flow KPIs, operational trends, change execution quality, needs-attention queue, 14-day release horizon |
| **Service health** | Eight business-service scorecards with computed bands, engine signals, "why this band" reasons, and drill-down into each service's records |
| **Incidents / Problems / Changes** | Filterable record tables with detail drawers, SLA/RCA risk notes, change outcomes, and linked-record lineage |
| **Release calendar** | Trailing twelve-month production release calendar (calendar and agenda modes) with readiness, risk, and validation conditions |
| **About & suite** | Product framing, scoring methodology, synthetic/read-only posture, and links to the sibling products |

## How the health score works

Bands and scores are **deterministic** — pure functions in [`lib/health.ts`](lib/health.ts) over the typed records in [`data/portfolio-health.ts`](data/portfolio-health.ts), with explainable `reasons[]`. Nothing is hand-scored and nothing is AI-generated.

Each service starts at 100 and takes deductions:

| Signal | Deduction |
|---|---|
| Each open P1 incident | −20 |
| Each SLA-risk incident | −8 |
| Each overdue RCA | −12 |
| 30-day change success < 70% / 70–84% | −20 / −10 |
| Each high-risk release in the next 14 days | −10 |

Bands: **At Risk** if score < 50, any open P1, or ≥ 2 overdue RCAs (a hard gate that overrides the score); **Healthy** if score ≥ 75 with no open P1; **Watch** otherwise. The portfolio score is the criticality-weighted average of service scores (Tier 0 ×3, Tier 1 ×2, Tier 2 ×1), and the portfolio goes At Risk whenever any Tier 0 service does. Unit tests assert every seeded service's band, portfolio stability, engine rules, and lineage integrity.

## Commands

Requires Node.js `>= 22.13.0`.

```bash
npm install     # install dependencies
npm run dev     # local development server
npm test        # production build + unit tests (engines, bands, lineage, rendered HTML)
npm run lint    # ESLint
npm run build   # production build (vinext)
```

## Project structure

- `app/` — Next.js App Router UI (single-page shell, views, drawers, calendar) and the warm-paper/navy visual system in `globals.css`
- `data/portfolio-health.ts` — typed synthetic dataset: business services, records, releases, monthly flow, lineage seeds
- `lib/health.ts` — deterministic service and portfolio health engines
- `tests/` — engine/band/lineage tests and rendered-HTML smoke tests
- `docs/` — [PRD](docs/portfolio-health-prd.md), [highlights](docs/highlights.md), [build log](docs/BUILD_LOG.md), and [threat model](docs/threat-model.md)

Toolchain: Next.js App Router via [vinext](https://github.com/cloudflare/vinext) (Vite), TypeScript strict mode, no database and no API routes in this increment.

## Fischer Product Lab suite

Portfolio Health is the operations pillar of a suite that turns noisy enterprise reality into governed, decision-quality executive signal:

| Product | Role | Live |
|---|---|---|
| [AgentOps](https://agentops-fpl.vercel.app/) | AI agent governance — is this agent safe to launch? | ✔ |
| [ProductPulse](https://productpulse-fpl.vercel.app/) | Product analytics — did the shipped initiative actually work? | ✔ |
| [TrustDesk](https://trustdesk-fpl.vercel.app/) | Customer trust questionnaire automation at scale | ✔ |
| [VulnBoard](https://vuln-board.vercel.app/) | Executive vulnerability metrics — where is security risk concentrated? | ✔ |

Security depth lives in VulnBoard and AI governance in AgentOps; Portfolio Health links out rather than re-implementing those domains.

## Security

Read-only synthetic demo: no real data, no secrets, no live integrations. See [SECURITY.md](SECURITY.md) and the [threat model](docs/threat-model.md).
