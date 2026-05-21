## ADDED Requirements

### Requirement: Freigegebene Studio-Foundations fuer Formulare und Tests

Das System SHALL fuer die React-Host-Anwendung und pluginfaehige Frontend-Pakete einen verbindlichen repo-weiten Foundation-Stack fuer Formulare und Frontend-Tests bereitstellen.

Dieser Foundation-Stack umfasst mindestens `react-hook-form`, `@hookform/resolvers`, `msw` und `fast-check`.

#### Scenario: Frontend-Paket benoetigt Formularorchestrierung

- **WHEN** ein Host- oder Plugin-Frontend-Paket neue oder grundlegend ueberarbeitete formularzentrierte UI-Logik einfuehrt
- **THEN** verwendet es fuer formularzentrierte Interaktionen `react-hook-form` plus `@hookform/resolvers`
- **AND** fuehrt keine parallele zweite Foundation fuer dieselben Aufgaben ein

#### Scenario: Referenzimplementierung bestaetigt einen Default-Standard

- **WHEN** definierte Referenzimplementierungen fuer Formulare oder HTTP-nahe Tests umgesetzt werden
- **THEN** validieren sie den verbindlichen Standardpfad fuer das Repository
- **AND** begrenzen die Geltung des Standards nicht auf Pilot- oder Sonderbereiche

#### Scenario: Bestehender stabiler Formularfluss bleibt unveraendert

- **WHEN** ein bestehender Formularfluss keine neue Funktionalitaet und keine grundlegende Ueberarbeitung erhaelt
- **THEN** muss er nicht allein zur Angleichung an die neue Foundation sofort migriert werden
- **AND** bleibt die Migration bis zu einer fachlichen Ueberarbeitung oder gezielten Konsolidierung optional

#### Scenario: Dokumentierter Spezialfall weicht begruendet ab

- **WHEN** ein Flow aus technischen Gruenden nicht sinnvoll ueber denselben Standardpfad abgebildet werden kann
- **THEN** darf er nur mit dokumentierter Architekturbegruendung als Spezialfall abweichen
- **AND** muss die Abweichung im Review als explizite Ausnahme nachvollziehbar sein

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

### Requirement: Vollstaendige Formular-Migrationsinventur als Pflichtartefakt

Das System SHALL fuer diesen Change eine vollstaendige Formular-Migrationsinventur fuer Host und Plugins als Pflichtartefakt dokumentieren.

#### Scenario: Change wird fuer den Rollout vorbereitet

- **WHEN** der Change konkrete Referenzmigrationen, Ausnahmen und Governance festlegt
- **THEN** existiert eine vollstaendige Inventur aller bekannten Host- und Plugin-Formulare
- **AND** dokumentiert sie mindestens Pfad, Zweck, heutiges Muster, Validierung, Submit-Pfad, Primitiven, Teststand, RHF-Bedarf, `msw`-Bedarf, `fast-check`-Eignung, Prioritaet, Risiko, Legacy-Ausnahme und Zielzustand

#### Scenario: Repo-weiter Default und Referenzscope werden getrennt dokumentiert

- **WHEN** der Change Referenzimplementierungen fuer den Rollout benennt
- **THEN** trennt er klar zwischen repo-weitem Default-Standard fuer neue oder grundlegend ueberarbeitete Flows und der kleineren Menge initialer Referenzimplementierungen
- **AND** bleibt nachvollziehbar, welche Bereiche nur unter die Default-Regel fallen und welche Bereiche im Change konkret als Referenz umgesetzt werden

#### Scenario: Inventur ist unvollstaendig

- **WHEN** relevante Host- oder Plugin-Formulare in der Inventur fehlen
- **THEN** gilt das Pflichtartefakt als nicht erfuellt
- **AND** darf der Change nicht als exit-bereit bewertet werden
