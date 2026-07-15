# Security Policy

## Scope and posture

Portfolio Health is a **read-only demonstration product** built on **synthetic data only**:

- Every incident, problem, change, release, service, owner, and metric is fictional. No employer, customer, or personal data exists anywhere in the repository or the running application.
- There are no write paths: no forms, no uploads, no persistence, no API routes, and no authentication.
- The "ServiceNow feed" indicator in the UI is simulated. There is no live ServiceNow (or any other) integration, and no credentials or tokens are present in the codebase or shipped to the browser.
- Health scores and bands are computed by pure, deterministic functions over the bundled synthetic records — no external calls, no AI generation.

Because of this posture, the application holds no confidential assets. The primary security concerns are supply-chain integrity (dependencies, build pipeline) and the integrity of the deployed static assets. See [docs/threat-model.md](docs/threat-model.md) for the STRIDE analysis.

## Reporting a vulnerability

If you find a security issue — for example a dependency vulnerability, a way to tamper with the deployed assets, or anything that contradicts the read-only/synthetic posture described above:

1. Open an issue in this repository describing the problem (no sensitive data is at stake, so public issues are acceptable), or
2. Contact the repository owner directly if you believe the issue affects the hosting account or deploy pipeline rather than the code.

Please include reproduction steps and the affected file or dependency. Reports are reviewed on a best-effort basis; this is a demonstration product, not a production service with an SLA.

## Dependency hygiene

- Dependencies are pinned via `package-lock.json` and installed with `npm ci`.
- `npm audit` findings are reviewed when dependencies change; fixes are applied when they do not break the Vinext/Sites toolchain.
- No secrets are required to build, test, or run the project (`npm install && npm run dev`).

## Out of scope

- Real ServiceNow integration, authentication, and write workflows do not exist in this increment; reports assuming them are out of scope.
- The hosting platform's own infrastructure (TLS termination, CDN, access policies) is governed by the platform provider.
