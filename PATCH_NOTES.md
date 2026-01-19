# Fix5.1 — Quick Collector visible (Cloudflare Pages-safe)

Problem: Your SPA fallback rule `/* /index.html 200` can intercept `/import.html`, so you never see the collector.

Solution: Proxy `/import` (and `/import.html`) to a separate static asset `/collector.html` using status **200** proxying,
*above* the SPA fallback.

## After deploy
Open:
- /import   (recommended)
- /import.html (also works)

## Files
- public/collector.html
- public/_redirects

## Apply
Copy both files into your repo (overwrite), commit, push.
