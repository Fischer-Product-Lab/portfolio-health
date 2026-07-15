"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  businessServices,
  changeOutcomeTotals,
  changeRecords,
  demoAsOf,
  incidentRecords,
  lineageStories,
  monthlyFlow,
  portfolioHeadline,
  problemRecords,
  releaseRecords,
  serviceProfiles,
  type BusinessService,
  type LineageItem,
  type ServiceProfile,
} from "../data/portfolio-health";
import {
  computePortfolioHealth,
  computeServiceHealth,
  deriveServiceHealthInput,
  isOpenIncident,
  isOpenProblem,
  releaseDate,
  type ServiceHealthResult,
} from "../lib/health";

type View = "overview" | "services" | "incidents" | "problems" | "changes" | "releases" | "about";
type FilterState = { status?: string; outcome?: string; priority?: string; service?: string; search?: string; releaseId?: string };

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  service: string;
  owner: string;
  opened: string;
  age: string;
  outcome?: string;
  risk?: string;
};

type Release = {
  id: string;
  changeId: string;
  day: number;
  month: number;
  title: string;
  time: string;
  window: string;
  service: string;
  owner: string;
  risk: "Low" | "Moderate" | "High";
  type: "Standard" | "Normal" | "Emergency";
  status: "Scheduled" | "Ready" | "Pending approval" | "Complete";
  environment: string;
  summary: string;
  conditions: string[];
};

const navItems: { id: View; label: string; short: string }[] = [
  { id: "overview", label: "Portfolio overview", short: "Overview" },
  { id: "services", label: "Service health", short: "Services" },
  { id: "incidents", label: "Incidents", short: "Incidents" },
  { id: "problems", label: "Problems", short: "Problems" },
  { id: "changes", label: "Changes", short: "Changes" },
  { id: "releases", label: "Release calendar", short: "Releases" },
  { id: "about", label: "About & suite", short: "About" },
];

// Fischer Product Lab siblings — framing and links only; each product owns its
// own domain (no security inventory or AI-governance modules re-built here).
const suiteProducts = [
  { name: "AgentOps", role: "AI agent governance — is this agent safe to launch?", href: "https://agentops-fpl.vercel.app/" },
  { name: "ProductPulse", role: "Product analytics — did the shipped initiative actually work?", href: "https://productpulse-fpl.vercel.app/" },
  { name: "TrustDesk", role: "Customer trust questionnaire automation at scale", href: "https://trustdesk-fpl.vercel.app/" },
  { name: "VulnBoard", role: "Executive vulnerability metrics — where is security risk concentrated?", href: "https://vuln-board.vercel.app/" },
];

const monthShortLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleString("en-US", { month: "short" });
};

const trendMonths = monthlyFlow.map((flow) => monthShortLabel(flow.month));

const trends = {
  incidents: { opened: monthlyFlow.map((flow) => flow.incidentsOpened), closed: monthlyFlow.map((flow) => flow.incidentsClosed) },
  problems: { opened: monthlyFlow.map((flow) => flow.problemsOpened), closed: monthlyFlow.map((flow) => flow.problemsClosed) },
  changes: { opened: monthlyFlow.map((flow) => flow.changesOpened), closed: monthlyFlow.map((flow) => flow.changesClosed) },
};

const changeOutcomes = changeOutcomeTotals;
const portfolioMetrics = portfolioHeadline;
const changeSuccessRate = Math.round((changeOutcomes.successful / portfolioMetrics.changes.closed) * 1000) / 10;
const currentMonthKey = demoAsOf.getMonth();
const dataThroughLabel = demoAsOf.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const serviceNameById = new Map(businessServices.map((service) => [service.id, service.name]));
const serviceName = (serviceId: string) => serviceNameById.get(serviceId) ?? serviceId;

// Calendar month key relative to the demo snapshot (July 2026 → 6, August 2025 → −5).
const monthKeyFor = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return (year - demoAsOf.getFullYear()) * 12 + monthNumber - 1;
};

// Display adapters: kit-typed records from data/portfolio-health.ts mapped to
// the row shapes the shipped V1 tables, drawers, and calendar render.
const incidents: Ticket[] = incidentRecords.map((record) => ({
  id: record.id,
  title: record.title,
  status: record.status,
  priority: record.priority,
  service: serviceName(record.serviceId),
  owner: record.owner,
  opened: record.openedLabel,
  age: record.ageLabel,
  risk: record.slaRisk ? "SLA at risk" : undefined,
}));

const problems: Ticket[] = problemRecords.map((record) => ({
  id: record.id,
  title: record.title,
  status: record.status,
  priority: record.priority,
  service: serviceName(record.serviceId),
  owner: record.owner,
  opened: record.openedLabel,
  age: `${record.ageDays}d`,
  risk: record.rcaOverdue ? "RCA overdue" : record.riskNote,
}));

const changes: Ticket[] = changeRecords.map((record) => ({
  id: record.id,
  title: record.title,
  status: record.status,
  priority: record.priority,
  service: serviceName(record.serviceId),
  owner: record.owner,
  opened: record.openedLabel,
  age: `${record.ageDays}d`,
  outcome: record.outcome,
  risk: record.risk,
}));

const releases: Release[] = releaseRecords.map((record) => ({
  id: record.id,
  changeId: record.changeId,
  day: record.day,
  month: monthKeyFor(record.month),
  title: record.title,
  time: record.time,
  window: record.window,
  service: serviceName(record.serviceId),
  owner: record.owner,
  risk: record.risk,
  type: record.type,
  status: record.status,
  environment: record.environment,
  summary: record.summary,
  conditions: record.conditions,
}));

const monthMeta = Array.from({ length: 12 }, (_, index) => {
  const key = currentMonthKey - 11 + index;
  const date = new Date(demoAsOf.getFullYear(), key, 1);
  return {
    key,
    label: date.toLocaleString("en-US", { month: "long", year: "numeric" }),
    short: date.toLocaleString("en-US", { month: "short" }),
    year: date.getFullYear(),
    days: new Date(2026, key + 1, 0).getDate(),
    start: date.getDay(),
  };
});

// Deterministic health engine wiring (lib/health.ts). The UI below displays
// only computed bands, scores, and reasons — never hand-entered ones.
const portfolioRecords = { incidents: incidentRecords, problems: problemRecords, changes: changeRecords, releases: releaseRecords };
const serviceHealthResults = businessServices.map((service) => computeServiceHealth(deriveServiceHealthInput(service, portfolioRecords, demoAsOf)));
const portfolioHealth = computePortfolioHealth(businessServices, serviceHealthResults);

type ServiceCard = {
  service: BusinessService;
  profile: ServiceProfile;
  result: ServiceHealthResult;
  openIncidents: number;
  openProblems: number;
  nextRelease?: { label: string; risk: string };
};

const serviceCards: ServiceCard[] = businessServices
  .map((service, index) => {
    const upcoming = releaseRecords
      .filter((release) => release.serviceId === service.id && releaseDate(release).getTime() > demoAsOf.getTime())
      .sort((left, right) => releaseDate(left).getTime() - releaseDate(right).getTime())[0];
    return {
      service,
      profile: serviceProfiles[service.id],
      result: serviceHealthResults[index],
      openIncidents: incidentRecords.filter((record) => record.serviceId === service.id && isOpenIncident(record)).length,
      openProblems: problemRecords.filter((record) => record.serviceId === service.id && isOpenProblem(record)).length,
      nextRelease: upcoming
        ? { label: releaseDate(upcoming).toLocaleDateString("en-US", { month: "short", day: "numeric" }), risk: upcoming.risk }
        : undefined,
    };
  })
  .sort((left, right) => left.result.score - right.result.score);

const servicesAtRisk = serviceCards.filter((card) => card.result.band === "At Risk").length;
const changeSuccessLabel = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate)}%`);

const lineages = lineageStories.map((story) => ({ ...story, service: serviceName(story.serviceId) }));

// Record lookups for drawer lineage sections (kit §7).
const incidentById = new Map(incidentRecords.map((record) => [record.id, record]));
const problemById = new Map(problemRecords.map((record) => [record.id, record]));
const changeById = new Map(changeRecords.map((record) => [record.id, record]));
const releaseById = new Map(releaseRecords.map((record) => [record.id, record]));

// Linked records for one drawer, in cause → resolution order. Only links whose
// target record exists are returned, so every rendered link is navigable.
function recordLineage(view: "incidents" | "problems" | "changes", id: string): LineageItem[] {
  const links: LineageItem[] = [];
  if (view === "incidents") {
    const record = incidentById.get(id);
    if (record?.causedByChangeId && changeById.has(record.causedByChangeId)) links.push({ label: "Caused by change", id: record.causedByChangeId, view: "changes" });
    if (record?.linkedProblemId && problemById.has(record.linkedProblemId)) links.push({ label: "Linked problem", id: record.linkedProblemId, view: "problems" });
  } else if (view === "problems") {
    const record = problemById.get(id);
    record?.relatedIncidentIds.forEach((incidentId) => {
      if (incidentById.has(incidentId)) links.push({ label: "Related incident", id: incidentId, view: "incidents" });
    });
    if (record?.permanentFixChangeId && changeById.has(record.permanentFixChangeId)) links.push({ label: "Permanent fix change", id: record.permanentFixChangeId, view: "changes" });
  } else {
    const record = changeById.get(id);
    record?.causedIncidentIds.forEach((incidentId) => {
      if (incidentById.has(incidentId)) links.push({ label: "Caused incident", id: incidentId, view: "incidents" });
    });
    if (record?.linkedReleaseId && releaseById.has(record.linkedReleaseId)) links.push({ label: "Linked release", id: record.linkedReleaseId, view: "releases" });
  }
  return links;
}

// Curated headline counts for the overview change-caused callout; each click
// path lands on a representative lineage-linked incident from the record set.
const changeCausedCounts = { P1: 1, P2: 2, P3: 3 } as const;
const changeCausedExample = (priority: "P1" | "P2" | "P3") =>
  incidentRecords.find((record) => record.causedByChangeId && record.priority === priority);

function StatusPill({ value }: { value: string }) {
  const key = value.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${key}`}>{value}</span>;
}

function MiniTrend({ opened, closed }: { opened: number[]; closed: number[] }) {
  const max = Math.max(...opened, ...closed);
  return (
    <div className="mini-trend" aria-label="Twelve month opened versus closed trend">
      {trendMonths.map((month, index) => (
        <div className="trend-column" key={month}>
          <div className="trend-bars">
            <span className="bar opened" style={{ height: `${Math.max(14, (opened[index] / max) * 62)}px` }} />
            <span className="bar closed" style={{ height: `${Math.max(14, (closed[index] / max) * 62)}px` }} />
          </div>
          <span>{month}</span>
        </div>
      ))}
    </div>
  );
}

function TrendLineChart({ months, opened, closed, label }: { months: string[]; opened: number[]; closed: number[]; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const width = canvas.clientWidth;
      const height = 250;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.floor(height * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const styles = getComputedStyle(document.documentElement);
      const muted = styles.getPropertyValue("--muted").trim() || "#69717c";
      const line = styles.getPropertyValue("--line").trim() || "#ded7c9";
      const openedColor = styles.getPropertyValue("--amber").trim() || "#b88a3d";
      const closedColor = styles.getPropertyValue("--green").trim() || "#2f8564";
      const panel = styles.getPropertyValue("--surface").trim() || "#fffdf7";
      const padding = { top: 18, right: 14, bottom: 34, left: 38 };
      const plotWidth = width - padding.left - padding.right;
      const plotHeight = height - padding.top - padding.bottom;
      const rawMax = Math.max(...opened, ...closed);
      const interval = rawMax > 100 ? 50 : 5;
      const chartMax = Math.max(interval, Math.ceil(rawMax / interval) * interval);

      context.font = "10px Inter, system-ui, sans-serif";
      context.textBaseline = "middle";
      for (let gridIndex = 0; gridIndex <= 4; gridIndex += 1) {
        const y = padding.top + (plotHeight * gridIndex) / 4;
        const value = Math.round(chartMax - (chartMax * gridIndex) / 4);
        context.beginPath();
        context.strokeStyle = line;
        context.globalAlpha = .7;
        context.lineWidth = 1;
        context.moveTo(padding.left, y);
        context.lineTo(width - padding.right, y);
        context.stroke();
        context.globalAlpha = 1;
        context.fillStyle = muted;
        context.textAlign = "right";
        context.fillText(String(value), padding.left - 8, y);
      }

      const xFor = (index: number) => padding.left + (plotWidth * index) / Math.max(1, months.length - 1);
      const yFor = (value: number) => padding.top + plotHeight - (value / chartMax) * plotHeight;

      months.forEach((month, index) => {
        if (width < 520 && index % 2 !== 0 && index !== months.length - 1) return;
        context.fillStyle = muted;
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillText(month, xFor(index), height - 22);
      });

      const drawSeries = (values: number[], color: string) => {
        context.beginPath();
        values.forEach((value, index) => {
          const x = xFor(index);
          const y = yFor(value);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.strokeStyle = color;
        context.lineWidth = 2.75;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.stroke();
        values.forEach((value, index) => {
          context.beginPath();
          context.arc(xFor(index), yFor(value), 3.25, 0, Math.PI * 2);
          context.fillStyle = panel;
          context.fill();
          context.lineWidth = 2;
          context.strokeStyle = color;
          context.stroke();
        });
      };

      drawSeries(opened, openedColor);
      drawSeries(closed, closedColor);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [months, opened, closed]);

  const accessibleSummary = months.map((month, index) => `${month}: ${opened[index]} opened and ${closed[index]} closed`).join("; ");
  return <canvas ref={canvasRef} className="line-chart-canvas" role="img" aria-label={`${label}. ${accessibleSummary}`} />;
}

function OperationalTrends({ openDetail }: { openDetail: (view: View, filter?: FilterState) => void }) {
  const [range, setRange] = useState<6 | 12>(12);
  const months = trendMonths.slice(-range);
  const incidentOpened = trends.incidents.opened.slice(-range);
  const incidentClosed = trends.incidents.closed.slice(-range);
  const problemOpened = trends.problems.opened.slice(-range);
  const problemClosed = trends.problems.closed.slice(-range);
  const currentLabel = trendMonths.at(-1) || "Current";
  const currentIncidentOpened = trends.incidents.opened.at(-1) || 0;
  const currentIncidentClosed = trends.incidents.closed.at(-1) || 0;
  const currentProblemOpened = trends.problems.opened.at(-1) || 0;
  const currentProblemClosed = trends.problems.closed.at(-1) || 0;

  return (
    <section className="trend-section" aria-label="Month-over-month operational trends">
      <div className="section-heading trend-section-heading">
        <div><span className="eyebrow">Operational flow</span><h2>Opened vs. closed month over month</h2><p>Volume trend through {dataThroughLabel}. Closure lines above intake indicate backlog burn-down.</p></div>
        <div className="range-toggle" role="group" aria-label="Trend period">
          <button className={range === 6 ? "active" : ""} onClick={() => setRange(6)}>6M</button>
          <button className={range === 12 ? "active" : ""} onClick={() => setRange(12)}>12M</button>
        </div>
      </div>
      <div className="line-chart-grid">
        <article className="panel line-chart-card">
          <div className="line-chart-header">
            <div><span className="eyebrow">Service restoration</span><h3>Incident flow</h3></div>
            <button className="text-link" onClick={() => openDetail("incidents")}>View records →</button>
          </div>
          <div className="line-chart-kpis"><div><span>{currentLabel} opened</span><strong>{currentIncidentOpened}</strong></div><div><span>{currentLabel} closed</span><strong>{currentIncidentClosed}</strong></div><div className="negative"><span>Net flow</span><strong>{currentIncidentOpened - currentIncidentClosed > 0 ? "+" : ""}{currentIncidentOpened - currentIncidentClosed}</strong></div><div><span>Closure ratio</span><strong>{Math.round((currentIncidentClosed / currentIncidentOpened) * 100)}%</strong></div></div>
          <div className="line-chart-legend"><span><i className="legend-opened" /> Opened</span><span><i className="legend-closed" /> Closed</span></div>
          <TrendLineChart months={months} opened={incidentOpened} closed={incidentClosed} label="Incident opened and closed trend" />
          <div className="chart-insight"><span>Watch</span><p>July intake outpaced closures after five months of near-parity or burn-down.</p></div>
        </article>
        <article className="panel line-chart-card">
          <div className="line-chart-header">
            <div><span className="eyebrow">Root-cause elimination</span><h3>Problem flow</h3></div>
            <button className="text-link" onClick={() => openDetail("problems")}>View records →</button>
          </div>
          <div className="line-chart-kpis"><div><span>{currentLabel} opened</span><strong>{currentProblemOpened}</strong></div><div><span>{currentLabel} closed</span><strong>{currentProblemClosed}</strong></div><div className="negative"><span>Net flow</span><strong>{currentProblemOpened - currentProblemClosed > 0 ? "+" : ""}{currentProblemOpened - currentProblemClosed}</strong></div><div><span>Closure ratio</span><strong>{Math.round((currentProblemClosed / currentProblemOpened) * 100)}%</strong></div></div>
          <div className="line-chart-legend"><span><i className="legend-opened" /> Opened</span><span><i className="legend-closed" /> Closed</span></div>
          <TrendLineChart months={months} opened={problemOpened} closed={problemClosed} label="Problem opened and closed trend" />
          <div className="chart-insight"><span>Action</span><p>Problem creation is accelerating while overdue RCA volume remains concentrated in identity and digital services.</p></div>
        </article>
      </div>
    </section>
  );
}

function MetricMethodology() {
  return (
    <details className="metric-methodology">
      <summary>
        <span><strong>How Portfolio Health is calculated</strong><small>Deterministic engine · criticality-weighted service scores · synthetic demonstration</small></span>
        <b>{portfolioHealth.score}/100</b>
      </summary>
      <div className="methodology-reasons">
        <StatusPill value={portfolioHealth.band} />
        {portfolioHealth.reasons.map((reason) => <span className="methodology-reason" key={reason}>{reason}</span>)}
      </div>
      <div className="methodology-grid methodology-grid-services">
        {serviceCards.map(({ service, result }) => (
          <div key={service.id}>
            <span>{service.name}<small>{service.criticality}</small></span>
            <strong>{result.score}</strong>
            <i><b style={{ width: `${result.score}%` }} /></i>
            <p>{result.band} · {result.reasons[0]}</p>
          </div>
        ))}
      </div>
      <p className="methodology-note">Each service starts at 100 with deductions: open P1 −20, SLA-risk incident −8, overdue RCA −12, 30-day change success below 85% −10 (below 70% −20), and each high-risk release in the next 14 days −10. An open P1 or two overdue RCAs force At Risk. The portfolio score weights service scores by criticality (Tier 0 ×3, Tier 1 ×2, Tier 2 ×1). Deterministic synthetic demo — recalibrate to an organization&apos;s targets before production use.</p>
    </details>
  );
}

function ServiceHealthPreview({ openDetail }: { openDetail: (view: View, filter?: FilterState) => void }) {
  return (
    <section className="panel service-preview">
      <div className="panel-heading">
        <div><span className="eyebrow">Portfolio by business service</span><h2>Service health and accountability</h2></div>
        <button className="text-link" onClick={() => openDetail("services")}>Open service portfolio →</button>
      </div>
      <div className="service-preview-grid">
        {serviceCards.slice(0, 4).map(({ service, result, openIncidents }) => (
          <article key={service.id}>
            <div className="service-score"><strong>{result.score}</strong><StatusPill value={result.band} /></div>
            <h3>{service.name}</h3>
            <p>{service.owner}</p>
            <dl>
              <div><dt>Incidents</dt><dd>{openIncidents}</dd></div>
              <div><dt>SLA risk</dt><dd>{result.signals.slaRiskIncidents}</dd></div>
              <div><dt>RCA due</dt><dd>{result.signals.overdueRcas}</dd></div>
              <div><dt>Change success</dt><dd>{changeSuccessLabel(result.signals.changeSuccessRate)}</dd></div>
            </dl>
            <button onClick={() => openDetail("incidents", { service: service.name })}>Review service records <span>→</span></button>
          </article>
        ))}
      </div>
    </section>
  );
}

function LineagePanel({ openDetail }: { openDetail: (view: View, filter?: FilterState) => void }) {
  const openItem = (item: LineageItem) => {
    if (item.view === "releases") openDetail("releases", { releaseId: item.id });
    else openDetail(item.view, { search: item.id });
  };

  return (
    <section className="lineage-section" aria-label="Linked operational record lineage">
      <div className="section-heading">
        <div><span className="eyebrow">Cause to permanent resolution</span><h2>Linked record lineage</h2><p>Trace disruption through root cause, remediation, release, and operating decision.</p></div>
      </div>
      <div className="lineage-grid">
        {lineages.map((lineage) => (
          <article className="panel lineage-card" key={lineage.title}>
            <div className="lineage-heading"><div><StatusPill value={lineage.state} /><h3>{lineage.title}</h3><p>{lineage.service} · {lineage.impact}</p></div><span>{lineage.due}</span></div>
            <div className="lineage-track">
              {lineage.items.map((item, index) => (
                <div key={`${lineage.title}-${item.label}`}>
                  <button onClick={() => openItem(item)}><span>{item.label}</span><strong>{item.id}</strong></button>
                  {index < lineage.items.length - 1 && <i aria-hidden="true">→</i>}
                </div>
              ))}
            </div>
            <div className="decision-row"><span>Decision / exit criterion</span><strong>{lineage.decision}</strong><small>Accountable: {lineage.owner}</small></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ServicePortfolio({ openDetail }: { openDetail: (view: View, filter?: FilterState) => void }) {
  return (
    <section className="service-view">
      <div className="detail-header service-header">
        <div><span className="eyebrow">Portfolio operating model</span><h1>Service health</h1><p>Compare operational exposure, remediation debt, change quality, and accountable decisions by business service.</p></div>
        <div className="summary-chip"><span>Services at risk</span><strong>{servicesAtRisk}</strong></div>
      </div>
      <div className="service-scorecard-grid">
        {serviceCards.map(({ service, profile, result, openIncidents, openProblems, nextRelease }) => (
          <article className="panel service-scorecard" key={service.id}>
            <div className="service-scorecard-heading">
              <div><span className="eyebrow">{service.owner} · {service.criticality}</span><h2>{service.name}</h2></div>
              <div className="service-score"><strong>{result.score}</strong><StatusPill value={result.band} /></div>
            </div>
            <div className="service-score-track"><i style={{ width: `${result.score}%` }} /></div>
            <div className="service-signals" role="group" aria-label={`${service.name} computed health signals`}>
              <div className={result.signals.openP1 > 0 ? "signal-alert" : ""}><strong>{result.signals.openP1}</strong><span>P1 open</span></div>
              <div><strong>{result.signals.slaRiskIncidents}</strong><span>SLA risk</span></div>
              <div><strong>{result.signals.overdueRcas}</strong><span>RCA overdue</span></div>
              <div><strong>{changeSuccessLabel(result.signals.changeSuccessRate)}</strong><span>Change success</span></div>
              <div><strong>{result.signals.highRiskReleases14d}</strong><span>High-risk 14d</span></div>
            </div>
            <dl className="service-kpis">
              <div><dt>Availability</dt><dd>{profile.availability}</dd></div>
              <div><dt>MTTR</dt><dd>{profile.mttr}</dd></div>
              <div><dt>SLA attainment</dt><dd>{profile.sla}</dd></div>
              <div><dt>Open incidents</dt><dd>{openIncidents}</dd></div>
              <div><dt>Open problems</dt><dd>{openProblems}</dd></div>
              <div><dt>Next release</dt><dd>{nextRelease ? nextRelease.label : "None"}{nextRelease && <small>{nextRelease.risk} risk</small>}</dd></div>
            </dl>
            <div className="service-reasons">
              <span>Why this band</span>
              <ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </div>
            <div className="service-decision"><span>Leadership action</span><p>{profile.decision}</p></div>
            <div className="service-actions"><button onClick={() => openDetail("incidents", { service: service.name })}>Incidents</button><button onClick={() => openDetail("problems", { service: service.name })}>Problems</button><button onClick={() => openDetail("changes", { service: service.name })}>Changes</button></div>
          </article>
        ))}
      </div>
      <LineagePanel openDetail={openDetail} />
      <MetricMethodology />
    </section>
  );
}

function PortfolioCard({
  eyebrow,
  title,
  opened,
  closed,
  trend,
  children,
  onOpen,
}: {
  eyebrow: string;
  title: string;
  opened: string;
  closed: string;
  trend: { opened: number[]; closed: number[] };
  children: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <article className="portfolio-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" aria-label={`Open ${title}`} onClick={onOpen}>↗</button>
      </div>
      <div className="volume-row">
        <div><span>Open</span><strong>{opened}</strong></div>
        <div><span>Closed · 30d</span><strong>{closed}</strong></div>
      </div>
      <MiniTrend {...trend} />
      <div className="trend-legend"><span><i className="legend-opened" /> Opened</span><span><i className="legend-closed" /> Closed</span></div>
      <div className="card-footer">{children}</div>
    </article>
  );
}

function Overview({ openDetail }: { openDetail: (view: View, filter?: FilterState) => void }) {
  return (
    <>
      <section className="hero-band">
        <div>
          <div className="hero-kicker"><span className="live-dot" /> Simulated ServiceNow portfolio feed</div>
          <h1>Operational health, in one decision-ready view.</h1>
          <p>Track service disruption, root-cause progress, change execution, and release risk across the portfolio.</p>
        </div>
        <div className="hero-aside">
          <span>Portfolio health</span>
          <strong>{portfolioHealth.score}</strong>
          <div className="hero-score-band"><StatusPill value={portfolioHealth.band} /></div>
          <div className="score-track"><i style={{ width: `${portfolioHealth.score}%` }} /></div>
          <small>{portfolioHealth.reasons[0]}</small>
        </div>
      </section>

      <section className="watch-strip" aria-label="Portfolio watchlist">
        <div className="watch-title"><span className="watch-icon">!</span><div><strong>Leadership watchlist</strong><small>Signals requiring action or awareness</small></div></div>
        <button onClick={() => openDetail("incidents", { priority: "P1" })}><strong>2</strong><span>Major incidents</span><small>1 change-related</small></button>
        <button onClick={() => openDetail("incidents", { status: "SLA at risk" })}><strong>8</strong><span>SLAs at risk</span><small>+2 since yesterday</small></button>
        <button onClick={() => openDetail("problems", { status: "RCA overdue" })}><strong>6</strong><span>RCA overdue</span><small>Oldest: 18 days</small></button>
        <button onClick={() => openDetail("changes", { outcome: "Failed / carried over" })}><strong>5</strong><span>Failed / carried</span><small>Rolling 30 days</small></button>
      </section>

      <MetricMethodology />

      <section className="section-heading">
        <div><span className="eyebrow">Core ITSM signals</span><h2>Flow and outcomes</h2></div>
        <div className="as-of">Data through {dataThroughLabel} · <span>Synthetic demo dataset</span></div>
      </section>

      <section className="portfolio-grid">
        <PortfolioCard eyebrow="Service restoration" title="Incidents" opened={String(portfolioMetrics.incidents.open)} closed={String(portfolioMetrics.incidents.closed)} trend={trends.incidents} onOpen={() => openDetail("incidents")}>
          <button onClick={() => openDetail("incidents", { priority: "P1" })}><strong className="critical-text">{portfolioMetrics.incidents.p1}</strong><span>P1 active</span></button>
          <button onClick={() => openDetail("incidents", { status: "SLA at risk" })}><strong>{portfolioMetrics.incidents.slaRisk}</strong><span>SLA risk</span></button>
          <div><strong>{portfolioMetrics.incidents.mttr}</strong><span>MTTR</span></div>
        </PortfolioCard>
        <PortfolioCard eyebrow="Root-cause elimination" title="Problems" opened={String(portfolioMetrics.problems.open)} closed={String(portfolioMetrics.problems.closed)} trend={trends.problems} onOpen={() => openDetail("problems")}>
          <button onClick={() => openDetail("problems", { status: "RCA overdue" })}><strong className="warning-text">{portfolioMetrics.problems.overdueRca}</strong><span>RCA overdue</span></button>
          <button onClick={() => openDetail("problems", { status: "Known Error" })}><strong>{portfolioMetrics.problems.knownErrors}</strong><span>Known errors</span></button>
          <div><strong>{portfolioMetrics.problems.repeatDrivers}</strong><span>Repeat drivers</span></div>
        </PortfolioCard>
        <PortfolioCard eyebrow="Release execution" title="Changes" opened={String(portfolioMetrics.changes.open)} closed={String(portfolioMetrics.changes.closed)} trend={trends.changes} onOpen={() => openDetail("changes")}>
          <button onClick={() => openDetail("changes", { outcome: "Closed with issues" })}><strong className="warning-text">{portfolioMetrics.changes.withIssues}</strong><span>With issues</span></button>
          <button onClick={() => openDetail("changes", { outcome: "Failed / carried over" })}><strong className="critical-text">{portfolioMetrics.changes.failed + portfolioMetrics.changes.carried}</strong><span>Failed / carried</span></button>
          <div><strong>{changeSuccessRate}%</strong><span>Success rate</span></div>
        </PortfolioCard>
      </section>

      <ServiceHealthPreview openDetail={openDetail} />

      <OperationalTrends openDetail={openDetail} />

      <section className="insights-grid">
        <article className="panel change-health">
          <div className="panel-heading"><div><span className="eyebrow">Change outcomes · 30 days</span><h2>Execution quality</h2></div><button className="text-link" onClick={() => openDetail("changes")}>Review changes →</button></div>
          <div className="health-content">
            <div className="donut" role="img" aria-label={`Change success rate ${changeSuccessRate} percent`}><div><strong>{changeSuccessRate}%</strong><span>successful</span></div></div>
            <div className="outcome-list">
              <button onClick={() => openDetail("changes", { outcome: "Successful" })}><i className="dot-success" /><span>Successful</span><strong>{changeOutcomes.successful}</strong></button>
              <button onClick={() => openDetail("changes", { outcome: "Closed with issues" })}><i className="dot-warning" /><span>Closed with issues</span><strong>{changeOutcomes.withIssues}</strong></button>
              <button onClick={() => openDetail("changes", { outcome: "Failed" })}><i className="dot-danger" /><span>Failed</span><strong>{changeOutcomes.failed}</strong></button>
              <button onClick={() => openDetail("changes", { outcome: "Carried over" })}><i className="dot-muted" /><span>Carried over</span><strong>{changeOutcomes.carried}</strong></button>
            </div>
          </div>
          <div className="caused-row"><span>Incidents caused by change</span>
            {(["P1", "P2", "P3"] as const).map((priority) => {
              const example = changeCausedExample(priority);
              return example
                ? <button key={priority} onClick={() => openDetail("incidents", { search: example.id })} aria-label={`Open a ${priority} incident caused by change`}><b>{priority}</b><strong>{changeCausedCounts[priority]}</strong></button>
                : <div key={priority}><b>{priority}</b><strong>{changeCausedCounts[priority]}</strong></div>;
            })}
          </div>
        </article>

        <article className="panel attention-panel">
          <div className="panel-heading"><div><span className="eyebrow">Prioritized by business impact</span><h2>Needs attention</h2></div><span className="count-badge">4 items</span></div>
          <button onClick={() => openDetail("incidents", { priority: "P1" })}><span className="priority-box p1">P1</span><div><strong>Market data refresh delayed remains active</strong><small>Trading Platform · INC0091817 · 4h 46m</small></div><span>→</span></button>
          <button onClick={() => openDetail("problems", { status: "RCA overdue" })}><span className="priority-box overdue">RCA</span><div><strong>Token expiration root cause overdue</strong><small>Client Identity · PRB0012488 · 4 days late</small></div><span>→</span></button>
          <button onClick={() => openDetail("changes", { outcome: "Failed" })}><span className="priority-box failed">CHG</span><div><strong>Reporting upgrade failed validation</strong><small>Data & Reporting · CHG0038210</small></div><span>→</span></button>
          <button onClick={() => openDetail("releases")}><span className="priority-box cab">CAB</span><div><strong>Market-data patch awaits approval</strong><small>Deploys Jul 14 · Moderate risk</small></div><span>→</span></button>
        </article>
      </section>

      <section className="panel release-preview">
        <div className="panel-heading"><div><span className="eyebrow">Next 14 days</span><h2>Release horizon</h2></div><button className="text-link" onClick={() => openDetail("releases")}>Open full calendar →</button></div>
        <div className="release-track">
          {releases.filter((item) => item.month === currentMonthKey && item.day > demoAsOf.getDate() && item.day <= demoAsOf.getDate() + 14).map((release) => (
            <button key={release.id} onClick={() => openDetail("releases", { releaseId: release.id })}>
              <span className="release-date"><b>{monthMeta.at(-1)?.short.toUpperCase()}</b><strong>{release.day}</strong></span>
              <div><strong>{release.title}</strong><small>{release.service} · {release.time}</small></div>
              <StatusPill value={release.risk} />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function DetailTable({ view, initialFilter, openDetail }: { view: "incidents" | "problems" | "changes"; initialFilter: FilterState; openDetail: (view: View, filter?: FilterState) => void }) {
  const source = view === "incidents" ? incidents : view === "problems" ? problems : changes;
  const [search, setSearch] = useState(initialFilter.search || "");
  const [status, setStatus] = useState(initialFilter.status || "All");
  const [outcome, setOutcome] = useState(initialFilter.outcome || "All");
  const [priority, setPriority] = useState(initialFilter.priority || "All");
  const [service, setService] = useState(initialFilter.service || "All");
  const [selected, setSelected] = useState<Ticket | null>(null);

  const filtered = source.filter((item) => {
    const matchesSearch = `${item.id} ${item.title} ${item.service} ${item.owner}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "All" || item.status === status || (status === "SLA at risk" && item.risk === "SLA at risk") || (status === "RCA overdue" && item.risk === "RCA overdue");
    const matchesOutcome = outcome === "All" || item.outcome === outcome || (outcome === "Failed / carried over" && ["Failed", "Carried over"].includes(item.outcome || ""));
    return matchesSearch && matchesStatus && matchesOutcome && (priority === "All" || item.priority === priority) && (service === "All" || item.service === service);
  });

  const labels = { incidents: { title: "Incident records", subtitle: "Service restoration, ownership, and SLA exposure" }, problems: { title: "Problem records", subtitle: "Root-cause progress, known errors, and permanent resolution" }, changes: { title: "Change records", subtitle: "Release readiness, execution quality, and closure outcomes" } }[view];
  const statuses = Array.from(new Set(source.map((item) => item.status)));
  const outcomes = Array.from(new Set(source.map((item) => item.outcome).filter(Boolean))) as string[];
  const services = Array.from(new Set(source.map((item) => item.service))).sort();

  return (
    <section className="detail-view">
      <div className="detail-header">
        <div><span className="eyebrow">Synthetic ServiceNow-style record view</span><h1>{labels.title}</h1><p>{labels.subtitle}</p></div>
        <div className="summary-chip"><span>Portfolio total</span><strong>{view === "incidents" ? portfolioMetrics.incidents.open + portfolioMetrics.incidents.closed : view === "problems" ? portfolioMetrics.problems.open + portfolioMetrics.problems.closed : portfolioMetrics.changes.open + portfolioMetrics.changes.closed}</strong></div>
      </div>
      <div className="filter-bar">
        <label className="search-field"><span>⌕</span><input aria-label="Search records" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ID, title, service, or owner" /></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option>{statuses.map((item) => <option key={item}>{item}</option>)}{view === "incidents" && <option>SLA at risk</option>}{view === "problems" && <option>RCA overdue</option>}</select></label>
        {view === "changes" && <label><span>Outcome</span><select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option>All</option><option>Failed / carried over</option>{outcomes.map((item) => <option key={item}>{item}</option>)}</select></label>}
        <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option>All</option><option>P1</option><option>P2</option><option>P3</option><option>P4</option></select></label>
        <label><span>Business service</span><select value={service} onChange={(event) => setService(event.target.value)}><option>All</option>{services.map((item) => <option key={item}>{item}</option>)}</select></label>
        {(status !== "All" || outcome !== "All" || priority !== "All" || service !== "All" || search) && <button className="clear-button" onClick={() => { setStatus("All"); setOutcome("All"); setPriority("All"); setService("All"); setSearch(""); }}>Clear filters</button>}
      </div>
      <div className="table-meta"><span>Showing {filtered.length} representative records</span><small>Synthetic data · Snapshot through {dataThroughLabel}</small></div>
      <div className="table-shell">
        <table>
          <thead><tr><th>Record</th><th>Status</th><th>{view === "changes" ? "Outcome" : "Priority"}</th><th>Business service</th><th>Owner / group</th><th>Opened</th><th>Age</th><th aria-label="Open record" /></tr></thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} onClick={() => setSelected(item)}>
                <td><button className="record-link" onClick={() => setSelected(item)}><strong>{item.id}</strong><span>{item.title}</span></button></td>
                <td><StatusPill value={item.status} />{item.risk && !["Low", "Moderate", "High"].includes(item.risk) && <small className="risk-note">{item.risk}</small>}</td>
                <td>{view === "changes" ? <StatusPill value={item.outcome || "Open"} /> : <span className={`priority-text ${item.priority.toLowerCase()}`}>{item.priority}</span>}</td>
                <td>{item.service}</td><td>{item.owner}</td><td>{item.opened}</td><td>{item.age}</td><td><button className="row-arrow" aria-label={`Open ${item.id}`} onClick={() => setSelected(item)}>→</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><strong>No records match these filters.</strong><span>Try widening the status or priority selection.</span></div>}
      </div>
      {selected && <RecordDrawer item={selected} view={view} onClose={() => setSelected(null)} onNavigate={openDetail} />}
    </section>
  );
}

function useModalDialog(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => dialog?.querySelector<HTMLElement>("[data-dialog-close]")?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return dialogRef;
}

function RecordDrawer({ item, view, onClose, onNavigate }: { item: Ticket; view: "incidents" | "problems" | "changes"; onClose: () => void; onNavigate: (view: View, filter?: FilterState) => void }) {
  const dialogRef = useModalDialog(onClose);
  const titleId = `record-drawer-${item.id}`;
  const lineageLinks = recordLineage(view, item.id);
  const openLink = (link: LineageItem) => {
    onClose();
    if (link.view === "releases") onNavigate("releases", { releaseId: link.id });
    else onNavigate(link.view, { search: link.id });
  };
  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside ref={dialogRef} className="record-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="drawer-top"><div><span className="eyebrow">{view.slice(0, -1)} record</span><h2 id={titleId}>{item.id}</h2></div><button data-dialog-close className="close-button" onClick={onClose} aria-label="Close details">×</button></div>
        <h3>{item.title}</h3>
        <div className="drawer-status"><StatusPill value={item.status} /><span className={`priority-text ${item.priority.toLowerCase()}`}>{item.priority}</span>{item.outcome && <StatusPill value={item.outcome} />}</div>
        <dl className="detail-list"><div><dt>Business service</dt><dd>{item.service}</dd></div><div><dt>Assignment</dt><dd>{item.owner}</dd></div><div><dt>Opened</dt><dd>{item.opened}</dd></div><div><dt>Current age</dt><dd>{item.age}</dd></div></dl>
        {lineageLinks.length > 0 && (
          <div className="drawer-section drawer-lineage">
            <span>Lineage</span>
            {lineageLinks.map((link) => (
              <button key={`${link.label}-${link.id}`} onClick={() => openLink(link)}>
                <span>{link.label}</span><strong>{link.id}</strong><b aria-hidden="true">→</b>
              </button>
            ))}
          </div>
        )}
        <div className="drawer-section"><span>Portfolio context</span><p>{view === "incidents" ? "Service restoration is active. Track SLA exposure and link any repeat pattern to a problem record." : view === "problems" ? "Root-cause ownership is established. Permanent-resolution evidence and linked incident reduction remain the exit criteria." : "Readiness, execution evidence, and post-implementation validation determine the final change outcome."}</p></div>
        <div className="activity"><span>Recent activity</span><div><i /><p><strong>Record updated</strong><small>12 minutes ago · {item.owner}</small></p></div><div><i /><p><strong>Portfolio signal recalculated</strong><small>2 hours ago · Automated feed</small></p></div><div><i /><p><strong>Leadership view synchronized</strong><small>Today · Portfolio automation</small></p></div></div>
        <button className="demo-action" disabled>ServiceNow link unavailable in demo</button>
      </aside>
    </div>
  );
}

function ReleaseCalendar({ requestedId, openDetail }: { requestedId?: string; openDetail: (view: View, filter?: FilterState) => void }) {
  // Releases are keyed by REL id; V1 deep links used the parent change id, so both resolve.
  const requested = requestedId ? releases.find((item) => item.id === requestedId || item.changeId === requestedId) : undefined;
  const [month, setMonth] = useState(requested?.month ?? currentMonthKey);
  const [selected, setSelected] = useState<Release | null>(requested ?? null);
  const [display, setDisplay] = useState<"calendar" | "agenda">("calendar");
  const monthData = monthMeta.find((item) => item.key === month) || monthMeta[0];
  const monthReleases = releases.filter((item) => item.month === month).sort((left, right) => left.day - right.day);
  const totalCells = Math.ceil((monthData.start + monthData.days) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, index) => {
    const day = index - monthData.start + 1;
    return day > monthData.days ? 0 : day;
  });

  return (
    <section className="calendar-view">
      <div className="detail-header calendar-header">
        <div><span className="eyebrow">Change & release management</span><h1>Release calendar</h1><p>Trailing 12-month view of production deployments, readiness, risk, and validation conditions.</p></div>
        <div className="calendar-stats"><div><span>This month</span><strong>{monthReleases.length}</strong></div><div><span>High risk</span><strong>{monthReleases.filter((item) => item.risk === "High").length}</strong></div><div><span>Awaiting approval</span><strong>{monthReleases.filter((item) => item.status === "Pending approval").length}</strong></div></div>
      </div>
      <div className="calendar-toolbar">
        <div className="month-control"><button disabled={month === monthMeta[0].key} onClick={() => setMonth(month - 1)} aria-label="Previous month">←</button><strong>{monthData.label}</strong><button disabled={month === monthMeta.at(-1)?.key} onClick={() => setMonth(month + 1)} aria-label="Next month">→</button></div>
        <div className="month-tabs">{monthMeta.map((item) => <button className={month === item.key ? "active" : ""} key={item.key} onClick={() => setMonth(item.key)}><span>{item.short}</span><small>{String(item.year).slice(-2)}</small></button>)}</div>
        <div className="calendar-toolbar-actions">
          <div className="calendar-view-toggle" role="group" aria-label="Release display"><button className={display === "calendar" ? "active" : ""} onClick={() => setDisplay("calendar")}>Calendar</button><button className={display === "agenda" ? "active" : ""} onClick={() => setDisplay("agenda")}>Agenda</button></div>
          <div className="calendar-legend"><span><i className="risk-low" /> Low</span><span><i className="risk-moderate" /> Moderate</span><span><i className="risk-high" /> High risk</span></div>
        </div>
      </div>
      {display === "calendar" && <div className="calendar-shell">
        <div className="weekday-row">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}</div>
        <div className="calendar-grid">
          {cells.map((day, index) => {
            if (day < 1) return <div className="calendar-cell muted-cell" key={`empty-${index}`} />;
            const items = monthReleases.filter((item) => item.day === day);
            const isToday = month === currentMonthKey && day === demoAsOf.getDate();
            return <div className={`calendar-cell ${isToday ? "today" : ""}`} key={day}><div className="day-number"><span>{day}</span>{isToday && <b>Today</b>}</div>{items.map((item) => <button className={`calendar-event risk-${item.risk.toLowerCase()}`} key={item.id} onClick={() => setSelected(item)}><span>{item.time}</span><strong>{item.title}</strong><small>{item.id}</small></button>)}</div>;
          })}
        </div>
      </div>}
      {display === "agenda" && <div className="release-agenda">
        {monthReleases.map((item) => (
          <button key={item.id} onClick={() => setSelected(item)}>
            <span className="agenda-date"><strong>{monthData.short} {item.day}</strong><small>{item.time}</small></span>
            <span className="agenda-detail"><strong>{item.title}</strong><small>{item.service} · {item.id} · {item.environment}</small></span>
            <span className="agenda-status"><StatusPill value={item.risk} /><StatusPill value={item.status} /></span>
            <b aria-hidden="true">→</b>
          </button>
        ))}
        {monthReleases.length === 0 && <div className="empty-state"><strong>No production releases in this month.</strong><span>Select another month to review the trailing twelve-month record.</span></div>}
      </div>}
      {selected && <ReleaseDrawer item={selected} onClose={() => setSelected(null)} onNavigate={openDetail} />}
    </section>
  );
}

function ReleaseDrawer({ item, onClose, onNavigate }: { item: Release; onClose: () => void; onNavigate: (view: View, filter?: FilterState) => void }) {
  const releaseMonth = monthMeta.find((month) => month.key === item.month) || monthMeta[0];
  const dialogRef = useModalDialog(onClose);
  const titleId = `release-drawer-${item.id}`;
  const parentChangeExists = changeById.has(item.changeId);
  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside ref={dialogRef} className="record-drawer release-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="drawer-top"><div><span className="eyebrow">Production change</span><h2 id={titleId}>{item.id}</h2></div><button data-dialog-close className="close-button" onClick={onClose} aria-label="Close details">×</button></div>
        <h3>{item.title}</h3>
        <div className="drawer-status"><StatusPill value={item.status} /><StatusPill value={item.risk} /><StatusPill value={item.type} /></div>
        <div className="release-time-card"><span>Deployment window</span><strong>{releaseMonth.short} {item.day}, {releaseMonth.year}</strong><small>{item.window}</small></div>
        <p className="release-summary">{item.summary}</p>
        <dl className="detail-list"><div><dt>Business service</dt><dd>{item.service}</dd></div><div><dt>Change owner</dt><dd>{item.owner}</dd></div><div><dt>Environment</dt><dd>{item.environment}</dd></div><div><dt>Change type</dt><dd>{item.type}</dd></div></dl>
        <div className="drawer-section drawer-lineage">
          <span>Lineage</span>
          {parentChangeExists ? (
            <button onClick={() => { onClose(); onNavigate("changes", { search: item.changeId }); }}>
              <span>Parent change</span><strong>{item.changeId}</strong><b aria-hidden="true">→</b>
            </button>
          ) : (
            <div className="lineage-static"><span>Parent change</span><strong>{item.changeId}</strong></div>
          )}
        </div>
        <div className="drawer-section conditions"><span>Closure & validation conditions</span>{item.conditions.map((condition) => <div key={condition}><i>✓</i><p>{condition}</p></div>)}</div>
        <div className="drawer-actions"><button className="secondary-action" onClick={onClose}>Back to calendar</button><button className="demo-action" disabled>Change link unavailable in demo</button></div>
      </aside>
    </div>
  );
}

function AboutView({ openDetail }: { openDetail: (view: View, filter?: FilterState) => void }) {
  return (
    <section className="about-view">
      <div className="detail-header about-header">
        <div><span className="eyebrow">Fischer Product Lab</span><h1>About Portfolio Health</h1><p>Operational health, in one decision-ready view.</p></div>
        <div className="summary-chip"><span>Data posture</span><strong>Synthetic</strong></div>
      </div>
      <div className="about-grid">
        <article className="panel about-card">
          <h2>What it is</h2>
          <p>Portfolio Health is an executive ITSM operating dashboard. It presents fictional ServiceNow-style incident, problem, change, and release records as one consolidated leadership view — flow, outcomes, risk, ownership, trend, and release timing — so a portfolio manager can move from awareness to accountability instead of reading ticket-count reports.</p>
        </article>
        <article className="panel about-card">
          <h2>How the score works</h2>
          <p>Health bands and scores are deterministic: pure functions over the stored records, with explainable reasons. Each service starts at 100 and takes deductions for open P1s, SLA-risk incidents, overdue RCAs, weak 30-day change success, and high-risk releases in the next 14 days; an open P1 or two overdue RCAs force At Risk. The portfolio score weights services by criticality (Tier 0 ×3, Tier 1 ×2, Tier 2 ×1). Nothing is hand-scored and nothing is AI-generated.</p>
          <button className="text-link" onClick={() => openDetail("services")}>See the service scorecards →</button>
        </article>
        <article className="panel about-card">
          <h2>Architecture &amp; posture (Increment 1)</h2>
          <p>A typed synthetic data model feeds deterministic health engines covered by unit tests, and the UI renders only what the engines return. The app is read-only — no forms, no writes, no auth, no uploads. The ServiceNow feed indicator is simulated: there is no live integration, and no employer, customer, or personal data appears anywhere in the product.</p>
        </article>
        <article className="panel about-card suite-card">
          <h2>The Fischer Product Lab suite</h2>
          <p>Portfolio Health is the operations pillar of a governed product suite — each sibling turns a different noisy enterprise domain into decision-quality executive signal.</p>
          <ul>
            {suiteProducts.map((product) => (
              <li key={product.name}>
                <a href={product.href} target="_blank" rel="noreferrer">
                  <strong>{product.name}</strong>
                  <span>{product.role}</span>
                </a>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function readRouteState() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view") as View | null;
  const view = requestedView && navItems.some((item) => item.id === requestedView) ? requestedView : "overview";
  const filter: FilterState = {};
  (["status", "outcome", "priority", "service", "search", "releaseId"] as const).forEach((key) => {
    const value = params.get(key);
    if (value) filter[key] = value;
  });
  return { view, filter };
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [filter, setFilter] = useState<FilterState>({});
  const [lastSync, setLastSync] = useState("2 min ago");

  const activeLabel = useMemo(() => navItems.find((item) => item.id === view)?.label || "Portfolio overview", [view]);

  useEffect(() => {
    const applyRoute = () => {
      const route = readRouteState();
      setView(route.view);
      setFilter(route.filter);
    };
    applyRoute();
    window.addEventListener("popstate", applyRoute);
    return () => window.removeEventListener("popstate", applyRoute);
  }, []);

  function openDetail(nextView: View, nextFilter: FilterState = {}) {
    setFilter(nextFilter);
    setView(nextView);
    const params = new URLSearchParams();
    if (nextView !== "overview") params.set("view", nextView);
    Object.entries(nextFilter).forEach(([key, value]) => { if (value) params.set(key, value); });
    const nextUrl = params.size > 0 ? `/?${params.toString()}` : "/";
    window.history.pushState(null, "", nextUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">F</div><div><strong>Fischer</strong><span>Product Lab</span></div></div>
        <div className="product-chip"><span>Current product</span><strong>Portfolio Health</strong></div>
        <nav aria-label="Primary navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => openDetail(item.id)}><span className={`nav-glyph glyph-${item.id}`} />{item.label}</button>)}</nav>
        <div className="sidebar-footer"><div><span className="live-dot" /><div><strong>Simulated ServiceNow feed</strong><small>Synthetic snapshot · no live connection</small></div></div><span className="demo-badge">DEMO</span></div>
        <div className="suite-links">
          <span>Product Lab suite</span>
          <div>{suiteProducts.map((product) => <a key={product.name} href={product.href} target="_blank" rel="noreferrer" title={product.role}>{product.name}</a>)}</div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark">F</div><div><span>Fischer Product Lab</span><strong>{activeLabel}</strong></div></div>
          <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => openDetail(item.id)}>{item.short}</button>)}</nav>
          <div className="topbar-context"><span>Fischer Product Lab</span><b>/</b><span>Portfolio Health</span><b>/</b><strong>{activeLabel}</strong></div>
          <div className="topbar-actions"><button className="sync-button" aria-label="Refresh synthetic demo snapshot" onClick={() => { setLastSync("just now"); window.setTimeout(() => setLastSync("1 min ago"), 60000); }}><span className="sync-icon">↻</span><span><b>Demo snapshot</b><small>Refreshed {lastSync}</small></span></button><span className="avatar" role="img" aria-label="Trevor Fischer demo profile">TF</span></div>
        </header>
        <main>
          {view === "overview" && <Overview openDetail={openDetail} />}
          {view === "services" && <ServicePortfolio openDetail={openDetail} />}
          {view === "incidents" && <DetailTable key={`incidents-${JSON.stringify(filter)}`} view="incidents" initialFilter={filter} openDetail={openDetail} />}
          {view === "problems" && <DetailTable key={`problems-${JSON.stringify(filter)}`} view="problems" initialFilter={filter} openDetail={openDetail} />}
          {view === "changes" && <DetailTable key={`changes-${JSON.stringify(filter)}`} view="changes" initialFilter={filter} openDetail={openDetail} />}
          {view === "releases" && <ReleaseCalendar key={filter.releaseId || "calendar"} requestedId={filter.releaseId} openDetail={openDetail} />}
          {view === "about" && <AboutView openDetail={openDetail} />}
        </main>
      </div>
    </div>
  );
}
