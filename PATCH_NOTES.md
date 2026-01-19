# Fix5.3.1 — Collector Syntax Error Hotfix

## Fix
Removes a duplicated/stray code fragment inside `coerceRecords()` that caused:
`Uncaught SyntaxError: Unexpected token ')'` (collector:437)

## Deploy
Overwrite:
- public/collector.html
- public/import.html
- public/_redirects

Commit + push.

## Open
- /import
