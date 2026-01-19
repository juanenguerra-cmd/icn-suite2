# Fix5 — Quick Collector (Immediate Data Collection)

This patch adds a **static data collection page** you can use immediately on Cloudflare Pages:
- **/import.html** (no React wiring needed)
- Paste CSV / JSON array / raw lines
- Auto-detect or force format
- Generates **icn-bulk-import-v1** JSON pack
- Copy JSON / Download .json
- Saves draft in localStorage for convenience

## Files included
- public/_redirects
- public/import.html

## Apply
1) Copy `public/import.html` into your repo at: `public/import.html`
2) Overwrite your SPA redirects file at: `public/_redirects`
3) Commit + push

## Use
After deploy, open:
- https://<your-cloudflare-pages-domain>/import.html

### Notes
- The first line in `_redirects` ensures Cloudflare doesn't rewrite `/import.html` to the SPA entry.
- iPhone Safari clipboard can be strict. If Copy fails, long-press inside the JSON box and copy manually.
