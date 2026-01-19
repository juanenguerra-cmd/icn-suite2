ICN Suite (icn-suite2) — Fix4 Patch

What this patch adds
- Fixes Cloudflare SPA fallback by supplying public/_redirects.
- Adds a new feature module: src/features/import/ImportCenter.tsx
  - Paste/upload CSV/JSON/raw lines
  - Builds an "icn-bulk-import-v1" JSON pack
  - Copy JSON to clipboard

Why this is safe for immediate deployment
- No dependency changes.
- No store or routing changes.
- Purely additive feature folder + redirects.

How to install
1) Copy public/_redirects into your repo's public/_redirects (overwrite).
2) Copy the folder src/features/import/ into your repo at the same path.
3) Commit + push.

How to show it in the UI (choose one)
A) Add a new tab/page in your existing shell and render:
   <ImportCenter />
   import { ImportCenter } from "@/features/import/ImportCenter";

B) Add a button somewhere (e.g., in Config) that toggles this component.

Notes
- This build intentionally does NOT write into icnStore yet.
  Next patch will add a schema-aware "Apply Pack" adapter that maps the pack into your store's exact types.
