# Ops Pack v3 — End-of-day Reminder + Backup Now

Adds:
- End-of-day reminder banner (default 19:00) if no backup today (or always if never backed up)
- Banner button: Backup Now (downloads JSON immediately)
- /backup settings:
  - reminder time (HH:MM)
  - filename mode: daily or timestamp
- Backup updates icn_last_backup_at_v1 so banner stops for the day

Deploy: overwrite public/ and push.
