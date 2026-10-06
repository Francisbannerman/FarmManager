# Farm Manager — Web

React + TypeScript + Vite dashboard for the Farm Manager API: draw your farm on a map, track sections, activities and finances.

## Requirements

- Node 20+ (22 recommended)
- A running Farm Manager API (see the backend repository)

## Run locally

```bash
npm ci
npm run dev
```

The app opens on http://localhost:5173 and talks to `http://localhost:5000` by default. To point it elsewhere, copy `.env.example` to `.env.local` and set `VITE_API_URL`.

Create an account on the sign-in screen; you'll be walked through creating your farm. Nothing is pre-loaded — all data comes from your account on the API.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | TypeScript check, no output |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Production: yes | API base URL, e.g. `https://api.your-domain.com` |
| `VITE_CURRENCY` | No | Currency label next to amounts (default `KES`) |

Vite inlines these at **build** time. A production build without `VITE_API_URL` shows a "Configuration missing" screen instead of calling the wrong server.

## Deploying

The build output in `dist/` is a static site — host it anywhere (Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3 + CDN, nginx).

1. Set `VITE_API_URL` in the host's build settings.
2. Build command `npm run build`, output directory `dist`.
3. **Add the site's exact origin to the API's CORS allow-list**, e.g. on the API: `Cors__AllowedOrigins__0=https://app.your-domain.com`. Without this the browser blocks every request.
4. Serve over HTTPS.

## How it works

- **Auth:** the API issues short-lived access tokens and single-use rotating refresh tokens. The client refreshes transparently, with a single in-flight refresh so concurrent requests never reuse a token. The session is kept in `localStorage` and synced across tabs.
- **Map painting:** strokes appear instantly and are saved in batches (one request per stroke, not per cell). If a save fails, the map snaps back to the last saved state and tells you.
- **Finance:** totals and charts come from the API's summary endpoint, so they always match what's stored.

## Project layout

```
src/
  main.tsx                 entry (error boundary)
  app/
    App.tsx                auth gate → farm setup → dashboard
    api/                   typed API client, endpoints, wire types
    auth/                  sign-in / register
    dashboard/             map, sections, activities, finance + data hook
    format.ts              section catalogue, money/date helpers
    ui.tsx  Toasts.tsx     shared modal, form and toast components
```
