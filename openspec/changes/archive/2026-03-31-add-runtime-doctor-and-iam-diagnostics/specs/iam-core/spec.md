## ADDED Requirements

### Requirement: Nicht-sensitive Diagnosefelder für IAM-Hotspots

Das System MUST für stabile IAM-v1-Hotspots strukturierte, nicht-sensitive Diagnosefelder bereitstellen, damit fachliche Ursachen ohne Provider- oder Secret-Leakage erkennbar werden.

#### Scenario: Fehlender Actor-Account wird explizit diagnostiziert

- **WHEN** ein IAM-Endpunkt wie `/api/v1/iam/me/context` oder `/api/v1/iam/users` den Actor im aktiven Instanzkontext nicht auflösen kann
- **THEN** bleibt der öffentliche Fehlercode stabil (`forbidden` oder `database_unavailable`)
- **AND** die Antwort enthält additive `details.reason_code`-Werte wie `missing_actor_account` oder `missing_instance_membership`
- **AND** die Antwort enthält keine rohen SQL-, Token- oder Provider-Interna

#### Scenario: Schema-Drift wird deterministisch gemeldet

- **WHEN** ein kritischer IAM-Schema-Bestandteil wie `iam.account_groups`, `iam.groups`, `idx_accounts_kc_subject_instance` oder eine RLS-Policy fehlt
- **THEN** melden `/health/ready`, `env:doctor:*` und betroffene IAM-Hotspots eine maschinenlesbare Ursache wie `schema_drift`, `missing_table` oder `missing_column`
- **AND** optionale Hinweise wie `schema_object` und `expected_migration` bleiben nicht-sensitiv

### Requirement: Kritischer IAM-Schema-Guard

Das System MUST vor Acceptance-Smoke und nach Migrationen den kritischen IAM-Sollstand validieren.

#### Scenario: Migration validiert den Sollstand

- **WHEN** `env:migrate:acceptance-hb` erfolgreich alle SQL-Dateien angewendet hat
- **THEN** validiert ein Schema-Guard kritische Tabellen, Spalten, Indizes und RLS-Policies
- **AND** der Befehl endet nicht erfolgreich, solange kritische Drift verbleibt

#### Scenario: Smoke erkennt Drift vor Fachfehlern

- **WHEN** `env:smoke:<profil>` oder `env:doctor:<profil>` gegen einen Drift-Zustand ausgeführt wird
- **THEN** wird die Drift als eigener Fehler gemeldet
- **AND** die Betriebsanalyse muss nicht erst über zufällige `500`- oder `403`-Antworten auf indirekten Fachpfaden erfolgen
