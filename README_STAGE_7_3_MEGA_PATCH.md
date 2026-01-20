# Stage 7.3 — Reports Tab + Huge Deployment (MEGA PATCH)

This mega patch includes:
- Stage 7.2 ImportPage
- Stage 7.3 ReportsPage
- Shared persisted-state utilities

## Add to repo
Copy these files into your repo:
- src/features/shared/persist.ts
- src/features/import/ImportPage.tsx
- src/features/import/importUtils.ts
- src/features/reports/ReportsPage.tsx
- src/features/reports/reportsUtils.ts

## Wire into your React app (edit 1–2 files)
Add routes/tabs:
- /import -> <ImportPage />
- /reports -> <ReportsPage />

### React Router example
```ts
import ImportPage from "./features/import/ImportPage";
import ReportsPage from "./features/reports/ReportsPage";

<Route path="/import" element={<ImportPage />} />
<Route path="/reports" element={<ReportsPage />} />
```

### Tab-state example
Add two nav tabs:
- Import
- Reports

## What staff can do after this deploy
- Use Ops Pro to collect/queue (Entry/Protex/Collector)
- Go to React Import tab -> Apply selected
- Go to React Reports tab -> Print/CSV/Executive summary

Ops Pro remains your safe lane while React becomes your “real app UI”.
