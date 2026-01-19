ICN Suite (icn-suite2) - Fix3 Patch

What this patch does
1) Fixes Cloudflare Pages SPA fallback parsing:
   - Adds public/_redirects with the correct one-line rewrite rule.
   - This prevents route refresh 404s and removes the "infinite loop" warning.

2) Adds SIP theme foundation block (as an append/merge file):
   - src/index.css.append
   - You must merge it into your existing src/index.css (or replace if you prefer).

How to use
A) Copy public/_redirects into your repo at: public/_redirects
B) Merge src/index.css.append into: src/index.css
C) Verify main.tsx includes: import "./index.css";
D) Commit and push.

Notes
- This patch is safe: it does not touch routing code or the Zustand store.
- This patch is intended to be applied on top of your current GREEN build (Fix2).
