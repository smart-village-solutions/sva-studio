## ADDED Requirements

### Requirement: OTEL-basierte Runtime- und IAM-Diagnostik

Das System SHALL OpenTelemetry nicht nur für generische Logs und Metriken, sondern auch für korrelierbare Runtime- und IAM-Diagnostik nutzen.

#### Scenario: IAM-Request-Spans tragen Diagnoseattribute

- **WHEN** ein IAM-Request verarbeitet wird
- **THEN** enthält der aktive Span Attribute wie `iam.endpoint`, `iam.instance_id`, `iam.actor_resolution`, `iam.reason_code`, `db.schema_guard_result`, `dependency.redis.status` und `dependency.keycloak.status`
- **AND** diese Attribute enthalten keine Secrets oder PII

#### Scenario: Diagnose-Events korrelieren Runtime-Pfade

- **WHEN** ein Doctor-, Readiness- oder Migrationspfad eine Drift oder Abhängigkeitsstörung erkennt
- **THEN** erzeugt das System OTEL-Events für Schema-Guard, Actor-Diagnose oder Migrationsverifikation
- **AND** diese Events bleiben über `request_id` und `trace_id` mit Logs, Browser-Netzwerkdaten und Runbooks korrelierbar
