# Security Policy

VaultDrop is built around a **zero-knowledge, end-to-end encrypted (E2EE)** peer-to-peer architecture. We take cryptographic integrity and user privacy seriously.

## Supported Versions

Only the latest `main` branch deployed to production is actively supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| `1.x` (`main`) | :white_check_mark: |

## Cryptographic & Privacy Guarantees

1. **Client-Side Key Generation**: A 256-bit symmetric key (`AES-GCM`) and a 32-bit random session salt are generated locally via `crypto.getRandomValues()`.
2. **URL Fragment Key Exchange**: The raw encryption key is encoded in the URL fragment (`#room=...&key=...`). Per RFC 3986 § 3.5, browsers never transmit URL fragments in HTTP requests or WebSocket handshakes.
3. **Authenticated Encryption (AEAD)**: Every chunk is encrypted with `AES-GCM-256` using a deterministic 96-bit IV (`[4-byte salt][8-byte uint64 BE chunkIndex]`) and 9-byte Authenticated Additional Data (`[8-byte uint64 BE chunkIndex][1-byte isLastChunk]`) to prevent chunk reordering, replay, or truncation attacks.
4. **End-to-End Integrity Verification**: An incremental FIPS 180-4 `SHA-256` digest is computed across the plaintext stream and verified via an encrypted EOF trailer chunk (`totalChunks + 1`).
5. **Signaling & Relay Isolation**: The Cloudflare Worker + Durable Object backend only coordinates ephemeral WebRTC signaling (`SDP` / `ICE`). When P2P fails and the user explicitly consents to WebSocket Relay fallback (capped at **10 MB**), only AES-GCM ciphertext transits the worker—never plaintext or keys.

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

If you discover a vulnerability in VaultDrop's cryptography, wire protocol, WebRTC signaling, or origin validation:

1. **Use GitHub Private Vulnerability Reporting**: Navigate to the [**Security** tab](https://github.com/bishoku/vault-drop/security/advisories/new) of this repository and click **"Report a vulnerability"**.
2. **Include Details**:
   - Affected component (`frontend/src/core/crypto.ts`, `workers/src/RoomDO.ts`, etc.)
   - Step-by-step reproduction or proof-of-concept (PoC)
   - Potential impact on confidentiality or integrity

We aim to acknowledge security reports within **48 hours** and provide a remediation plan or patch within **7 days**.
