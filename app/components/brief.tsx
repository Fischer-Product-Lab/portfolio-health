"use client";

import type { DecisionEntry, WeeklyBrief } from "../../lib/release-intelligence";
import { decisionRegisterCsv, downloadFile, findingsCsv, weeklyBriefMarkdown } from "../../lib/exports";
import type { ReleaseFinding } from "../../lib/release-intelligence";
import { StatusPill } from "./ui";

type OpenDetail = (
  view: "overview" | "services" | "incidents" | "problems" | "changes" | "releases" | "brief" | "about",
  filter?: { releaseId?: string; search?: string },
) => void;

export function BriefView({
  brief,
  register,
  findings,
  openDetail,
}: {
  brief: WeeklyBrief;
  register: DecisionEntry[];
  findings: ReleaseFinding[];
  openDetail: OpenDetail;
}) {
  const exportBrief = () => downloadFile("portfolio-health-weekly-brief.md", weeklyBriefMarkdown(brief, register), "text/markdown;charset=utf-8");
  const exportDecisions = () => downloadFile("portfolio-health-decisions.csv", decisionRegisterCsv(register), "text/csv;charset=utf-8");
  const exportFindings = () => downloadFile("portfolio-health-findings.csv", findingsCsv(findings), "text/csv;charset=utf-8");

  const openRef = (ref: { id: string; view: string }) => {
    if (ref.view === "services") openDetail("services");
    else if (ref.view === "releases") openDetail("releases", { releaseId: ref.id });
    else openDetail(ref.view as "incidents" | "problems" | "changes", { search: ref.id });
  };

  return (
    <section className="brief-view">
      <div className="detail-header brief-header">
        <div>
          <span className="eyebrow">Deterministic leadership narrative</span>
          <h1>Weekly leadership brief</h1>
          <p>{brief.periodLabel}. Every line traces to displayed records — no external LLM, no fabricated impact claims.</p>
        </div>
        <div className="brief-export-actions">
          <button type="button" onClick={exportBrief}>Export brief (.md)</button>
          <button type="button" onClick={exportDecisions}>Export decisions (.csv)</button>
          <button type="button" onClick={exportFindings}>Export findings (.csv)</button>
        </div>
      </div>

      <article className="panel brief-headline-card">
        <p className="brief-headline">{brief.headline}</p>
      </article>

      <div className="brief-sections">
        {brief.sections.map((section) => (
          <article className="panel brief-section-card" key={section.title}>
            <h2>{section.title}</h2>
            {section.items.length === 0 ? (
              <p className="brief-empty">Nothing to report.</p>
            ) : (
              <ul className="brief-items">
                {section.items.map((item, index) => (
                  <li key={`${section.title}-${index}`}>
                    <span>{item.text}</span>
                    {item.refs.length > 0 && (
                      <div className="brief-refs">
                        {item.refs.map((ref) => (
                          <button key={`${ref.view}-${ref.id}`} type="button" onClick={() => openRef(ref)}>
                            {ref.id} →
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <section className="panel decision-register" aria-label="Decision register">
        <div className="panel-heading">
          <div><span className="eyebrow">Read-only register</span><h2>Decisions required</h2></div>
          <span className="count-badge">{register.length} entries</span>
        </div>
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Decision / action</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Status</th>
                <th>Consequence of delay</th>
                <th aria-label="Open evidence" />
              </tr>
            </thead>
            <tbody>
              {register.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{entry.id}</strong></td>
                  <td>{entry.title}</td>
                  <td>{entry.owner}</td>
                  <td>{entry.due}</td>
                  <td><StatusPill value={entry.status} /></td>
                  <td>{entry.consequence}</td>
                  <td>
                    {entry.refs[0] && (
                      <button
                        type="button"
                        className="row-arrow"
                        aria-label={`Open evidence for ${entry.id}`}
                        onClick={() => openRef(entry.refs[0])}
                      >
                        →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
