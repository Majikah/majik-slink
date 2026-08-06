// ─── Internal helpers ─────────────────────────────────────────────────────────

import { MajikKey } from "@majikah/majik-key";
import { MajikSLinkSigningError, MajikSLinkValidationError } from "./errors";
import {
  SLinkClaimType,
  SLinkSource,
  SLinkVerificationMethod,
  UrlInfo,
} from "./types";
import { CANONICAL_PREFIX } from "./constants";
import psl from "psl";

export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateId(): string {
  // 16-byte random hex — replace with your preferred ID strategy (uuid, nanoid, etc.)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Detect the likely source platform from a registered domain.
 */
export function detectSource(sld: string): SLinkSource {
  switch (sld.toLowerCase()) {
    case "youtube":
      return "youtube";
    case "twitter":
    case "x":
      return "x";
    case "instagram":
      return "instagram";
    case "tiktok":
      return "tiktok";
    case "github":
      return "github";
    default:
      return "other";
  }
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function assertNonEmptyString(
  value: unknown,
  name: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MajikSLinkValidationError(
      `"${name}" must be a non-empty string.`,
    );
  }
}

export function assertValidHttpUrl(value: string): void {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new MajikSLinkValidationError(
        `URL must use http or https. Got: "${u.protocol}"`,
      );
    }
  } catch (err) {
    if (err instanceof MajikSLinkValidationError) throw err;
    throw new MajikSLinkValidationError(`Invalid URL: "${value}"`, err);
  }
}

export function assertMajikKey(key: unknown): asserts key is MajikKey {
  if (!key || typeof key !== "object") {
    throw new MajikSLinkValidationError("A MajikKey instance is required.");
  }
  if (typeof (key as MajikKey).fingerprint !== "string") {
    throw new MajikSLinkValidationError(
      "Provided key does not appear to be a MajikKey (missing fingerprint).",
    );
  }
}

export function assertUnlockedKey(key: MajikKey): void {
  if ((key as MajikKey).isLocked) {
    throw new MajikSLinkSigningError(
      "MajikKey is locked. Call unlock() before creating a MajikSLink.",
    );
  }
  if (!(key as MajikKey).hasSigningKeys) {
    throw new MajikSLinkSigningError(
      "MajikKey has no signing keys. Re-import via importFromMnemonicBackup() to enable signing.",
    );
  }
}

// ─── URL normalisation ────────────────────────────────────────────────────────

/**
 * Parse and normalise a URL into its constituent parts, stripping all query
 * params, auth, fragments, and trailing slashes from the path.
 *
 * Returns null when the URL cannot be resolved to a valid PSL domain.
 */
export function parseUrlInfo(rawUrl: string): UrlInfo | null {
  try {
    assertValidHttpUrl(rawUrl);

    const parsedUrl = new URL(rawUrl);
    const hostnameStr = parsedUrl.hostname;

    const pslResult = psl.parse(hostnameStr);

    // psl.parse returns a ParsedDomain | { error } union
    if ("error" in pslResult && pslResult.error) return null;

    const parsed = pslResult as psl.ParsedDomain;

    if (!parsed.domain) return null;

    const sld = parsed.sld ?? hostnameStr;
    const tld = parsed.tld ?? "";
    const subdomain = parsed.subdomain ?? null;
    const domain = parsed.domain; // e.g. "youtube.com"

    // Normalise path: strip trailing slash unless it is the root
    let path = parsedUrl.pathname;
    if (path !== "/" && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    if (!path) path = "/";

    const cleanUrl = `${parsedUrl.protocol}//${hostnameStr}${path}`;

    // Canonical string that is hashed and signed
    const canonical = `${CANONICAL_PREFIX}${subdomain ?? "root"}::${sld}::${tld}::${path}`;

    return { domain, sld, tld, subdomain, path, cleanUrl, canonical };
  } catch {
    return null;
  }
}

/**
 * Reconstruct the canonical string from already-parsed parts.
 * Used during fromJSON rehydration to avoid re-running PSL.
 */
export function buildCanonical(
  subdomain: string | null,
  sld: string,
  tld: string,
  path: string,
): string {
  return `${CANONICAL_PREFIX}${subdomain ?? "root"}::${sld}::${tld}::${path}`;
}

/**
 * Derive the natural default verification method for a claim type when the
 * caller doesn't specify one explicitly.
 *   - "ownership"   → "dns_txt" (strongest available proof for a domain the signer controls)
 *   - "attribution" → "page_content" (only proof possible without domain control)
 *   - "reference"   → null (no independent proof is possible at all)
 */
export function defaultVerificationMethod(
  claimType: SLinkClaimType,
): SLinkVerificationMethod {
  switch (claimType) {
    case "ownership":
      return "dns_txt";
    case "attribution":
      return "page_content";
    case "reference":
      return null;
  }
}
