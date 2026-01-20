# Stage 7.2 — React Import Tab (PATCH)

This patch adds a React Import page that:
- Reads queue from localStorage key: `icn_import_queue_v1`
- Supports: select/apply queued packs, paste JSON pack, upload JSON file(s)
- Applies to the app's persisted state by detecting the persisted key (Zustand persist or plain object)
- Creates a backup before writing: `icn_state_backup_YYYY-MM-DD-HH-MM-SS` and stores latest key in `icn_latest_backup_key_v1`
- Dedups ABT/VAX/IP while importing into canonical:
  - modules.abt.courses[]
  - modules.vaccinations.records[]
  - modules.ip.cases[]
  - residentsById{}

## Files added
- src/features/import/ImportPage.tsx
- src/features/import/importUtils.ts

## Wire into your app (edit 1–2 files)
Add a tab/route in your existing nav/router.

### React Router example
```ts
import ImportPage from "./features/import/ImportPage";
<Route path="/import" element={<ImportPage />} />
```

### Tab-state example
Add a tab labeled "Import" rendering <ImportPage />.

## IMPORTANT
This implementation updates persisted localStorage directly for maximum compatibility.
If your store doesn't re-render on external localStorage writes, refresh the app after applying.
(We can switch to store actions once we confirm your icnStore API.)
