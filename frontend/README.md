# Tune-In Frontend

React 19 + TypeScript + Vite single-page application implementing **The Neo-Brutalist Ledger** UI for **Tune-In** (see [`../DESIGN.md`](../DESIGN.md)).

See the [root README](../README.md) for product overview, system architecture, and scoring formulas, and [`../backend/README.md`](../backend/README.md) for running the API server.

---

## Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **Routing & State**: React Router v7 + TanStack Query v5 (`30s` stale time)
- **Icons & Tooling**: Lucide React, Vitest + React Testing Library, Oxlint

---

## Setup & Running Locally

From the `frontend/` directory:

```powershell
# Install npm dependencies
npm install

# Start Vite dev server at http://127.0.0.1:5173
npm run dev
```

[`vite.config.ts`](./vite.config.ts) proxies all `/api` requests to the backend server at `http://127.0.0.1:8000`, so start the backend first when running against live data.

---

## Build, Lint & Tests

From the `frontend/` directory:

```powershell
# Run unit & component tests (Vitest)
npm test

# Lint codebase (Oxlint)
npm run lint

# Type-check and build production bundle (tsc -b && vite build)
npm run build
```
