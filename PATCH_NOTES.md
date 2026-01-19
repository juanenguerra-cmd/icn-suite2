# Fix5.3 — ABT parsing: smarter grouping + better extraction

## Improvements
- Filters out common header/footer lines from "Order Listing Report".
- Groups ABT items into entries using resident markers like: LAST, FIRST (12345).
- Extracts resident name even if marker is not at the start of the chunk.
- Better drug capture using dosage-form keywords (Tablet/Capsule/Solution/etc).
- Preview shows pack.meta when splitting logic is used.

## Deploy
Overwrite these files in your repo:
- public/_redirects
- public/collector.html
- public/import.html

Then commit + push.

## Use
Open: /import
