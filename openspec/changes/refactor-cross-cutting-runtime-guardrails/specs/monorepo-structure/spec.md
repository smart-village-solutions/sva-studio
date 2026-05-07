## ADDED Requirements

### Requirement: Plugin-Preflight validiert SDK-Kompatibilitaet und Translation-Ownership

Das Monorepo SHALL den Build-time-Plugin-Preflight um SDK-Kompatibilitaetspruefung, Translation-Ownership und Aktivierungsstatus erweitern, bevor der Registry-Snapshot publiziert wird.

#### Scenario: Plugin deklariert kompatible SDK-Range

- **GIVEN** ein Plugin deklariert seine unterstuetzte SDK-SemVer-Range
- **WHEN** der Host den Snapshot erzeugt
- **THEN** wird das Plugin nur akzeptiert, wenn die installierte `@sva/plugin-sdk`-Version in dieser Range liegt
- **AND** inkompatible Plugins werden mit einem deterministischen Kompatibilitaetsfehler abgewiesen

#### Scenario: Zwei aktive Plugins kollidieren auf demselben Translation-Pfad

- **GIVEN** zwei aktive Plugins belegen denselben kanonischen Translation-Key oder Key-Pfad
- **WHEN** der Preflight die Plugin-i18n-Baeume validiert
- **THEN** behandelt der Host dies als Kollision statt als stilles Last-Wins-Merge
- **AND** der Fehler benennt Key und owning Plugins

#### Scenario: Build-linked Plugin ist deaktiviert

- **GIVEN** ein Plugin ist im Workspace gebaut, aber fuer eine Instanz oder Umgebung deaktiviert
- **WHEN** der Host den aktiven Snapshot fuer diese Aktivierungsmenge erstellt
- **THEN** bleiben seine Routen, Navigationseintraege, Translationen und Admin-Beitraege inaktiv
- **AND** der Host kann denselben Build mit unterschiedlicher Plugin-Aktivierung betreiben

### Requirement: Architektur-Gates sind verbindlicher Teil des Qualitaetslaufs

Das Monorepo MUST cross-cutting Architekturregeln ueber verbindliche lokale und CI-Gates erzwingen statt nur ueber Konventionen oder Einzeltests.

#### Scenario: Dependency-Graph driftet von den Zielgrenzen weg

- **WHEN** ein Projektgraph- oder Dependency-Snapshot eine unerlaubte neue Importkante zeigt
- **THEN** schlaegt der Architektur-Gate fehl
- **AND** der Befund benennt Quelle, Ziel und verletzte Boundary-Regel

#### Scenario: Sichtbare UI-Texte oder fehlende i18n-Keys werden eingefuehrt

- **WHEN** der i18n-Qualitaetslauf fehlende, ungenutzte oder nicht extrahierte sichtbare Texte erkennt
- **THEN** blockiert der Gate den Build oder PR-Check
- **AND** die Verletzung ist nicht nur ein Review-Hinweis

#### Scenario: Server-only Modul leakt in universalen oder Client-Code

- **WHEN** ein universal, clientseitig oder eager geladenes Modul direkt oder transitiv `.server.ts`, `@sva/*/server` oder gleichwertige server-only Pfade importiert
- **THEN** schlaegt der statische Gate fehl
- **AND** dies gilt auch fuer `interfaces-api`-aehnliche Reflexions- oder `typeof import(...)`-Pfade
