# Fix7 — Working Mode PRO (Big Jump)

## What’s new
- **Vault export/import**:
  - Export Vault backup JSON
  - Import Vault backups or individual icn-bulk-import-v1 packs (multi-select)
- **CSV export**:
  - Export merged pack (or current pack) to CSV
  - Choose dataset (Auto/Census/Vaccinations/ABT/Generic)
- **Executive Summary**:
  - Generates a concise summary with dataset counts + top ABT meds + top vaccines
- Keeps:
  - Append mode
  - Auto-save to Vault
  - Merge + download merged
  - Queue for ICN Suite

## Deploy
Overwrite in repo:
- public/_redirects
- public/collector.html
- public/import.html
- public/working.html

Commit + push.

## Open
- /working
- /import
