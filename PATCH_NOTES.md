# Fix9 — Full Production Pipeline (static)

Routes:
- /working  : landing page
- /import   : Quick Collector
- /apply    : Apply to Tracker (schema map + dedup + file upload)
- /reports  : Reports (ABT active, IP active, Vax snapshot + executive summary)

Deploy overwrite:
- public/_redirects
- public/working.html
- public/collector.html
- public/import.html
- public/bridge.html
- public/reports.html
