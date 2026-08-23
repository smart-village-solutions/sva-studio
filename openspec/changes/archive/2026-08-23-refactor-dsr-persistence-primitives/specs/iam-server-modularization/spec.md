## ADDED Requirements

### Requirement: DSR-Persistenzprimitiven besitzen einen fachlichen Owner

Das System SHALL die parametrierten SQL-Verträge für aktive Legal Holds, DSR-Request-Events und DSR-Audit-Events zentral in `@sva/iam-governance` besitzen. Alle Consumer SHALL dieselbe Instanzbindung, UUID-Casts, JSON-Serialisierung, Request-/Trace-Korrelation und Fehlerpropagation verwenden.

#### Scenario: Legal Hold wird mandantengebunden geprüft

- **WHEN** ein DSR-Flow den aktiven Legal-Hold-Status eines Accounts prüft
- **THEN** bindet die Abfrage sowohl `instance_id` als auch `account_id`
- **AND** berücksichtigt ausschließlich aktive, nicht abgelaufene Holds

#### Scenario: DSR-Ereignis wird unverändert persistiert

- **WHEN** ein DSR-Flow ein Request- oder Audit-Event persistiert
- **THEN** bleiben Querytext, Parameterreihenfolge und JSON-Serialisierung über alle Consumer identisch
- **AND** stammen Request-ID und Trace-ID eines Audit-Events ausschließlich aus dem aktiven Workspace-Kontext

#### Scenario: Persistenzfehler stoppt den Flow

- **WHEN** eine Legal-Hold- oder Event-Abfrage fehlschlägt
- **THEN** wird der Fehler unverändert propagiert
- **AND** wird keine nachfolgende Persistenzabfrage desselben Flows ausgeführt
