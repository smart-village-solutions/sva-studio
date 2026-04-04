## MODIFIED Requirements
### Requirement: Health-Checks und Observability
Das System MUST Health-Check-Endpunkte bereitstellen, die den Zustand der IAM-Infrastruktur prüfen und eine stabile, UI-taugliche Darstellung zentraler Abhängigkeiten liefern.

#### Scenario: Readiness-Probe
- **WENN** ein Orchestrator (K8s, Docker) die Readiness prüft via `GET /health/ready`
- **DANN** prüft der Endpunkt: DB-Connection, Keycloak-Konnektivität, Redis-Session-Store
- **UND** gibt `200 OK` zurück, wenn alle Systeme erreichbar sind
- **UND** gibt `503 Service Unavailable` mit Details zurück, wenn ein System ausgefallen ist

#### Scenario: UI-taugliche Dienstübersicht für das Studio
- **WHEN** das Studio den Readiness-Endpunkt für die Shell-Anzeige abfragt
- **THEN** enthält die Antwort eine stabile Liste oder Struktur einzelner Dienste mit Namen und Status
- **AND** mindestens `database`, `redis` und `keycloak` sind einzeln auswertbar
- **AND** jeder Dienst liefert einen maschinenlesbaren Status wie `ready`, `degraded`, `not_ready` oder `unknown`
- **AND** optionale Diagnosefelder bleiben auf sichere, nicht-sensitive Werte wie `reason_code` und lokalisierbare Kurzmeldungen begrenzt

#### Scenario: Readiness-Response bleibt für UI und Betrieb korrelierbar
- **WHEN** der Readiness-Endpunkt antwortet
- **THEN** enthält die Antwort weiterhin `requestId` und Zeitstempel
- **AND** fehlgeschlagene Dienstprüfungen werden serverseitig strukturiert geloggt
- **AND** die öffentliche Response enthält keine Stacktraces, Secrets oder rohen Provider-Interna
