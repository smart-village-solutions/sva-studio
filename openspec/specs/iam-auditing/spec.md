# iam-auditing Specification

## Purpose
Diese Spezifikation definiert Anforderungen an das Auditing im IAM-Kontext: unveränderbare Protokollierung sicherheitsrelevanter Identity-Ereignisse, duale Emission in `iam.activity_logs` und die OTEL-Pipeline sowie nachvollziehbare Dokumentation von Migrationen und RLS-Ausnahmepfaden.
## Requirements
### Requirement: Immutable Logging für Identity-Basisereignisse

Das System MUST sicherheitsrelevante Identity-Ereignisse aus Child A unveränderbar protokollieren.

#### Scenario: Login/Logout wird protokolliert

- **WHEN** ein Benutzer sich erfolgreich anmeldet oder abmeldet
- **THEN** wird ein unveränderbares Audit-Event mit Zeitpunkt, pseudonymisierter Actor-Referenz und Ergebnis erzeugt
- **AND** Klartext-PII wird nicht gespeichert

#### Scenario: Token-Validierungsfehler wird protokolliert

- **WHEN** Token-Validierung fehlschlägt (z. B. `invalid`, `expired`, `issuer_mismatch`, `audience_mismatch`)
- **THEN** wird ein `warn`-fähiges Sicherheitsereignis mit Fehlerklasse erzeugt
- **AND** Tokenwerte, Session-IDs und Klartext-PII werden nicht geloggt

### Requirement: Dual-Write für Child-A-Sicherheitsereignisse

Das System MUST Child-A-Sicherheitsereignisse sowohl in `iam.activity_logs` als auch über den SDK Logger in die OTEL-Pipeline emittieren.

#### Scenario: Duale Emission bei Login-Ereignis

- **WHEN** ein Login-Ereignis entsteht
- **THEN** wird ein Audit-Record in `iam.activity_logs` geschrieben
- **AND** ein strukturierter SDK-Logeintrag mit korrelierbaren IDs (`request_id`, `trace_id`) emittiert

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
