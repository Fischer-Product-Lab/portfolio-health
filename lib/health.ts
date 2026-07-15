// Portfolio Health — deterministic health engines.
// Scoring rules are specified in docs/portfolio-health-prd.md.
// Pure functions: same inputs → same outputs, with explainable reasons[].
// The UI displays only what these return — bands are never hardcoded.

import type {
  BusinessService,
  Change,
  HealthBand,
  Incident,
  Problem,
  Release,
} from "../data/portfolio-health";

export interface ServiceHealthInput {
  service: BusinessService;
  openIncidents: Incident[]; // already filtered to this service
  openProblems: Problem[];
  recentChanges: Change[]; // open + closed-in-last-30-days (see isRecentChange)
  upcomingReleases: Release[]; // next 14 days for this service
}

export interface ServiceHealthResult {
  band: HealthBand;
  score: number; // 0–100
  reasons: string[]; // 1–4 short explainers
  signals: {
    openP1: number;
    slaRiskIncidents: number;
    overdueRcas: number;
    changeSuccessRate: number | null; // percent; null if no closed changes in window
    highRiskReleases14d: number;
  };
}

export interface PortfolioHealthResult {
  band: HealthBand;
  score: number; // 0–100
  reasons: string[];
  serviceBreakdown: { serviceId: string; band: HealthBand; score: number }[];
}

// ---------------------------------------------------------------------------
// Input derivation helpers (pure predicates over stored records)
// ---------------------------------------------------------------------------

/** An incident is open until it is Resolved or Closed. */
export function isOpenIncident(incident: Incident): boolean {
  return incident.status !== "Resolved" && incident.status !== "Closed";
}

/** A problem is open until it is Closed (Known Error / Monitoring remain open). */
export function isOpenProblem(problem: Problem): boolean {
  return problem.status !== "Closed";
}

/**
 * Recent change window per kit §6.1: currently open (outcome "Open") OR closed
 * within the last 30 days. Records carry ageDays from a fixed snapshot date, so
 * "closed in the last 30 days" is proxied as outcome !== "Open" && ageDays <= 30.
 */
export function isRecentChange(change: Change): boolean {
  return change.outcome === "Open" || change.ageDays <= 30;
}

/** Release calendar date at local midnight. */
export function releaseDate(release: Release): Date {
  const [year, month] = release.month.split("-").map(Number);
  return new Date(year, month - 1, release.day);
}

/** Upcoming = strictly after asOf and within the next 14 days. */
export function isUpcomingRelease(release: Release, asOf: Date): boolean {
  const date = releaseDate(release).getTime();
  const start = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()).getTime();
  const end = start + 14 * 24 * 60 * 60 * 1000;
  return date > start && date <= end;
}

export interface PortfolioRecords {
  incidents: Incident[];
  problems: Problem[];
  changes: Change[];
  releases: Release[];
}

/** Assemble the §6.1 input for one service from the full record set. */
export function deriveServiceHealthInput(
  service: BusinessService,
  records: PortfolioRecords,
  asOf: Date,
): ServiceHealthInput {
  return {
    service,
    openIncidents: records.incidents.filter((item) => item.serviceId === service.id && isOpenIncident(item)),
    openProblems: records.problems.filter((item) => item.serviceId === service.id && isOpenProblem(item)),
    recentChanges: records.changes.filter((item) => item.serviceId === service.id && isRecentChange(item)),
    upcomingReleases: records.releases.filter((item) => item.serviceId === service.id && isUpcomingRelease(item, asOf)),
  };
}

// ---------------------------------------------------------------------------
// 6.1 Service health
// ---------------------------------------------------------------------------

/**
 * Scoring: start at 100, apply deductions, clamp 0–100.
 * - Each open P1: −20
 * - Each SLA-risk incident: −8
 * - Each overdue RCA: −12
 * - Change success rate (Successful / closed changes in window):
 *     < 70% → −20; 70–84% → −10; ≥ 85% or null → 0
 * - Each High-risk release in next 14 days: −10
 *
 * Bands (At Risk evaluated first — the open-P1 / overdue-RCA hard gate wins
 * over any score-based Healthy claim):
 * - At Risk: score < 50 OR openP1 ≥ 1 OR overdueRcas ≥ 2
 * - Healthy: score ≥ 75 AND openP1 === 0
 * - Watch: everything else
 */
export function computeServiceHealth(input: ServiceHealthInput): ServiceHealthResult {
  const openP1 = input.openIncidents.filter((item) => item.priority === "P1").length;
  const slaRiskIncidents = input.openIncidents.filter((item) => item.slaRisk).length;
  const overdueRcas = input.openProblems.filter((item) => item.rcaOverdue).length;

  const closedChanges = input.recentChanges.filter((item) => item.outcome !== "Open");
  const successfulChanges = closedChanges.filter((item) => item.outcome === "Successful").length;
  const changeSuccessRate = closedChanges.length === 0
    ? null
    : Math.round((successfulChanges / closedChanges.length) * 1000) / 10;

  const highRiskReleases14d = input.upcomingReleases.filter((item) => item.risk === "High").length;

  const changeQualityDeduction = changeSuccessRate === null || changeSuccessRate >= 85
    ? 0
    : changeSuccessRate < 70
      ? 20
      : 10;

  const rawScore = 100
    - openP1 * 20
    - slaRiskIncidents * 8
    - overdueRcas * 12
    - changeQualityDeduction
    - highRiskReleases14d * 10;
  const score = Math.min(100, Math.max(0, rawScore));

  const band: HealthBand = score < 50 || openP1 >= 1 || overdueRcas >= 2
    ? "At Risk"
    : score >= 75
      ? "Healthy"
      : "Watch";

  const reasons: string[] = [];
  if (openP1 > 0) reasons.push(`${openP1} open P1 incident${openP1 === 1 ? "" : "s"}`);
  if (overdueRcas > 0) reasons.push(`${overdueRcas} overdue RCA${overdueRcas === 1 ? "" : "s"}`);
  if (slaRiskIncidents > 0) reasons.push(`${slaRiskIncidents} incident${slaRiskIncidents === 1 ? "" : "s"} at SLA risk`);
  if (changeSuccessRate !== null && changeSuccessRate < 85) reasons.push(`Change success ${changeSuccessRate}% in the last 30 days`);
  if (highRiskReleases14d > 0) reasons.push(`${highRiskReleases14d} high-risk release${highRiskReleases14d === 1 ? "" : "s"} in the next 14 days`);
  if (reasons.length === 0) reasons.push("No open P1s, overdue RCAs, SLA-risk incidents, or high-risk releases");

  return {
    band,
    score,
    reasons: reasons.slice(0, 4),
    signals: { openP1, slaRiskIncidents, overdueRcas, changeSuccessRate, highRiskReleases14d },
  };
}

// ---------------------------------------------------------------------------
// 6.2 Portfolio health
// ---------------------------------------------------------------------------

const criticalityWeight: Record<BusinessService["criticality"], number> = {
  "Tier 0": 3,
  "Tier 1": 2,
  "Tier 2": 1,
};

/**
 * Portfolio score = criticality-weighted average of service scores
 * (Tier 0 ×3, Tier 1 ×2, Tier 2 ×1).
 *
 * Portfolio band:
 * - At Risk if any Tier 0 service is At Risk OR portfolio score < 55
 * - Healthy if portfolio score ≥ 75 AND no service is At Risk
 * - Watch otherwise
 *
 * `serviceResults` must be aligned index-for-index with `services`.
 */
export function computePortfolioHealth(
  services: BusinessService[],
  serviceResults: ServiceHealthResult[],
): PortfolioHealthResult {
  const paired = services.map((service, index) => ({ service, result: serviceResults[index] }));

  const totalWeight = paired.reduce((sum, { service }) => sum + criticalityWeight[service.criticality], 0);
  const weightedSum = paired.reduce(
    (sum, { service, result }) => sum + result.score * criticalityWeight[service.criticality],
    0,
  );
  const score = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight);

  const atRisk = paired.filter(({ result }) => result.band === "At Risk");
  const tier0AtRisk = atRisk.filter(({ service }) => service.criticality === "Tier 0");

  const band: HealthBand = tier0AtRisk.length > 0 || score < 55
    ? "At Risk"
    : score >= 75 && atRisk.length === 0
      ? "Healthy"
      : "Watch";

  const totalOpenP1 = paired.reduce((sum, { result }) => sum + result.signals.openP1, 0);
  const totalOverdueRcas = paired.reduce((sum, { result }) => sum + result.signals.overdueRcas, 0);

  const reasons: string[] = [];
  if (tier0AtRisk.length > 0) {
    reasons.push(`Tier 0 at risk: ${tier0AtRisk.map(({ service }) => service.name).join(", ")}`);
  }
  const otherAtRisk = atRisk.filter(({ service }) => service.criticality !== "Tier 0");
  if (otherAtRisk.length > 0) {
    reasons.push(`Also at risk: ${otherAtRisk.map(({ service }) => service.name).join(", ")}`);
  }
  if (totalOpenP1 > 0 || totalOverdueRcas > 0) {
    const parts: string[] = [];
    if (totalOpenP1 > 0) parts.push(`${totalOpenP1} open P1${totalOpenP1 === 1 ? "" : "s"}`);
    if (totalOverdueRcas > 0) parts.push(`${totalOverdueRcas} overdue RCA${totalOverdueRcas === 1 ? "" : "s"}`);
    reasons.push(`${parts.join(" and ")} across the portfolio`);
  }
  if (reasons.length === 0) {
    reasons.push(atRisk.length === 0 ? "No services at risk" : `${atRisk.length} service${atRisk.length === 1 ? "" : "s"} at risk`);
  }

  return {
    band,
    score,
    reasons: reasons.slice(0, 3),
    serviceBreakdown: paired.map(({ service, result }) => ({
      serviceId: service.id,
      band: result.band,
      score: result.score,
    })),
  };
}
