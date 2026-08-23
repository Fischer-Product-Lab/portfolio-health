import Link from "next/link";
import { LegacyDemoRedirect } from "./legacy-demo-redirect";
import { ProductWindow } from "./product-window";

const STEPS = [
  {
    n: "01",
    label: "Inspect",
    copy: "Each business service is scored from its open incidents, problems, recent changes, and the next fourteen days of releases.",
  },
  {
    n: "02",
    label: "Deduct",
    copy: "Every service starts at 100. Open P1s, SLA-risk incidents, overdue RCAs, weak thirty-day change success, and high-risk releases take the score down.",
  },
  {
    n: "03",
    label: "Gate",
    copy: "An open P1 or two overdue RCAs force At Risk. A high average cannot bury a major incident or stalled root cause.",
  },
  {
    n: "04",
    label: "Roll up",
    copy: "The portfolio score weights services by criticality. Any Tier 0 service At Risk forces the portfolio At Risk — with reasons a leader can defend.",
  },
];

export function LandingPage() {
  return (
    <div className="marketing">
      <LegacyDemoRedirect />
      <div className="marketing-grain" aria-hidden />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-baseline gap-3">
            <span className="marketing-type-body font-medium tracking-tight text-ivory">
              Portfolio Health
            </span>
            <span className="marketing-type-meta text-gold">
              Fischer Product Lab
            </span>
          </Link>
          <Link
            href="/demo"
            className="marketing-type-meta text-ivory/70 transition-colors hover:text-gold"
          >
            Open the demo
          </Link>
        </header>

        <main className="flex flex-1 flex-col">
          <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-8 pt-10 text-center sm:pt-16">
            <p className="marketing-type-meta marketing-rise text-gold">
              Read-only · synthetic ServiceNow-style demo
            </p>
            <h1 className="marketing-type-display marketing-rise marketing-rise-delay-1 mt-6 max-w-5xl text-ivory">
              Is the portfolio actually healthy?
            </h1>
            <p className="marketing-type-body marketing-rise marketing-rise-delay-2 mx-auto mt-6 max-w-xl text-ivory/70">
              Track service disruption, root-cause progress, change execution,
              and release risk in one decision-ready view.
            </p>
            <div className="marketing-rise marketing-rise-delay-3 mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/demo"
                className="marketing-type-body inline-flex h-11 items-center rounded-sm bg-ivory px-6 font-medium text-navy transition-opacity hover:opacity-90"
              >
                Open the demo
              </Link>
              <a
                href="#how-it-decides"
                className="marketing-type-body inline-flex h-11 items-center rounded-sm border border-gold/45 px-6 font-medium text-ivory transition-colors hover:border-gold hover:text-gold"
              >
                See how it decides
              </a>
            </div>
          </section>

          <section
            className="marketing-rise marketing-rise-delay-4 relative mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6"
            aria-label="Portfolio Health product"
          >
            <div className="marketing-light" aria-hidden />
            <Link
              href="/demo"
              className="relative z-10 block rounded-xl outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
            >
              <span className="sr-only">
                Open the Portfolio Health operating dashboard in the live demo
              </span>
              <ProductWindow />
            </Link>
          </section>

          <section
            id="how-it-decides"
            className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pb-24"
          >
            <p className="marketing-type-meta text-gold">How it decides</p>
            <h2 className="marketing-type-title mt-3 max-w-2xl text-ivory">
              Health is a pure function. Same records, same band. Nothing is
              hand-scored.
            </h2>
            <ol className="mt-12 divide-y divide-hairline border-y border-hairline">
              {STEPS.map((step) => (
                <li
                  key={step.n}
                  className="grid gap-3 py-7 sm:grid-cols-[5rem_10rem_1fr] sm:items-baseline sm:gap-8"
                >
                  <span className="font-mono text-[length:var(--type-body)] tabular-nums text-gold">
                    {step.n}
                  </span>
                  <span className="marketing-type-meta text-ivory">
                    {step.label}
                  </span>
                  <p className="marketing-type-body text-ivory/70">
                    {step.copy}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <footer className="mx-auto w-full max-w-6xl border-t border-hairline px-6 py-8">
          <p className="marketing-type-meta text-ivory/45">
            Fischer Product Lab · portfolio demonstration · © Trevor Fischer
          </p>
        </footer>
      </div>
    </div>
  );
}
