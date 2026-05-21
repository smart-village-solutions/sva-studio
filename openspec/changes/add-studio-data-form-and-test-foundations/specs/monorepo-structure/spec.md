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

### Requirement: HTTP-nahe Frontend-Tests nutzen denselben Foundation-Stack

Das System SHALL fuer Frontend-Unit- und Integrations-Tests, die HTTP-Verhalten pruefen, `msw` als verbindliche Default-Mocking-Schicht im gemeinsamen Foundation-Stack bereitstellen.

#### Scenario: Frontend-Test prueft API-Verhalten

- **WHEN** ein neuer oder grundlegend ueberarbeiteter Frontend-Test Request-, Fehler-, Lade- oder Retry-Verhalten gegen HTTP-Endpunkte prueft
- **THEN** beschreibt der Test das Netzwerkverhalten ueber `msw`
- **AND** mockt nicht primaer interne Fetch-Wrapper oder komponentenlokale Implementierungsdetails
- **AND** bleibt derselbe Mocking-Ansatz zwischen Browser- und Node-Testumgebungen wiederverwendbar

#### Scenario: Bestehender Test nutzt noch direkten Fetch-Stub

- **WHEN** ein bestehender HTTP-naher Frontend-Test noch direkte `fetch`- oder Wrapper-Stubs nutzt
- **THEN** wird er spaetestens bei grundlegendem Umbau oder in einem definierten Referenzblock auf `msw` migriert
- **AND** muss nicht allein aus kosmetischen Gruenden sofort umgestellt werden

#### Scenario: Rein lokale Logik bleibt bei Modul-Mocks

- **WHEN** ein Test ausschliesslich lokale Fachlogik ohne HTTP-Verhalten prueft
- **THEN** sind Modul-Mocks oder andere passende Testdoubles weiterhin zulaessig
- **AND** wird `msw` nicht fuer Faelle erzwungen, in denen kein beobachtbarer Netzpfad existiert

#### Scenario: MSW ersetzt keinen echten E2E- oder Infra-Lauf

- **WHEN** die Teststrategie fuer einen Flow bewertet wird
- **THEN** gilt `msw` als Ersatz fuer HTTP-nahe Unit- oder Integrations-Mocks
- **AND** ersetzt nicht die bestehenden Live-E2E- oder Infra-Readiness-Anforderungen
- **AND** bleibt die Abgrenzung zu echten Service-Stacks dokumentiert

### Requirement: Property-based Testing ist Teil der Foundation fuer kritische Kernlogik

Das System SHALL fuer kritische, framework-agnostische Kernlogik gezielt Property-based Tests mit `fast-check` als Teil des gemeinsamen Foundation-Stacks einsetzen.

#### Scenario: Kritischer Guard oder Normalisierer wird geaendert

- **WHEN** Guard-, Parser-, Routing-, Normalisierungs- oder aehnliche Kernlogik in kritischen Hotspots geaendert oder neu eingefuehrt wird
- **THEN** prueft die Teststrategie, ob Invarianten oder Randfallraeume mit `fast-check` abgesichert werden muessen
- **AND** werden beispielbasierte Tests bei hohem Kombinationsraum durch mindestens eine passende Property ergaenzt

#### Scenario: Reiner UI-Baustein ohne hohe Eingabevielfalt

- **WHEN** ein Testgegenstand hauptsaechlich aus praesentationsnaher UI ohne kritische Eingabeinvarianten besteht
- **THEN** ist `fast-check` nicht verpflichtend
- **AND** bleibt der gezielte Einsatz auf risikoreiche Kernlogik fokussiert

### Requirement: Initiale `fast-check`-Hotspot-Liste ist Teil der Foundation-Einfuehrung

Das System SHALL fuer diesen Change eine kleine initiale `fast-check`-Hotspot-Liste im Foundation-Stack selbst dokumentieren.

#### Scenario: Change definiert die erste Hotspot-Startmenge

- **WHEN** der Change die ersten Property-based-Testing-Bereiche festlegt
- **THEN** benennt er mindestens `packages/routing/src/route-search.ts`, `packages/routing/src/admin-resource-search-params.ts`, `packages/core/src/waste-management-location-tour-pickup-date-import.ts` und `packages/core/src/input-readers.ts`
- **AND** dokumentiert fuer diese Startmenge die erwarteten Invarianten oder den fachlichen Grund fuer eine eng begruendete Verschiebung

#### Scenario: Hotspot-Liste bleibt nur abstrakt

- **WHEN** der Change nur allgemeine Kategorien wie Parser, Guards oder Routing-Invarianten nennt
- **THEN** gilt die initiale Hotspot-Liste als nicht hinreichend dokumentiert
- **AND** ist der Change fuer Review und Exit nicht ausreichend geschaerft

### Requirement: Vollstaendige Formular-Migrationsinventur als Pflichtartefakt

Das System SHALL fuer diesen Change eine vollstaendige Formular-Migrationsinventur fuer Host und Plugins als Pflichtartefakt dokumentieren.

#### Scenario: Change wird fuer den Rollout vorbereitet

- **WHEN** der Change konkrete Referenzmigrationen, Ausnahmen und Governance festlegt
- **THEN** existiert eine vollstaendige Inventur aller bekannten Host- und Plugin-Formulare
- **AND** wird sie unter `docs/development/studio-form-migrationsinventur.md` gefuehrt
- **AND** dokumentiert sie mindestens Pfad, Zweck, heutiges Muster, Validierung, Submit-Pfad, Primitiven, Teststand, RHF-Bedarf, `msw`-Bedarf, `fast-check`-Eignung, Prioritaet, Risiko, Legacy-Ausnahme und Zielzustand

#### Scenario: Repo-weiter Default und Referenzscope werden getrennt dokumentiert

- **WHEN** der Change Referenzimplementierungen fuer den Rollout benennt
- **THEN** trennt er klar zwischen repo-weitem Default-Standard fuer neue oder grundlegend ueberarbeitete Flows und der kleineren Menge initialer Referenzimplementierungen
- **AND** bleibt nachvollziehbar, welche Bereiche nur unter die Default-Regel fallen und welche Bereiche im Change konkret als Referenz umgesetzt werden

#### Scenario: Governance-Artefakte werden abgelegt

- **WHEN** Review-Kriterien, Ausnahmeregeln und Exit-Nachweise fuer diesen Change dokumentiert werden
- **THEN** werden sie unter `docs/development/studio-foundations-governance.md` gebuendelt
- **AND** folgen Inventur- und Governance-Artefakte damit den Repo-Doku-Regeln fuer Entwicklungsdokumentation

#### Scenario: Inventur ist unvollstaendig

- **WHEN** relevante Host- oder Plugin-Formulare in der Inventur fehlen
- **THEN** gilt das Pflichtartefakt als nicht erfuellt
- **AND** darf der Change nicht als exit-bereit bewertet werden
