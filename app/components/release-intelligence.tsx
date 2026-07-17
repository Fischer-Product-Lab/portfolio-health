"use client";

import type { ReleaseFinding, ReleaseReadiness, ConcentrationGroup, FindingKind, ReadinessState } from "../../lib/release-intelligence";
import { StatusPill } from "./ui";

type OpenDetail = (
  view: "overview" | "services" | "incidents" | "problems" | "changes" | "releases" | "brief" | "about",
  filter?: { releaseId?: string; finding?: string; readiness?: string; intelligenceKind?: string },
) => void;

export type IntelligenceFilters = {
  kind: FindingKind | "all";
  readiness: ReadinessState | "all";
  findingId?: string;
};

export function ReleaseIntelligenceSummary({
  findings,
  horizonCount,
  horizonDays,
}: {
  findings: ReleaseFinding[];
  horizonCount: number;
  horizonDays: number;
}) {
  const high = findings.filter((f) => f.severity === "High").length;
  const collision = findings.filter((f) => f.kind === "collision").length;
  const blackout = findings.filter((f) => f.kind === "blackout").length;
  const readiness = findings.filter((f) => f.kind === "readiness").length;

  return (
    <section className="panel intelligence-summary" aria-label="Release intelligence summary">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Deterministic release intelligence</span>
          <h2>Next {horizonDays}-day outlook</h2>
        </div>
        <div className="intelligence-kpis">
          <div><span>Horizon releases</span><strong>{horizonCount}</strong></div>
          <div className={high > 0 ? "kpi-alert" : ""}><span>High severity</span><strong>{high}</strong></div>
          <div><span>Collisions</span><strong>{collision}</strong></div>
          <div><span>Blackout / freeze</span><strong>{blackout}</strong></div>
          <div><span>Readiness gaps</span><strong>{readiness}</strong></div>
        </div>
      </div>
      <p className="intelligence-note">Findings are computed from overlapping windows, shared dependencies, blackout policy, and governance evidence — never stored or AI-generated.</p>
    </section>
  );
}

export function ReleaseIntelligenceFilters({
  filters,
  onChange,
}: {
  filters: IntelligenceFilters;
  onChange: (next: IntelligenceFilters) => void;
}) {
  return (
    <div className="intelligence-filters" role="group" aria-label="Release intelligence filters">
      <label>
        <span>Finding type</span>
        <select
          value={filters.kind}
          onChange={(event) => onChange({ ...filters, kind: event.target.value as IntelligenceFilters["kind"], findingId: undefined })}
          aria-label="Filter by finding type"
        >
          <option value="all">All findings</option>
          <option value="collision">Collisions</option>
          <option value="blackout">Blackout / freeze</option>
          <option value="readiness">Readiness</option>
        </select>
      </label>
      <label>
        <span>Readiness state</span>
        <select
          value={filters.readiness}
          onChange={(event) => onChange({ ...filters, readiness: event.target.value as IntelligenceFilters["readiness"] })}
          aria-label="Filter by readiness state"
        >
          <option value="all">All states</option>
          <option value="Blocked">Blocked</option>
          <option value="Action required">Action required</option>
          <option value="Ready with conditions">Ready with conditions</option>
          <option value="Ready">Ready</option>
        </select>
      </label>
      {(filters.kind !== "all" || filters.readiness !== "all" || filters.findingId) && (
        <button type="button" className="clear-button" onClick={() => onChange({ kind: "all", readiness: "all" })}>
          Clear filters
        </button>
      )}
    </div>
  );
}

export function ReleaseFindingsList({
  findings,
  filters,
  openDetail,
}: {
  findings: ReleaseFinding[];
  filters: IntelligenceFilters;
  openDetail: OpenDetail;
}) {
  const filtered = findings.filter((finding) => {
    if (filters.findingId && finding.id !== filters.findingId) return false;
    if (filters.kind !== "all" && finding.kind !== filters.kind) return false;
    return true;
  });

  return (
    <section className="panel findings-panel" aria-label="Prioritized release findings">
      <div className="panel-heading">
        <div><span className="eyebrow">Explainable rules</span><h2>Prioritized findings</h2></div>
        <span className="count-badge">{filtered.length} items</span>
      </div>
      <div className="findings-list">
        {filtered.map((finding) => (
          <button
            key={finding.id}
            type="button"
            className={`finding-row severity-${finding.severity.toLowerCase()}`}
            onClick={() => openDetail("releases", { releaseId: finding.releaseIds[0], finding: finding.id, intelligenceKind: finding.kind })}
            aria-label={`Open ${finding.rule}: ${finding.summary}`}
          >
            <div className="finding-meta">
              <span className="finding-rule">{finding.rule}</span>
              <StatusPill value={finding.severity} />
            </div>
            <strong>{finding.summary}</strong>
            <p>{finding.detail}</p>
            <small>Next action: {finding.recommendation}</small>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state"><strong>No findings match these filters.</strong><span>Widen the finding type or readiness selection.</span></div>
        )}
      </div>
    </section>
  );
}

export function ReleaseConcentrationPanel({ groups }: { groups: ConcentrationGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="panel concentration-panel" aria-label="Concentrated release risk">
      <div className="panel-heading">
        <div><span className="eyebrow">Load concentration</span><h2>By service and owner</h2></div>
      </div>
      <div className="concentration-grid">
        {groups.map((group) => (
          <article key={`${group.kind}-${group.label}`}>
            <span className="eyebrow">{group.kind === "owner" ? "Owner" : group.kind === "tier0" ? "Tier 0" : "Service"}</span>
            <h3>{group.label}</h3>
            <p>{group.note}</p>
            <div className="concentration-meta">
              <span>{group.releaseIds.length} releases</span>
              <span>{group.highRiskCount} high risk</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ReadinessChecklist({ readiness }: { readiness: ReleaseReadiness }) {
  return (
    <div className="drawer-section readiness-section">
      <span>Readiness state</span>
      <div className="drawer-status"><StatusPill value={readiness.state} /></div>
      <ul className="readiness-checklist">
        {readiness.checklist.map((item) => (
          <li key={item.label} className={item.ok ? "ok" : "gap"}>
            <i aria-hidden="true">{item.ok ? "✓" : "○"}</i>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      {readiness.reasons.length > 0 && (
        <div className="readiness-reasons">
          {readiness.reasons.map((reason) => <p key={reason}>{reason}</p>)}
        </div>
      )}
    </div>
  );
}

export function releaseMarkerLabel(releaseId: string, findings: ReleaseFinding[], readiness?: ReleaseReadiness): string {
  const parts: string[] = [releaseId];
  if (readiness && readiness.state !== "Ready") parts.push(readiness.state);
  if (findings.length > 0) parts.push(`${findings.length} finding${findings.length === 1 ? "" : "s"}`);
  return parts.join(", ");
}

export function passesIntelligenceFilters(
  releaseId: string,
  filters: IntelligenceFilters,
  findingsByRelease: Map<string, ReleaseFinding[]>,
  readinessByRelease: Map<string, ReleaseReadiness>,
): boolean {
  if (filters.findingId) {
    const finding = findingsByRelease.get(releaseId)?.find((item) => item.id === filters.findingId);
    if (!finding) return false;
  }
  if (filters.kind !== "all") {
    const hasKind = (findingsByRelease.get(releaseId) ?? []).some((item) => item.kind === filters.kind);
    if (!hasKind) return false;
  }
  if (filters.readiness !== "all") {
    const state = readinessByRelease.get(releaseId)?.state;
    if (state !== filters.readiness) return false;
  }
  return true;
}
