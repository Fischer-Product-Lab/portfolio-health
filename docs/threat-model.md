# Portfolio Health — Threat Model

**Scope:** the Portfolio Health demonstration application (this repository) and its deployed static build.
**Method:** STRIDE.
**Last reviewed:** July 2026 (Increment 1).

## 1. System description

Portfolio Health is a single-page executive dashboard:

- **Client:** a React (Next.js App Router via Vinext/Vite) application. All views — overview, service scorecards, record tables, drawers, release calendar, About — render from data compiled into the bundle.
- **Data:** a typed synthetic dataset (`data/portfolio-health.ts`) and deterministic scoring engines (`lib/health.ts`). No runtime data sources.
- **Server surface:** a server-rendering worker produced by the build. No API routes, no database bindings in use (D1/R2 are declared null), no session state.
- **Identity:** none. No authentication, no cookies set by the app, no user input other than client-side filter/search state reflected in the URL query string.
- **Egress:** none at runtime. The only external references are four hyperlinks to sibling Fischer Product Lab products (opened with `rel="noreferrer"`).

### Assets worth protecting

| Asset | Why it matters |
|---|---|
| Integrity of deployed assets | A tampered bundle could serve misleading content or malicious script under the product's URL |
| Repository and hosting credentials | Compromise enables asset tampering (held outside the app; platform/account scope) |
| Credibility of the demo | The product must never appear to hold real employer/customer/ITSM data — synthetic labeling is a product guarantee |

### Trust boundaries

1. **Browser ↔ hosting edge** — HTTPS provided by the hosting platform.
2. **Source ↔ build ↔ deploy** — local repository, `npm` dependency graph, Vinext build, platform deploy.

## 2. STRIDE analysis

| Threat | Applicability | Mitigation / disposition |
|---|---|---|
| **S — Spoofing** | No user identity exists to spoof. Site impersonation (look-alike domains) is possible for any public site. | No auth surface to attack. Canonical URLs are published in the README/About; TLS via the hosting platform. |
| **T — Tampering** | No write paths in the app; data is compiled at build time. Residual vector: compromise of repo, dependencies, or deploy pipeline. | Read-only UI by design; `package-lock.json` + `npm ci`; dependency review on change; hosting/deploy credentials never stored in the repo; tests assert product surface and synthetic labeling, so CI catches content tampering that alters them. |
| **R — Repudiation** | Users take no recordable actions; there is nothing to repudiate. | Content changes are attributable through git history. |
| **I — Information disclosure** | The entire dataset is fictional and intentionally public. No secrets, tokens, or personal data exist in the bundle. | Guarded by policy and review: hard rule against real employer/customer/personal data and against browser-exposed credentials. External links use `rel="noreferrer"`. |
| **D — Denial of service** | Static assets served by the platform CDN; no expensive server compute per request. | Platform-level concern; impact limited to demo availability. No amplification surface (no APIs). |
| **E — Elevation of privilege** | Single anonymous read-only role; no privileged functionality exists in the app. | Nothing to elevate to. Hosting-account privilege is managed at the platform, outside app scope. |

## 3. Explicit non-goals and future risk notes

- **No live ServiceNow integration.** If a future increment adds one, this model must be revisited: server-side-only credentials, secret storage outside the repo, egress allow-listing, and data-classification review become mandatory before any real record is fetched.
- **No authentication or RBAC.** Adding either introduces spoofing/EoP surface not analyzed here.
- **No user-generated content.** All XSS-relevant content is developer-authored and React-escaped; there is no user input persisted or reflected beyond client-side filter state in the query string, which is parsed with `URLSearchParams` and matched against fixed view/filter keys.

## 4. Residual risk summary

The realistic risks are supply-chain (malicious or vulnerable npm dependency) and account-level compromise of the repository or hosting platform. Both are mitigated by lockfile discipline, dependency review, and keeping credentials out of the codebase — and bounded by the fact that the application holds no real data and performs no privileged actions.

Review this document whenever the increment scope changes (new data sources, auth, write paths, or public hosting changes).
