# Majik SLink

[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://www.thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)
![npm](https://img.shields.io/npm/v/@majikah/majik-slink) ![npm downloads](https://img.shields.io/npm/dm/@majikah/majik-slink) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

**MajikSLink** is a specialized TypeScript library designed for URL binding, ownership, and cryptographic attribution. It provides a robust, zero-trust mechanism to prove that a specific digital identity (via a **MajikKey** and **MUID**) controls or is attested to a publicly accessible web resource (such as a YouTube channel, social media profile, DNS record, or personal blog).

By combining traditional **Ed25519** signatures with post-quantum **ML-DSA-87 (Dilithium)** hybrid cryptography via `@majikah/majik-signature`, MajikSLink ensures that your identity-to-URL associations are tamper-proof, resilient against future quantum threats, and structurally decoupled for decentralized verification.

Identities can be created and managed via the web application at **[https://id.majikah.solutions](https://id.majikah.solutions)**.

---

## Key Features

1. **Deterministic URL Normalization:** Automatically converts URLs into a canonical format (`majik-slink-v1:<subdomain>::<sld>::<tld>::<path>`). It strips tracking queries, fragments, and trailing slashes so the exact same core resource always generates a consistent hash and verification code.
2. **Flexible Claim Types:**
   * **`ownership`**: The strongest claim, indicating domain control. Verified via DNS TXT records.
   * **`attribution`**: Indicates content control (e.g., a channel bio or GitHub README) but not DNS control. Verified via page content scraping.
   * **`reference`**: A pure cryptographic attestation ("this URL is relevant to me") with no independent third-party verification possible.
3. **Compact Post-Quantum Signatures:** Signatures are stored in a compact envelope. Public keys are *never* embedded directly, requiring verifiers to externally resolve them via the signer's `muid`, ensuring up-to-date registry checks.
4. **Challenge-Response Verification:** Derives a short OTP-style code (`vCode`) from the SHA-256 hash of the canonical URL to be placed in DNS TXT records or page bios. 
5. **Serialization Ready:** Built-in support for flawless JSON rehydration (`toJSON` / `fromJSON`) and Base64 serialization (`serialize` / `deserialize`).

---

## Installation

```bash
npm install @majikah/majik-slink @majikah/majik-key @majikah/majik-signature
```

---

## Quick Start & Usage

### 1. Generating a UI Challenge (Without Signing)
If you are building a UI and want to show the user their verification code *before* they confirm and sign, you can generate a challenge using just the URL.

```typescript
import { MajikSLink } from "@majikah/majik-slink";

const preview = await MajikSLink.generateChallenge("https://github.com/majikah/repo?utm_source=test#readme");

if (preview) {
  console.log("Canonical URL:", preview.cleanUrl); // https://github.com/majikah/repo
  console.log("Ask user to add this to their bio:", preview.v_code); // majik-slink:xxxx...
}
```

### 2. Creating and Signing a New SLink
To permanently link an identity to a URL, create a `MajikSLink` instance using an unlocked `MajikKey`.

```typescript
import { MajikKey } from "@majikah/majik-key";

// 1. Initialize and unlock your identity
const mnemonic = MajikKey.generateMnemonic();
const key = await MajikKey.create(mnemonic, 'my-passphrase', 'My Signing Key');
const userId = "user_abc123";
const muid = "muid_xyz987";

// 2. Create the SLink payload
const targetUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const slink = await MajikSLink.create(targetUrl, key, userId, muid, {
  claimType: "attribution" // Automatically defaults verificationMethod to "page_content"
});

console.log("Status:", slink.status); // "unverified"
console.log("Source Platform:", slink.source); // "youtube"
```

### 3. Displaying Verification Requirements
Depending on the `claimType`, you can guide users on how to prove their link:

```typescript
if (slink.verificationMethod === "dns_txt") {
  console.log("Add a TXT Record:");
  console.log("Name:", slink.dnsRecordName);   // _majik-challenge.youtube.com
  console.log("Value:", slink.dnsRecordValue); // majik-slink-verify=majik-slink:a1b2...
} else if (slink.verificationMethod === "page_content") {
  console.log("Add this code anywhere in your bio or README:");
  console.log(slink.vCode); // majik-slink:a1b2...
  
  // You can also display it in nice OTP chunks:
  console.log("Display Code:", slink.codeChunks.join("-"));
}
```

### 4. Verifying Cryptographic Signatures
Because MajikSLink uses **compact signatures**, public keys are not stored in the SLink payload. You must fetch the public keys (via `muid`) from your trusted identity registry to verify the claim.

```typescript
import { MajikSignature } from "@majikah/majik-signature";

// 1. Fetch public keys from your trusted registry using the SLink's MUID
const publicKeys = await fetchPublicKeysForMuid(slink.muid); 

// 2. Verify the cryptographic signature against the canonical URL
const verificationResult = slink.verify(publicKeys);

if (verificationResult.valid) {
    console.log("Valid signature from:", verificationResult.signerId);
    
    // 3. (Optional) If you also successfully scraped the vCode from the web:
    slink.markVerified(); 
} else {
    slink.markSignatureInvalid();
}
```

*Note: You can also verify statically without hydrating via `MajikSLink.verifySignature(slinkJSON, publicKeys)`.*

### 5. Utilities & Comparisons
Easily compare URLs to see if they resolve to the exact same signed resource:

```typescript
// Ignores query params and fragments automatically
const isMatch = slink.isSameResource("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s");
console.log(isMatch); // true

// View a human-readable debug summary
console.log(slink.toSummary());
```

### 6. Serialization and Database Storage
Store and retrieve `MajikSLink` objects seamlessly.

```typescript
// Export to JSON for Database storage
const jsonPayload = slink.toJSON();

// Hydrate from DB (Note: signatures must still be verified with external keys)
const hydratedSLink = MajikSLink.fromJSON(jsonPayload);

// Export to Base64 (Useful for QR codes or URL parameters)
const base64String = slink.serialize();
const fromBase64 = MajikSLink.deserialize(base64String);
```

---

## Related Ecosystem Projects

*   **[Majik Signature](https://www.npmjs.com/package/@majikah/majik-signature)**: Hybrid post-quantum content signing engine. ([Microsoft Store](https://apps.microsoft.com/detail/9pl9g3xzvd1x))
*   **[Majik Message](https://message.majikah.solutions)**: Secure messaging platform utilizing Majik Keys and hybrid ML-KEM-768/X25519 protocols for identity-bound communication. ([Microsoft Store](https://apps.microsoft.com/detail/9pmjgvzzjspn))
*   **[Majik Key](https://www.npmjs.com/package/@majikah/majik-key)**: Foundational seed phrase account library.
*   **[Majik Universal ID](https://id.majikah.solutions)**: A cryptographically anchored identity layer for the Majikah ecosystem.
*   **[Majik Envelope](https://www.npmjs.com/package/@majikah/majik-envelope)**: Post-quantum group encryption.

---

## License

[Apache-2.0](LICENSE) — free for personal and commercial use.

---

## Author

Developed by **Josef Elijah Fabian (Zelijah)** | [Majikah Solutions OPC](https://majikah.solutions/about)

**Developer**: [Josef Elijah Fabian](https://github.com/jedlsf)  
**GitHub**: [https://github.com/Majikah](https://github.com/Majikah)  
**Project Repository**: [https://github.com/Majikah/majik-slink](https://github.com/Majikah/majik-slink)  

---

## Contact

- **Business Email**: [business@majikah.solutions](mailto:business@majikah.solutions)
- **Official Website**: [https://www.thezelijah.world](https://www.thezelijah.world)
- **Majikah Ecosystem**: [https://majikah.solutions](https://majikah.solutions)