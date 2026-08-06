# Majik SLink

[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://www.thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)
![npm](https://img.shields.io/npm/v/@majikah/majik-slink) ![npm downloads](https://img.shields.io/npm/dm/@majikah/majik-slink) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

**MajikSLink** is a specialized TypeScript library designed for URL ownership verification and cryptographic identity linking. It provides a robust, zero-trust mechanism to prove that a specific digital identity (a **MajikKey**) controls a publicly accessible web resource (such as a YouTube channel, social media profile, DNS record, or personal blog).

By combining traditional **Ed25519** signatures with post-quantum **ML-DSA-87 (Dilithium)** hybrid cryptography via `@majikah/majik-signature`, MajikSLink ensures that your identity-to-URL associations are tamper-proof and resilient against future quantum threats.

Identities can be created and managed via the web application at **[https://id.majikah.solutions](https://id.majikah.solutions)** using your own Majik Keys.

---

## Key Features

1. **Deterministic URL Normalization:** Automatically converts URLs into a canonical `cleanUrl` format (stripping tracking queries, fragments, and trailing slashes) so that the same core resource always generates a consistent verification code and hash.
2. **Challenge-Response Verification:** Generates short, OTP-style verification codes (`vCode`) that users can place in DNS TXT records, bios, or page metadata for automated verifiers to detect.
3. **Post-Quantum Hybrid Signing:** Leverages `MajikSignature` to sign the canonical URL data, guaranteeing non-repudiation.
4. **Trustless Proof of Ownership:** Enables a decentralized workflow where a web crawler verifies the presence of a challenge code, and the library independently verifies the cryptographic signature against the owner's public keys.
5. **Flexible Serialization:** Built-in support for flawless JSON rehydration (`toJSON` / `fromJSON`) and Base64 serialization (`serialize` / `deserialize`) for seamless database storage and API transmission.

---

## Installation

```bash
npm install @majikah/majik-slink @majikah/majik-key @majikah/majik-signature
```

## Quick Start & Usage

### 1. Creating and Signing a New SLink
To link an identity to a URL, create a `MajikSLink` instance using a user's `MajikKey`.

```typescript
import { MajikSLink } from "@majikah/majik-slink";
import { MajikKey } from "@majikah/majik-key";

// 1. Initialize your identity (MajikKey)
const key = await MajikKey.fromSeedPhrase("your seed phrase here...");
const userId = "user_abc123";
const muid = "muid_xyz987";

// 2. Create the SLink payload
const targetUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s";
const slink = await MajikSLink.create(targetUrl, key, userId, muid, {
  claimType: "ownership" // Defaults to "ownership" and verificationMethod: "dns_txt"
});

console.log("Canonical URL:", slink.cleanUrl); // https://www.youtube.com/watch
console.log("Verification Code:", slink.vCode); // majik-slink:xxxx-xxxx-xxxx...
```

### 2. Presenting the Challenge (For Verifiers)
If you are building an application that needs to ask a user to verify a URL, you can generate a challenge without a private key.

```typescript
const challenge = await MajikSLink.generateChallenge("https://github.com/majikah/repo");

if (challenge) {
  console.log("Ask the user to place this code in their bio:", challenge.v_code);
  console.log("Expected resource hash:", challenge.hash);
}
```

### 3. DNS TXT Verification Formatting
For domain ownership claims, `MajikSLink` automatically formats the required DNS properties.

```typescript
console.log("DNS Record Name:", slink.dnsRecordName);   // e.g., _majik-challenge.github.com
console.log("DNS Record Value:", slink.dnsRecordValue); // e.g., majik-slink-verify=majik-slink:...
```

### 4. Verifying Cryptographic Signatures
When validating an SLink supplied by a user, use their public keys to verify the payload hasn't been tampered with.

```typescript
import { MajikSignature } from "@majikah/majik-signature";

// Retrieve public keys (usually fetched from a trusted identity registry)
const publicKeys = {
  ed25519: "base64-ed25519-pubkey",
  mldsa: "base64-mldsa-pubkey"
};

// Verify the hydrated SLink instance
const verificationResult = slink.verify(publicKeys);

if (verificationResult.valid) {
    console.log("Valid signature from:", verificationResult.signerId);
    slink.markVerified(); // Update state to verified
} else {
    slink.markSignatureInvalid();
}
```

### 5. Serialization and Deserialization
Easily store and retrieve `MajikSLink` objects from your database.

```typescript
// Export to JSON for DB storage
const jsonPayload = slink.toJSON();

// Hydrate from DB
const hydratedSLink = MajikSLink.fromJSON(jsonPayload);
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

Made with 💙 by **Zelijah**

**Developer**: Josef Elijah Delos Santos Fabian  
**Organization**: Majikah Solutions OPC  
**GitHub**: [https://github.com/jedlsf](https://github.com/jedlsf)  
**Project Repository**: [https://github.com/Majikah/majik-slink](https://github.com/Majikah/majik-slink)

---

## Contact

*   **Business Email**: [business@thezelijah.world](mailto:business@thezelijah.world)
*   **Official Website**: [https://www.thezelijah.world](https://www.thezelijah.world)
*   **ID Web App**: [https://id.majikah.solutions](https://id.majikah.solutions)