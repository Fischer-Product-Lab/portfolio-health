// Portfolio Health — release-intelligence engines (Increment 2).
// Pure, deterministic functions over the stored data model: collision
// detection, blackout/change-freeze checks, readiness assessment, owner /
// tier concentration, the weekly leadership brief, and the decision register.
// Findings and readiness states are never stored — the UI displays only what
// these functions return.

import type {
  BlackoutWindow,
  BusinessService,
  Change,
  FreezeException,
  Incident,
  LineageStory,
  Release,
} from "../data/portfolio-health";
import type { PortfolioHealthResult, ServiceHealthResult } from "./health";

// Same derivation as lib/health.ts releaseDate — kept local (type-only imports
// between modules) so tests can run each engine file under Node type-stripping.
function releaseDate(release: Release): Date {
  const [year, month] = release.month.split("-").map(Number);
  return new Date(year, month - 1, release.day);
}

// Release-intelligence looks slightly further out than the 14-day health
// deduction window: leadership reviews the coming three weeks of the calendar.
export const INTELLIGENCE_HORIZON_DAYS = 21;

// Minimum recovery time between consecutive releases on the same service
// before the gap itself becomes a finding.
export const RECOVERY_GAP_HOURS = 24;

export type FindingKind = "collision" | "blackout" | "readiness";
export type FindingSeverity = "High" | "Moderate" | "Low";

export interface ReleaseFinding {
  id: string; // stable per rule + records, usable as a React key
  kind: FindingKind;
  rule: string; // short rule label shown as the finding eyebrow
  severity: FindingSeverity;
  releaseIds: string[];
  serviceIds: string[];
  summary: string; // one-line leadership summary
  detail: string; // the evidence behind the finding
  recommendation: string; // suggested next action
}

export type ReadinessState = "Ready" | "Ready with conditions" | "Action required" | "Blocked";

export interface ReadinessChecklistItem {
  label: string;
  ok: boolean;
}

export interface ReleaseReadiness {
  releaseId: string;
  state: ReadinessState;
  checklist: ReadinessChecklistItem[];
  reasons: string[]; // present only when state !== "Ready"
}

// ---------------------------------------------------------------------------
// Release window intervals
// ---------------------------------------------------------------------------

// Window strings are stored as "8:30 PM–10:30 PM CT". Timestamps are derived
// here (single source of truth) rather than duplicated on each record.
function parseClock(text: string): { hours: number; minutes: number } {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error(`Unparseable release window time: "${text}"`);
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return { hours, minutes: Number(match[2]) };
}

/** Start/end instants for a release window; end rolls to the next day when the window crosses midnight. */
export function releaseInterval(release: Release): { start: Date; end: Date } {
  const day = releaseDate(release);
  const [startText, endText] = release.window.replace(/\s*CT\s*$/i, "").split("–");
  const startClock = parseClock(startText);
  const endClock = parseClock(endText);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startClock.hours, startClock.minutes);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endClock.hours, endClock.minutes);
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Horizon = strictly after asOf and within the next INTELLIGENCE_HORIZON_DAYS days. */
export function isHorizonRelease(release: Release, asOf: Date): boolean {
  const date = releaseDate(release).getTime();
  const start = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()).getTime();
  return date > start && date <= start + INTELLIGENCE_HORIZON_DAYS * 24 * 60 * 60 * 1000;
}

function intervalsOverlap(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

const shortDate = (date: Date): string =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

/**
 * Deterministic collision rules over horizon releases:
 * 1. Same-service overlap — two windows on one business service overlap in time.
 * 2. Shared-dependency overlap — windows on different services overlap while
 *    touching the same dependency.
 * 3. Insufficient recovery gap — consecutive windows on one service are less
 *    than RECOVERY_GAP_HOURS apart, leaving no validation/rollback headroom.
 */
export function detectCollisions(
  releases: Release[],
  services: BusinessService[],
  asOf: Date,
): ReleaseFinding[] {
  const horizon = releases
    .filter((release) => isHorizonRelease(release, asOf))
    .sort((a, b) => releaseInterval(a).start.getTime() - releaseInterval(b).start.getTime());
  const serviceName = (id: string) => services.find((service) => service.id === id)?.name ?? id;
  const findings: ReleaseFinding[] = [];

  for (let i = 0; i < horizon.length; i += 1) {
    for (let j = i + 1; j < horizon.length; j += 1) {
      const a = horizon[i];
      const b = horizon[j];
      const ia = releaseInterval(a);
      const ib = releaseInterval(b);
      const severity: FindingSeverity = a.risk === "High" || b.risk === "High" ? "High" : "Moderate";

      if (a.serviceId === b.serviceId && intervalsOverlap(ia, ib)) {
        findings.push({
          id: `COL-OVERLAP-${a.id}-${b.id}`,
          kind: "collision",
          rule: "Same-service overlap",
          severity,
          releaseIds: [a.id, b.id],
          serviceIds: [a.serviceId],
          summary: `${a.id} and ${b.id} overlap on ${serviceName(a.serviceId)} (${shortDate(ia.start)})`,
          detail: `"${a.title}" (${a.window}) and "${b.title}" (${b.window}) run concurrently on the same business service, so a failure in either window cannot be isolated or rolled back independently.`,
          recommendation: "Sequence the windows so the second release starts only after the first is validated.",
        });
        continue;
      }

      if (a.serviceId !== b.serviceId && intervalsOverlap(ia, ib)) {
        const shared = a.governance.dependencies.filter((dep) => b.governance.dependencies.includes(dep));
        if (shared.length > 0) {
          findings.push({
            id: `COL-DEP-${a.id}-${b.id}`,
            kind: "collision",
            rule: "Shared-dependency overlap",
            severity,
            releaseIds: [a.id, b.id],
            serviceIds: [a.serviceId, b.serviceId],
            summary: `${a.id} and ${b.id} both touch ${shared.join(", ")} in overlapping windows (${shortDate(ia.start)})`,
            detail: `"${a.title}" on ${serviceName(a.serviceId)} and "${b.title}" on ${serviceName(b.serviceId)} change the shared dependency ${shared.join(" and ")} at the same time, which confounds root-cause isolation if either degrades.`,
            recommendation: "Stagger the windows or nominate one release to own the shared dependency for the night.",
          });
        }
        continue;
      }

      if (a.serviceId === b.serviceId) {
        const gapMs = Math.max(ib.start.getTime() - ia.end.getTime(), ia.start.getTime() - ib.end.getTime());
        const gapHours = gapMs / (60 * 60 * 1000);
        if (gapHours < RECOVERY_GAP_HOURS) {
          findings.push({
            id: `COL-GAP-${a.id}-${b.id}`,
            kind: "collision",
            rule: "Insufficient recovery gap",
            severity: "Moderate",
            releaseIds: [a.id, b.id],
            serviceIds: [a.serviceId],
            summary: `${Math.round(gapHours)}h between ${a.id} and ${b.id} on ${serviceName(a.serviceId)}`,
            detail: `"${b.title}" starts about ${Math.round(gapHours)} hours after "${a.title}" ends — under the ${RECOVERY_GAP_HOURS}-hour recovery standard, leaving little room to validate the first release or roll it back before the second begins.`,
            recommendation: `Confirm the first window's validation evidence before go/no-go, or move the second window to restore a ${RECOVERY_GAP_HOURS}-hour gap.`,
          });
        }
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Blackout / change-freeze checks
// ---------------------------------------------------------------------------

function windowInterval(window: BlackoutWindow): { start: Date; end: Date } {
  return { start: new Date(window.startsAt), end: new Date(window.endsAt) };
}

function windowCovers(window: BlackoutWindow, serviceId: string): boolean {
  return window.scope === "all" || window.scope.includes(serviceId);
}

/**
 * Flags horizon releases that intersect a blackout / change-freeze window in
 * scope for their service:
 * - inside a window without an approved exception → High (schedule violation)
 * - inside a window whose approved exception lapses before the release → Moderate
 * - partial overlap without an exception → severity follows release risk
 */
export function detectBlackoutFindings(
  releases: Release[],
  windows: BlackoutWindow[],
  exceptions: FreezeException[],
  asOf: Date,
): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];

  for (const release of releases.filter((item) => isHorizonRelease(item, asOf))) {
    const interval = releaseInterval(release);
    for (const window of windows) {
      if (!windowCovers(window, release.serviceId)) continue;
      const freeze = windowInterval(window);
      if (!intervalsOverlap(interval, freeze)) continue;

      const fullyInside = interval.start.getTime() >= freeze.start.getTime()
        && interval.end.getTime() <= freeze.end.getTime();
      const exception = exceptions.find(
        (item) => item.windowId === window.id && item.releaseId === release.id && item.status === "Approved",
      );
      const exceptionLapsed = exception !== undefined
        && new Date(exception.expiresAt).getTime() < interval.start.getTime();

      if (exception && !exceptionLapsed) continue; // operating under a valid approved exception

      if (exception && exceptionLapsed) {
        findings.push({
          id: `BLK-LAPSE-${window.id}-${release.id}`,
          kind: "blackout",
          rule: "Freeze exception lapses",
          severity: "Moderate",
          releaseIds: [release.id],
          serviceIds: [release.serviceId],
          summary: `${release.id} exception ${exception.id} expires ${shortDate(new Date(exception.expiresAt))}, before the ${shortDate(interval.start)} window`,
          detail: `"${release.title}" sits inside ${window.name} (${window.id}). Exception ${exception.id} was approved by ${exception.approver} but expires before the release window opens, so the release would execute without freeze cover.`,
          recommendation: `Renew ${exception.id} with the ${window.owner} before ${shortDate(new Date(exception.expiresAt))}, or reschedule outside the freeze.`,
        });
        continue;
      }

      findings.push({
        id: `BLK-${fullyInside ? "IN" : "PART"}-${window.id}-${release.id}`,
        kind: "blackout",
        rule: fullyInside ? "Scheduled inside freeze" : "Overlaps freeze boundary",
        severity: fullyInside ? "High" : release.risk === "High" ? "High" : "Moderate",
        releaseIds: [release.id],
        serviceIds: [release.serviceId],
        summary: `${release.id} ${fullyInside ? "falls inside" : "overlaps"} ${window.name} (${shortDate(freeze.start)}–${shortDate(freeze.end)}) with no exception`,
        detail: `"${release.title}" is scheduled ${release.window} on ${shortDate(interval.start)}, ${fullyInside ? "entirely within" : "partially overlapping"} ${window.name}: ${window.policyReason}`,
        recommendation: fullyInside
          ? `Reschedule outside the freeze or obtain an approved exception from the ${window.owner}.`
          : `Shift the window clear of the freeze boundary or confirm an exception with the ${window.owner}.`,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Readiness assessment
// ---------------------------------------------------------------------------

/**
 * Readiness ladder (evaluated top-down; first match wins):
 * - Blocked — inside an in-scope freeze without a valid approved exception,
 *   or High risk with no rollback plan.
 * - Action required — approval outstanding, two or more evidence gaps, a
 *   lapsing freeze exception, or a partial freeze overlap without exception.
 * - Ready with conditions — exactly one evidence gap.
 * - Ready — approval in place and every checklist item present.
 */
export function assessReadiness(
  release: Release,
  windows: BlackoutWindow[],
  exceptions: FreezeException[],
): ReleaseReadiness {
  const gov = release.governance;
  const approvalOk = gov.approval !== "Pending";
  const checklist: ReadinessChecklistItem[] = [
    { label: gov.approval === "Not required" ? "Approval (not required)" : "CAB approval", ok: approvalOk },
    { label: "Implementation plan", ok: gov.implementationPlan },
    { label: "Validation evidence", ok: gov.validationEvidence },
    { label: "Rollback plan", ok: gov.rollbackPlan },
    { label: "Business owner acknowledgement", ok: gov.businessOwnerAck },
    { label: "Dependencies confirmed", ok: gov.dependencyConfirmed },
  ];
  const evidenceGaps = checklist.slice(1).filter((item) => !item.ok);
  const reasons: string[] = [];

  const interval = releaseInterval(release);
  let insideFreezeUncovered = false;
  let partialFreezeUncovered = false;
  let exceptionLapses = false;
  for (const window of windows) {
    if (!windowCovers(window, release.serviceId)) continue;
    const freeze = windowInterval(window);
    if (!intervalsOverlap(interval, freeze)) continue;
    const exception = exceptions.find(
      (item) => item.windowId === window.id && item.releaseId === release.id && item.status === "Approved",
    );
    if (exception && new Date(exception.expiresAt).getTime() >= interval.start.getTime()) continue;
    if (exception) {
      exceptionLapses = true;
      reasons.push(`Freeze exception ${exception.id} for ${window.name} expires before the release window`);
      continue;
    }
    const fullyInside = interval.start.getTime() >= freeze.start.getTime()
      && interval.end.getTime() <= freeze.end.getTime();
    if (fullyInside) {
      insideFreezeUncovered = true;
      reasons.push(`Scheduled inside ${window.name} without an approved exception`);
    } else {
      partialFreezeUncovered = true;
      reasons.push(`Window overlaps ${window.name} without an approved exception`);
    }
  }

  if (release.risk === "High" && !gov.rollbackPlan) reasons.push("High-risk release without a rollback plan");
  if (!approvalOk) reasons.push("CAB approval outstanding");
  for (const gap of evidenceGaps) {
    if (gap.label !== "Rollback plan" || release.risk !== "High") reasons.push(`${gap.label} missing`);
  }

  const state: ReadinessState = insideFreezeUncovered || (release.risk === "High" && !gov.rollbackPlan)
    ? "Blocked"
    : !approvalOk || evidenceGaps.length >= 2 || exceptionLapses || partialFreezeUncovered
      ? "Action required"
      : evidenceGaps.length === 1
        ? "Ready with conditions"
        : "Ready";

  return { releaseId: release.id, state, checklist, reasons: state === "Ready" ? [] : reasons };
}

/** Readiness for every horizon release, keyed for the UI. */
export function assessHorizonReadiness(
  releases: Release[],
  windows: BlackoutWindow[],
  exceptions: FreezeException[],
  asOf: Date,
): ReleaseReadiness[] {
  return releases
    .filter((release) => isHorizonRelease(release, asOf))
    .map((release) => assessReadiness(release, windows, exceptions));
}

/**
 * Readiness gaps (Blocked / Action required) surfaced as findings alongside
 * collisions and blackouts. Assessed here without freeze windows so that
 * purely freeze-driven states stay owned by detectBlackoutFindings and are
 * not reported twice.
 */
export function detectReadinessFindings(releases: Release[], asOf: Date): ReleaseFinding[] {
  const findings: ReleaseFinding[] = [];
  for (const release of releases.filter((item) => isHorizonRelease(item, asOf))) {
    const readiness = assessReadiness(release, [], []);
    if (readiness.state !== "Blocked" && readiness.state !== "Action required") continue;
    findings.push({
      id: `RDY-${release.id}`,
      kind: "readiness",
      rule: readiness.state === "Blocked" ? "Release blocked" : "Readiness gap",
      severity: readiness.state === "Blocked" ? "High" : "Moderate",
      releaseIds: [release.id],
      serviceIds: [release.serviceId],
      summary: `${release.id} is ${readiness.state === "Blocked" ? "blocked" : "not ready"}: ${readiness.reasons[0] ?? "governance evidence incomplete"}`,
      detail: `"${release.title}" (${shortDate(releaseInterval(release).start)}) — ${readiness.reasons.join("; ")}.`,
      recommendation: readiness.state === "Blocked"
        ? "Resolve the blocking condition before the window; do not proceed as scheduled."
        : "Close the outstanding governance items before the go/no-go checkpoint.",
    });
  }
  return findings;
}

/** All findings, ordered High → Moderate → Low, then by first release id. */
export function detectAllFindings(
  releases: Release[],
  services: BusinessService[],
  windows: BlackoutWindow[],
  exceptions: FreezeException[],
  asOf: Date,
): ReleaseFinding[] {
  const severityRank: Record<FindingSeverity, number> = { High: 0, Moderate: 1, Low: 2 };
  return [
    ...detectCollisions(releases, services, asOf),
    ...detectBlackoutFindings(releases, windows, exceptions, asOf),
    ...detectReadinessFindings(releases, asOf),
  ].sort((a, b) =>
    severityRank[a.severity] - severityRank[b.severity]
    || a.releaseIds[0].localeCompare(b.releaseIds[0]),
  );
}

// ---------------------------------------------------------------------------
// Concentration (owner / Tier 0 / single-service load)
// ---------------------------------------------------------------------------

export interface ConcentrationGroup {
  kind: "owner" | "tier0" | "service";
  label: string;
  releaseIds: string[];
  highRiskCount: number;
  note: string;
}

/**
 * Concentration rules over horizon releases:
 * - Owner: one owner holds 2+ releases of which 2+ are High risk.
 * - Tier 0: 2+ High-risk releases land on Tier 0 services in the horizon.
 * - Service: a single service has 3+ releases in the horizon.
 */
export function detectConcentrations(
  releases: Release[],
  services: BusinessService[],
  asOf: Date,
): ConcentrationGroup[] {
  const horizon = releases.filter((release) => isHorizonRelease(release, asOf));
  const groups: ConcentrationGroup[] = [];

  const byOwner = new Map<string, Release[]>();
  for (const release of horizon) {
    byOwner.set(release.owner, [...(byOwner.get(release.owner) ?? []), release]);
  }
  for (const [owner, owned] of [...byOwner.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const high = owned.filter((release) => release.risk === "High");
    if (owned.length >= 2 && high.length >= 2) {
      groups.push({
        kind: "owner",
        label: owner,
        releaseIds: owned.map((release) => release.id),
        highRiskCount: high.length,
        note: `${owner} carries ${high.length} high-risk windows in the next ${INTELLIGENCE_HORIZON_DAYS} days — a single point of failure for preparation and on-call cover.`,
      });
    }
  }

  const tier0Ids = new Set(services.filter((service) => service.criticality === "Tier 0").map((service) => service.id));
  const tier0Releases = horizon.filter((release) => tier0Ids.has(release.serviceId));
  const tier0High = tier0Releases.filter((release) => release.risk === "High");
  if (tier0High.length >= 2) {
    groups.push({
      kind: "tier0",
      label: "Tier 0 services",
      releaseIds: tier0Releases.map((release) => release.id),
      highRiskCount: tier0High.length,
      note: `${tier0Releases.length} releases land on Tier 0 services in the next ${INTELLIGENCE_HORIZON_DAYS} days, ${tier0High.length} of them high risk — the portfolio's most critical services absorb the most change.`,
    });
  }

  const byService = new Map<string, Release[]>();
  for (const release of horizon) {
    byService.set(release.serviceId, [...(byService.get(release.serviceId) ?? []), release]);
  }
  for (const [serviceId, list] of [...byService.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length >= 3) {
      const name = services.find((service) => service.id === serviceId)?.name ?? serviceId;
      groups.push({
        kind: "service",
        label: name,
        releaseIds: list.map((release) => release.id),
        highRiskCount: list.filter((release) => release.risk === "High").length,
        note: `${name} takes ${list.length} release windows in the next ${INTELLIGENCE_HORIZON_DAYS} days — validate each window independently before approving the sequence.`,
      });
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Decision register
// ---------------------------------------------------------------------------

export interface DecisionEntry {
  id: string; // DEC-##, stable ordering by due date then id
  title: string;
  owner: string;
  due: string; // display date, e.g. "Jul 13"
  status: "Due this week" | "Open";
  consequence: string; // what happens if the decision is not made
  refs: { id: string; view: "incidents" | "problems" | "changes" | "releases" }[];
}

export interface DecisionRegisterInput {
  releases: Release[];
  windows: BlackoutWindow[];
  exceptions: FreezeException[];
  lineage: LineageStory[];
  asOf: Date;
}

/**
 * The register is derived, not stored: release-governance gaps and freeze
 * conflicts each demand a named decision, and the curated lineage stories
 * carry their own leadership decisions. Sorted by due date.
 */
export function deriveDecisionRegister(input: DecisionRegisterInput): DecisionEntry[] {
  const { releases, windows, exceptions, lineage, asOf } = input;
  const weekEnd = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() + 7);
  const entries: Omit<DecisionEntry, "id" | "status">[] = [];

  for (const story of lineage) {
    entries.push({
      title: story.decision,
      owner: story.owner,
      due: story.due,
      consequence: story.impact,
      refs: story.items.map((item) => ({ id: item.id, view: item.view })),
    });
  }

  for (const release of releases.filter((item) => isHorizonRelease(item, asOf))) {
    const readiness = assessReadiness(release, windows, exceptions);
    if (readiness.state === "Ready") continue;
    const start = releaseInterval(release).start;
    const due = shortDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1));
    if (readiness.state === "Blocked") {
      entries.push({
        title: `Reschedule or exempt ${release.id} (${release.title})`,
        owner: release.owner,
        due,
        consequence: readiness.reasons[0] ?? "Release executes in violation of freeze policy",
        refs: [{ id: release.id, view: "releases" }],
      });
    } else if (readiness.state === "Action required") {
      entries.push({
        title: `Clear readiness gaps for ${release.id} (${release.title})`,
        owner: release.owner,
        due,
        consequence: `${readiness.reasons.join("; ")} — window proceeds without full governance cover`,
        refs: [{ id: release.id, view: "releases" }],
      });
    }
  }

  const dueTime = (due: string): number => {
    const parsed = new Date(`${due}, ${asOf.getFullYear()}`);
    return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
  };

  return entries
    .sort((a, b) => dueTime(a.due) - dueTime(b.due) || a.title.localeCompare(b.title))
    .map((entry, index) => ({
      ...entry,
      id: `DEC-${String(index + 1).padStart(2, "0")}`,
      status: dueTime(entry.due) <= weekEnd.getTime() ? "Due this week" : "Open",
    }));
}

// ---------------------------------------------------------------------------
// Weekly leadership brief
// ---------------------------------------------------------------------------

export interface BriefItem {
  text: string;
  refs: { id: string; view: "incidents" | "problems" | "changes" | "releases" | "services" }[];
}

export interface BriefSection {
  title: string;
  items: BriefItem[];
}

export interface WeeklyBrief {
  periodLabel: string; // e.g. "Week ending Jul 9, 2026"
  headline: string;
  sections: BriefSection[];
}

export interface WeeklyBriefInput {
  asOf: Date;
  services: BusinessService[];
  serviceResults: ServiceHealthResult[]; // aligned index-for-index with services
  portfolio: PortfolioHealthResult;
  incidents: Incident[];
  changes: Change[];
  releases: Release[];
  findings: ReleaseFinding[];
  register: DecisionEntry[];
}

const longDate = (date: Date): string =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * Assembles the weekly leadership brief from already-computed engine outputs.
 * Every line traces to record ids; nothing here is scored or invented.
 */
export function deriveWeeklyBrief(input: WeeklyBriefInput): WeeklyBrief {
  const { asOf, services, serviceResults, portfolio, incidents, changes, releases, findings, register } = input;
  const weekStart = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() - 7);

  const posture: BriefItem[] = [
    {
      text: `Portfolio health is ${portfolio.band} (${portfolio.score}/100): ${portfolio.reasons.join("; ")}.`,
      refs: [],
    },
    ...services
      .map((service, index) => ({ service, result: serviceResults[index] }))
      .filter(({ result }) => result.band !== "Healthy")
      .map(({ service, result }) => ({
        text: `${service.name} is ${result.band} (${result.score}) — ${result.reasons[0]}.`,
        refs: [{ id: service.id, view: "services" as const }],
      })),
  ];

  const changed: BriefItem[] = [];
  for (const incident of incidents) {
    if (incident.priority !== "P1") continue;
    const opened = new Date(incident.opened);
    if (opened.getTime() >= weekStart.getTime()) {
      changed.push({
        text: `P1 ${incident.id} opened ${incident.openedLabel} on ${serviceLabel(services, incident.serviceId)}: ${incident.title} (${incident.status}).`,
        refs: [{ id: incident.id, view: "incidents" }],
      });
    }
  }
  for (const change of changes) {
    if ((change.outcome === "Failed" || change.outcome === "Closed with issues") && change.ageDays <= 7) {
      changed.push({
        text: `${change.id} closed ${change.outcome.toLowerCase()} on ${serviceLabel(services, change.serviceId)}: ${change.title}.`,
        refs: [{ id: change.id, view: "changes" }],
      });
    }
  }
  for (const release of releases) {
    if (release.status !== "Complete") continue;
    const date = releaseDate(release);
    if (date.getTime() >= weekStart.getTime() && date.getTime() <= asOf.getTime()) {
      changed.push({
        text: `${release.id} (${release.title}) completed ${shortDate(date)} on ${serviceLabel(services, release.serviceId)}.`,
        refs: [{ id: release.id, view: "releases" }],
      });
    }
  }

  const highFindings = findings.filter((finding) => finding.severity === "High");
  const outlook: BriefItem[] = [
    {
      text: `${releases.filter((release) => isHorizonRelease(release, asOf)).length} releases are scheduled in the next ${INTELLIGENCE_HORIZON_DAYS} days; the engines flag ${findings.length} findings (${highFindings.length} high severity).`,
      refs: [],
    },
    ...findings.slice(0, 5).map((finding) => ({
      text: `${finding.rule}: ${finding.summary}.`,
      refs: finding.releaseIds.map((id) => ({ id, view: "releases" as const })),
    })),
  ];

  const decisions: BriefItem[] = register
    .filter((entry) => entry.status === "Due this week")
    .map((entry) => ({
      text: `${entry.id} — ${entry.title} (${entry.owner}, due ${entry.due}).`,
      refs: entry.refs,
    }));

  return {
    periodLabel: `Week ending ${longDate(asOf)}`,
    headline: `Portfolio is ${portfolio.band} with ${highFindings.length} high-severity release finding${highFindings.length === 1 ? "" : "s"} and ${decisions.length} decision${decisions.length === 1 ? "" : "s"} due this week.`,
    sections: [
      { title: "Portfolio posture", items: posture },
      { title: "What changed this week", items: changed },
      { title: `Next ${INTELLIGENCE_HORIZON_DAYS} days`, items: outlook },
      { title: "Decisions needed", items: decisions },
    ],
  };
}

function serviceLabel(services: BusinessService[], serviceId: string): string {
  return services.find((service) => service.id === serviceId)?.name ?? serviceId;
}
