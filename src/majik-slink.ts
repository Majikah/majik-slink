/**
 * majik-slink.ts
 */

import type { MajikKey } from "@majikah/majik-key";
import {
  MajikSignature,
  MajikSignatureCompactJSON,
  MajikSignerPublicKeys,
  VerificationResult,
} from "@majikah/majik-signature";
import {
  MajikSLinkConstructorOptions,
  MajikSLinkJSON,
  SLinkClaimType,
  SLinkCodePreview,
  SLinkSource,
  SLinkVerificationMethod,
  SLinkVerificationStatus,
  UrlInfo,
} from "./core/types";
import {
  MajikSLinkError,
  MajikSLinkSerializationError,
  MajikSLinkSigningError,
  MajikSLinkValidationError,
} from "./core/errors";
import { CODE_HEX_LENGTH, CODE_PREFIX, SLINK_VERSION } from "./core/constants";
import {
  assertMajikKey,
  assertNonEmptyString,
  assertUnlockedKey,
  assertValidHttpUrl,
  buildCanonical,
  defaultVerificationMethod,
  detectSource,
  generateId,
  parseUrlInfo,
  sha256Hex,
} from "./core/utils";

// ─── MajikSLink ───────────────────────────────────────────────────────────────

/**
 * MajikSLink
 * ---------------------
 * MajikSLink — URL binding, ownership, and attribution signing/verification.
 * A MajikSLink cryptographically associates a MUID/MajikKey with a
 * publicly-accessible URL by:
 *
 *   1. Normalising the URL to a canonical form (scheme + subdomain + domain +
 *      tld + path, no query string, no fragment, no trailing slash).
 *   2. Deriving a short, deterministic verification code from a SHA-256 digest
 *      of the canonical URL parts — so the same resource always produces the
 *      same code regardless of query params or tracking tokens.
 *   3. Signing the canonical URL string with the signer's MajikKey via
 *      MajikSignature (Ed25519 + ML-DSA-87 hybrid), stored in compact form
 *      (no embedded public keys — resolved externally at verify time via
 *      muid / signerId).
 *
 * The *strength* of the claim is described by `claimType`:
 *   - "ownership":   the signer controls the domain. Verifiable via DNS TXT
 *                     (strongest — survives page changes) or page content.
 *   - "attribution": the signer controls the content at this URL (a channel
 *                     bio, repo README) but not the domain/DNS. Verifiable
 *                     only via page content.
 *   - "reference":   the signer controls neither. A signed attestation with
 *                     no independent proof possible — never present this to
 *                     end users as "verified"; surface it as "attested by
 *                     <signer>" instead.
 * See `SLinkClaimType` / `SLinkVerificationMethod` for the full contract.
 *
 * For "dns_txt" verification, the owner publishes `dnsRecordValue` at
 * `dnsRecordName`. For "page_content", the owner embeds `vCode` anywhere in
 * the public page (description, bio, comment, HTML body) and a scraper
 * verifies its presence. Once found, the MajikSignature certifies the
 * association between the signer's identity and the URL.
 *
 * Canonical URL format (what is signed):
 *   "majik-slink-v1:<subdomain>::<sld>::<tld>::<path>"
 *   e.g. "majik-slink-v1:www::youtube::com::/watch/dQw4w9WgXcQ"
 *
 * Verification code format:
 *   "majik-slink:<first 32 hex chars of SHA-256(canonical)>"
 *   e.g. "majik-slink:a1b2c3d4e5f6..."
 */
export class MajikSLink {
  private readonly _version: 1;
  private readonly _id: string;
  private readonly _user_id: string;
  private readonly _muid: string;

  // URL parts (normalised)
  private readonly _domain: string; // "youtube.com"
  private readonly _sld: string; // "youtube"
  private readonly _tld: string; // "com"
  private readonly _subdomain: string | null;
  private readonly _path: string;

  private readonly _url: string; // original input URL
  private readonly _clean_url: string; // stripped clean URL

  private readonly _hash: string; // SHA-256 hex of canonical
  private readonly _v_code: string; // "majik-slink:<hash[:32]>"

  private readonly _source: SLinkSource;
  private _status: SLinkVerificationStatus;
  private _verified_at: Date | null;

  private readonly _claim_type: SLinkClaimType;
  private readonly _verification_method: SLinkVerificationMethod;
  private readonly _signature: MajikSignatureCompactJSON;
  private _resolvedSignature: MajikSignature | null = null;

  private readonly _timestamp: Date;

  // ── Private constructor — use MajikSLink.create() ────────────────────────

  private constructor(data: MajikSLinkConstructorOptions) {
    this._version = data.version;
    this._id = data.id;
    this._user_id = data.user_id;
    this._muid = data.muid;
    this._domain = data.domain;
    this._sld = data.sld;
    this._tld = data.tld;
    this._subdomain = data.subdomain;
    this._path = data.path;
    this._url = data.url;
    this._clean_url = data.clean_url;
    this._hash = data.hash;
    this._v_code = data.v_code;
    this._source = data.source;
    // `??` — not `||` — so an explicit `null` (a deliberate "no verification
    // possible" for claim_type "reference") is preserved rather than being
    // silently overwritten by the default.
    this._claim_type = data.claim_type ?? "ownership";
    this._verification_method =
      data.verification_method ?? defaultVerificationMethod(this._claim_type);
    this._status = data.status;
    this._verified_at = data.verified_at;
    this._signature = data.signature;
    this._timestamp = data.timestamp;
  }
  // ── Getters ──────────────────────────────────────────────────────────────

  get version(): 1 {
    return this._version;
  }
  get id(): string {
    return this._id;
  }
  get userId(): string {
    return this._user_id;
  }

  get muid(): string {
    return this._muid;
  }

  /** Full registered domain e.g. "youtube.com" */
  get domain(): string {
    return this._domain;
  }
  /** Second-level domain e.g. "youtube" */
  get sld(): string {
    return this._sld;
  }
  /** Top-level domain e.g. "com" */
  get tld(): string {
    return this._tld;
  }
  /** Subdomain or null e.g. "www" */
  get subdomain(): string | null {
    return this._subdomain;
  }
  /** Normalised path */
  get path(): string {
    return this._path;
  }

  /** Original URL as supplied by the user */
  get url(): string {
    return this._url;
  }
  /** Query-param-free URL */
  get cleanUrl(): string {
    return this._clean_url;
  }

  /** SHA-256 hex digest of the canonical string */
  get hash(): string {
    return this._hash;
  }
  /** Short verification code to embed in the page ("majik-slink:…") */
  get vCode(): string {
    return this._v_code;
  }

  get source(): SLinkSource {
    return this._source;
  }
  get status(): SLinkVerificationStatus {
    return this._status;
  }
  get verifiedAt(): Date | null {
    return this._verified_at;
  }

  /**
   * The resolved MajikSignature instance, if `resolveSignature()` has been
   * called. Null until then — MajikSLink stores only the compact envelope
   * (no embedded public keys), so there is nothing to eagerly resolve.
   */
  get signature(): MajikSignature | null {
    return this._resolvedSignature;
  }

  /**
   * Get the raw compact signature JSON as stored/persisted.
   * No public keys are embedded — resolve them externally (e.g. by
   * `signerId` / `muid` from your key registry) before verifying.
   */
  get signatureJSON(): MajikSignatureCompactJSON {
    return this._signature;
  }

  /**
   * Resolve the compact signature into a full MajikSignature instance, using
   * externally-supplied public keys (looked up by `this.muid` or
   * `this.signatureJSON.signerId` from your key registry).
   *
   * There is nothing to fall back to by design — MajikSLink never stores
   * public keys inline, so `publicKeys` is mandatory. The result is cached;
   * subsequent calls with the same (correct) keys are free.
   *
   * @throws {MajikSLinkValidationError} if `publicKeys.signerId` does not
   *         match the signerId recorded on this SLink's signature.
   *
   * @example
   *   const keys = await resolvePublicKeysForMuid(slink.muid);
   *   const sig = slink.resolveSignature(keys);
   *   console.log(sig.hasTSA);
   */
  resolveSignature(publicKeys: MajikSignerPublicKeys): MajikSignature {
    if (!this._resolvedSignature) {
      if (publicKeys.signerId !== this._signature.signerId) {
        throw new MajikSLinkValidationError(
          `publicKeys are for signer "${publicKeys.signerId}" but this SLink was signed by "${this._signature.signerId}".`,
        );
      }
      this._resolvedSignature = MajikSignature.fromCompact(
        this._signature,
        publicKeys,
      );
    }
    return this._resolvedSignature;
  }

  get claimType(): SLinkClaimType {
    return this._claim_type;
  }
  get verificationMethod(): SLinkVerificationMethod {
    return this._verification_method;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  /** True when a successful scrape + signature verification has been recorded */
  get isVerified(): boolean {
    return this._status === "verified";
  }

  /** The OTP-display chunks (groups of 4 hex chars from the hash) */
  get codeChunks(): string[] {
    const hex = this._hash.slice(0, CODE_HEX_LENGTH);
    const chunks: string[] = [];
    for (let i = 0; i < hex.length; i += 4) {
      chunks.push(hex.slice(i, i + 4));
    }
    return chunks;
  }

  /**
   * The DNS TXT record name to publish for `"dns_txt"` verification.
   * Only meaningful when `verificationMethod === "dns_txt"` — for
   * `"page_content"` or `"reference"` SLinks this value is simply
   * irrelevant (not an error), so check `verificationMethod` before using it.
   *
   * @example "_majik-challenge.example.com"
   */
  get dnsRecordName(): string {
    return `_majik-challenge.${this._domain}`;
  }

  /**
   * The DNS TXT record value to publish for `"dns_txt"` verification.
   * See `dnsRecordName` — only meaningful when
   * `verificationMethod === "dns_txt"`.
   *
   * @example "majik-slink-verify=majik-slink:a1b2c3d4..."
   */
  get dnsRecordValue(): string {
    return `majik-slink-verify=${this._v_code}`;
  }

  // ── Static: create ────────────────────────────────────────────────────────

  /**
   * Create and sign a new MajikSLink.
   *
   * @param rawUrl   The public URL to sign. Query params and fragments are
   *                 stripped before signing — identical resources with different
   *                 params will always produce the same hash / v_code.
   * @param key      An unlocked MajikKey with signing keys present.
   * @param userId   The ID of the user who owns this SLink.
   * @param options  Optional overrides (id, timestamp, status).
   *
   * @throws {MajikSLinkValidationError} for bad inputs.
   * @throws {MajikSLinkSigningError}    when the key is locked or lacks signing keys.
   * @throws {MajikSLinkError}           for unexpected failures.
   *
   * @example
   *   const slink = await MajikSLink.create(
   *     "https://youtube.com/watch?v=dQw4w9WgXcQ",
   *     unlockedKey,
   *     user.id,
   *   );
   *   console.log(slink.vCode); // "majik-slink:a1b2c3d4…"
   */
  static async create(
    rawUrl: string,
    key: MajikKey,
    userId: string,
    muid: string,
    options?: {
      id?: string;
      timestamp?: Date;
      status?: SLinkVerificationStatus;
      claimType?: SLinkClaimType; // defaults to "ownership"
      verificationMethod?: SLinkVerificationMethod; // defaults to null
    },
  ): Promise<MajikSLink> {
    // ── Validate inputs ──────────────────────────────────────────────────
    assertNonEmptyString(rawUrl, "url");
    assertNonEmptyString(userId, "userId");
    assertNonEmptyString(muid, "Majik Universal ID");
    assertMajikKey(key);
    assertUnlockedKey(key);
    assertValidHttpUrl(rawUrl);

    const urlInfo = parseUrlInfo(rawUrl);
    if (!urlInfo) {
      throw new MajikSLinkValidationError(
        `Could not parse URL into a valid domain: "${rawUrl}". Ensure it is a public https:// URL.`,
      );
    }

    const ts = options?.timestamp ?? new Date();

    const hash = await sha256Hex(urlInfo.canonical);
    const v_code = `${CODE_PREFIX}${hash.slice(0, CODE_HEX_LENGTH)}`;

    let signature: MajikSignature;
    try {
      signature = await MajikSignature.sign(urlInfo.canonical, key, {
        contentType: "majik-slink/url",
        timestamp: ts.toISOString(),
      });
    } catch (err) {
      throw new MajikSLinkSigningError(
        "Failed to sign the SLink canonical URL.",
        err,
      );
    }

    return new MajikSLink({
      version: SLINK_VERSION,
      id: options?.id ?? generateId(),
      user_id: userId,
      muid,
      domain: urlInfo.domain,
      sld: urlInfo.sld,
      tld: urlInfo.tld,
      subdomain: urlInfo.subdomain,
      path: urlInfo.path,
      url: rawUrl,
      clean_url: urlInfo.cleanUrl,
      hash,
      v_code,
      source: detectSource(urlInfo.sld),
      claim_type: options?.claimType ?? "ownership",
      verification_method: options?.verificationMethod ?? null,
      status: options?.status ?? "unverified",
      verified_at: null,
      signature: signature.toCompact(),
      timestamp: ts,
    });
  }

  // ── Static: generateChallenge ─────────────────────────────────────────────

  /**
   * Derive the verification code and URL info for a raw URL *without* signing.
   *
   * Use this in the UI to show the challenge code to the user before they
   * confirm and trigger the full `create()` flow.
   *
   * Returns null when the URL cannot be parsed (shows inline as a validation
   * error rather than throwing, for convenient use in onChange handlers).
   *
   * @example
   *   const preview = await MajikSLink.generateChallenge(url);
   *   if (preview) setChallenge(preview.v_code);
   */
  static async generateChallenge(
    rawUrl: string,
  ): Promise<SLinkCodePreview | null> {
    try {
      assertValidHttpUrl(rawUrl);
    } catch {
      return null;
    }

    const urlInfo = parseUrlInfo(rawUrl);
    if (!urlInfo) return null;

    const hash = await sha256Hex(urlInfo.canonical);
    const v_code = `${CODE_PREFIX}${hash.slice(0, CODE_HEX_LENGTH)}`;

    return { v_code, hash, cleanUrl: urlInfo.cleanUrl, urlInfo };
  }

  // ── Static: verifySignature ───────────────────────────────────────────────
  /**
   * Verify the stored MajikSignature of a persisted MajikSLink against
   * externally-supplied public keys.
   *
   * This does NOT scrape the target page or check DNS — it only
   * cryptographically checks that the signature covers the canonical URL
   * and was issued by the holder of `publicKeys`. No public keys are
   * embedded in the stored SLink; you must resolve them yourself (e.g. by
   * `signerId` / `muid` from your key registry) before calling this.
   *
   * Use in conjunction with your DNS/scrape check to fully verify a claim:
   *   1. Look up (dns_txt) or scrape (page_content) per `verificationMethod`
   *      and confirm `v_code` is present.
   *   2. Call `verifySignature()` to confirm the cryptographic provenance.
   *
   * @example
   *   const keys = await resolvePublicKeysForMuid(slink.muid);
   *   const result = MajikSLink.verifySignature(slink, keys);
   *   if (!result.valid) console.warn("Signature invalid:", result.reason);
   */
  static verifySignature(
    slink: MajikSLink | MajikSLinkJSON,
    publicKeys: MajikSignerPublicKeys,
  ): VerificationResult {
    const json = slink instanceof MajikSLink ? slink.toJSON() : slink;
    const parts = json.domain.split(".");
    const tld = parts[parts.length - 1] ?? "";
    const sld = parts.slice(0, -1).join(".") || json.domain;
    const canonical = buildCanonical(json.subdomain, sld, tld, json.path);
    return MajikSignature.verifyCompact(canonical, json.signature, publicKeys);
  }

  // ── Instance: verify ──────────────────────────────────────────────────────

  /**
   * Verify this SLink's stored signature against externally-supplied
   * public keys.
   *
   * This validates that:
   *   1. The signature cryptographically matches the canonical URL
   *   2. The signature was created by the holder of the private key
   *      corresponding to `publicKeys`
   *
   * Note: This does NOT scrape the page or check DNS. Use with
   * `markVerified()` after a successful DNS lookup / scrape (per
   * `verificationMethod`) to complete the verification flow.
   *
   * @param publicKeys The signer's public keys (classic Ed25519 + ML-DSA-87),
   *                    resolved externally — e.g. by `this.muid`.
   * @returns Verification result with valid/invalid status and optional reason
   *
   * @example
   *   // After confirming v_code via DNS or page scrape:
   *   const keys = await resolvePublicKeysForMuid(slink.muid);
   *   const result = slink.verify(keys);
   *   if (result.valid) {
   *     slink.markVerified();
   *     await db.save(slink);
   *   }
   */
  verify(publicKeys: MajikSignerPublicKeys): VerificationResult {
    const canonical = buildCanonical(
      this._subdomain,
      this._sld,
      this._tld,
      this._path,
    );
    return MajikSignature.verifyCompact(canonical, this._signature, publicKeys);
  }

  // ── Status mutation ───────────────────────────────────────────────────────

  /**
   * Record a successful scrape verification.
   * Should be called by your server route after a positive scrape result.
   */
  markVerified(): this {
    this._status = "verified";
    this._verified_at = new Date();
    return this;
  }

  /**
   * Record a failed scrape (challenge not found on page).
   */
  markFailed(): this {
    this._status = "failed";
    return this;
  }

  /**
   * Record that the scrape found the code but the signature did not verify.
   */
  markSignatureInvalid(): this {
    this._status = "sig_invalid";
    return this;
  }

  /**
   * Mark the SLink as pending verification (scrape in progress).
   */
  markPending(): this {
    this._status = "pending";
    return this;
  }

  // ── URL utilities ─────────────────────────────────────────────────────────

  /**
   * Re-parse and return structured URL info from this SLink's clean URL.
   * Useful when you need the UrlInfo object on a rehydrated instance.
   */
  parseUrlInfo(): UrlInfo | null {
    return parseUrlInfo(this._clean_url);
  }

  /**
   * Returns true if two SLink instances (or a raw URL + this SLink) refer
   * to the same normalised resource — i.e. they share the same hash.
   *
   * Returns null if the comparison URL cannot be parsed (indicates invalid URL).
   *
   * @example
   *   slink.isSameResource(otherSlink); // true/false
   *   slink.isSameResource("https://youtube.com/watch?v=abc"); // true/false/null
   */
  isSameResource(other: MajikSLink | string): boolean | null {
    if (typeof other === "string") {
      const info = parseUrlInfo(other);
      if (!info) return null; // Indicates parse error

      // Compare canonical strings
      const canonical = buildCanonical(
        info.subdomain,
        info.sld,
        info.tld,
        info.path,
      );
      const thisCanonical = buildCanonical(
        this._subdomain,
        this._sld,
        this._tld,
        this._path,
      );
      return canonical === thisCanonical;
    }
    return this._hash === other._hash;
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  toJSON(): MajikSLinkJSON {
    return {
      version: this._version,
      id: this._id,
      user_id: this._user_id,
      muid: this._muid,
      domain: this._domain,
      subdomain: this._subdomain,
      path: this._path,
      url: this._url,
      hash: this._hash,
      v_code: this._v_code,
      source: this._source,
      claim_type: this._claim_type,
      verification_method: this._verification_method,
      status: this._status,
      timestamp: this._timestamp.toISOString(),
      verified_at: this._verified_at?.toISOString() ?? null,
      signature: this._signature,
    };
  }

  /**
   * Rehydrate a MajikSLink from a plain JSON object (e.g. from a database row).
   * Does NOT re-verify the signature — call `verify()` explicitly with
   * externally-resolved public keys.
   *
   * @throws {MajikSLinkSerializationError} if any required field is missing or malformed.
   */
  static fromJSON(raw: unknown): MajikSLink {
    try {
      const json = raw as MajikSLinkJSON;

      // Required field assertions
      assertNonEmptyString(json?.id, "id");
      assertNonEmptyString(json?.user_id, "user_id");
      assertNonEmptyString(json?.domain, "domain");
      assertNonEmptyString(json?.path, "path");
      assertNonEmptyString(json?.url, "url");
      assertNonEmptyString(json?.hash, "hash");
      assertNonEmptyString(json?.v_code, "v_code");
      assertNonEmptyString(json?.source, "source");
      assertNonEmptyString(json?.claim_type, "claim_type");
      assertNonEmptyString(json?.status, "status");
      assertNonEmptyString(json?.timestamp, "timestamp");

      if (
        json?.claim_type !== "ownership" &&
        json?.claim_type !== "attribution" &&
        json?.claim_type !== "reference"
      ) {
        throw new MajikSLinkSerializationError(
          `"claim_type" must be "ownership", "attribution", or "reference". Got: ${String(json?.claim_type)}`,
        );
      }

      // verification_method is nullable by design — check it's a valid
      // value rather than asserting non-empty.
      if (
        json?.verification_method !== null &&
        json?.verification_method !== "dns_txt" &&
        json?.verification_method !== "page_content"
      ) {
        throw new MajikSLinkSerializationError(
          `"verification_method" must be "dns_txt", "page_content", or null. Got: ${String(json?.verification_method)}`,
        );
      }

      if (!json?.signature || typeof json.signature !== "object") {
        throw new MajikSLinkSerializationError(
          '"signature" must be a MajikSignatureCompactJSON object.',
        );
      }

      // Derive sld / tld from stored domain ("youtube.com" → "youtube", "com")
      // Note: This is a simplified approach. For production use with multi-part
      // TLDs (.co.uk, .github.io), consider storing sld and tld separately in JSON
      // or using a proper public suffix list parser.
      const parts = json.domain.split(".");
      const tld = parts[parts.length - 1] ?? "";
      const sld = parts.slice(0, -1).join(".") || json.domain;

      // Reconstruct clean_url from stored parts
      // The original URL might have had query params, but clean_url never does
      const protocol = json.url.startsWith("https://") ? "https://" : "http://";
      const subdomainPart = json.subdomain ? `${json.subdomain}.` : "";
      const clean_url = `${protocol}${subdomainPart}${json.domain}${json.path}`;

      return new MajikSLink({
        version: SLINK_VERSION,
        id: json.id,
        user_id: json.user_id,
        muid: json.muid,
        domain: json.domain,
        sld,
        tld,
        subdomain: json.subdomain ?? null,
        path: json.path,
        url: json.url,
        clean_url,
        hash: json.hash,
        v_code: json.v_code,
        source: json.source as SLinkSource,
        claim_type: json.claim_type,
        verification_method: json.verification_method,
        status: json.status as SLinkVerificationStatus,
        verified_at: json.verified_at ? new Date(json.verified_at) : null,
        signature: json.signature,
        timestamp: new Date(json.timestamp),
      });
    } catch (err) {
      if (err instanceof MajikSLinkError) throw err;
      throw new MajikSLinkSerializationError(
        "Failed to deserialize MajikSLink from JSON.",
        err,
      );
    }
  }

  /**
   * Serialize to a base64 string for embedding in URLs, QR codes, etc.
   */
  serialize(): string {
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(this.toJSON()));
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (err) {
      throw new MajikSLinkSerializationError(
        "Failed to serialize MajikSLink.",
        err,
      );
    }
  }

  /**
   * Deserialize a MajikSLink from a base64 string produced by `serialize()`.
   */
  static deserialize(base64: string): MajikSLink {
    try {
      assertNonEmptyString(base64, "base64");
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return MajikSLink.fromJSON(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (err) {
      if (err instanceof MajikSLinkError) throw err;
      throw new MajikSLinkSerializationError(
        "Failed to deserialize MajikSLink from base64.",
        err,
      );
    }
  }

  toString(): string {
    return this.serialize();
  }

  // ── Debug / display helpers ────────────────────────────────────────────────

  /**
   * Human-readable summary — useful for logging and dev tools.
   */
  toSummary(): string {
    return [
      `MajikSLink v${this._version}`,
      `  id:       ${this._id}`,
      `  user:     ${this._user_id}`,
      `  url:      ${this._clean_url}`,
      `  v_code:   ${this._v_code}`,
      `  claim:    ${this._claim_type} (${this._verification_method ?? "no verification possible"})`,
      `  status:   ${this._status}`,
      `  source:   ${this._source}`,
      `  signed:   ${this._timestamp.toISOString()}`,
      `  verified: ${this._verified_at?.toISOString() ?? "—"}`,
    ].join("\n");
  }
}

// Freeze static methods
Object.freeze(MajikSLink);

// Freeze instance methods
Object.freeze(MajikSLink.prototype);
