## ADDED Requirements

### Requirement: Freigegebene Studio-Foundations fuer Daten, Formulare und Tests

Das System SHALL fuer die React-Host-Anwendung und pluginfaehige Frontend-Pakete einen freigegebenen Foundation-Stack fuer wiederverwendeten Server-State, Formulare und Frontend-Tests bereitstellen.

Dieser Foundation-Stack umfasst mindestens `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `msw` und `fast-check`.

#### Scenario: Frontend-Paket benoetigt wiederverwendeten Server-State oder Formularorchestrierung

- **WHEN** ein Host- oder Plugin-Frontend-Paket neue datenladende oder formularzentrierte UI-Logik einfuehrt
- **THEN** verwendet es fuer clientseitig wiederverwendeten Server-State `@tanstack/react-query`
- **AND** verwendet es fuer formularzentrierte Interaktionen `react-hook-form` plus `@hookform/resolvers`
- **AND** fuehrt keine parallele zweite Foundation fuer dieselben Aufgaben ein

#### Scenario: Test- und Runtime-Abhaengigkeiten bleiben korrekt getrennt

- **WHEN** die Workspace-Pakete fuer diese Foundations konfiguriert werden
- **THEN** liegen browserseitige Runtime-Abhaengigkeiten nur in Frontend-Projekten
- **AND** liegen `msw` und `fast-check` als Test- oder Entwicklungsabhaengigkeiten in den betroffenen Projekten oder im Root-Tooling
- **AND** serverseitige Runtime-Pakete werden nicht mit browser-only Frontend-Foundations belastet

### Requirement: Hostweiter Query-Client-Standard

Das System SHALL in `apps/sva-studio-react` einen hostweiten `QueryClient` als Standard fuer Query-Caching, Mutationen und Invalidation bereitstellen.

#### Scenario: Mehrere Views teilen dieselbe Server-Entitaet

- **WHEN** mehrere Host- oder Plugin-Views dieselben serverseitigen Daten wiederverwenden
- **THEN** teilen sie sich den hostweiten `QueryClient`
- **AND** verwenden stabile Query-Keys statt lokaler, voneinander isolierter Fetch-States
- **AND** koennen betroffene Daten nach Mutationen gezielt invalidieren

#### Scenario: Neue Query-Muster werden eingefuehrt

- **WHEN** ein neuer Datenlade- oder Mutationsfluss in der React-App entsteht
- **THEN** definiert er Query-Key-, Refetch- und Invalidation-Verhalten nach demselben hostweiten Standard
- **AND** dokumentiert Query-Keys so, dass Host und Plugins keine widerspruechlichen Cache-Semantiken erzeugen
