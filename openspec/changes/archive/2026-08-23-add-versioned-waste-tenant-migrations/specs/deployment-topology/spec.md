## ADDED Requirements

### Requirement: Promote führt Waste-Tenant-Migrationen versioniert und transaktional aus

Das System SHALL Waste-Schemaänderungen für bestehende Tenant-Datenbanken als geordnete, unveränderliche Migrationen ausführen, deren erfolgreicher Stand in der jeweiligen Waste-Datenbank protokolliert wird. Der reguläre Migrations-One-shot SHALL den Schema-Builder für Neuprovisionierungen nicht als wiederholbaren Reconcile-Vertrag verwenden.

#### Scenario: Additive Migration wird genau einmal angewendet

- **WHEN** ein geschützter Promote-Lauf eine registrierte Waste-Tenant-Datenbank mit einer ausstehenden Migration verarbeitet
- **THEN** führt der One-shot ausschließlich die noch nicht protokollierten Migrationsschritte in definierter Reihenfolge aus
- **AND** protokolliert er die Migrations-ID erst nach erfolgreicher Ausführung
- **AND** lässt ein späterer Lauf bereits protokollierte Migrationen unverändert

#### Scenario: Tenant-Migration schlägt atomar fehl

- **WHEN** ein SQL-Schritt oder die abschließende Verifikation für eine Tenant-Datenbank fehlschlägt
- **THEN** rollt der One-shot alle in dieser Tenant-Transaktion vorgenommenen Schema- und Ledger-Änderungen zurück
- **AND** beendet er den Promote-Migrationsschritt fail-closed vor dem App-Deploy

#### Scenario: Provisionierungs-Schema enthält historische destruktive Statements

- **WHEN** der kanonische Schema-Builder für neue Waste-Tenants Backfills, Rechteänderungen oder destruktive Bereinigungen enthält
- **THEN** gelangen diese Statements nicht implizit in den Migrationslauf bestehender Tenant-Datenbanken
- **AND** benötigt jede destruktive Bestandsmigration einen eigenen geprüften Migrationsschritt mit Preflight und expliziter Freigabe
