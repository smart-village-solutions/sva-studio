# Change: Baseline der Kontolöschregeln aktualisieren

## Why

Die bisherige Baseline `90 / 180 / 365` ist für den vorgesehenen Konten-Lebenszyklus zu kurz. Außerdem beschreibt die Oberfläche die Fristen derzeit nicht überall eindeutig als absolute Schwellwerte seit dem letzten erfolgreichen Login.

## What Changes

- Die zentrale Baseline für Deaktivierung, Pseudonymisierung und finalen Tombstone-Soft-Delete wird auf `365 / 730 / 1.095` Tage geändert.
- Bereits explizit gespeicherte Tenant-Regeln bleiben unverändert; die neue Baseline wirkt für alle Tenants ohne explizite Konfiguration.
- Admin- und Self-Service-Oberflächen formulieren jede Frist eindeutig als absoluten Zeitraum seit dem letzten erfolgreichen Login.
- Die Texte stellen weiterhin klar, dass `deleted` im automatischen Lifecycle einen finalen Tombstone-Soft-Delete und keine physische Löschung bezeichnet.

## Impact

- Affected specs: `iam-data-subject-rights`, `account-ui`
- Affected code: `packages/iam-governance`, Account- und IAM-Admin-UI, zugehörige Tests und Dokumentation
- Affected arc42 sections: keine; Datenmodell und Systemgrenzen bleiben unverändert
