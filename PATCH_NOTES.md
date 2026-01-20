# Ops Pack v7 — Schema Doctor (Stage 7.1)

Adds:
- /doctor : detects tracker localStorage key, creates backup, migrates legacy arrays into canonical:
  - modules.abt.courses[]
  - modules.vaccinations.records[]
  - modules.ip.cases[]
  - residentsById{}
- Clears legacy arrays after move to prevent double counting
- Stores migration metadata under state.migrations.schemaDoctorV1
- Adds “Run Schema Doctor” widget in /ops
- _redirects updated for /doctor

Deploy: overwrite public/ and push. Open /doctor?v=7.
