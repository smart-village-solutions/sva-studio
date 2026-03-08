# IAM Auditing Specification Delta (Core Data Layer)

## ADDED Requirements

### Requirement: Auditierbare Migrations- und Seed-Operationen

Das System SHALL sicherheitsrelevante IAM-Migrations- und Seed-Operationen nachvollziehbar protokollieren.

#### Scenario: Ausführung einer IAM-Migration

- **WHEN** eine Migration im `iam`-Schema ausgeführt wird
- **THEN** wird ein nachvollziehbarer Lauf mit Zeitpunkt, Version und Ergebnis erzeugt
- **AND** fehlgeschlagene Läufe sind für Betrieb und Incident-Analyse sichtbar

### Requirement: Audit-Kontext für RLS-Ausnahmepfade

Das System SHALL dokumentierte RLS-Ausnahmepfade in Migrationen oder Admin-Prozessen als Sicherheitskontext erfassbar machen.

#### Scenario: Geplanter RLS-Bypass in Migration

- **WHEN** ein legitimierter Prozess RLS temporär umgeht
- **THEN** enthält der Vorgang einen dokumentierten Grund und Scope
- **AND** nach Abschluss ist der Normalzustand wiederhergestellt und nachweisbar

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
