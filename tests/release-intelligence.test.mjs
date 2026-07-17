import assert from "node:assert/strict";
import test from "node:test";

import {
  businessServices,
  blackoutWindows,
  changeRecords,
  demoAsOf,
  freezeExceptions,
  incidentRecords,
  lineageStories,
  problemRecords,
  releaseRecords,
} from "../data/portfolio-health.ts";
import {
  computePortfolioHealth,
  computeServiceHealth,
  deriveServiceHealthInput,
} from "../lib/health.ts";
import {
  assessHorizonReadiness,
  detectAllFindings,
  detectCollisions,
  detectConcentrations,
  deriveDecisionRegister,
  deriveWeeklyBrief,
  INTELLIGENCE_HORIZON_DAYS,
  isHorizonRelease,
} from "../lib/release-intelligence.ts";
import {
  decisionRegisterCsv,
  findingsCsv,
  weeklyBriefMarkdown,
} from "../lib/exports.ts";

const records = {
  incidents: incidentRecords,
  problems: problemRecords,
  changes: changeRecords,
  releases: releaseRecords,
};

const serviceResults = businessServices.map((service) =>
  computeServiceHealth(deriveServiceHealthInput(service, records, demoAsOf)),
);
const portfolio = computePortfolioHealth(businessServices, serviceResults);
const findings = detectAllFindings(
  releaseRecords,
  businessServices,
  blackoutWindows,
  freezeExceptions,
  demoAsOf,
);
const readiness = assessHorizonReadiness(releaseRecords, blackoutWindows, freezeExceptions, demoAsOf);
const register = deriveDecisionRegister({
  releases: releaseRecords,
  windows: blackoutWindows,
  exceptions: freezeExceptions,
  lineage: lineageStories,
  asOf: demoAsOf,
});
const brief = deriveWeeklyBrief({
  asOf: demoAsOf,
  services: businessServices,
  serviceResults,
  portfolio,
  incidents: incidentRecords,
  changes: changeRecords,
  releases: releaseRecords,
  findings,
  register,
});

test("horizon window covers the next three weeks from the demo snapshot", () => {
  assert.equal(INTELLIGENCE_HORIZON_DAYS, 21);
  const horizon = releaseRecords.filter((release) => isHorizonRelease(release, demoAsOf));
  assert.ok(horizon.length >= 5, "seed should include multiple horizon releases");
  assert.ok(
    horizon.some((release) => release.id === "REL000106"),
    "rescheduled entitlement migration should remain in the horizon",
  );
});

test("collision engine flags overlapping high-risk windows on shared services", () => {
  const collisions = detectCollisions(releaseRecords, businessServices, demoAsOf);
  assert.ok(collisions.length > 0, "expected at least one collision finding");
  const entitlementCollision = collisions.find((finding) => finding.releaseIds.includes("REL000106"));
  assert.ok(entitlementCollision, "entitlement migration pair should produce a collision finding");
  assert.equal(entitlementCollision.kind, "collision");
});

test("all findings merge collisions, blackouts, and readiness gaps with stable ordering", () => {
  assert.ok(findings.length > 0);
  const kinds = new Set(findings.map((finding) => finding.kind));
  assert.ok(kinds.has("collision") || kinds.has("blackout") || kinds.has("readiness"));
  for (const finding of findings) {
    assert.ok(finding.id);
    assert.ok(finding.summary);
    assert.ok(finding.recommendation);
    assert.ok(finding.releaseIds.length > 0);
  }
});

test("readiness assessment returns checklist items for horizon releases", () => {
  assert.ok(readiness.length > 0);
  const blockedOrAction = readiness.filter(
    (item) => item.state === "Blocked" || item.state === "Action required",
  );
  assert.ok(blockedOrAction.length > 0, "seed should include releases with readiness gaps");
  for (const item of readiness) {
    assert.ok(item.checklist.length >= 4);
  }
});

test("concentration engine surfaces owner and service load in the horizon", () => {
  const groups = detectConcentrations(releaseRecords, businessServices, demoAsOf);
  assert.ok(groups.length > 0);
  assert.ok(groups.some((group) => group.kind === "owner" || group.kind === "service" || group.kind === "tier0"));
});

test("decision register merges lineage decisions with release governance gaps", () => {
  assert.ok(register.length >= lineageStories.length);
  for (const entry of register) {
    assert.match(entry.id, /^DEC-\d{2}$/);
    assert.ok(entry.title);
    assert.ok(entry.consequence);
    assert.ok(entry.refs.length > 0);
  }
});

test("weekly brief and exports are non-empty and synthetic-safe", () => {
  assert.ok(brief.headline);
  assert.ok(brief.sections.length >= 3);
  const markdown = weeklyBriefMarkdown(brief, register);
  assert.match(markdown, /Portfolio Health — Weekly Leadership Brief/);
  assert.match(markdown, /Synthetic demo dataset/);
  assert.match(decisionRegisterCsv(register), /id,decision,owner/);
  assert.match(findingsCsv(findings), /id,kind,rule,severity/);
});
