# VaultDrop

**Zero-knowledge, peer-to-peer, end-to-end encrypted file transfer.** No sign-up, no server storage, no tracking. Stream 10 GB+ files directly between browsers with **< 30 MB RAM usage**.

🚀 **Live Application:** [https://bishoku.github.io/vault-drop/](https://bishoku.github.io/vault-drop/)

[![Live Demo](https://img.shields.io/badge/Live_App-bishoku.github.io%2Fvault--drop-10b981?style=for-the-badge&logo=firefox-browser&logoColor=white)](https://bishoku.github.io/vault-drop/)
[![CI](https://github.com/bishoku/vault-drop/actions/workflows/ci.yml/badge.svg)](https://github.com/bishoku/vault-drop/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/bishoku/vault-drop/actions/workflows/deploy.yml/badge.svg)](https://github.com/bishoku/vault-drop/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![React: 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript: 5.7](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)
[![Cloudflare: Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020.svg)](https://workers.cloudflare.com/)

---

## ✨ Features

- 🔒 **End-to-End Encrypted (E2EE)** — 256-bit AES-GCM encryption. The raw key is generated via CSPRNG and shared strictly in the URL fragment (`#key=...`). The server never sees the key.
- 🚀 **Zero-RAM Multi-Gigabyte Streaming** — Transfers files of **10 GB+** over P2P with a RAM footprint capped under **30 MB**. No `ArrayBuffer` allocation failures, no tab crashes (OOM).
- ⚡ **0ms Pre-read Delay & Streaming SHA-256** — Files start transferring instantly. SHA-256 is computed on the fly using a pure TypeScript FIPS 180-4 streaming engine and verified via an encrypted trailer chunk at EOF.
- 💾 **Direct-to-Disk Storage (OPFS & FSA)**:
  - **OPFS (Origin Private File System)**: Silently streams large files directly to sandboxed disk storage across Chrome, Safari, and Firefox without memory buildup, serialized via a deterministic write queue.
  - **File System Access API (FSA)**: Optional direct-to-disk save location picker on desktop Chromium (Chrome/Edge/Brave/Opera).
- 🌊 **Hardware-Level WebRTC & WebSocket Backpressure** — Dynamic high/low watermark flow control (`HIGH_WATERMARK = 2 MB`, `LOW_WATERMARK = 512 KB`) that throttles Web Workers when network buffers fill up.
- 🛡️ **Guaranteed P2P with Quota-Safe Relay Fallback (Max 10 MB)** — Transfer runs 100% P2P over WebRTC DataChannel by default (unlimited file size). If strict NAT/firewalls prevent P2P, a modal prompts the user before switching to an encrypted Cloudflare WebSocket tunnel fallback (strictly capped at **10 MB** to protect Cloudflare Free Tier quotas).
- 📱 **Mobile & PWA Ready** — Service worker auto-update toast notifications, in-app QR scanner, native "Save to Photos / Gallery" export (`navigator.share`), Screen Wake Lock API (with automatic re-acquisition on tab visibility), and responsive dark/light mode.
- 🌍 **Bilingual** — Turkish (Türkçe) and English with automatic language detection.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SENDER BROWSER                                  │
│                                                                             │
│  [File] ──► [file.slice(60KB)] ───► [Streaming SHA-256]                     │
│                     │                                                       │
│                     ▼                                                       │
│            [AES-GCM-256 Encrypt]                                            │
│                     │                                                       │
│       ┌─────────────┴─────────────┐                                         │
│       ▼                           ▼                                         │
│  [bufferedAmount > 2MB?]    [Worker Throttling (pause/drain)]               │
│       │ (No)                                                                │
│       ▼                                                                     │
│  [WebRTC DataChannel] ────────────────────────┐                             │
└───────────────────────────────────────────────│─────────────────────────────┘
                                                │ (Direct P2P Data Stream)
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RECEIVER BROWSER                                 │
│                                                                             │
│  [WebRTC DataChannel] ──► [AES-GCM-256 Decrypt] ──► [Streaming SHA-256]    │
│                                     │                                       │
│                                     ▼                                       │
│                       [Serial Direct-to-Disk Queue]                         │
│                         (OPFS / File System Access)                         │
│                                     │                                       │
│                                     ▼                                       │
│             [Trailer Received ──► Verify SHA-256 ──► Assembled File]        │
└─────────────────────────────────────────────────────────────────────────────┘

                                   ▲
                                   │ (Signaling Only / ≤ 10 MB Encrypted Relay)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKER + DURABLE OBJECT                      │
│                                                                             │
│  • Ephemeral Room Coordination (Max 2 peers per room, explicit role binding)│
│  • SDP Offer / Answer & ICE Candidate Exchange                              │
│  • Encrypted Relay Fallback (Max 10 MB, only if P2P fails + user confirms)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Cryptography & Wire Protocol

1. **Key Generation**: 256-bit CSPRNG key and 32-bit random session salt generated client-side with `crypto.getRandomValues()`. The key is formatted as base64url and appended to the URL fragment (`#room=...&key=...`).
2. **SCTP-Safe Chunk Size**: **60 KB** (`61,440 bytes` plaintext / `61,472 bytes` wire frame), staying strictly below the `64 KB` (`65,536 bytes`) WebRTC SCTP `maxMessageSize` ceiling across all desktop and mobile browser combinations.
3. **Deterministic 96-bit IV (12 bytes)**:
   ```
   [sessionSalt: 4 bytes][chunkIndex: 8 bytes uint64 BE]
   ```
4. **Wire Format**:
   ```
   [chunkIndex: 4 bytes uint32 BE][iv: 12 bytes][ciphertext + 16-byte GCM tag]
   ```
5. **AAD (Authenticated Additional Data)**:
   Fixed 9-byte structure ensuring chunk sequence and boundary integrity:
   ```
   [chunkIndex: 8 bytes uint64 BE][isLastChunk: 1 byte uint8 (0x00 or 0x01)]
   ```
6. **Integrity Trailer**: Chunk 0 delivers the encrypted metadata manifest. File chunks 1 to $N$ stream with on-the-fly incremental SHA-256 updates. Chunk $N+1$ carries the final ciphertext trailer containing the expected file digest.
7. **Zero-Knowledge**: Keys never hit signaling servers; URLs sent in HTTP headers omit the hash fragment (RFC 3986 § 3.5).
8. **Quota-Protected Relay Fallback (Max 10 MB)**: When P2P fails, users are warned about metadata visibility before switching to relay mode. Relay transfers remain end-to-end encrypted and are strictly capped at **10 MB** (`MAX_RELAY_FILE_SIZE`) on both client and Cloudflare Durable Object.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (for the signaling server)

### Local Development

```bash
# Clone the repository
git clone https://github.com/bishoku/vault-drop.git
cd vault-drop

# Start the signaling server (terminal 1)
cd workers
npm install
npm run dev
# → Running on http://localhost:8787

# Start the frontend (terminal 2)
cd frontend
npm install
npm run dev
# → Running on http://localhost:5173
```

Open two browser tabs (one in incognito) to test file transfer locally.

### Deploy

#### Frontend (GitHub Pages)

The frontend auto-deploys via GitHub Actions on push to `main` using [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. In your GitHub repository, navigate to **Settings** → **Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. Under **Settings** → **Actions** → **General**, ensure **Workflow permissions** is set to **Read and write permissions**.
4. *(Optional)* To use a custom signaling worker, set the `VITE_SIGNALING_URL` variable under **Settings** → **Variables and secrets** → **Actions** (defaults to `wss://vaultdrop-signaling.barishoku.workers.dev`).
5. Push your code to `main` — your app will be live at `https://bishoku.github.io/vault-drop/`.

#### Signaling Server (Cloudflare Workers)

```bash
cd workers

# Login to Cloudflare (first time only)
npx wrangler login

# Deploy
npm run deploy
# → https://vaultdrop-signaling.YOUR_SUBDOMAIN.workers.dev
```

> **Origin Security**: The worker enforces strict Origin checks (`ALLOWED_ORIGINS` in `workers/src/index.ts`). Ensure your GitHub Pages domain (`https://bishoku.github.io`) is listed.

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SIGNALING_URL` | WebSocket URL of the signaling server | `ws://localhost:8787` (dev) / Cloudflare Worker (prod) |
| `VITE_BASE_PATH` | Base path for deployment | `./` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS v4 |
| **State** | Zustand |
| **Crypto & Hashing** | Web Crypto API (AES-GCM-256), Pure TS Streaming SHA-256 |
| **Transport** | WebRTC DataChannel (with flow control), WebSocket (signaling/relay) |
| **Storage Engine** | Origin Private File System (OPFS), File System Access API (FSA) |
| **Signaling** | Cloudflare Workers + Durable Objects (WebSocket Hibernation) |
| **i18n** | react-i18next (Turkish & English) |
| **Icons** | Lucide React |

## 🌐 Browser Support & Capabilities

| Capability | Chrome / Edge | Safari | Firefox | Mobile Chrome | iOS Safari |
|---|:---:|:---:|:---:|:---:|:---:|
| **P2P Transfer (WebRTC, Unlimited)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Direct-to-Disk (OPFS)** | ✅ (10 GB+) | ✅ (10 GB+) | ✅ (10 GB+) | ✅ | ✅ |
| **Save Location Picker (FSA)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Hardware Backpressure** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Encrypted Relay Fallback (≤ 10 MB)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Wake Lock API** | ✅ | ✅ (16.4+) | ❌ | ✅ | ✅ (16.4+) |

## 📂 Project Structure

```
vault-drop/
├── .github/
│   ├── ISSUE_TEMPLATE/               # Structured Bug Report & Feature Request forms
│   ├── workflows/
│   │   ├── ci.yml                    # Automated PR Typecheck & Build verification
│   │   └── deploy.yml                # Automated GitHub Pages CI/CD
│   └── PULL_REQUEST_TEMPLATE.md
├── frontend/
│   ├── src/
│   │   ├── core/
│   │   │   ├── crypto.ts             # AES-GCM-256, 10 MB relay limit & URL key exchange
│   │   │   ├── sha256.ts             # Pure TS streaming FIPS 180-4 SHA-256
│   │   │   ├── storage.ts            # OPFS & FSA direct-to-disk streaming writers
│   │   │   ├── history.ts            # Local IndexedDB transfer history store
│   │   │   ├── webrtc.ts             # RTCPeerConnection & DataChannel backpressure
│   │   │   ├── session/
│   │   │   │   └── TransferEngine.ts # Core P2P & WebSocket relay state machine
│   │   │   └── worker/
│   │   │       ├── transfer.worker.ts# Zero-RAM chunking, crypto & stream worker
│   │   │       └── worker-client.ts  # Main-thread worker bridge
│   │   ├── components/               # React UI components (DropZone, ProgressBar, etc.)
│   │   ├── hooks/                    # useWebRTC, useWakeLock
│   │   ├── locales/                  # Turkish (tr.json) & English (en.json)
│   │   └── styles/                   # Tailwind CSS v4 & theme variables
│   ├── vite.config.ts                # Vite config with PWA & relative base
│   └── package.json
├── workers/
│   ├── src/
│   │   ├── index.ts                  # Worker router & CORS/Origin validator
│   │   └── RoomDO.ts                 # Durable Object room with 10 MB relay guard
│   ├── wrangler.toml                 # DO migrations & SQLite binding
│   └── package.json
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE                           # MIT
└── README.md
```

## Contributing & Security

- Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup instructions and architectural guidelines, and our [Code of Conduct](./CODE_OF_CONDUCT.md).
- To report a security vulnerability privately, please refer to [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © VaultDrop Contributors
