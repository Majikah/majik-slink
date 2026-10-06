/**
 * index.ts
 * Public API surface for majik-slink.
 */

// ── Main class ────────────────────────────────────────────────────────────────
export { MajikSLink } from "./majik-slink.js";

// ── Types ─────────────────────────────────────────────────────────────────────
export type * from "./core/types.js";

// ── Errors ────────────────────────────────────────────────────────────────────
export * from "./core/errors.js";

// ── Constants ─────────────────────────────────────────────────────────────────
export * from "./core/constants.js";

// ── Low-level utilities (opt-in) ──────────────────────────────────────────────

export {
  parseUrlInfo,
  buildCanonical,
  detectSource,
  defaultVerificationMethod,
} from "./core/utils.js";
