"use client";

import { useEffect } from "react";

const DEMO_KEYS = [
  "view",
  "status",
  "outcome",
  "priority",
  "service",
  "search",
  "releaseId",
  "finding",
  "readiness",
  "intelligenceKind",
] as const;

/** Preserve pre-landing deep links (`/?view=releases`) by sending them to /demo. */
export function LegacyDemoRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasDemoState = DEMO_KEYS.some((key) => params.has(key));
    if (!hasDemoState) return;
    window.location.replace(`/demo${window.location.search}`);
  }, []);

  return null;
}
