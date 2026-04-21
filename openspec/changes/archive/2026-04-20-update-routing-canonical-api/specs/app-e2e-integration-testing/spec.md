## MODIFIED Requirements
### Requirement: Mindestabdeckung kritischer Navigationspfade
Das System SHALL mindestens die Root-Shell, eine echte Kernroute, eine Plugin-Route und den Auth-Entry-Point im E2E-Smoketest abdecken.

#### Scenario: Kernrouten verfügbar
- **WHEN** der E2E-Smoketest läuft
- **THEN** liefern `/`, `/interfaces` und `/plugins/example` erfolgreiche Antworten
- **AND** `/auth/login` liefert den erwarteten Redirect-Flow

#### Scenario: Clientseitige Navigation hält die Shell aktiv
- **WHEN** der Browser von `/` clientseitig nach `/interfaces` navigiert
- **THEN** bleibt die App-Shell erhalten
- **AND** es erfolgt kein Full Reload der gesamten Anwendung
