# Fix5.4.1 — ABT ReferenceError hotfix

## Error fixed
Uncaught ReferenceError: Cannot access 'antibiotic' before initialization

Cause: the ABT extraction block referenced `antibiotic` before it was declared.

Fix: declare `let antibiotic = ...` first, then run the "prefer drug text after (ID)" logic.

## Deploy
Overwrite:
- public/collector.html
- public/import.html
- public/_redirects

Commit + push, then reload /import.
