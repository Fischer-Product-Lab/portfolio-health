import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

// `next build` (output: "export") prerenders the app to out/. The exported
// HTML is the deployable artifact, so tests assert against it directly.
async function renderHome() {
  return readFile(new URL("../out/index.html", import.meta.url), "utf8");
}

async function renderDemo() {
  const candidates = [
    new URL("../out/demo.html", import.meta.url),
    new URL("../out/demo/index.html", import.meta.url),
  ];
  for (const href of candidates) {
    try {
      return await readFile(href, "utf8");
    } catch {
      // try the next static-export path
    }
  }
  throw new Error("static export did not write out/demo.html or out/demo/index.html");
}

test("prerenders a cinematic title page at /", async () => {
  const html = await renderHome();
  assert.match(html, /<title>Portfolio Health \| Fischer Product Lab<\/title>/i);
  assert.match(html, /Is the portfolio actually healthy\?/);
  assert.match(html, /service disruption/);
  assert.match(html, /root-cause progress/);
  assert.match(html, /change execution/);
  assert.match(html, /release risk/);
  assert.match(html, /decision-ready view/);
  assert.match(html, /synthetic ServiceNow-style demo/);
  assert.match(html, /Open the demo/);
  assert.match(html, /See how it decides/);
  assert.match(html, /href="\/demo"/);
  assert.match(html, /marketing-grain/);
  assert.match(html, /marketing-light/);
  assert.match(html, /geist_/);
  assert.match(html, /How it decides/);
  assert.doesNotMatch(html, /How Portfolio Health is calculated/);
  assert.doesNotMatch(html, /trusted by|Trusted by/i);
  assert.doesNotMatch(html, /spline|@react-three\/fiber|R3F/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("title-page product window renders live health.ts output", async () => {
  const html = await renderHome();
  assert.match(html, />69</);
  assert.match(html, /At Risk/);
  assert.match(html, /Tier 0 at risk: Trading Platform/);
  assert.match(html, /Also at risk: Integration Gateway/);
  assert.match(html, /1 open P1 and 5 overdue RCAs across the portfolio/);
  assert.match(html, /Trading Platform/);
  assert.match(html, /Integration Gateway/);
  assert.match(html, />40</);
  assert.match(html, />68</);
  assert.match(html, /Open P1/);
  assert.match(html, /RCA overdue/);
  assert.match(html, /High-risk 14d/);
});

test("prerenders the existing dashboard at /demo", async () => {
  const html = await renderDemo();
  assert.match(html, /Operational health, in one decision-ready view\./);
  assert.match(html, /Incidents/);
  assert.match(html, /Problems/);
  assert.match(html, /Changes/);
  assert.match(html, /Release calendar/);
  assert.match(html, /Leadership brief/);
  assert.match(html, /Synthetic demo dataset/);
  assert.match(html, /Simulated ServiceNow feed/);
  assert.match(html, /demo-badge/);
  assert.match(html, /no live connection/);
  assert.match(html, /Service health/);
  assert.match(html, /How Portfolio Health is calculated/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the finished product metadata and removes starter assets", async () => {
  const [demoPage, landingPage, layout, css, packageJson, intelligenceUi] = await Promise.all([
    readFile(new URL("../app/demo/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/components/release-intelligence.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(landingPage, /LandingPage/);
  assert.match(demoPage, /ReleaseCalendar/);
  assert.match(demoPage, /BriefView/);
  assert.match(demoPage, /ReleaseIntelligenceSummary/);
  assert.match(demoPage, /release-intelligence/);
  assert.match(intelligenceUi, /Deterministic release intelligence/);
  assert.match(demoPage, /TrendLineChart/);
  assert.match(demoPage, /Opened vs\. closed month over month/);
  assert.match(demoPage, /Array\.from\(\{ length: 12 \}/);
  assert.match(demoPage, /currentMonthKey - 11 \+ index/);
  assert.match(demoPage, /Trailing 12-month view/);
  assert.match(demoPage, /ServicePortfolio/);
  assert.match(demoPage, /service-signals/);
  assert.match(demoPage, /Why this band/);
  assert.match(demoPage, /Linked record lineage/);
  assert.match(demoPage, /recordLineage/);
  assert.match(demoPage, /drawer-lineage/);
  assert.match(demoPage, /Parent change/);
  assert.match(demoPage, /Caused by change/);
  assert.match(demoPage, /Permanent fix change/);
  assert.match(demoPage, /useModalDialog/);
  assert.match(demoPage, /About Portfolio Health/);
  assert.match(demoPage, /suite-links/);
  assert.match(demoPage, /agentops-fpl\.vercel\.app/);
  assert.match(demoPage, /productpulse-fpl\.vercel\.app/);
  assert.match(demoPage, /trustdesk-fpl\.vercel\.app/);
  assert.match(demoPage, /vuln-board\.vercel\.app/);
  assert.match(demoPage, /readRouteState/);
  assert.match(demoPage, /calendar-view-toggle/);
  assert.match(demoPage, /Business service/);
  assert.match(demoPage, /DetailTable/);
  assert.match(demoPage, /Closed with issues/);
  assert.match(demoPage, /Carried over/);
  assert.match(demoPage, /\/demo/);
  assert.match(layout, /\/og\.png/);
  assert.match(layout, /Geist/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /Fischer Product Lab \/ VulnBoard visual system/);
  assert.match(css, /--gold-soft:\s*#d7b56d/);
  assert.match(css, /#0[Bb]1220/);
  assert.match(css, /#F4EFE4|#f4efe4/);
  assert.match(css, /#C4A35A|#c4a35a/);
  assert.match(css, /marketing-grain/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", root)));
});
