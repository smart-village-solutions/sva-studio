## MODIFIED Requirements
### Requirement: App-Stack Definition
Das System SHALL Web-Apps unter `apps/` mit klar getrennten Verantwortlichkeiten bereitstellen.

Die interne Studio-Anwendung bleibt unter `apps/sva-studio-react` als TanStack-Start-App bestehen.
Für die öffentliche Fortschrittsberichterstattung SHALL zusätzlich eine eigenständige statische Reporting-App unter `apps/project-report` existieren.

#### Scenario: Interne Studio-App vorhanden
- **WHEN** das Workspace-Setup abgeschlossen ist
- **THEN** existiert `apps/sva-studio-react` als interne Studio-App

#### Scenario: Öffentliche Reporting-App vorhanden
- **WHEN** die Projektberichterstattung bereitgestellt wird
- **THEN** existiert `apps/project-report` als eigenständige App im Workspace
- **AND** die App ist baulich von `apps/sva-studio-react` getrennt
- **AND** die App besitzt eigene Nx-Targets für Build, Lint und mindestens einen Testtyp
