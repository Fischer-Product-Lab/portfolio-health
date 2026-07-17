// Portfolio Health — local export builders (Increment 2).
// Pure string builders for the weekly brief (Markdown) and the decision
// register / findings (CSV), plus a browser-only download helper. Exports are
// generated entirely client-side from the synthetic dataset — nothing is
// uploaded or fetched.

import type { DecisionEntry, ReleaseFinding, WeeklyBrief } from "./release-intelligence";

const SYNTHETIC_NOTICE =
  "Synthetic demo dataset — every record is fictional; no live connection.";

/** Weekly leadership brief as a self-contained Markdown document. */
export function weeklyBriefMarkdown(brief: WeeklyBrief, register: DecisionEntry[]): string {
  const lines: string[] = [
    "# Portfolio Health — Weekly Leadership Brief",
    "",
    `_${brief.periodLabel}. ${SYNTHETIC_NOTICE}_`,
    "",
    `**${brief.headline}**`,
    "",
  ];

  for (const section of brief.sections) {
    lines.push(`## ${section.title}`, "");
    if (section.items.length === 0) {
      lines.push("- Nothing to report.", "");
      continue;
    }
    for (const item of section.items) {
      const refs = item.refs.length > 0 ? ` (${item.refs.map((ref) => ref.id).join(", ")})` : "";
      lines.push(`- ${item.text}${refs}`);
    }
    lines.push("");
  }

  lines.push("## Decision register", "");
  if (register.length === 0) {
    lines.push("- No open decisions.", "");
  } else {
    lines.push("| ID | Decision | Owner | Due | Status | If not decided |", "| --- | --- | --- | --- | --- | --- |");
    for (const entry of register) {
      const cells = [entry.id, entry.title, entry.owner, entry.due, entry.status, entry.consequence]
        .map((cell) => cell.replaceAll("|", "\\|"));
      lines.push(`| ${cells.join(" | ")} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function csv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell))
        .join(","),
    )
    .join("\r\n");
}

/** Decision register as CSV (one row per decision). */
export function decisionRegisterCsv(register: DecisionEntry[]): string {
  return csv([
    ["id", "decision", "owner", "due", "status", "consequence", "linked_records"],
    ...register.map((entry) => [
      entry.id,
      entry.title,
      entry.owner,
      entry.due,
      entry.status,
      entry.consequence,
      entry.refs.map((ref) => ref.id).join("; "),
    ]),
  ]);
}

/** Release findings as CSV (one row per finding). */
export function findingsCsv(findings: ReleaseFinding[]): string {
  return csv([
    ["id", "kind", "rule", "severity", "releases", "services", "summary", "recommendation"],
    ...findings.map((finding) => [
      finding.id,
      finding.kind,
      finding.rule,
      finding.severity,
      finding.releaseIds.join("; "),
      finding.serviceIds.join("; "),
      finding.summary,
      finding.recommendation,
    ]),
  ]);
}

/** Trigger a local file download from an in-memory string (client-side only). */
export function downloadFile(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
