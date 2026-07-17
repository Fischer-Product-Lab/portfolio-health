// Portfolio Health — synthetic ITSM dataset (single source of truth).
// Model and seed requirements are specified in docs/portfolio-health-prd.md.
// All records are fictional. Statuses and health bands are never stored here;
// bands and scores are computed by lib/health.ts from these inputs.

export type Priority = "P1" | "P2" | "P3" | "P4";

// Kit §5 canonical status vocabulary.
export type TicketStatus =
  | "New"
  | "In Progress"
  | "On Hold"
  | "Resolved"
  | "Closed"
  | "Root Cause Analysis"
  | "Known Error";

// V1 shipped with a richer status vocabulary that filters, pills, and drawers
// already rely on. These unions extend the kit vocabulary rather than rename
// shipped statuses (CLAUDE.md workflow rule 3: preserve existing UI behavior).
export type IncidentStatus = TicketStatus | "Open";
export type ProblemStatus = TicketStatus | "RCA In Progress" | "Fix In Progress" | "Monitoring";
export type ChangeStatus = TicketStatus | "Scheduled" | "Implementing" | "Pending approval" | "Ready" | "Rescheduled";

export type ChangeOutcome = "Open" | "Successful" | "Closed with issues" | "Failed" | "Carried over";
export type HealthBand = "Healthy" | "Watch" | "At Risk";
export type ReleaseRisk = "Low" | "Moderate" | "High";

export interface BusinessService {
  id: string; // svc-001 …
  name: string;
  owner: string; // fictional owning group
  criticality: "Tier 0" | "Tier 1" | "Tier 2";
}

export interface Incident {
  id: string; // INC######
  title: string;
  status: IncidentStatus;
  priority: Priority;
  serviceId: string;
  owner: string;
  opened: string; // ISO date
  openedLabel: string; // display form preserved from V1 tables
  ageDays: number;
  ageLabel: string; // display form preserved from V1 tables (sub-day precision)
  slaRisk: boolean;
  causedByChangeId?: string; // CHG######
  linkedProblemId?: string; // PRB######
}

export interface Problem {
  id: string;
  title: string;
  status: ProblemStatus;
  priority: Priority;
  serviceId: string;
  owner: string;
  opened: string;
  openedLabel: string;
  ageDays: number;
  rcaOverdue: boolean;
  riskNote?: string; // secondary V1 table note (e.g. "Target at risk") when not RCA overdue
  knownError: boolean;
  permanentFixChangeId?: string;
  relatedIncidentIds: string[];
}

export interface Change {
  id: string;
  title: string;
  status: ChangeStatus;
  priority: Priority;
  serviceId: string;
  owner: string;
  opened: string;
  openedLabel: string;
  ageDays: number;
  outcome: ChangeOutcome;
  risk: ReleaseRisk;
  linkedReleaseId?: string;
  causedIncidentIds: string[];
}

// Release-intelligence governance evidence (Increment 2). Grouped so each
// release row stays readable. Readiness states are never stored — they are
// derived by lib/release-intelligence.ts from this evidence.
export interface ReleaseGovernance {
  dependencies: string[]; // shared applications / infrastructure this release touches
  approval: "Approved" | "Pending" | "Not required";
  implementationPlan: boolean;
  validationEvidence: boolean;
  rollbackPlan: boolean;
  businessOwnerAck: boolean;
  dependencyConfirmed: boolean;
  freezeExceptionId?: string; // links to freezeExceptions when a blackout applies
}

export interface Release {
  id: string; // REL######
  changeId: string; // parent CHG###### (V1 deep links used change ids; keep both resolvable)
  day: number;
  month: string; // "2026-07" — calendar key derived in the UI layer
  title: string;
  time: string;
  window: string;
  serviceId: string;
  owner: string;
  risk: ReleaseRisk;
  type: "Standard" | "Normal" | "Emergency";
  status: "Scheduled" | "Ready" | "Pending approval" | "Complete";
  environment: string;
  summary: string;
  conditions: string[]; // V1 renders these as a checklist; kept as a list
  governance: ReleaseGovernance;
}

// Blackout / change-freeze windows. Timestamps are full local ISO strings
// (never date-only, which JavaScript parses as UTC).
export interface BlackoutWindow {
  id: string; // BLK-###
  name: string;
  policyReason: string;
  startsAt: string; // local ISO datetime
  endsAt: string; // local ISO datetime
  scope: string[] | "all"; // service ids the window restricts
  owner: string; // accountable policy owner
}

export interface FreezeException {
  id: string; // EXC-###
  windowId: string;
  releaseId: string;
  status: "Approved" | "Pending";
  expiresAt: string; // local ISO datetime
  approver: string;
}

export interface MonthlyFlow {
  month: string; // "2025-08" … "2026-07"
  incidentsOpened: number;
  incidentsClosed: number;
  problemsOpened: number;
  problemsClosed: number;
  changesOpened: number;
  changesClosed: number;
}

// Fixed synthetic snapshot date. Every derived age, window, and calendar key is
// deterministic relative to this instant.
export const demoAsOf = new Date(2026, 6, 9);

// ---------------------------------------------------------------------------
// Business services (kit §5 seed — 8 services, criticality-tiered)
// ---------------------------------------------------------------------------

export const businessServices: BusinessService[] = [
  { id: "svc-001", name: "Trading Platform", owner: "Market Data", criticality: "Tier 0" },
  { id: "svc-002", name: "Client Identity", owner: "IAM Engineering", criticality: "Tier 0" },
  { id: "svc-003", name: "Clearing & Settlement", owner: "Batch Services", criticality: "Tier 0" },
  { id: "svc-004", name: "Advisor Portal", owner: "Digital Experience", criticality: "Tier 1" },
  { id: "svc-005", name: "Integration Gateway", owner: "API Platform", criticality: "Tier 1" },
  { id: "svc-006", name: "DevOps Platform", owner: "Platform Engineering", criticality: "Tier 1" },
  { id: "svc-007", name: "Data & Reporting", owner: "Data Operations", criticality: "Tier 2" },
  { id: "svc-008", name: "Mobile Experience", owner: "Digital Channels", criticality: "Tier 2" },
];

// Curated per-service operating context shown on scorecards. These are display
// metadata only — never a band or score; those come from lib/health.ts.
export interface ServiceProfile {
  availability: string;
  mttr: string;
  sla: string;
  trend: number;
  decision: string;
}

export const serviceProfiles: Record<string, ServiceProfile> = {
  "svc-001": { availability: "99.62%", mttr: "3h 58m", sla: "84%", trend: -6, decision: "Hold the market-data patch until P1 restoration evidence and RCA ownership are attached" },
  "svc-002": { availability: "99.78%", mttr: "3h 04m", sla: "88%", trend: -3, decision: "Approve token-cache rollback staffing and the rescheduled migration window" },
  "svc-003": { availability: "99.85%", mttr: "2h 41m", sla: "90%", trend: -2, decision: "Assign the export memory-pressure RCA owner before the settlement optimization window" },
  "svc-004": { availability: "99.95%", mttr: "1h 54m", sla: "96%", trend: 3, decision: "Confirm rollback checkpoint for blue-green cutover" },
  "svc-005": { availability: "99.74%", mttr: "2h 52m", sla: "86%", trend: -4, decision: "Escalate the two overdue gateway RCAs and confirm latency containment" },
  "svc-006": { availability: "99.97%", mttr: "1h 21m", sla: "99%", trend: 4, decision: "No leadership decision required" },
  "svc-007": { availability: "99.82%", mttr: "3h 26m", sla: "87%", trend: -4, decision: "Confirm validation owner after the failed cluster upgrade" },
  "svc-008": { availability: "99.96%", mttr: "1h 38m", sla: "98%", trend: 2, decision: "No leadership decision required" },
};

// ---------------------------------------------------------------------------
// Incident records (representative rows)
// ---------------------------------------------------------------------------

export const incidentRecords: Incident[] = [
  { id: "INC0091842", title: "Intermittent authentication failures", status: "In Progress", priority: "P2", serviceId: "svc-002", owner: "IAM Operations", opened: "2026-07-09T08:12:00", openedLabel: "Jul 9, 8:12 AM", ageDays: 0, ageLabel: "3h 18m", slaRisk: true, linkedProblemId: "PRB0012488" },
  { id: "INC0091817", title: "Market data refresh delayed", status: "In Progress", priority: "P1", serviceId: "svc-001", owner: "Market Data", opened: "2026-07-09T06:44:00", openedLabel: "Jul 9, 6:44 AM", ageDays: 0, ageLabel: "4h 46m", slaRisk: true, causedByChangeId: "CHG0038355", linkedProblemId: "PRB0012472" },
  { id: "INC0091764", title: "Batch settlement job exceeded window", status: "Resolved", priority: "P2", serviceId: "svc-003", owner: "Batch Services", opened: "2026-07-08T21:27:00", openedLabel: "Jul 8, 9:27 PM", ageDays: 0, ageLabel: "8h 03m", slaRisk: false, linkedProblemId: "PRB0012451" },
  { id: "INC0091711", title: "Advisor portal document upload error", status: "Resolved", priority: "P2", serviceId: "svc-004", owner: "Digital Experience", opened: "2026-07-08T14:15:00", openedLabel: "Jul 8, 2:15 PM", ageDays: 0, ageLabel: "21h 15m", slaRisk: false, causedByChangeId: "CHG0038324", linkedProblemId: "PRB0012439" },
  { id: "INC0091648", title: "Elevated API response latency", status: "In Progress", priority: "P2", serviceId: "svc-005", owner: "API Platform", opened: "2026-07-08T09:10:00", openedLabel: "Jul 8, 9:10 AM", ageDays: 1, ageLabel: "1d 2h", slaRisk: true, linkedProblemId: "PRB0012416" },
  { id: "INC0091589", title: "Lower environment certificate warning", status: "Closed", priority: "P4", serviceId: "svc-006", owner: "Platform Engineering", opened: "2026-07-07T16:03:00", openedLabel: "Jul 7, 4:03 PM", ageDays: 1, ageLabel: "1d 19h", slaRisk: false },
  { id: "INC0091544", title: "Reporting extract returned partial results", status: "In Progress", priority: "P3", serviceId: "svc-007", owner: "Data Operations", opened: "2026-07-07T11:22:00", openedLabel: "Jul 7, 11:22 AM", ageDays: 2, ageLabel: "2d", slaRisk: true, causedByChangeId: "CHG0038210", linkedProblemId: "PRB0012368" },
  { id: "INC0091490", title: "Entitlement sync queue backlog", status: "Closed", priority: "P3", serviceId: "svc-002", owner: "IAM Operations", opened: "2026-07-06T15:36:00", openedLabel: "Jul 6, 3:36 PM", ageDays: 2, ageLabel: "2d 20h", slaRisk: false },
  { id: "INC0091422", title: "Notification delivery delay", status: "Closed", priority: "P4", serviceId: "svc-008", owner: "Messaging Services", opened: "2026-07-05T19:14:00", openedLabel: "Jul 5, 7:14 PM", ageDays: 3, ageLabel: "3d 16h", slaRisk: false },
  { id: "INC0091386", title: "Cash-management export unavailable", status: "In Progress", priority: "P2", serviceId: "svc-003", owner: "Treasury Platforms", opened: "2026-07-05T10:08:00", openedLabel: "Jul 5, 10:08 AM", ageDays: 4, ageLabel: "4d 1h", slaRisk: true, linkedProblemId: "PRB0012294" },
  { id: "INC0091344", title: "Client statement generation delay", status: "Resolved", priority: "P3", serviceId: "svc-007", owner: "Document Services", opened: "2026-07-04T18:31:00", openedLabel: "Jul 4, 6:31 PM", ageDays: 4, ageLabel: "4d 17h", slaRisk: false },
  { id: "INC0091279", title: "Mobile push registration failures", status: "Closed", priority: "P3", serviceId: "svc-008", owner: "Digital Channels", opened: "2026-07-03T13:42:00", openedLabel: "Jul 3, 1:42 PM", ageDays: 5, ageLabel: "5d 22h", slaRisk: false, linkedProblemId: "PRB0012238" },
  { id: "INC0091198", title: "Reference-data reconciliation mismatch", status: "Closed", priority: "P3", serviceId: "svc-007", owner: "Data Operations", opened: "2026-07-02T08:15:00", openedLabel: "Jul 2, 8:15 AM", ageDays: 7, ageLabel: "7d 3h", slaRisk: false, linkedProblemId: "PRB0012368" },
  { id: "INC0091107", title: "Automated account-opening task stalled", status: "Closed", priority: "P4", serviceId: "svc-004", owner: "Workflow Operations", opened: "2026-06-30T15:20:00", openedLabel: "Jun 30, 3:20 PM", ageDays: 8, ageLabel: "8d 20h", slaRisk: false, linkedProblemId: "PRB0012181" },
];

// ---------------------------------------------------------------------------
// Problem records
// ---------------------------------------------------------------------------

export const problemRecords: Problem[] = [
  { id: "PRB0012488", title: "Recurring token expiration under peak load", status: "RCA In Progress", priority: "P1", serviceId: "svc-002", owner: "IAM Engineering", opened: "2026-06-29", openedLabel: "Jun 29", ageDays: 10, rcaOverdue: true, knownError: false, permanentFixChangeId: "CHG0038412", relatedIncidentIds: ["INC0091842"] },
  { id: "PRB0012472", title: "Market data cache desynchronization", status: "RCA In Progress", priority: "P2", serviceId: "svc-001", owner: "Market Data", opened: "2026-06-24", openedLabel: "Jun 24", ageDays: 15, rcaOverdue: true, knownError: false, permanentFixChangeId: "CHG0038397", relatedIncidentIds: ["INC0091817"] },
  { id: "PRB0012451", title: "Settlement batch contention", status: "Fix In Progress", priority: "P2", serviceId: "svc-003", owner: "Batch Services", opened: "2026-06-17", openedLabel: "Jun 17", ageDays: 22, rcaOverdue: false, riskNote: "Target at risk", knownError: false, permanentFixChangeId: "CHG0038371", relatedIncidentIds: ["INC0091764"] },
  { id: "PRB0012439", title: "Document upload retry loop", status: "Known Error", priority: "P2", serviceId: "svc-004", owner: "Digital Experience", opened: "2026-06-11", openedLabel: "Jun 11", ageDays: 28, rcaOverdue: false, knownError: true, relatedIncidentIds: ["INC0091711"] },
  { id: "PRB0012503", title: "Gateway consumer timeout spike", status: "RCA In Progress", priority: "P2", serviceId: "svc-005", owner: "API Platform", opened: "2026-06-22", openedLabel: "Jun 22", ageDays: 17, rcaOverdue: true, knownError: false, relatedIncidentIds: [] },
  { id: "PRB0012416", title: "API latency after connection pool recycle", status: "RCA In Progress", priority: "P3", serviceId: "svc-005", owner: "API Platform", opened: "2026-05-30", openedLabel: "May 30", ageDays: 40, rcaOverdue: true, knownError: false, relatedIncidentIds: ["INC0091648"] },
  { id: "PRB0012395", title: "Certificate renewal notification gap", status: "Closed", priority: "P3", serviceId: "svc-006", owner: "Platform Engineering", opened: "2026-05-16", openedLabel: "May 16", ageDays: 54, rcaOverdue: false, knownError: false, relatedIncidentIds: [] },
  { id: "PRB0012368", title: "Reporting partition skew", status: "Monitoring", priority: "P3", serviceId: "svc-007", owner: "Data Operations", opened: "2026-04-28", openedLabel: "Apr 28", ageDays: 72, rcaOverdue: false, knownError: false, relatedIncidentIds: ["INC0091544", "INC0091198"] },
  { id: "PRB0012311", title: "Entitlement queue poison message", status: "Closed", priority: "P3", serviceId: "svc-002", owner: "IAM Operations", opened: "2026-04-04", openedLabel: "Apr 4", ageDays: 96, rcaOverdue: false, knownError: false, relatedIncidentIds: [] },
  { id: "PRB0012294", title: "Cash export memory pressure", status: "RCA In Progress", priority: "P2", serviceId: "svc-003", owner: "Treasury Platforms", opened: "2026-03-27", openedLabel: "Mar 27", ageDays: 104, rcaOverdue: true, knownError: false, relatedIncidentIds: ["INC0091386"] },
  { id: "PRB0012262", title: "Statement rendering dependency timeout", status: "Known Error", priority: "P3", serviceId: "svc-007", owner: "Document Services", opened: "2026-03-12", openedLabel: "Mar 12", ageDays: 119, rcaOverdue: false, knownError: true, relatedIncidentIds: [] },
  { id: "PRB0012238", title: "Mobile registration token collision", status: "Fix In Progress", priority: "P3", serviceId: "svc-008", owner: "Digital Channels", opened: "2026-02-21", openedLabel: "Feb 21", ageDays: 138, rcaOverdue: false, knownError: false, relatedIncidentIds: ["INC0091279"] },
  { id: "PRB0012181", title: "Account-opening workflow lock contention", status: "Monitoring", priority: "P3", serviceId: "svc-004", owner: "Workflow Operations", opened: "2026-01-19", openedLabel: "Jan 19", ageDays: 171, rcaOverdue: false, knownError: false, relatedIncidentIds: ["INC0091107"] },
  { id: "PRB0012144", title: "Vendor reference file occasionally incomplete", status: "Closed", priority: "P4", serviceId: "svc-007", owner: "Data Operations", opened: "2025-12-11", openedLabel: "Dec 11", ageDays: 210, rcaOverdue: false, knownError: false, relatedIncidentIds: [] },
];

// ---------------------------------------------------------------------------
// Change records
// ---------------------------------------------------------------------------

export const changeRecords: Change[] = [
  { id: "CHG0038412", title: "Identity gateway token cache update", status: "Scheduled", priority: "P2", serviceId: "svc-002", owner: "A. Shah", opened: "2026-07-07", openedLabel: "Jul 7", ageDays: 2, outcome: "Open", risk: "High", linkedReleaseId: "REL000105", causedIncidentIds: [] },
  { id: "CHG0038397", title: "Trading platform market-data patch", status: "Pending approval", priority: "P2", serviceId: "svc-001", owner: "M. Rivera", opened: "2026-07-06", openedLabel: "Jul 6", ageDays: 3, outcome: "Open", risk: "Moderate", linkedReleaseId: "REL000104", causedIncidentIds: [] },
  { id: "CHG0038371", title: "Settlement database index optimization", status: "Ready", priority: "P3", serviceId: "svc-003", owner: "J. Wu", opened: "2026-07-05", openedLabel: "Jul 5", ageDays: 4, outcome: "Open", risk: "Moderate", linkedReleaseId: "REL000103", causedIncidentIds: [] },
  { id: "CHG0038355", title: "Market-data feed adapter update", status: "Closed", priority: "P2", serviceId: "svc-001", owner: "M. Rivera", opened: "2026-06-26", openedLabel: "Jun 26", ageDays: 13, outcome: "Failed", risk: "Moderate", causedIncidentIds: ["INC0091817"] },
  { id: "CHG0038324", title: "Advisor portal upload service release", status: "Closed", priority: "P3", serviceId: "svc-004", owner: "K. Patel", opened: "2026-06-06", openedLabel: "Jun 6", ageDays: 33, outcome: "Closed with issues", risk: "Moderate", linkedReleaseId: "REL000102", causedIncidentIds: ["INC0091711"] },
  { id: "CHG0038299", title: "API gateway capacity increase", status: "Closed", priority: "P3", serviceId: "svc-005", owner: "S. Brooks", opened: "2026-06-29", openedLabel: "Jun 29", ageDays: 10, outcome: "Successful", risk: "Low", linkedReleaseId: "REL000101", causedIncidentIds: [] },
  { id: "CHG0038262", title: "Lower environment certificate rotation", status: "Closed", priority: "P4", serviceId: "svc-006", owner: "R. Chen", opened: "2026-06-27", openedLabel: "Jun 27", ageDays: 12, outcome: "Successful", risk: "Low", causedIncidentIds: [] },
  { id: "CHG0038210", title: "Reporting cluster version update", status: "Closed", priority: "P2", serviceId: "svc-007", owner: "L. Martin", opened: "2026-06-23", openedLabel: "Jun 23", ageDays: 16, outcome: "Failed", risk: "High", causedIncidentIds: ["INC0091544"] },
  { id: "CHG0038184", title: "Entitlement service database migration", status: "Rescheduled", priority: "P2", serviceId: "svc-002", owner: "D. Kim", opened: "2026-06-07", openedLabel: "Jun 7", ageDays: 32, outcome: "Carried over", risk: "High", linkedReleaseId: "REL000106", causedIncidentIds: [] },
  { id: "CHG0038141", title: "Notification provider failover test", status: "Closed", priority: "P3", serviceId: "svc-008", owner: "P. Young", opened: "2026-06-07", openedLabel: "Jun 7", ageDays: 32, outcome: "Closed with issues", risk: "Moderate", causedIncidentIds: [] },
  { id: "CHG0038106", title: "Cash export worker scaling", status: "Closed", priority: "P3", serviceId: "svc-003", owner: "E. Ford", opened: "2026-06-16", openedLabel: "Jun 16", ageDays: 23, outcome: "Closed with issues", risk: "Moderate", causedIncidentIds: [] },
  { id: "CHG0038073", title: "Statement renderer dependency update", status: "Closed", priority: "P3", serviceId: "svc-007", owner: "N. Hall", opened: "2026-06-13", openedLabel: "Jun 13", ageDays: 26, outcome: "Closed with issues", risk: "Moderate", causedIncidentIds: [] },
  { id: "CHG0038027", title: "Mobile notification SDK rollout", status: "Closed", priority: "P3", serviceId: "svc-008", owner: "C. Evans", opened: "2026-06-09", openedLabel: "Jun 9", ageDays: 30, outcome: "Successful", risk: "Low", causedIncidentIds: [] },
  { id: "CHG0037988", title: "Reference data ingestion redesign", status: "Closed", priority: "P2", serviceId: "svc-007", owner: "L. Martin", opened: "2026-06-05", openedLabel: "Jun 5", ageDays: 34, outcome: "Successful", risk: "Moderate", causedIncidentIds: [] },
  { id: "CHG0037932", title: "Account-opening orchestration patch", status: "Closed", priority: "P2", serviceId: "svc-004", owner: "B. Lewis", opened: "2026-05-30", openedLabel: "May 30", ageDays: 40, outcome: "Failed", risk: "High", causedIncidentIds: [] },
];

// ---------------------------------------------------------------------------
// Release records (trailing twelve months). Months are canonical "YYYY-MM";
// the calendar derives its numeric month key from demoAsOf.
// ---------------------------------------------------------------------------

// Completed releases closed with full governance evidence; only their touched
// dependencies (and any freeze exception) vary.
const closedGovernance = (dependencies: string[], freezeExceptionId?: string): ReleaseGovernance => ({
  dependencies,
  approval: "Approved",
  implementationPlan: true,
  validationEvidence: true,
  rollbackPlan: true,
  businessOwnerAck: true,
  dependencyConfirmed: true,
  ...(freezeExceptionId ? { freezeExceptionId } : {}),
});

export const releaseRecords: Release[] = [
  // July 2026 (current month)
  { id: "REL000101", changeId: "CHG0038299", day: 2, month: "2026-07", title: "API gateway capacity increase", time: "10:00 PM", window: "10:00 PM–11:30 PM CT", serviceId: "svc-005", owner: "S. Brooks", risk: "Low", type: "Standard", status: "Complete", environment: "Production", summary: "Increase gateway worker capacity and tune autoscaling thresholds ahead of quarterly volume.", conditions: ["Synthetic checks green", "Error rate below 0.5%", "Rollback image retained 24h"], governance: closedGovernance(["Integration Gateway Routing"]) },
  { id: "REL000102", changeId: "CHG0038324", day: 6, month: "2026-07", title: "Advisor portal upload release", time: "9:00 PM", window: "9:00 PM–11:00 PM CT", serviceId: "svc-004", owner: "K. Patel", risk: "Moderate", type: "Normal", status: "Complete", environment: "Production", summary: "Deploy retry-handling improvements for document uploads.", conditions: ["Post-deploy upload test required", "Support bridge held 60m", "Additional monitoring added after close"], governance: closedGovernance(["Document Store"]) },
  { id: "REL000103", changeId: "CHG0038371", day: 10, month: "2026-07", title: "Settlement DB optimization", time: "11:00 PM", window: "11:00 PM–12:30 AM CT", serviceId: "svc-003", owner: "J. Wu", risk: "Moderate", type: "Normal", status: "Ready", environment: "Production", summary: "Apply index optimizations to reduce settlement batch contention.", conditions: ["DBA validation complete", "Batch baseline captured", "Rollback script tested"], governance: { dependencies: ["Settlement Database"], approval: "Approved", implementationPlan: true, validationEvidence: true, rollbackPlan: true, businessOwnerAck: true, dependencyConfirmed: true } },
  { id: "REL000104", changeId: "CHG0038397", day: 14, month: "2026-07", title: "Market-data patch", time: "8:30 PM", window: "8:30 PM–10:30 PM CT", serviceId: "svc-001", owner: "M. Rivera", risk: "Moderate", type: "Normal", status: "Pending approval", environment: "Production", summary: "Patch market-data cache synchronization and add drift telemetry.", conditions: ["CAB approval pending", "Vendor validation attached", "Trading smoke test assigned"], governance: { dependencies: ["Market Data Cache"], approval: "Pending", implementationPlan: true, validationEvidence: true, rollbackPlan: true, businessOwnerAck: false, dependencyConfirmed: true } },
  { id: "REL000105", changeId: "CHG0038412", day: 17, month: "2026-07", title: "Token cache update", time: "10:00 PM", window: "10:00 PM–12:00 AM CT", serviceId: "svc-002", owner: "A. Shah", risk: "High", type: "Normal", status: "Scheduled", environment: "Production", summary: "Update token caching behavior to address peak-load authentication failures.", conditions: ["P1 problem link required", "Rollback under 15 minutes", "War room staffed"], governance: { dependencies: ["Auth Token Service"], approval: "Approved", implementationPlan: true, validationEvidence: false, rollbackPlan: true, businessOwnerAck: true, dependencyConfirmed: true } },
  { id: "REL000106", changeId: "CHG0038184", day: 22, month: "2026-07", title: "Entitlement DB migration — rescheduled", time: "10:30 PM", window: "10:30 PM–1:30 AM CT", serviceId: "svc-002", owner: "D. Kim", risk: "High", type: "Normal", status: "Scheduled", environment: "Production", summary: "Rescheduled window for the carried-over entitlement service database migration.", conditions: ["Carried-over change re-approved", "Data reconciliation signed", "Failback tested"], governance: { dependencies: ["Entitlement Database"], approval: "Approved", implementationPlan: true, validationEvidence: true, rollbackPlan: true, businessOwnerAck: true, dependencyConfirmed: true, freezeExceptionId: "EXC-002" } },
  { id: "REL000107", changeId: "CHG0038449", day: 21, month: "2026-07", title: "Blue-green routing cutover", time: "9:30 PM", window: "9:30 PM–11:30 PM CT", serviceId: "svc-004", owner: "T. Green", risk: "High", type: "Normal", status: "Scheduled", environment: "Production", summary: "Move advisor traffic to the new green stack and validate end-to-end journeys.", conditions: ["NFR sign-off complete", "Observability dashboard live", "Rollback decision at +30m"], governance: { dependencies: ["Advisor Traffic Router"], approval: "Approved", implementationPlan: true, validationEvidence: true, rollbackPlan: true, businessOwnerAck: true, dependencyConfirmed: true } },
  { id: "REL000108", changeId: "CHG0038474", day: 24, month: "2026-07", title: "Reporting cluster upgrade", time: "7:00 PM", window: "7:00 PM–11:00 PM CT", serviceId: "svc-007", owner: "L. Martin", risk: "Moderate", type: "Normal", status: "Ready", environment: "Production", summary: "Upgrade reporting compute nodes with phased validation.", conditions: ["Extract reconciliation complete", "Performance baseline attached", "Business validation by 10:30 PM"], governance: { dependencies: ["Reporting Compute Cluster", "Integration Gateway Routing"], approval: "Approved", implementationPlan: true, validationEvidence: false, rollbackPlan: true, businessOwnerAck: true, dependencyConfirmed: true } },
  { id: "REL000109", changeId: "CHG0038501", day: 28, month: "2026-07", title: "Messaging provider failover", time: "8:00 PM", window: "8:00 PM–9:30 PM CT", serviceId: "svc-008", owner: "P. Young", risk: "Low", type: "Standard", status: "Scheduled", environment: "Production", summary: "Exercise provider failover and confirm notification delivery paths.", conditions: ["Test recipient list approved", "Provider support notified", "Latency threshold below 90s"], governance: { dependencies: ["Notification Provider Bridge"], approval: "Approved", implementationPlan: true, validationEvidence: true, rollbackPlan: true, businessOwnerAck: true, dependencyConfirmed: true } },
  // Increment 2 additions — releases that exercise the collision, blackout,
  // and readiness engines. Kept Moderate risk or outside the 14-day health
  // window so computed service bands are unchanged (CLAUDE.md workflow rule 3).
  { id: "REL000133", changeId: "CHG0038186", day: 22, month: "2026-07", title: "Entitlement cache warm-up", time: "11:00 PM", window: "11:00 PM–12:00 AM CT", serviceId: "svc-002", owner: "D. Kim", risk: "Moderate", type: "Normal", status: "Scheduled", environment: "Production", summary: "Pre-warm entitlement caches immediately after the rescheduled migration to avoid a cold-start login spike.", conditions: ["Migration completion confirmed", "Cache hit-rate baseline captured", "Login synthetic checks green"], governance: { dependencies: ["Entitlement Database"], approval: "Approved", implementationPlan: true, validationEvidence: true, rollbackPlan: true, businessOwnerAck: true, dependencyConfirmed: true } },
  { id: "REL000134", changeId: "CHG0038512", day: 24, month: "2026-07", title: "Gateway auth adapter hardening", time: "8:00 PM", window: "8:00 PM–10:00 PM CT", serviceId: "svc-005", owner: "A. Shah", risk: "High", type: "Normal", status: "Scheduled", environment: "Production", summary: "Harden the gateway authentication adapter against the token-cache failure mode seen on Client Identity.", conditions: ["Token-cache release outcome reviewed", "Gateway canary thresholds set", "Rollback image staged"], governance: { dependencies: ["Auth Token Service", "Integration Gateway Routing"], approval: "Approved", implementationPlan: true, validationEvidence: true, rollbackPlan: true, businessOwnerAck: false, dependencyConfirmed: false } },
  { id: "REL000135", changeId: "CHG0038372", day: 11, month: "2026-07", title: "Settlement optimization validation", time: "10:00 PM", window: "10:00 PM–11:30 PM CT", serviceId: "svc-003", owner: "J. Wu", risk: "Moderate", type: "Normal", status: "Ready", environment: "Production", summary: "Run the post-optimization batch validation pass against the captured performance baseline.", conditions: ["Baseline comparison scripted", "DBA on bridge", "Abort criteria agreed"], governance: { dependencies: ["Settlement Database"], approval: "Approved", implementationPlan: true, validationEvidence: true, rollbackPlan: true, businessOwnerAck: true, dependencyConfirmed: true } },
  // Trailing twelve months (completed)
  { id: "REL000110", changeId: "CHG0038538", day: 4, month: "2025-08", title: "Identity datastore migration", time: "10:00 PM", window: "10:00 PM–1:00 AM CT", serviceId: "svc-002", owner: "D. Kim", risk: "High", type: "Normal", status: "Complete", environment: "Production", summary: "Migrate identity profile data to the resilient multi-region datastore.", conditions: ["Data reconciliation signed", "Failback tested", "Executive notification drafted"], governance: closedGovernance(["Identity Profile Datastore"]) },
  { id: "REL000111", changeId: "CHG0038572", day: 11, month: "2025-08", title: "API contract release", time: "9:00 PM", window: "9:00 PM–10:30 PM CT", serviceId: "svc-005", owner: "S. Brooks", risk: "Moderate", type: "Normal", status: "Complete", environment: "Production", summary: "Publish backward-compatible API contracts for the portfolio reporting feed.", conditions: ["Consumer validation complete", "Schema registry updated", "Error budget healthy"], governance: closedGovernance(["Integration Gateway Routing"]) },
  { id: "REL000112", changeId: "CHG0038619", day: 18, month: "2025-08", title: "Settlement resilience test", time: "11:30 PM", window: "11:30 PM–1:30 AM CT", serviceId: "svc-003", owner: "J. Wu", risk: "High", type: "Normal", status: "Complete", environment: "Production", summary: "Run controlled node-failure validation before peak processing season.", conditions: ["CAB approval complete", "Operations bridge booked", "Recovery checkpoint documented"], governance: closedGovernance(["Settlement Database"]) },
  { id: "REL000113", changeId: "CHG0038660", day: 25, month: "2025-08", title: "Observability agent rollout", time: "8:00 PM", window: "8:00 PM–10:00 PM CT", serviceId: "svc-006", owner: "R. Chen", risk: "Low", type: "Standard", status: "Complete", environment: "Production", summary: "Deploy the standard observability agent across remaining production services.", conditions: ["Coverage report attached", "CPU overhead below 2%", "Dashboards pre-created"], governance: closedGovernance(["Observability Pipeline"]) },
  { id: "REL000114", changeId: "CHG0038704", day: 8, month: "2025-09", title: "Emergency access hardening", time: "9:00 PM", window: "9:00 PM–10:00 PM CT", serviceId: "svc-002", owner: "A. Shah", risk: "Moderate", type: "Emergency", status: "Complete", environment: "Production", summary: "Harden break-glass access controls following quarterly review.", conditions: ["Security approval complete", "Access test scheduled", "Audit evidence retained"], governance: closedGovernance(["Break-glass Access Vault"]) },
  { id: "REL000115", changeId: "CHG0038756", day: 15, month: "2025-09", title: "Trading release 26.9", time: "8:30 PM", window: "8:30 PM–11:30 PM CT", serviceId: "svc-001", owner: "M. Rivera", risk: "High", type: "Normal", status: "Complete", environment: "Production", summary: "Deliver the September trading platform release train.", conditions: ["Regression suite green", "Business sign-off complete", "Rollback checkpoint at +45m"], governance: closedGovernance(["Order Routing Engine"]) },
  { id: "REL000116", changeId: "CHG0038812", day: 6, month: "2025-10", title: "API gateway TLS refresh", time: "9:00 PM", window: "9:00 PM–10:30 PM CT", serviceId: "svc-005", owner: "S. Brooks", risk: "Low", type: "Standard", status: "Complete", environment: "Production", summary: "Rotate gateway certificates and validate downstream client trust chains.", conditions: ["Certificate chain validated", "Consumer notice complete", "Rollback bundle staged"], governance: closedGovernance(["Integration Gateway Routing"]) },
  { id: "REL000117", changeId: "CHG0038864", day: 20, month: "2025-10", title: "Change-freeze readiness release", time: "8:00 PM", window: "8:00 PM–11:00 PM CT", serviceId: "svc-006", owner: "R. Chen", risk: "Moderate", type: "Normal", status: "Complete", environment: "Production", summary: "Complete platform tooling updates ahead of the year-end change freeze.", conditions: ["Freeze exception list reviewed", "Toolchain health green", "Support coverage confirmed"], governance: closedGovernance(["CI/CD Toolchain"]) },
  { id: "REL000118", changeId: "CHG0038919", day: 3, month: "2025-11", title: "Tax processing capacity uplift", time: "10:00 PM", window: "10:00 PM–12:30 AM CT", serviceId: "svc-007", owner: "N. Hall", risk: "Moderate", type: "Normal", status: "Complete", environment: "Production", summary: "Add document-rendering capacity before year-end tax statement generation.", conditions: ["Load test target met", "Queue alarms validated", "Capacity rollback documented"], governance: closedGovernance(["Document Rendering Farm"]) },
  { id: "REL000119", changeId: "CHG0038961", day: 17, month: "2025-11", title: "Identity secondary-region activation", time: "9:30 PM", window: "9:30 PM–12:30 AM CT", serviceId: "svc-002", owner: "D. Kim", risk: "High", type: "Normal", status: "Complete", environment: "Production", summary: "Activate secondary-region identity services and validate controlled traffic failover.", conditions: ["Multi-region review approved", "Failback test complete", "Executive bridge staffed"], governance: closedGovernance(["Identity Profile Datastore"]) },
  { id: "REL000120", changeId: "CHG0039014", day: 9, month: "2025-12", title: "Holiday freeze security exception", time: "11:00 PM", window: "11:00 PM–12:00 AM CT", serviceId: "svc-002", owner: "A. Shah", risk: "High", type: "Emergency", status: "Complete", environment: "Production", summary: "Deploy a narrowly scoped security fix during the year-end change freeze.", conditions: ["Emergency CAB approval", "Security validation attached", "Customer notification on standby"], governance: closedGovernance(["Auth Token Service"], "EXC-001") },
  { id: "REL000121", changeId: "CHG0039077", day: 13, month: "2026-01", title: "Annual certificate rotation", time: "8:00 PM", window: "8:00 PM–10:00 PM CT", serviceId: "svc-006", owner: "R. Chen", risk: "Low", type: "Standard", status: "Complete", environment: "Production", summary: "Rotate shared platform certificates across production services.", conditions: ["Inventory reconciliation complete", "Expiry alerts cleared", "Service-owner sign-off captured"], governance: closedGovernance(["Certificate Authority"]) },
  { id: "REL000122", changeId: "CHG0039128", day: 27, month: "2026-01", title: "Data-retention policy release", time: "9:00 PM", window: "9:00 PM–11:30 PM CT", serviceId: "svc-007", owner: "L. Martin", risk: "Moderate", type: "Normal", status: "Complete", environment: "Production", summary: "Apply updated retention policies and archive validation workflows.", conditions: ["Legal approval complete", "Archive restore tested", "Deletion evidence retained"], governance: closedGovernance(["Archive Storage"]) },
  { id: "REL000123", changeId: "CHG0039186", day: 10, month: "2026-02", title: "Account-opening release 27.2", time: "8:30 PM", window: "8:30 PM–11:00 PM CT", serviceId: "svc-004", owner: "B. Lewis", risk: "Moderate", type: "Normal", status: "Complete", environment: "Production", summary: "Release workflow reliability and straight-through-processing improvements.", conditions: ["Journey regression green", "Operations playbook updated", "Conversion baseline captured"], governance: closedGovernance(["Onboarding Workflow Engine"]) },
  { id: "REL000124", changeId: "CHG0039231", day: 24, month: "2026-02", title: "Advisor portal accessibility release", time: "9:00 PM", window: "9:00 PM–10:30 PM CT", serviceId: "svc-004", owner: "K. Patel", risk: "Low", type: "Standard", status: "Complete", environment: "Production", summary: "Deploy accessibility and navigation improvements across core advisor journeys.", conditions: ["Accessibility scan passed", "Keyboard testing complete", "Support notes published"], governance: closedGovernance(["Advisor Web Frontend"]) },
  { id: "REL000125", changeId: "CHG0039294", day: 7, month: "2026-03", title: "Trading platform release 27.3", time: "8:00 PM", window: "8:00 PM–11:30 PM CT", serviceId: "svc-001", owner: "M. Rivera", risk: "High", type: "Normal", status: "Complete", environment: "Production", summary: "Deliver the March trading release with routing and telemetry enhancements.", conditions: ["Trading certification complete", "Market-open rollback plan", "Business bridge staffed"], governance: closedGovernance(["Order Routing Engine"]) },
  { id: "REL000126", changeId: "CHG0039348", day: 21, month: "2026-03", title: "Enterprise recovery exercise", time: "11:00 PM", window: "11:00 PM–2:00 AM CT", serviceId: "svc-003", owner: "J. Wu", risk: "High", type: "Normal", status: "Complete", environment: "Production", summary: "Exercise application recovery across settlement and identity dependencies.", conditions: ["Scenario approved", "Recovery checkpoints assigned", "Post-exercise review scheduled"], governance: closedGovernance(["Settlement Database", "Identity Profile Datastore"]) },
  { id: "REL000127", changeId: "CHG0039406", day: 4, month: "2026-04", title: "Multi-region traffic cutover", time: "9:30 PM", window: "9:30 PM–1:00 AM CT", serviceId: "svc-004", owner: "T. Green", risk: "High", type: "Normal", status: "Complete", environment: "Production", summary: "Shift advisor traffic to the active-active regional architecture.", conditions: ["Regional readiness green", "NFR sign-off complete", "Failback under 20 minutes"], governance: closedGovernance(["Advisor Traffic Router"]) },
  { id: "REL000128", changeId: "CHG0039462", day: 18, month: "2026-04", title: "QE automation framework update", time: "7:30 PM", window: "7:30 PM–9:00 PM CT", serviceId: "svc-006", owner: "R. Chen", risk: "Low", type: "Standard", status: "Complete", environment: "Production", summary: "Publish the shared test-automation framework and reporting integration.", conditions: ["Compatibility suite green", "Adoption guide published", "Pipeline rollback tagged"], governance: closedGovernance(["CI/CD Toolchain"]) },
  { id: "REL000129", changeId: "CHG0039524", day: 9, month: "2026-05", title: "Observability standard rollout", time: "8:00 PM", window: "8:00 PM–10:00 PM CT", serviceId: "svc-005", owner: "S. Brooks", risk: "Moderate", type: "Normal", status: "Complete", environment: "Production", summary: "Complete mandatory service-level telemetry and alerting coverage.", conditions: ["Coverage threshold met", "Alert routing tested", "Runbooks linked"], governance: closedGovernance(["Observability Pipeline"]) },
  { id: "REL000130", changeId: "CHG0039581", day: 23, month: "2026-05", title: "Settlement performance release", time: "10:30 PM", window: "10:30 PM–12:30 AM CT", serviceId: "svc-003", owner: "J. Wu", risk: "Moderate", type: "Normal", status: "Complete", environment: "Production", summary: "Deploy batch throughput and contention improvements.", conditions: ["Performance baseline approved", "Peak simulation passed", "DBA coverage confirmed"], governance: closedGovernance(["Settlement Database"]) },
  { id: "REL000131", changeId: "CHG0039643", day: 5, month: "2026-06", title: "API platform version upgrade", time: "9:00 PM", window: "9:00 PM–12:00 AM CT", serviceId: "svc-005", owner: "S. Brooks", risk: "High", type: "Normal", status: "Complete", environment: "Production", summary: "Upgrade the shared API platform runtime with phased consumer validation.", conditions: ["Consumer matrix signed", "Canary thresholds defined", "Rollback image retained"], governance: closedGovernance(["Integration Gateway Routing"]) },
  { id: "REL000132", changeId: "CHG0039702", day: 19, month: "2026-06", title: "Fiscal-year reporting release", time: "8:30 PM", window: "8:30 PM–11:00 PM CT", serviceId: "svc-007", owner: "L. Martin", risk: "Moderate", type: "Normal", status: "Complete", environment: "Production", summary: "Release fiscal-year reporting updates and executive portfolio extracts.", conditions: ["Finance validation complete", "Extract totals reconciled", "Business sign-off assigned"], governance: closedGovernance(["Reporting Compute Cluster"]) },
];

// ---------------------------------------------------------------------------
// Blackout / change-freeze windows and freeze exceptions (Increment 2).
// Findings ("release X violates window Y") are never stored — they are
// computed by lib/release-intelligence.ts from these inputs.
// ---------------------------------------------------------------------------

export const blackoutWindows: BlackoutWindow[] = [
  {
    id: "BLK-001",
    name: "Q2 earnings announcement freeze",
    policyReason: "No production change on Tier 0 revenue services from two days before through one day after the quarterly earnings announcement.",
    startsAt: "2026-07-21T00:00:00",
    endsAt: "2026-07-23T23:59:00",
    scope: ["svc-001", "svc-002", "svc-003"],
    owner: "Change Management Office",
  },
  {
    id: "BLK-002",
    name: "Market-data vendor maintenance moratorium",
    policyReason: "Upstream market-data vendor maintenance; no changes to consuming services while vendor failover paths are degraded.",
    startsAt: "2026-07-14T21:30:00",
    endsAt: "2026-07-15T06:00:00",
    scope: ["svc-001"],
    owner: "Vendor Management",
  },
  {
    id: "BLK-003",
    name: "Year-end holiday change freeze",
    policyReason: "Annual enterprise freeze covering year-end processing and reduced support staffing.",
    startsAt: "2025-12-05T00:00:00",
    endsAt: "2026-01-05T23:59:00",
    scope: "all",
    owner: "Change Management Office",
  },
];

export const freezeExceptions: FreezeException[] = [
  // Historical precedent: the December security fix shipped inside BLK-003
  // under an approved emergency exception.
  { id: "EXC-001", windowId: "BLK-003", releaseId: "REL000120", status: "Approved", expiresAt: "2025-12-10T23:59:00", approver: "E. Navarro (CAB chair)" },
  // Approved for the rescheduled entitlement migration, but it lapses before
  // the BLK-001 window opens — the engine flags it for renewal.
  { id: "EXC-002", windowId: "BLK-001", releaseId: "REL000106", status: "Approved", expiresAt: "2026-07-15T23:59:00", approver: "E. Navarro (CAB chair)" },
];

// ---------------------------------------------------------------------------
// Monthly flow (trailing twelve months, portfolio-level)
// ---------------------------------------------------------------------------

export const monthlyFlow: MonthlyFlow[] = [
  { month: "2025-08", incidentsOpened: 238, incidentsClosed: 221, problemsOpened: 12, problemsClosed: 10, changesOpened: 68, changesClosed: 65 },
  { month: "2025-09", incidentsOpened: 226, incidentsClosed: 230, problemsOpened: 14, problemsClosed: 11, changesOpened: 74, changesClosed: 72 },
  { month: "2025-10", incidentsOpened: 241, incidentsClosed: 235, problemsOpened: 13, problemsClosed: 15, changesOpened: 77, changesClosed: 79 },
  { month: "2025-11", incidentsOpened: 219, incidentsClosed: 227, problemsOpened: 11, problemsClosed: 12, changesOpened: 81, changesClosed: 78 },
  { month: "2025-12", incidentsOpened: 232, incidentsClosed: 228, problemsOpened: 16, problemsClosed: 13, changesOpened: 75, changesClosed: 77 },
  { month: "2026-01", incidentsOpened: 224, incidentsClosed: 231, problemsOpened: 14, problemsClosed: 16, changesOpened: 79, changesClosed: 82 },
  { month: "2026-02", incidentsOpened: 201, incidentsClosed: 190, problemsOpened: 15, problemsClosed: 11, changesOpened: 72, changesClosed: 69 },
  { month: "2026-03", incidentsOpened: 193, incidentsClosed: 205, problemsOpened: 13, problemsClosed: 14, changesOpened: 79, changesClosed: 76 },
  { month: "2026-04", incidentsOpened: 218, incidentsClosed: 210, problemsOpened: 18, problemsClosed: 12, changesOpened: 83, changesClosed: 81 },
  { month: "2026-05", incidentsOpened: 207, incidentsClosed: 221, problemsOpened: 17, problemsClosed: 15, changesOpened: 91, changesClosed: 86 },
  { month: "2026-06", incidentsOpened: 229, incidentsClosed: 224, problemsOpened: 14, problemsClosed: 15, changesOpened: 88, changesClosed: 84 },
  { month: "2026-07", incidentsOpened: 214, incidentsClosed: 186, problemsOpened: 16, problemsClosed: 11, changesOpened: 96, changesClosed: 80 },
];

// ---------------------------------------------------------------------------
// Curated portfolio-level headline figures (kit §5 allows these to remain
// curated; service scorecards and bands are computed, never these).
// ---------------------------------------------------------------------------

export const changeOutcomeTotals = { successful: 68, withIssues: 9, failed: 3, carried: 2 };

export const portfolioHeadline = {
  incidents: { open: 47, closed: monthlyFlow.at(-1)?.incidentsClosed ?? 0, p1: 2, slaRisk: 8, mttr: "3h 12m" },
  problems: { open: 18, closed: monthlyFlow.at(-1)?.problemsClosed ?? 0, overdueRca: 6, knownErrors: 9, repeatDrivers: 4 },
  changes: { open: 24, closed: monthlyFlow.at(-1)?.changesClosed ?? 0, ...changeOutcomeTotals },
};

// ---------------------------------------------------------------------------
// Linked-record lineage panel content (overview/service view). Items resolve
// to real record ids above; releases are referenced by REL id.
// ---------------------------------------------------------------------------

export interface LineageItem {
  label: string;
  id: string;
  view: "incidents" | "problems" | "changes" | "releases";
}

export interface LineageStory {
  title: string;
  serviceId: string;
  impact: string;
  owner: string;
  due: string;
  decision: string;
  state: "Decision due" | "In remediation" | "Monitoring";
  items: LineageItem[];
}

export const lineageStories: LineageStory[] = [
  {
    title: "Peak-load authentication failure",
    serviceId: "svc-002",
    impact: "Repeat authentication failures with SLA exposure and an overdue P1 root cause",
    owner: "A. Shah",
    due: "Jul 10",
    decision: "Approve rollback staffing and the permanent-fix deployment window",
    state: "Decision due",
    items: [
      { label: "Incident", id: "INC0091842", view: "incidents" },
      { label: "Problem", id: "PRB0012488", view: "problems" },
      { label: "Fix change", id: "CHG0038412", view: "changes" },
      { label: "Release", id: "REL000105", view: "releases" },
    ],
  },
  {
    title: "Reporting cluster validation failure",
    serviceId: "svc-007",
    impact: "Failed change increased delivery risk for the July reporting release",
    owner: "L. Martin",
    due: "Jul 12",
    decision: "Confirm remediation evidence and a named business-validation owner",
    state: "In remediation",
    items: [
      { label: "Incident", id: "INC0091544", view: "incidents" },
      { label: "Problem", id: "PRB0012368", view: "problems" },
      { label: "Failed change", id: "CHG0038210", view: "changes" },
      { label: "Release", id: "REL000108", view: "releases" },
    ],
  },
  {
    title: "Settlement batch contention",
    serviceId: "svc-003",
    impact: "Recurring processing-window pressure with a permanent fix ready",
    owner: "J. Wu",
    due: "Jul 11",
    decision: "Review post-release batch performance against the captured baseline",
    state: "Monitoring",
    items: [
      { label: "Incident", id: "INC0091764", view: "incidents" },
      { label: "Problem", id: "PRB0012451", view: "problems" },
      { label: "Fix change", id: "CHG0038371", view: "changes" },
      { label: "Release", id: "REL000103", view: "releases" },
    ],
  },
];
