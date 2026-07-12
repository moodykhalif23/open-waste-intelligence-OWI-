# OWI Dashboard (`/dash`)

Ops dashboard for coordinators and directors: composition views, bin health, collect-today list, review queue, reports.

Stack: React + Vite + TypeScript + **Apache ECharts** (the only chart library, ever). UI rules: flat, no gradients, responsive, fast, EN+SW i18n from the first screen.

## Run

```sh
pnpm install
pnpm dev            # http://localhost:5174 — /api is proxied to the local API, no URL config
```

Sign in with a coordinator/admin account. Pages: Overview (report volume + fill-level charts, stat tiles), Bins (registry admin + printable QR download), Reports (latest observations with photos).

Checks: `pnpm check` (tsc + eslint).
