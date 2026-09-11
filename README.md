# VaultDrop

**Peer-to-peer, end-to-end encrypted file transfer.** No sign-up, no storage, no tracking.

[![Deploy to GitHub Pages](https://github.com/bishoku/vault-drop/actions/workflows/deploy.yml/badge.svg)](https://github.com/bishoku/vault-drop/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## Features

- 🔒 **End-to-End Encrypted** — AES-GCM-256 encryption. The key never leaves your browser.
- 🌐 **Peer-to-Peer** — Direct WebRTC connection for maximum speed and privacy.
- ☁️ **Relay Fallback** — Cloudflare Workers relay when P2P isn't possible (data stays encrypted).
- 📱 **Mobile Friendly** — PWA with Wake Lock, Web Share API, and OPFS support.
- 🌍 **Multi-language** — Turkish and English with auto-detection.
- 🎨 **Light & Dark Themes** — Follows system preference with manual toggle.
- 💾 **Zero Storage** — Nothing is ever written to disk on the server.
- 📦 **Large File Support** — Stream files up to 10 GB+ on desktop (Chrome/Edge).

## Architecture

```
┌──────────────┐         WebSocket          ┌──────────────────────┐
│              │◄──────────────────────────►│  Cloudflare Worker   │
│   Sender     │     Signaling (SDP/ICE)    │  + Durable Object    │
│   Browser    │                            │  (Room Management)   │
│              │◄──────────────────────────►│                      │
└──────┬───────┘         WebSocket          └──────────┬───────────┘
       │                                               │
       │          WebRTC DataChannel (P2P)              │
       │◄─────────────────────────────────────────────►│
       │          OR WebSocket Relay (E2EE)             │
       │                                               │
┌──────▼───────┐                            ┌──────────▼───────────┐
│              │                            │                      │
│   Receiver   │◄──────────────────────────►│  Cloudflare Worker   │
│   Browser    │         WebSocket          │  (Relay Passthrough)  │
│              │                            │                      │
└──────────────┘                            └──────────────────────┘
```

### Security Model

1. **Key Exchange**: A 256-bit AES key is generated client-side and embedded in the URL fragment (`#key=...`). The fragment is never sent to the server (RFC 3986).
2. **Encryption**: Each 64 KB chunk is encrypted with AES-GCM-256 using a deterministic counter-based IV and authenticated additional data (AAD) that binds chunk ordering.
3. **Verification**: A SHA-256 hash of the complete file is computed and verified after transfer.
4. **Relay Mode**: When P2P fails, data passes through Cloudflare Workers but remains encrypted. The server cannot read file contents.

> ⚠️ **Relay Mode Metadata**: In relay mode, Cloudflare can observe IP addresses, transfer timestamps, and encrypted payload sizes. For IP anonymity, use a VPN.

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

The frontend auto-deploys via GitHub Actions on push to `main`. Set the `VITE_SIGNALING_URL` variable in your repository settings:

1. Go to **Settings** → **Variables and secrets** → **Actions**
2. Add variable: `VITE_SIGNALING_URL` = `wss://your-worker.your-subdomain.workers.dev`

#### Signaling Server (Cloudflare Workers)

```bash
cd workers

# Login to Cloudflare (first time only)
npx wrangler login

# Deploy
npm run deploy
# → https://vaultdrop-signaling.YOUR_SUBDOMAIN.workers.dev
```

> **Note**: Cloudflare Workers with Durable Objects may require a paid plan ($5/month) depending on your account configuration.

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SIGNALING_URL` | WebSocket URL of the signaling server | `ws://localhost:8787` |
| `VITE_BASE_PATH` | Base path for GitHub Pages deployment | `./` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS v4 |
| **State** | Zustand |
| **Crypto** | Web Crypto API (AES-GCM-256) |
| **Transport** | WebRTC DataChannel, WebSocket |
| **Signaling** | Cloudflare Workers + Durable Objects |
| **i18n** | react-i18next |
| **Icons** | Lucide React |

## Browser Support

| Feature | Chrome/Edge | Firefox | Safari | iOS Safari |
|---------|-------------|---------|--------|------------|
| P2P Transfer | ✅ | ✅ | ✅ | ✅ |
| Direct Disk Save | ✅ (10 GB+) | ❌ | ❌ | ❌ |
| OPFS (Large Files) | ✅ | ✅ | ✅ | ✅ |
| Share Target (PWA) | ✅ | ❌ | ❌ | ❌ |

## Project Structure

```
vaultdrop/
├── .github/workflows/deploy.yml    # GitHub Pages CI/CD
├── frontend/                       # React + Vite frontend
│   ├── src/
│   │   ├── core/                   # Transfer engine
│   │   │   ├── crypto.ts           # AES-GCM encryption
│   │   │   ├── webrtc.ts           # PeerConnection manager
│   │   │   ├── relay.ts            # CF Worker relay client
│   │   │   ├── storage.ts          # Platform-adaptive file saving
│   │   │   └── worker/             # Web Worker for chunking
│   │   ├── components/             # React UI components
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── locales/                # i18n translations (TR/EN)
│   │   └── styles/                 # CSS tokens & global styles
│   └── vite.config.ts
├── workers/                        # Cloudflare Workers signaling server
│   ├── src/
│   │   ├── index.ts                # Worker router
│   │   └── RoomDO.ts               # Durable Object room manager
│   └── wrangler.toml
├── LICENSE                         # MIT
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

## License

[MIT](./LICENSE) © VaultDrop Contributors
