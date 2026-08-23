import {
  businessServices,
  changeRecords,
  demoAsOf,
  incidentRecords,
  problemRecords,
  releaseRecords,
} from "../../../data/portfolio-health";
import {
  computePortfolioHealth,
  computeServiceHealth,
  deriveServiceHealthInput,
} from "../../../lib/health";
import { StatusPill } from "../ui";

const records = {
  incidents: incidentRecords,
  problems: problemRecords,
  changes: changeRecords,
  releases: releaseRecords,
};

const serviceHealthResults = businessServices.map((service) =>
  computeServiceHealth(deriveServiceHealthInput(service, records, demoAsOf)),
);

const portfolioHealth = computePortfolioHealth(businessServices, serviceHealthResults);

const serviceRows = businessServices
  .map((service, index) => ({
    service,
    result: serviceHealthResults[index],
  }))
  .sort((left, right) => left.result.score - right.result.score);

const signalTotals = serviceHealthResults.reduce(
  (totals, result) => ({
    openP1: totals.openP1 + result.signals.openP1,
    slaRiskIncidents: totals.slaRiskIncidents + result.signals.slaRiskIncidents,
    overdueRcas: totals.overdueRcas + result.signals.overdueRcas,
    highRiskReleases14d: totals.highRiskReleases14d + result.signals.highRiskReleases14d,
  }),
  { openP1: 0, slaRiskIncidents: 0, overdueRcas: 0, highRiskReleases14d: 0 },
);

const navLabels = [
  "Portfolio overview",
  "Service health",
  "Incidents",
  "Problems",
  "Changes",
  "Release calendar",
  "Leadership brief",
  "About & suite",
];

/**
 * Faithful in-page chrome of the Portfolio Health operating view —
 * scores, bands, and reasons come from lib/health.ts over the synthetic
 * portfolio. Nothing here is invented or hand-scored.
 */
export function ProductWindow() {
  return (
    <div className="product-window title-window">
      <div className="title-window-chrome">
        <div className="title-window-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="title-window-url">portfolio-health · portfolio overview</div>
      </div>

      <div className="title-window-body">
        <aside className="title-window-rail">
          <div className="title-window-brand">
            <span className="brand-mark">F</span>
            <span>
              <strong>Fischer</strong>
              <small>Product Lab</small>
            </span>
          </div>
          <div className="product-chip">
            <span>Current product</span>
            <strong>Portfolio Health</strong>
          </div>
          <ul>
            {navLabels.map((label, index) => (
              <li key={label} className={index === 0 ? "active" : undefined}>
                {label}
              </li>
            ))}
          </ul>
          <div className="title-window-rail-foot">
            <span className="demo-badge">DEMO</span>
            <small>Synthetic snapshot · no live connection</small>
          </div>
        </aside>

        <div className="title-window-main">
          <section className="hero-band title-window-hero">
            <div>
              <div className="hero-kicker">
                <span className="live-dot" /> Simulated ServiceNow portfolio feed
              </div>
              <h3>Operational health, in one decision-ready view.</h3>
              <ul className="title-window-reasons">
                {portfolioHealth.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            <div className="hero-aside">
              <span>Portfolio health</span>
              <strong>{portfolioHealth.score}</strong>
              <div className="hero-score-band">
                <StatusPill value={portfolioHealth.band} />
              </div>
              <div className="score-track">
                <i style={{ width: `${portfolioHealth.score}%` }} />
              </div>
            </div>
          </section>

          <section className="title-window-signals" aria-label="Computed portfolio signals">
            <div>
              <strong>{signalTotals.openP1}</strong>
              <span>Open P1</span>
            </div>
            <div>
              <strong>{signalTotals.slaRiskIncidents}</strong>
              <span>SLA risk</span>
            </div>
            <div>
              <strong>{signalTotals.overdueRcas}</strong>
              <span>RCA overdue</span>
            </div>
            <div>
              <strong>{signalTotals.highRiskReleases14d}</strong>
              <span>High-risk 14d</span>
            </div>
          </section>

          <section className="title-window-services" aria-label="Computed service health">
            {serviceRows.map(({ service, result }) => (
              <article key={service.id}>
                <div>
                  <strong>{service.name}</strong>
                  <small>{service.criticality} · {service.owner}</small>
                </div>
                <b>{result.score}</b>
                <StatusPill value={result.band} />
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
