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

Open `https://<laptop-ip>:5173` on the phone, accept the self-signed cert, and set the server address + device token under Settings. Reports without a GPS fix stay queued (the server requires coordinates until bin-registry lookup can supply a location).

Checks: `pnpm check` (tsc + eslint).
