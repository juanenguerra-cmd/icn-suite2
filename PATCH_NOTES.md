# Fix5.4.2 — ABT mm trim hotfix

## Error fixed
Uncaught TypeError: Cannot read properties of undefined (reading 'trim')

Cause: ABT extraction referenced `mm[2].trim()` but the regex only has one capture group,
so the medication text is `mm[1]`.

Fix: use `mm[1]` and guard for undefined.

## Deploy
Overwrite:
- public/collector.html
- public/import.html
- public/_redirects

Commit + push, reload /import.
