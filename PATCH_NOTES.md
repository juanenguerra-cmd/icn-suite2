# Fix5.2 — Quick Collector: record count + preview + smarter ABT parsing

## What it fixes
- "Records:" pill now always shows a number (was blank due to id mismatch in some deployments).
- Adds a **Preview (first 5)** box so you can confirm parsing before copying/downloading.
- If pasted ABT data comes in as one huge line (common from PDFs), it tries to split by resident markers like:
  `LAST, FIRST (12345)`.

## Deploy
Copy into your repo (overwrite):
- public/_redirects
- public/collector.html
- public/import.html

Then commit + push.

## Open
- /import (recommended)
- /import.html (also works)
