# ICN Suite — React + TypeScript (Vite) — Phase 1

This zip is a ready-to-run Vite React + TS project that implements **Phase 1: Census (Paste → Preview → Commit)** with:
- Crash-safe **ErrorBoundary** (export/reset options)
- Persistent **LocalStorage** via Zustand
- Basic census parser with warnings
- Cloudflare Pages SPA routing via `public/_redirects`

## Run locally
```bash
npm install
npm run dev
```
Open the URL printed in the terminal (usually http://localhost:5173).

## Production-like test
```bash
npm run build
npm run preview
```

## Cloudflare Pages settings
- Build command: `npm run build`
- Build output directory: `dist` (NO leading slash)
- Add `public/_redirects` (already included):
  `/*  /index.html  200`

## Notes
- Unit inference is placeholder (200s → Unit 2, 300s → Unit 3, 400s → Unit 4). We will tune this after you paste a real census format.
