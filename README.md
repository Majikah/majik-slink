# Majik SLink

[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)

**MajikSLink** is a specialized TypeScript library designed for URL ownership verification and cryptographic identity linking. It provides a robust mechanism to prove that a specific digital identity (a MajikKey) controls a publicly accessible web resource (such as a YouTube channel, social media profile, or personal blog).

By combining traditional **Ed25519** signatures with post-quantum **ML-DSA-87** (Dilithium) hybrid cryptography, MajikSLink ensures that your identity-to-URL associations are tamper-proof and future-proof.



Identities can be created and managed via the web application at **[https://id.majikah.solutions](https://id.majikah.solutions)** using your own Majik Keys.

![npm](https://img.shields.io/npm/v/@majikah/majik-slink) ![npm downloads](https://img.shields.io/npm/dm/@majikah/majik-slink) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)




## Key Features:
1. **Deterministic URL Normalization:** Automatically converts URLs into a canonical format (stripping query params and fragments) so that the same resource always generates the same verification code.

2. **Challenge-Response Verification:** Generates short, embeddable verification codes (v_code) that users can place in their bios or page metadata for automated scrapers to detect.

3. **Hybrid Signing:** Leverages [@majikah/majik-signature](https://www.npmjs.com/package/@majikah/majik-signature) to sign canonical URL data with both classical and post-quantum algorithms.

4. **Proof of Ownership:** Enables a trustless workflow where a crawler can verify the presence of a code, and the library verifies the cryptographic signature against the owner's public keys.

5. **Seamless Serialization:** Includes built-in support for JSON rehydration and Base64 serialization for easy storage in databases or transmission via QR codes.


## Related Projects


### [Majik Signature](https://www.npmjs.com/package/@majikah/majik-signature)
Hybrid post-quantum content signing — the signing engine used by `signContent()` and `signFile()`.

[Read Docs](https://majikah.solutions/products/majik-signature/docs) · [Microsoft Store](https://apps.microsoft.com/detail/9pl9g3xzvd1x)

[![Majik Signature Microsoft App Store](https://get.microsoft.com/images/en-us%20light.svg)](https://apps.microsoft.com/detail/9pl9g3xzvd1x)



### [Majik Message](https://message.majikah.solutions)
Secure messaging platform using Majik Keys and Majik Signatures for identity-bound communication.

[Read Docs](https://majikah.solutions/products/majik-message/docs) · [Microsoft Store](https://apps.microsoft.com/detail/9pmjgvzzjspn)

[![Majik Message Microsoft App Store](https://get.microsoft.com/images/en-us%20light.svg)](https://apps.microsoft.com/detail/9pmjgvzzjspn)


### [Majik Key](https://www.npmjs.com/package/@majikah/majik-key)
Seed phrase account library — required peer dependency for signing and encryption.

[Read More Information](https://majikah.solutions/sdk/majik-key)

### [Majik Envelope](https://www.npmjs.com/package/@majikah/majik-envelope)
Post-quantum group encryption — used to encrypt and share private personal info.

[Read More Information](https://majikah.solutions/sdk/majik-envelope)


### [Majik Universal ID](https://id.majikah.solutions)
A cryptographically anchored identity layer for the Majikah ecosystem.

[Read More Information](https://majikah.solutions/sdk/majik-universal-id)


---

## Contributing

If you want to contribute or help extend support, reach out via email. All contributions are welcome!

---

## License

[Apache-2.0](LICENSE) — free for personal and commercial use.

---

## Author

Made with 💙 by [@thezelijah](https://github.com/jedlsf)

**Developer**: Josef Elijah Fabian  
**GitHub**: [https://github.com/jedlsf](https://github.com/jedlsf)  
**Project Repository**: [https://github.com/Majikah/majik-slink](https://github.com/Majikah/majik-slink)

---

## Contact

- **Business Email**: [business@thezelijah.world](mailto:business@thezelijah.world)
- **Official Website**: [https://www.thezelijah.world](https://www.thezelijah.world)
- **ID Web App**: [https://id.majikah.solutions](https://id.majikah.solutions)