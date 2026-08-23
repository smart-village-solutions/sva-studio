## 1. Spezifikation und Architektur

- [x] 1.1 Versionierten, transaktionalen Waste-Tenant-Migrationsvertrag spezifizieren.
- [x] 1.2 Arc42- und Rollout-Dokumentation auf den versionierten Vertrag umstellen.

## 2. Implementierung

- [x] 2.1 Schema-Builder-Manifest und zugehörige Build-Paketierung entfernen.
- [x] 2.2 Tenant-lokales Migrationsledger und geordnete additive Migrationen implementieren.
- [x] 2.3 Rollback, Wiederanlauf, Namensdrift und Scope durch Charakterisierungstests absichern.

## 3. Verifikation

- [x] 3.1 Betroffene Unit-, Type-, Runtime-, Lint- und Deployment-Gates ausführen.
- [x] 3.2 New-only-Fallow-Audits für alle betroffenen Workspaces ausführen.
- [x] 3.3 PR-HEAD pushen und CI, Coverage sowie Review-Threads terminal verifizieren. Abschlussnachweis: PR #984 wurde am 16. August 2026 gemergt; die terminale Review-Auswertung weist keine offenen Threads, fehlgeschlagenen oder ausstehenden Checks aus.
