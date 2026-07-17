"use client";

// Shared presentational atoms used by page.tsx and the Increment 2 components.

export function StatusPill({ value }: { value: string }) {
  const key = value.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${key}`}>{value}</span>;
}
