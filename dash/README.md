# OWI Dashboard (`/dash`)

Ops dashboard for coordinators and admins: collect-today list, route planning, composition, recycling value, carbon, cleanliness, dumping hotspots, review queue, field reports, volunteer events, users, open-data API keys, audit trail and settings.

Stack: React + Vite + TypeScript + MUI + **Apache ECharts** (the only chart library, ever). UI rules: flat, no gradients, responsive, fast, EN+SW i18n from the first screen.

## Run

```sh
pnpm install
pnpm dev            # http://localhost:5174 — /api is proxied to the local API, no URL config
```

Sign in with a coordinator/admin account.

Checks: `pnpm check` (tsc + eslint).
