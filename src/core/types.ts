// ─── Supporting types ─────────────────────────────────────────────────────────

import { MajikSignatureCompactJSON } from "@majikah/majik-signature";

/**
 * What kind of relationship the user claims to have with this URL.
 *   - "ownership":    user controls the domain (can add a DNS TXT record).
 *                      Strongest proof; independent of any single page's content.
 *   - "attribution":  user controls the *content* at this URL (a profile bio,
 *                      video description, repo README) but not the domain/DNS
 *                      itself — e.g. a YouTube channel, a GitHub profile.
 *                      Provable only via page-embed code, never DNS.
 *   - "reference":     user controls neither the domain nor the content.
 *                      A pure attestation ("this URL is about me / relevant to
 *                      me") with no independent proof possible. Should never
 *                      be presented to end users as "verified" — surface it
 *                      as "attested by <signer>" instead.
 */
export type SLinkClaimType = "ownership" | "attribution" | "reference";

export type SLinkVerificationMethod = "dns_txt" | "page_content" | null;

/** Verification status of a MajikSLink */
export type SLinkVerificationStatus =
  | "pending"
  | "unverified" // created but scrape not yet attempted
  | "verified" // challenge found on page + signature valid
  | "failed" // scrape ran but challenge not found
  | "sig_invalid"; // challenge found but signature did not verify

export interface MajikSLinkJSON {
  version: 1;
  id: string;
  user_id: string;
  muid: string;
  /** Full registered domain e.g. "youtube.com" */
  domain: string;
  /** Subdomain or null */
  subdomain: string | null;
  /** Normalised path */
  path: string;
  /** Original URL supplied by the user */
  url: string;
  /** SHA-256 hex digest of the canonical string */
  hash: string;
  /** The short verification code to embed in the page */
  v_code: string;
  /** Detected source platform */
  source: SLinkSource;

  claim_type: SLinkClaimType;
  verification_method: SLinkVerificationMethod;
  /** Verification status */
  status: SLinkVerificationStatus;
  /** ISO timestamp of when this SLink was created */
  timestamp: string;
  /** ISO timestamp of the last verification attempt, or null */
  verified_at: string | null;
  /** Compact envelope — no embedded public keys. Resolve via muid/signerId at verify time. */
  signature: MajikSignatureCompactJSON;
}

/** Source platform of the signed URL */
export type SLinkSource =
  | "youtube"
  | "x"
  | "instagram"
  | "tiktok"
  | "github"
  | "website"
  | "other";

/** Structured URL parts extracted during normalisation */
export interface UrlInfo {
  /** Full registered domain e.g. "youtube.com" */
  domain: string;
  /** Second-level domain only e.g. "youtube" */
  sld: string;
  /** Top-level domain e.g. "com" */
  tld: string;
  /** Subdomain or null e.g. "www" | null */
  subdomain: string | null;
  /** Normalised pathname e.g. "/watch/dQw4w9WgXcQ" */
  path: string;
  /** Reconstructed clean URL (no params, no fragment) */
  cleanUrl: string;
  /** The string that is actually hashed + signed */
  canonical: string;
}

/** Lightweight code-only payload — useful for the UI before full create() */
export interface SLinkCodePreview {
  /** The short string to embed in the page */
  v_code: string;
  /** SHA-256 hex of canonical */
  hash: string;
  /** Reconstructed clean URL */
  cleanUrl: string;
  /** Parsed URL parts */
  urlInfo: UrlInfo;
}

export interface MajikSLinkConstructorOptions {
  version: 1;
  id: string;
  user_id: string;
  muid: string;
  domain: string;
  sld: string;
  tld: string;
  subdomain: string | null;
  path: string;
  url: string;
  clean_url: string;
  hash: string;
  v_code: string;
  source: SLinkSource;
  claim_type?: SLinkClaimType;
  verification_method?: SLinkVerificationMethod;
  status: SLinkVerificationStatus;
  verified_at: Date | null;
  signature: MajikSignatureCompactJSON;
  timestamp: Date;
}
