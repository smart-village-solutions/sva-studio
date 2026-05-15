## ADDED Requirements

### Requirement: Freigegebene Studio-Foundations fuer Formulare und Tests

Das System SHALL fuer die React-Host-Anwendung und pluginfaehige Frontend-Pakete einen freigegebenen Foundation-Stack fuer Formulare und Frontend-Tests bereitstellen.

Dieser Foundation-Stack umfasst mindestens `react-hook-form`, `@hookform/resolvers`, `msw` und `fast-check`.

#### Scenario: Frontend-Paket benoetigt Formularorchestrierung

- **WHEN** ein Host- oder Plugin-Frontend-Paket neue oder grundlegend ueberarbeitete formularzentrierte UI-Logik einfuehrt
- **THEN** verwendet es fuer formularzentrierte Interaktionen `react-hook-form` plus `@hookform/resolvers`
- **AND** fuehrt keine parallele zweite Foundation fuer dieselben Aufgaben ein

#### Scenario: Bestehender stabiler Formularfluss bleibt unveraendert

- **WHEN** ein bestehender Formularfluss keine neue Funktionalitaet und keine grundlegende Ueberarbeitung erhaelt
- **THEN** muss er nicht allein zur Angleichung an die neue Foundation sofort migriert werden
- **AND** bleibt die Migration bis zu einer fachlichen Ueberarbeitung oder gezielten Konsolidierung optional

#### Scenario: Test- und Runtime-Abhaengigkeiten bleiben korrekt getrennt

- **WHEN** die Workspace-Pakete fuer diese Foundations konfiguriert werden
- **THEN** liegen browserseitige Runtime-Abhaengigkeiten nur in Frontend-Projekten
- **AND** liegen `msw` und `fast-check` als Test- oder Entwicklungsabhaengigkeiten in den betroffenen Projekten oder im Root-Tooling
- **AND** serverseitige Runtime-Pakete werden nicht mit browser-only Frontend-Foundations belastet

### Requirement: Gemeinsame Einfuehrungsbausteine fuer Foundations

Das System SHALL die Einfuehrung von Formular- und Test-Foundations ueber gemeinsame Adapter, Test-Helfer und Migrationsregeln orchestrieren, statt jede View oder jeden Test isoliert zu verdrahten.

#### Scenario: Formularstandard wird eingefuehrt

- **WHEN** `react-hook-form` in Host- oder Plugin-Views eingefuehrt wird
- **THEN** stehen dokumentierte Studio-Patterns oder gemeinsame Adapter fuer gaengige Formularbausteine zur Verfuegung
- **AND** wird Fehler- und Summary-Mapping nicht pro View neu erfunden

#### Scenario: HTTP-Teststandard wird eingefuehrt

- **WHEN** `msw` fuer HTTP-nahe Frontend-Tests eingefuehrt wird
- **THEN** existiert ein gemeinsames Test-Setup mit wiederverwendbaren Handlern und Reset-Regeln
- **AND** ist die Abgrenzung zu Modul-Mocks und Live-E2E dokumentiert
