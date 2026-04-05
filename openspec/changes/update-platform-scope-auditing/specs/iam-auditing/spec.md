## MODIFIED Requirements
### Requirement: Dual-Write für Child-A-Sicherheitsereignisse

Das System MUST Child-A-Sicherheitsereignisse sowohl in den scope-passenden Audit-Store als auch über den SDK Logger in die OTEL-Pipeline emittieren.

#### Scenario: Tenant-Login wird dual emittiert

- **WHEN** ein Login-Ereignis im Tenant-Scope entsteht
- **THEN** wird ein Audit-Record in `iam.activity_logs` geschrieben
- **AND** ein strukturierter SDK-Logeintrag mit `scope_kind=instance`, `instance_id`, `request_id` und `trace_id` emittiert

#### Scenario: Root-Host-Auth-Ereignis wird dual emittiert

- **WHEN** ein Login-, Logout- oder Silent-Reauth-Ereignis auf dem Root-Host entsteht
- **THEN** wird ein Audit-Record in `iam.platform_activity_logs` geschrieben
- **AND** ein strukturierter SDK-Logeintrag mit `scope_kind=platform`, `workspace_id=platform`, `request_id` und `trace_id` emittiert
- **AND** es wird kein synthetischer `instance_id`-Wert erzeugt

### Requirement: Immutable Logging für Identity-Basisereignisse

Das System MUST sicherheitsrelevante Identity-Ereignisse unveränderbar protokollieren und Audit- von operativen Logging-Pfaden strikt trennen.

#### Scenario: Fehlerlogging bleibt redigiert

- **WHEN** ein Auth-, Resolver- oder Audit-Pfad technisch fehlschlägt
- **THEN** enthalten operative Logs nur strukturierte, redigierte Felder wie `error_type`, `reason_code`, `dependency`, `scope_kind`, `request_id` und `trace_id`
- **AND** keine Tokens, Secrets, rohen Provider-Antworten oder Klartext-PII werden geloggt
