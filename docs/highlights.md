# Portfolio Health — Highlights

## Overview

Portfolio Health is an executive ITSM operating dashboard: fictional ServiceNow-style incident, problem, change, and release data presented as one decision-ready leadership view. It is the operations pillar of the Fischer Product Lab suite.

## The problem it demonstrates

Enterprise ITSM reporting is queue-shaped, not decision-shaped. Leaders get ticket counts per tool and per team, but not a defensible answer to "which business service needs intervention this week, and why." Portfolio Health shows what that answer looks like when health is computed, explainable, and linked to evidence.

## What it does

- Computes a portfolio health score and band from eight business-service scorecards, weighted by service criticality
- Explains every band with `reasons[]` — open P1s, SLA-risk incidents, overdue RCAs, 30-day change success, high-risk releases in the next 14 days
- Links records across their lifecycle: change-caused incidents, incident → problem → permanent-fix change → release lineage, walkable through detail drawers
- Preserves click-through from every summary number to the filtered records behind it
- Shows a trailing twelve-month release calendar with readiness, risk, and validation conditions

## Engine thesis

**Deterministic over generative.** Bands and scores are pure functions over typed records (`lib/health.ts`): same inputs, same outputs, with hard governance gates (an open P1 or two overdue RCAs force At Risk regardless of score). Nothing is hand-scored, nothing is AI-generated, and the UI can only display what the engine returns. Unit tests assert every seeded service's band, portfolio stability, engine edge cases, and lineage integrity.

## Engineering highlights

- Typed synthetic data model as a single source of truth, with display adapters preserving the shipped UI's behavior
- Deterministic scoring engines with explainable output, covered by Node's built-in test runner against the TypeScript sources
- Shareable view/filter deep links (including backward-compatible release ids), accessible modal drawers with focus management, canvas trend charts
- Read-only by construction: no forms, no write paths, no auth, no env vars

## Security highlights

- Synthetic data only, labeled in the UI with a persistent DEMO badge and a simulated feed indicator
- No secrets anywhere in the repo or bundle; no runtime egress beyond four sibling-product hyperlinks
- STRIDE threat model (`docs/threat-model.md`), security policy (`SECURITY.md`), Dependabot + CodeQL + secret scanning on the repository
