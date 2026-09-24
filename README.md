"spacefit" 
17/09/26 - Implemented product details page - Grant.

## Quick start

    npm install
    npm --prefix backend install
    npm --prefix frontend install
    npm run dev

`npm run dev` runs both processes together:

- **api** — Express API on http://localhost:4000 (watch mode)
- **web** — Vite dev server on http://localhost:5173 (proxies `/api` → the API)

Open http://localhost:5173.

Other root scripts:

- `npm run build` — typecheck + build the storefront to `frontend/dist`
- `npm start` — run the API alone; with `frontend/dist` present it serves the
  built storefront at http://localhost:4000 (any unknown client path gets the
  SPA shell, and legacy `.html` URLs redirect client-side)
- `npm test` — backend suite (116) + frontend suite (126)

The endpoint reference, architecture (Vite/React dev · build · serve) and
configuration live in [backend/README.md](backend/README.md).

Optional follow-ups, deliberately out of scope of the React port: Playwright
browser E2E, `@tanstack/react-query` data layer, Tailwind v4.
