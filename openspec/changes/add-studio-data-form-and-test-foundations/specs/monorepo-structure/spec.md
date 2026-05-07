## ADDED Requirements

### Requirement: Freigegebene Studio-Foundations fuer Formulare und Tests

Das System SHALL fuer die React-Host-Anwendung und pluginfaehige Frontend-Pakete einen freigegebenen Foundation-Stack fuer Formulare und Frontend-Tests bereitstellen.

Dieser Foundation-Stack umfasst mindestens `react-hook-form`, `@hookform/resolvers`, `msw` und `fast-check`.

#### Scenario: Frontend-Paket benoetigt Formularorchestrierung

- **WHEN** ein Host- oder Plugin-Frontend-Paket neue formularzentrierte UI-Logik einfuehrt
- **THEN** verwendet es fuer formularzentrierte Interaktionen `react-hook-form` plus `@hookform/resolvers`
- **AND** fuehrt keine parallele zweite Foundation fuer dieselben Aufgaben ein

#### Scenario: Test- und Runtime-Abhaengigkeiten bleiben korrekt getrennt

- **WHEN** die Workspace-Pakete fuer diese Foundations konfiguriert werden
- **THEN** liegen browserseitige Runtime-Abhaengigkeiten nur in Frontend-Projekten
- **AND** liegen `msw` und `fast-check` als Test- oder Entwicklungsabhaengigkeiten in den betroffenen Projekten oder im Root-Tooling
- **AND** serverseitige Runtime-Pakete werden nicht mit browser-only Frontend-Foundations belastet
