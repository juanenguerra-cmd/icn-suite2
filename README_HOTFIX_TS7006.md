# Hotfix — TS7006 (implicit any) in src/features/import/importUtils.ts

Cloudflare build error:
- src/features/import/importUtils.ts(270,31): TS7006 Parameter 'd' implicitly has an 'any' type.

Fix:
- Add an explicit type to the map parameter: `map((d: any) => ...)`

Patch contains:
- A small replacement snippet to apply in your existing file.

How to apply:
1) Open: src/features/import/importUtils.ts
2) Find normalizePack() and replace the map line with the one in PATCH_SNIPPET.txt
3) Commit + push
