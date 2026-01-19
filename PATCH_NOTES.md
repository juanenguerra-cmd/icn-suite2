# Fix6 — Working Mode (Big Jump)

## What you get
- Quick Collector now includes a built-in **Pack Vault**:
  - auto-save packs to vault (toggle)
  - manual save
  - view/delete packs
  - merge selected packs
  - download merged output
- **Append mode**: keep adding paste batches into a session pack (merges automatically).
- **Queue for ICN Suite**: stores the latest pack into localStorage queue key:
  - `icn_import_queue_v1`
  This is a safe handoff for your React app importer to consume later.
- New landing page:
  - `/working` -> Working Mode links

## Deploy
Overwrite:
- public/_redirects
- public/collector.html
- public/import.html
- public/working.html

Commit + push.

## Open
- /working (recommended)
- /import
