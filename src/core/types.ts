// ─── Supporting types ─────────────────────────────────────────────────────────

import { MajikSignatureJSON } from "@majikah/majik-signature";

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

/** Verification status of a MajikSLink */
export type SLinkVerificationStatus =
  | "pending"
  | "unverified" // created but scrape not yet attempted
  | "verified" // challenge found on page + signature valid
  | "failed" // scrape ran but challenge not found
  | "sig_invalid"; // challenge found but signature did not verify

/** Shape persisted to / rehydrated from a database */
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
  /** Verification status */
  status: SLinkVerificationStatus;
  /** ISO timestamp of when this SLink was created */
  timestamp: string;
  /** ISO timestamp of the last verification attempt, or null */
  verified_at: string | null;
  /** The MajikSignature envelope covering the canonical URL */
  signature: MajikSignatureJSON;
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
