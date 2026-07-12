# OWI Field App (`/app`)

Collector PWA: photo capture, QR/GPS bin identification, fill tap, offline sync queue, route view.

Stack: Vite + React + TypeScript, service worker, IndexedDB queue.

## Spike status

The current code is the spike: photo (native camera) → client-side compression to ~300 KB → GPS fix (10 s timeout, never blocks the report) → fill tap → IndexedDB queue → auto-sync to the API when online. It shows elapsed seconds per report — the flow must stay ≤ 20 s on a collector-class phone (Android 10, 2 GB RAM). That phone test is the pass/fail.

## Run on a phone (same Wi-Fi)

```sh
pnpm install
pnpm dev          # serves HTTPS on your LAN IP — camera/GPS require a secure context
```

Open `https://<laptop-ip>:5173` on the phone and accept the self-signed cert. The dev server proxies `/api` to the local API (`127.0.0.1:8000`), so only the device token needs to be set under Settings — leave the server address empty. Reports sync with GPS coordinates or a scanned bin QR; with neither, they stay queued until a GPS fix succeeds.

Checks: `pnpm check` (tsc + eslint).
