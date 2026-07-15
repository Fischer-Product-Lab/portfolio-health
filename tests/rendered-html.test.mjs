import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "portfolio.test" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Portfolio Health product surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Portfolio Health \| Fischer Product Lab<\/title>/i);
  assert.match(html, /Operational health, in one decision-ready view\./);
  assert.match(html, /Incidents/);
  assert.match(html, /Problems/);
  assert.match(html, /Changes/);
  assert.match(html, /Release calendar/);
  assert.match(html, /Synthetic demo dataset/);
  assert.match(html, /Simulated ServiceNow feed/);
  assert.match(html, /demo-badge/);
  assert.match(html, /no live connection/);
  assert.match(html, /Service health/);
  assert.match(html, /How Portfolio Health is calculated/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the finished product metadata and removes starter assets", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ReleaseCalendar/);
  assert.match(page, /TrendLineChart/);
  assert.match(page, /Opened vs\. closed month over month/);
  assert.match(page, /Array\.from\(\{ length: 12 \}/);
  assert.match(page, /currentMonthKey - 11 \+ index/);
  assert.match(page, /Trailing 12-month view/);
  assert.match(page, /ServicePortfolio/);
  assert.match(page, /service-signals/);
  assert.match(page, /Why this band/);
  assert.match(page, /Linked record lineage/);
  assert.match(page, /recordLineage/);
  assert.match(page, /drawer-lineage/);
  assert.match(page, /Parent change/);
  assert.match(page, /Caused by change/);
  assert.match(page, /Permanent fix change/);
  assert.match(page, /useModalDialog/);
  assert.match(page, /About Portfolio Health/);
  assert.match(page, /suite-links/);
  assert.match(page, /agentops-fpl\.vercel\.app/);
  assert.match(page, /productpulse-fpl\.vercel\.app/);
  assert.match(page, /trustdesk-fpl\.vercel\.app/);
  assert.match(page, /vuln-board\.vercel\.app/);
  assert.match(page, /readRouteState/);
  assert.match(page, /calendar-view-toggle/);
  assert.match(page, /Business service/);
  assert.match(page, /DetailTable/);
  assert.match(page, /Closed with issues/);
  assert.match(page, /Carried over/);
  assert.match(layout, /\/og\.png/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /Fischer Product Lab \/ VulnBoard visual system/);
  assert.match(css, /--gold-soft:\s*#d7b56d/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", root)));
});
