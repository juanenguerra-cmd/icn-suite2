# Fix5.4 — ABT grouping + extraction for LON/alphanumeric IDs

## What it fixes
- ABT resident markers like `SPECTOR, LESLIE G (LON202033)` were not detected because the ID isn't all digits.
  That prevented grouping and caused recordCount to inflate (each line became a record).
- Now the collector recognizes IDs inside parentheses that are **alphanumeric** (letters+numbers, optional hyphen).

## Improvements
- Proper grouping by resident marker → recordCount should match actual residents/orders (not header lines).
- Better antibiotic extraction: prefers the medication text right after the `(ID)` marker, up to `Give` or the first date.

## Deploy
Overwrite in repo:
- public/collector.html
- public/import.html
- public/_redirects

Commit + push.

## Open
- /import
