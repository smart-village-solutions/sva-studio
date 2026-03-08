# IAM Retention-Automation

## Ziel

Automatisierte Durchsetzung von Aufbewahrungsfristen pro Mandant:

- PII-Anonymisierung nach `retention_days`
- Audit-Archivierung nach `audit_retention_days`

## Technische Basis

- Migration `0006_iam_activity_log_archive.sql` erstellt `iam.activity_logs_archive`.
- Script: `scripts/ops/run-iam-retention.mjs`
- Ausführung:

```bash
pnpm iam:retention:run
```

## Ablauf im Script

1. **PII-Anonymisierung**
   - Kandidaten: `iam.accounts` mit `soft_deleted_at` und ohne `permanently_deleted_at`
   - Schwellwert: `NOW() - retention_days` je `iam.instances`
   - Felder werden geleert: `email_ciphertext`, `display_name_ciphertext`, `first_name_ciphertext`, `last_name_ciphertext`, `phone_ciphertext`, `notes`
   - Marker: `permanently_deleted_at = NOW()`

2. **Audit-Archivierung**
   - Kandidaten: `iam.activity_logs` älter als `audit_retention_days` je `iam.instances`
   - Transfer nach `iam.activity_logs_archive`
   - Danach Löschung aus `iam.activity_logs`

## Cron-Empfehlung

- Frequenz: täglich `02:30 UTC`
- Beispiel:

```cron
30 2 * * * cd /opt/sva-studio && IAM_DATABASE_URL=*** pnpm iam:retention:run >> /var/log/sva/iam-retention.log 2>&1
```

## Monitoring

- Log-Ausgabe enthält Anzahl anonymisierter und archivierter Datensätze.
- Bei Exit-Code `!= 0` Alarm auslösen (Job-Failure).
