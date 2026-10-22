# Contributing to VaultDrop

Thank you for your interest in contributing to **VaultDrop**! We welcome bug reports, cryptographic and performance audits, UI/UX refinements, and documentation improvements.

---

## 🛠️ Local Development Setup

### Prerequisites

- **Node.js**: v20+
- **npm**: v10+

### 1. Clone the Repository

```bash
git clone https://github.com/bishoku/vault-drop.git
cd vault-drop
```

### 2. Start the Signaling Worker (Terminal 1)

```bash
cd workers
npm install
npm run dev
# Local Cloudflare Worker + Durable Object running at http://localhost:8787
```

### 3. Start the Frontend Application (Terminal 2)

```bash
cd frontend
npm install
npm run dev
# Vite dev server running at http://localhost:5173
```

---

## 📐 Architecture & Code Guidelines

1. **Zero-RAM Streaming First**: Never load an entire `File` or accumulate all chunks in memory (`ArrayBuffer[]`) when OPFS or File System Access API is available. Keep chunk processing inside `frontend/src/core/worker/transfer.worker.ts`.
2. **SCTP-Safe Chunking**: Keep the plaintext chunk size at `60 KB` (`61,440 bytes`) so the encrypted wire frame (`61,472 bytes`) stays strictly below the `64 KB` (`65,536 bytes`) WebRTC SCTP `maxMessageSize` across all browsers.
3. **WebSocket Relay Quota Protection**: WebSocket fallback is strictly limited to **10 MB** (`MAX_RELAY_FILE_SIZE`) on both client and Durable Object (`RoomDO.ts`) to respect Cloudflare Free Tier quotas.
4. **Bilingual Localization (i18n)**: All user-facing strings must be added to both `frontend/src/locales/tr.json` and `frontend/src/locales/en.json`.
5. **Type Safety**: Run typechecks in both packages before opening a Pull Request:
   ```bash
   npm --prefix workers run typecheck
   npm --prefix frontend run typecheck
   npm --prefix frontend run build
   ```

---

## 🔄 Pull Request Process

1. Fork the repository and create your branch from `main` (`git checkout -b feat/your-feature` or `fix/your-bugfix`).
2. Ensure both `frontend` and `workers` pass `npm run typecheck` and `npm run build`.
3. Open a Pull Request clearly describing the motivation, architectural impact, and manual testing performed across browsers.
