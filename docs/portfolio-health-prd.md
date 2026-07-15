# Portfolio Health — Product Requirements (V1)

**Status:** V1 complete · read-only synthetic demo · live at [portfolio-health-fpl.vercel.app](https://portfolio-health-fpl.vercel.app/)
**Owner:** Fischer Product Lab

## 1. Problem

ITSM tooling produces ticket-count reports; leadership needs an operating view. When incidents, problems, changes, and releases are reported as separate queues, no one can answer the portfolio-level questions: where is operational risk accumulating, is restore/RCA fast enough, how are changes actually closing, and which upcoming releases create near-term pressure.

## 2. Users and jobs

| User | Job |
|---|---|
| Portfolio / operations leader | Decide where to intervene this week, with evidence one click away |
| Service owner | See their service's computed health, the signals driving it, and the records behind each signal |
| Reviewer of this demo | Evaluate the deterministic-scoring approach and the engineering behind it |

## 3. V1 scope (shipped)

- **Portfolio overview** — computed portfolio health (score, band, reasons), leadership watchlist, flow KPIs and 12-month trends, change execution quality, needs-attention queue, 14-day release horizon
- **Service health** — eight business-service scorecards with computed band, score, five engine signals, `reasons[]`, curated operating context, and drill-down into filtered record tables
- **Record tables** — incidents, problems, changes with search/filter, detail drawers, and linked-record lineage
- **Release calendar** — trailing twelve-month calendar/agenda with release drawers and parent-change lineage
- **About & suite** — product framing, methodology, posture, sibling-product links

## 4. Data model

Typed synthetic records in `data/portfolio-health.ts`: `BusinessService` (8 services, Tier 0–2), `Incident`, `Problem`, `Change`, `Release`, `MonthlyFlow`, plus lineage links (`causedByChangeId`, `linkedProblemId`, `permanentFixChangeId`, `linkedReleaseId`, `causedIncidentIds`, `relatedIncidentIds`). Releases carry `REL######` ids with a `changeId` parent; legacy change-id deep links still resolve. Portfolio-level headline KPIs are curated display figures; **service and portfolio bands/scores are always computed from records**.

## 5. Health engine specification (`lib/health.ts`)

### 5.1 Service health — `computeServiceHealth`

Inputs per service: open incidents, open problems, recent changes (open + closed in the last 30 days), releases in the next 14 days.

Score starts at 100 with deductions, clamped to 0–100:

| Signal | Deduction |
|---|---|
| Each open P1 incident | −20 |
| Each SLA-risk incident | −8 |
| Each overdue RCA | −12 |
| Change success rate (Successful / closed in window): < 70% | −20 |
| Change success rate 70–84% | −10 |
| Change success rate ≥ 85% or no closed changes | 0 |
| Each High-risk release in next 14 days | −10 |

Bands (hard gate first): **At Risk** if score < 50 OR open P1 ≥ 1 OR overdue RCAs ≥ 2; **Healthy** if score ≥ 75 AND no open P1; **Watch** otherwise. Every result carries 1–4 human-readable `reasons[]` and a `signals` block.

### 5.2 Portfolio health — `computePortfolioHealth`

Portfolio score = service scores weighted by criticality (Tier 0 ×3, Tier 1 ×2, Tier 2 ×1). Band: **At Risk** if any Tier 0 service is At Risk or score < 55; **Healthy** if score ≥ 75 and no service is At Risk; **Watch** otherwise. Reasons cite the top drivers (named at-risk services, portfolio P1/RCA totals).

### 5.3 Seed expectations (asserted by tests)

The eight seeded services must resolve to: Trading Platform **At Risk**, Client Identity **Watch**, Clearing & Settlement **Watch**, Advisor Portal **Healthy**, Integration Gateway **At Risk**, DevOps Platform **Healthy**, Data & Reporting **Watch**, Mobile Experience **Healthy**. Seed data — never the engine — is adjusted when a service misses its intended band. At least six lineage chains exist, including a change-caused P1 chain (CHG → INC → PRB → fix CHG) and a carried-over change with a rescheduled release.

## 6. Non-goals (V1)

Real ServiceNow integration, authentication/RBAC, write workflows, AI-generated narratives, graph visualizations, table sort/pagination/export, and domain expansion into security inventory or AI-governance metrics (those live in sibling products).

## 7. Success criteria

In a three-minute walkthrough: (1) overview shows a computed score/band with reasons, (2) a Tier 0 service is At Risk with explainable deductions next to a Healthy service, (3) a full change-caused-P1 lineage chain is walkable through drawers, (4) the V1 tables/filters/calendar still work, (5) About states the synthetic posture and links the suite. All `npm test` / `npm run lint` / `npm run build` gates green.
