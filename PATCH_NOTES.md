# ICN Suite v10 — Unified Shell Static Deploy

This patch deploys your uploaded Unified Tracker shell UI as a static page so you *immediately* see the layout you expect.

Open:
- /unified?v=1

Included:
- public/unified.html
- public/_redirects (merge the /unified lines into your existing _redirects if you already have one)

Note:
- Embedded iframe tool filenames referenced by the shell must exist in your repo to fully function.
  Even if they don't yet, you will still see the exact UI structure (header + left nav + dashboard cards).
