/**
 * index.ts
 * Public API surface for majik-slink.
 */

// ── Main class ────────────────────────────────────────────────────────────────
export { MajikSLink } from "./majik-slink";

// ── Types ─────────────────────────────────────────────────────────────────────
export type * from "./core/types";

// ── Errors ────────────────────────────────────────────────────────────────────
export * from "./core/errors";

// ── Constants ─────────────────────────────────────────────────────────────────
export * from "./core/constants";

// ── Low-level utilities (opt-in) ──────────────────────────────────────────────

export { parseUrlInfo, buildCanonical, detectSource } from "./core/utils";
