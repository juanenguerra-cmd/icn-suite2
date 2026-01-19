FIX-ONLY ZIP — Cloudflare build stabilization

Problem
- Repo contained two stacks (legacy src/pages + Context store) and (new src/features + Zustand store).
- Cloudflare compiled everything, causing useIcnStore vs useICNStore errors and missing type exports.

Fix
- This zip uses ONLY the Zustand stack:
  - src/store/icnStore.ts exports useICNStore
  - src/types/icn.ts exports VaccineName/VaccineRecord/AntibioticRecord, etc.
  - src/features/** contains Census + Vaccinations + ABT
- TypeScript configs exclude legacy folders if they exist:
  - src/pages/**
  - src/store/icnStore.tsx

How to apply
1) In your real repo folder (keep .git/), delete dist/ and node_modules/.
2) Replace src/, public/, index.html, package.json, tsconfig*.json, vite.config.ts, tailwind config files with this zip's versions.
3) Commit + push.
