import { describe, it, expect, beforeAll } from "vitest";
import { MajikSLink } from "../src/majik-slink";
import { MajikKey } from "@majikah/majik-key";
import { MajikSignature } from "@majikah/majik-signature";

import { getTestKey } from "./helpers/crypto";
import {
  MajikSLinkSerializationError,
  MajikSLinkValidationError,
} from "../src/core/errors";
import { CODE_HEX_LENGTH, CODE_PREFIX } from "../src/core/constants";

// ─── TEST SUITE ──────────────────────────────────────────────────────────────

describe("MajikSLink Class Unit Tests", () => {
  // ── SHARED KEY POOL ─────────────────────────────────────────────────────
  //
  // Created ONCE, in parallel, at the top of the suite to optimise test run
  // times, matching the strategy used in majik-signature.test.ts.
  let keyA: MajikKey;
  let keyB: MajikKey;

  const dummyUserId = "user_abc123";
  const dummyMuid = "muid_xyz987";
  const standardUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  beforeAll(async () => {
    console.log(
      "[majik-slink] Generating shared key pool (2 keys, parallel)...",
    );
    [keyA, keyB] = await Promise.all([getTestKey(), getTestKey()]);
    console.log("[majik-slink] Shared key pool ready.");
  }, 120000);

  // ── INITIALISATION & CREATION TESTS ─────────────────────────────────────

  describe("Creation (.create)", () => {
    it("should successfully create and sign an SLink with a standard valid URL", async () => {
      const slink = await MajikSLink.create(
        standardUrl,
        keyA,
        dummyUserId,
        dummyMuid,
      );

      expect(slink).toBeInstanceOf(MajikSLink);
      expect(slink.version).toBe(1);
      expect(slink.userId).toBe(dummyUserId);
      expect(slink.muid).toBe(dummyMuid);

      // Verification Defaults
      expect(slink.claimType).toBe("ownership");
      expect(slink.verificationMethod).toBe("dns_txt");
      expect(slink.status).toBe("unverified");
      expect(slink.isVerified).toBe(false);

      // URL parts
      expect(slink.domain).toBe("youtube.com");
      expect(slink.sld).toBe("youtube");
      expect(slink.tld).toBe("com");
      expect(slink.subdomain).toBe("www");
      expect(slink.path).toBe("/watch");
      expect(slink.cleanUrl).toBe("https://www.youtube.com/watch");
      expect(slink.source).toBe("youtube");

      // Crypto payload
      expect(slink.hash).toBeDefined();
      expect(slink.vCode.startsWith(CODE_PREFIX)).toBe(true);
      expect(slink.signatureJSON).toBeDefined();
      expect(slink.signatureJSON.signerId).toBe(keyA.fingerprint);
    });

    it("should strip query parameters, fragments, and trailing slashes for the canonical cleanUrl", async () => {
      const noisyUrl =
        "https://github.com/majikah/repo/?utm_source=test&ref=123#readme";
      const slink = await MajikSLink.create(
        noisyUrl,
        keyA,
        dummyUserId,
        dummyMuid,
      );

      expect(slink.cleanUrl).toBe("https://github.com/majikah/repo");
      expect(slink.path).toBe("/majikah/repo");
      expect(slink.source).toBe("github");
    });

    it("should set appropriate default verification methods for different claim types", async () => {
      const attrSlink = await MajikSLink.create(
        standardUrl,
        keyA,
        dummyUserId,
        dummyMuid,
        {
          claimType: "attribution",
        },
      );
      expect(attrSlink.claimType).toBe("attribution");
      expect(attrSlink.verificationMethod).toBe("page_content");

      const refSlink = await MajikSLink.create(
        standardUrl,
        keyA,
        dummyUserId,
        dummyMuid,
        {
          claimType: "reference",
        },
      );
      expect(refSlink.claimType).toBe("reference");
      expect(refSlink.verificationMethod).toBeNull();
    });

    it("should explicitly reject malformed or non-HTTP URLs", async () => {
      await expect(
        MajikSLink.create("not-a-url", keyA, dummyUserId, dummyMuid),
      ).rejects.toThrow(MajikSLinkValidationError);
      await expect(
        MajikSLink.create("ftp://example.com", keyA, dummyUserId, dummyMuid),
      ).rejects.toThrow(MajikSLinkValidationError);
    });

    it("should reject empty strings for required parameters", async () => {
      await expect(
        MajikSLink.create(standardUrl, keyA, "", dummyMuid),
      ).rejects.toThrow(/userId.*must be a non-empty string/);
    });
  });

  // ── CHALLENGE GENERATION TESTS ──────────────────────────────────────────

  describe("Challenge Generation (.generateChallenge)", () => {
    it("should generate a valid challenge payload for a well-formed URL without signing", async () => {
      const challenge = await MajikSLink.generateChallenge(standardUrl);

      expect(challenge).not.toBeNull();
      expect(challenge?.v_code).toMatch(/^majik-slink:/);
      expect(challenge?.cleanUrl).toBe("https://www.youtube.com/watch");
      expect(challenge?.hash.length).toBe(64);
      expect(challenge?.urlInfo.domain).toBe("youtube.com");
    });

    it("should return null gracefully instead of throwing for an invalid URL", async () => {
      const challenge =
        await MajikSLink.generateChallenge("invalid-url-string");
      expect(challenge).toBeNull();
    });

    it("should generate identical v_codes for URLs that resolve to the same canonical resource", async () => {
      const challenge1 = await MajikSLink.generateChallenge(
        "https://x.com/profile",
      );
      const challenge2 = await MajikSLink.generateChallenge(
        "https://x.com/profile?tracker=123#top",
      );

      expect(challenge1?.v_code).toBe(challenge2?.v_code);
      expect(challenge1?.hash).toBe(challenge2?.hash);
    });
  });

  // ── VERIFICATION TESTS ──────────────────────────────────────────────────

  describe("Cryptographic Verification (.verify & .verifySignature)", () => {
    let slink: MajikSLink;
    let publicKeysA: any;
    let publicKeysB: any;

    beforeAll(async () => {
      slink = await MajikSLink.create(
        standardUrl,
        keyA,
        dummyUserId,
        dummyMuid,
      );
      publicKeysA = MajikSignature.publicKeysFromMajikKey(keyA);
      publicKeysB = MajikSignature.publicKeysFromMajikKey(keyB);
    });

    it("should successfully verify using the correct externally-supplied public keys (.verify)", () => {
      const result = slink.verify(publicKeysA);
      expect(result.valid).toBe(true);
      expect(result.signerId).toBe(keyA.fingerprint);
    });

    it("should fail verification when presented with non-matching public keys", () => {
      const result = slink.verify(publicKeysB);
      expect(result.valid).toBe(false);
    });

    it("should allow static verification of a bare JSON representation (.verifySignature)", () => {
      const json = slink.toJSON();
      const result = MajikSLink.verifySignature(json, publicKeysA);
      expect(result.valid).toBe(true);
    });

    it("should resolve the underlying MajikSignature instance caching it on success (.resolveSignature)", () => {
      const signature = slink.resolveSignature(publicKeysA);
      expect(signature).toBeInstanceOf(MajikSignature);
      expect(signature.signerId).toBe(keyA.fingerprint);

      // Testing the cached path
      const cachedSignature = slink.resolveSignature(publicKeysA);
      expect(cachedSignature).toBe(signature);
    });

    it("should throw an error resolving the signature if the provided keys mismatch the stored signerId", () => {
      // Hydrate a fresh instance so we bypass the cached signature from previous tests
      const freshSlink = MajikSLink.fromJSON(slink.toJSON());

      expect(() => freshSlink.resolveSignature(publicKeysB)).toThrow(
        MajikSLinkValidationError,
      );
    });
  });

  // ── STATE MUTATION TESTS ────────────────────────────────────────────────

  describe("Status Mutations", () => {
    it("should mutate status states properly via marking functions", async () => {
      const slink = await MajikSLink.create(
        standardUrl,
        keyA,
        dummyUserId,
        dummyMuid,
      );
      expect(slink.status).toBe("unverified");
      expect(slink.isVerified).toBe(false);

      slink.markPending();
      expect(slink.status).toBe("pending");

      slink.markFailed();
      expect(slink.status).toBe("failed");

      slink.markSignatureInvalid();
      expect(slink.status).toBe("sig_invalid");

      slink.markVerified();
      expect(slink.status).toBe("verified");
      expect(slink.isVerified).toBe(true);
      expect(slink.verifiedAt).toBeInstanceOf(Date);
    });
  });

  // ── SERIALISATION TESTS ─────────────────────────────────────────────────

  describe("Serialization & Deserialization", () => {
    let slink: MajikSLink;

    beforeAll(async () => {
      slink = await MajikSLink.create(
        standardUrl,
        keyA,
        dummyUserId,
        dummyMuid,
      );
    });

    it("should flawlessly execute a JSON round-trip (.toJSON & .fromJSON)", () => {
      const json = slink.toJSON();
      expect(typeof json).toBe("object");

      const hydrated = MajikSLink.fromJSON(json);
      expect(hydrated).toBeInstanceOf(MajikSLink);
      expect(hydrated.id).toBe(slink.id);
      expect(hydrated.hash).toBe(slink.hash);
      expect(hydrated.signatureJSON.signerId).toBe(
        slink.signatureJSON.signerId,
      );
    });

    it("should flawlessly execute a Base64 string round-trip (.serialize & .deserialize)", () => {
      const base64 = slink.serialize();
      expect(typeof base64).toBe("string");

      const hydrated = MajikSLink.deserialize(base64);
      expect(hydrated.domain).toBe(slink.domain);
      expect(hydrated.vCode).toBe(slink.vCode);
    });

    it("should throw a Validation Error when deserializing malformed JSON missing required fields", () => {
      const badJson = { version: 1, id: "incomplete" }; // Missing user_id, muid, etc.

      // Expect a validation error because the base fields fail validation before hydration finishes
      expect(() => MajikSLink.fromJSON(badJson)).toThrow(
        MajikSLinkValidationError,
      );
    });

    it("should throw a Serialization Error for an invalid claim_type", () => {
      const json = slink.toJSON();
      (json as any).claim_type = "invalid_claim";
      expect(() => MajikSLink.fromJSON(json)).toThrow(
        MajikSLinkSerializationError,
      );
    });
  });

  // ── UTILITIES & GETTERS ─────────────────────────────────────────────────

  describe("Getters and Utility Operations", () => {
    let slink: MajikSLink;

    beforeAll(async () => {
      slink = await MajikSLink.create(
        standardUrl,
        keyA,
        dummyUserId,
        dummyMuid,
      );
    });

    it("should split the hash into correct OTP-style code chunks (.codeChunks)", () => {
      const chunks = slink.codeChunks;
      expect(chunks.length).toBe(CODE_HEX_LENGTH / 4); // Should have 8 chunks of 4 characters each
      expect(chunks.join("")).toBe(slink.hash.slice(0, CODE_HEX_LENGTH));
    });

    it("should correctly format DNS TXT record payloads", () => {
      expect(slink.dnsRecordName).toBe("_majik-challenge.youtube.com");
      expect(slink.dnsRecordValue).toBe(`majik-slink-verify=${slink.vCode}`);
    });

    it("should identify when comparing to the same resource (.isSameResource)", async () => {
      const noisyUrl = `${standardUrl}?tracked=true#comments`;

      // String comparison
      expect(slink.isSameResource(noisyUrl)).toBe(true);
      expect(slink.isSameResource("https://different.com")).toBe(false);

      // Object comparison
      const identicalSLink = await MajikSLink.create(
        noisyUrl,
        keyB,
        dummyUserId,
        dummyMuid,
      );
      expect(slink.isSameResource(identicalSLink)).toBe(true);
    });

    it("should return null for isSameResource if provided a malformed string URL", () => {
      expect(slink.isSameResource("invalid-url")).toBeNull();
    });

    it("should safely produce a human-readable summary string (.toSummary)", () => {
      const summary = slink.toSummary();
      expect(typeof summary).toBe("string");
      expect(summary).toContain(`MajikSLink v1`);
      expect(summary).toContain(`id:`);
      expect(summary).toContain(`claim:    ownership (dns_txt)`);
      expect(summary).toContain(`source:   youtube`);
    });
  });
});
