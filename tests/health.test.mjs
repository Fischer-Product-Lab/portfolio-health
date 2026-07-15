import assert from "node:assert/strict";
import test from "node:test";

import {
  businessServices,
  changeRecords,
  demoAsOf,
  incidentRecords,
  problemRecords,
  releaseRecords,
} from "../data/portfolio-health.ts";
import {
  computePortfolioHealth,
  computeServiceHealth,
  deriveServiceHealthInput,
} from "../lib/health.ts";

const records = {
  incidents: incidentRecords,
  problems: problemRecords,
  changes: changeRecords,
  releases: releaseRecords,
};

const serviceResults = businessServices.map((service) =>
  computeServiceHealth(deriveServiceHealthInput(service, records, demoAsOf)),
);
const resultById = new Map(businessServices.map((service, index) => [service.id, serviceResults[index]]));

// Intended bands per docs/portfolio-health-prd.md §5.3.
const intendedBands = {
  "svc-001": "At Risk", // Trading Platform
  "svc-002": "Watch", // Client Identity
  "svc-003": "Watch", // Clearing & Settlement
  "svc-004": "Healthy", // Advisor Portal
  "svc-005": "At Risk", // Integration Gateway
  "svc-006": "Healthy", // DevOps Platform
  "svc-007": "Watch", // Data & Reporting
  "svc-008": "Healthy", // Mobile Experience
};

test("each seeded business service resolves to its intended band (PRD §5.3)", () => {
  assert.equal(businessServices.length, 8);
  for (const service of businessServices) {
    const result = resultById.get(service.id);
    assert.ok(result, `missing health result for ${service.id}`);
    assert.equal(
      result.band,
      intendedBands[service.id],
      `${service.name} (${service.id}) resolved to ${result.band}, expected ${intendedBands[service.id]} — reasons: ${result.reasons.join("; ")}`,
    );
    assert.ok(result.reasons.length >= 1 && result.reasons.length <= 4, `${service.id} must have 1–4 reasons`);
    assert.ok(result.score >= 0 && result.score <= 100, `${service.id} score out of range`);
  }
});

test("portfolio band and score are stable for the seed set", () => {
  const portfolio = computePortfolioHealth(businessServices, serviceResults);
  assert.equal(portfolio.score, 69);
  assert.equal(portfolio.band, "At Risk");
  assert.ok(portfolio.reasons.length >= 1 && portfolio.reasons.length <= 3);
  assert.ok(portfolio.reasons[0].includes("Trading Platform"), "top reason should name the Tier 0 At Risk service");
  assert.equal(portfolio.serviceBreakdown.length, 8);

  const expectedScores = {
    "svc-001": 40,
    "svc-002": 60,
    "svc-003": 60,
    "svc-004": 90,
    "svc-005": 68,
    "svc-006": 100,
    "svc-007": 72,
    "svc-008": 100,
  };
  for (const entry of portfolio.serviceBreakdown) {
    assert.equal(entry.score, expectedScores[entry.serviceId], `unexpected score for ${entry.serviceId}`);
    assert.equal(entry.band, intendedBands[entry.serviceId], `unexpected band for ${entry.serviceId}`);
  }

  // Determinism: recomputing from the same inputs yields identical output.
  const again = computePortfolioHealth(
    businessServices,
    businessServices.map((service) => computeServiceHealth(deriveServiceHealthInput(service, records, demoAsOf))),
  );
  assert.deepEqual(again, portfolio);
});

// ---------------------------------------------------------------------------
// Engine rules (PRD §5.1) exercised with fabricated inputs
// ---------------------------------------------------------------------------

const stubService = { id: "svc-test", name: "Test Service", owner: "QA", criticality: "Tier 1" };

function makeIncident(overrides = {}) {
  return {
    id: "INC0000001", title: "t", status: "In Progress", priority: "P3", serviceId: "svc-test",
    owner: "o", opened: "2026-07-01", openedLabel: "Jul 1", ageDays: 1, ageLabel: "1d", slaRisk: false,
    ...overrides,
  };
}

function makeProblem(overrides = {}) {
  return {
    id: "PRB0000001", title: "t", status: "RCA In Progress", priority: "P3", serviceId: "svc-test",
    owner: "o", opened: "2026-06-01", openedLabel: "Jun 1", ageDays: 30, rcaOverdue: false, knownError: false,
    relatedIncidentIds: [],
    ...overrides,
  };
}

function makeChange(overrides = {}) {
  return {
    id: "CHG0000001", title: "t", status: "Closed", priority: "P3", serviceId: "svc-test",
    owner: "o", opened: "2026-06-20", openedLabel: "Jun 20", ageDays: 19, outcome: "Successful", risk: "Low",
    causedIncidentIds: [],
    ...overrides,
  };
}

function makeInput(overrides = {}) {
  return {
    service: stubService,
    openIncidents: [],
    openProblems: [],
    recentChanges: [],
    upcomingReleases: [],
    ...overrides,
  };
}

test("an open P1 forces At Risk even when the score is otherwise Healthy", () => {
  const result = computeServiceHealth(makeInput({
    openIncidents: [makeIncident({ priority: "P1" })],
  }));
  assert.equal(result.score, 80); // only the −20 P1 deduction
  assert.equal(result.band, "At Risk");
  assert.ok(result.reasons[0].includes("P1"));
});

test("two overdue RCAs force At Risk even when the score is otherwise Healthy", () => {
  const result = computeServiceHealth(makeInput({
    openProblems: [makeProblem({ id: "PRB1", rcaOverdue: true }), makeProblem({ id: "PRB2", rcaOverdue: true })],
  }));
  assert.equal(result.score, 76);
  assert.equal(result.band, "At Risk");
});

test("change success rate brackets deduct 0 / 10 / 20 and null deducts nothing", () => {
  const success = (outcomes) => computeServiceHealth(makeInput({
    recentChanges: outcomes.map((outcome, index) => makeChange({ id: `CHG${index}`, outcome })),
  }));
  assert.equal(success([]).signals.changeSuccessRate, null);
  assert.equal(success([]).score, 100);
  assert.equal(success(["Successful", "Successful", "Successful", "Successful", "Successful", "Successful", "Closed with issues"]).score, 100); // 85.7% ≥ 85 → 0
  assert.equal(success(["Successful", "Successful", "Successful", "Failed"]).score, 90); // 75% → −10
  assert.equal(success(["Successful", "Failed"]).score, 80); // 50% → −20
  assert.equal(success(["Successful", "Successful", "Successful", "Successful", "Successful", "Successful", "Closed with issues"]).signals.changeSuccessRate, 85.7);
});

test("open (outcome Open) changes never count toward the success-rate denominator", () => {
  const result = computeServiceHealth(makeInput({
    recentChanges: [makeChange({ outcome: "Open" }), makeChange({ id: "CHG2", outcome: "Successful" })],
  }));
  assert.equal(result.signals.changeSuccessRate, 100);
});

test("score clamps at 0 and stays within 0–100", () => {
  const result = computeServiceHealth(makeInput({
    openIncidents: Array.from({ length: 6 }, (_, index) => makeIncident({ id: `INC${index}`, priority: "P1", slaRisk: true })),
  }));
  assert.equal(result.score, 0);
  assert.equal(result.band, "At Risk");
});

test("portfolio weights Tier 0 ×3, Tier 1 ×2, Tier 2 ×1 and applies band rules", () => {
  const services = [
    { id: "a", name: "A", owner: "o", criticality: "Tier 0" },
    { id: "b", name: "B", owner: "o", criticality: "Tier 1" },
    { id: "c", name: "C", owner: "o", criticality: "Tier 2" },
  ];
  const mkResult = (score, band) => ({ band, score, reasons: ["r"], signals: { openP1: 0, slaRiskIncidents: 0, overdueRcas: 0, changeSuccessRate: null, highRiskReleases14d: 0 } });

  // (90×3 + 60×2 + 30×1) / 6 = 70 → Watch (no At Risk service, score < 75)
  const watch = computePortfolioHealth(services, [mkResult(90, "Healthy"), mkResult(60, "Watch"), mkResult(30, "Watch")]);
  assert.equal(watch.score, 70);
  assert.equal(watch.band, "Watch");

  // Any Tier 0 At Risk forces the portfolio At Risk regardless of score.
  const tier0Risk = computePortfolioHealth(services, [mkResult(90, "At Risk"), mkResult(100, "Healthy"), mkResult(100, "Healthy")]);
  assert.equal(tier0Risk.band, "At Risk");

  // Healthy requires score ≥ 75 AND no service At Risk.
  const healthy = computePortfolioHealth(services, [mkResult(90, "Healthy"), mkResult(80, "Healthy"), mkResult(75, "Healthy")]);
  assert.equal(healthy.band, "Healthy");
  const heldToWatch = computePortfolioHealth(services, [mkResult(90, "Healthy"), mkResult(80, "Healthy"), mkResult(60, "At Risk")]);
  assert.equal(heldToWatch.band, heldToWatch.score < 55 ? "At Risk" : "Watch");
});

// ---------------------------------------------------------------------------
// Lineage seed integrity (PRD §5.3 minimum chains)
// ---------------------------------------------------------------------------

const incidentById = new Map(incidentRecords.map((record) => [record.id, record]));
const problemById = new Map(problemRecords.map((record) => [record.id, record]));
const changeById = new Map(changeRecords.map((record) => [record.id, record]));
const releaseById = new Map(releaseRecords.map((record) => [record.id, record]));

test("every record references a seeded business service", () => {
  const serviceIds = new Set(businessServices.map((service) => service.id));
  for (const record of [...incidentRecords, ...problemRecords, ...changeRecords, ...releaseRecords]) {
    assert.ok(serviceIds.has(record.serviceId), `${record.id} references unknown service ${record.serviceId}`);
  }
});

test("all lineage links resolve to existing records", () => {
  for (const incident of incidentRecords) {
    if (incident.causedByChangeId) assert.ok(changeById.has(incident.causedByChangeId), `${incident.id} → ${incident.causedByChangeId}`);
    if (incident.linkedProblemId) assert.ok(problemById.has(incident.linkedProblemId), `${incident.id} → ${incident.linkedProblemId}`);
  }
  for (const problem of problemRecords) {
    if (problem.permanentFixChangeId) assert.ok(changeById.has(problem.permanentFixChangeId), `${problem.id} → ${problem.permanentFixChangeId}`);
    for (const incidentId of problem.relatedIncidentIds) assert.ok(incidentById.has(incidentId), `${problem.id} → ${incidentId}`);
  }
  for (const change of changeRecords) {
    if (change.linkedReleaseId) assert.ok(releaseById.has(change.linkedReleaseId), `${change.id} → ${change.linkedReleaseId}`);
    for (const incidentId of change.causedIncidentIds) assert.ok(incidentById.has(incidentId), `${change.id} → ${incidentId}`);
  }
});

test("the six seeded lineage chains are wired", () => {
  // 1. Change-caused P1: CHG → INC (P1) → PRB (RCA overdue) → open fix CHG
  const p1 = incidentById.get("INC0091817");
  assert.equal(p1.priority, "P1");
  assert.equal(p1.causedByChangeId, "CHG0038355");
  assert.ok(changeById.get("CHG0038355").causedIncidentIds.includes("INC0091817"));
  const p1Problem = problemById.get(p1.linkedProblemId);
  assert.equal(p1Problem.rcaOverdue, true);
  assert.equal(changeById.get(p1Problem.permanentFixChangeId).outcome, "Open");

  // 2. Change-caused P2: CHG → INC (P2) → PRB (known error)
  const p2 = incidentById.get("INC0091711");
  assert.equal(p2.priority, "P2");
  assert.equal(p2.causedByChangeId, "CHG0038324");
  assert.equal(problemById.get(p2.linkedProblemId).knownError, true);

  // 3. Successful change with completed release
  const successful = changeById.get("CHG0038299");
  assert.equal(successful.outcome, "Successful");
  assert.equal(releaseById.get(successful.linkedReleaseId).status, "Complete");

  // 4. High-risk upcoming release on a Tier 0 service
  const scheduled = changeById.get("CHG0038412");
  assert.equal(scheduled.status, "Scheduled");
  const upcoming = releaseById.get(scheduled.linkedReleaseId);
  assert.equal(upcoming.risk, "High");
  assert.equal(upcoming.month, "2026-07");
  assert.ok(upcoming.day > 9 && upcoming.day <= 23, "release must fall in the next 14 days");
  const tier0 = businessServices.find((service) => service.id === upcoming.serviceId);
  assert.equal(tier0.criticality, "Tier 0");

  // 5. Failed change that caused an incident
  const failed = changeById.get("CHG0038210");
  assert.equal(failed.outcome, "Failed");
  assert.ok(failed.causedIncidentIds.includes("INC0091544"));

  // 6. Carried-over change with a rescheduled release
  const carried = changeById.get("CHG0038184");
  assert.equal(carried.outcome, "Carried over");
  const rescheduled = releaseById.get(carried.linkedReleaseId);
  assert.equal(rescheduled.status, "Scheduled");
  assert.equal(rescheduled.month, "2026-07");
});
