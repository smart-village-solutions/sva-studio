## ADDED Requirements

### Requirement: Plugin-Preflight validiert SDK-Kompatibilität und Translation-Ownership

Das Monorepo SHALL den Build-time-Plugin-Preflight um SDK-Kompatibilitätsprüfung, Translation-Ownership und Aktivierungsstatus erweitern, bevor der Registry-Snapshot publiziert wird.

#### Scenario: Plugin deklariert kompatible SDK-Range

- **GIVEN** ein Plugin deklariert seine unterstützte SDK-SemVer-Range
- **WHEN** der Host den Snapshot erzeugt
- **THEN** wird das Plugin nur akzeptiert, wenn die installierte `@sva/plugin-sdk`-Version in dieser Range liegt
- **AND** inkompatible Plugins werden mit einem deterministischen Kompatibilitätsfehler abgewiesen

#### Scenario: Zwei aktive Plugins kollidieren auf demselben Translation-Pfad

- **GIVEN** zwei aktive Plugins belegen denselben kanonischen Translation-Key oder Key-Pfad
- **WHEN** der Preflight die Plugin-i18n-Bäume validiert
- **THEN** behandelt der Host dies als Kollision statt als stilles Last-Wins-Merge
- **AND** der Fehler benennt Key und owning Plugins

#### Scenario: Build-linked Plugin ist deaktiviert

- **GIVEN** ein Plugin ist im Workspace gebaut, aber für eine Instanz oder Umgebung deaktiviert
- **WHEN** der Host den aktiven Snapshot für diese Aktivierungsmenge erstellt
- **THEN** bleiben seine Routen, Navigationseinträge, Translationen und Admin-Beiträge inaktiv
- **AND** der Host kann denselben Build mit unterschiedlicher Plugin-Aktivierung betreiben

### Requirement: Architektur-Gates sind verbindlicher Teil des Qualitätslaufs

Das Monorepo MUST cross-cutting Architekturregeln über verbindliche lokale und CI-Gates erzwingen statt nur über Konventionen oder Einzeltests.

#### Scenario: Dependency-Graph driftet von den Zielgrenzen weg

- **WHEN** ein Projektgraph- oder Dependency-Snapshot eine unerlaubte neue Importkante zeigt
- **THEN** schlägt der Architektur-Gate fehl
- **AND** der Befund benennt Quelle, Ziel und verletzte Boundary-Regel

#### Scenario: Sichtbare UI-Texte oder fehlende i18n-Keys werden eingeführt

- **WHEN** der i18n-Qualitätslauf fehlende, ungenutzte oder nicht extrahierte sichtbare Texte erkennt
- **THEN** blockiert der Gate den Build oder PR-Check
- **AND** die Verletzung ist nicht nur ein Review-Hinweis

#### Scenario: Server-only Modul leakt in universalen oder Client-Code

- **WHEN** ein universal, clientseitig oder eager geladenes Modul direkt oder transitiv `.server.ts`, `@sva/*/server` oder gleichwertige server-only Pfade importiert
- **THEN** schlägt der statische Gate fehl
- **AND** dies gilt auch für `interfaces-api`-ähnliche Reflexions- oder `typeof import(...)`-Pfade
