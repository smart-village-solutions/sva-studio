## MODIFIED Requirements

### Requirement: Code-Route-Registry
Das System SHALL eine programmatische Route-Registry bereitstellen, die Routen aus Core und Plugins kombiniert.

#### Scenario: Core und Plugin Routen kombiniert
- **WHEN** die App startet
- **THEN** sind Core- und Plugin-Routen gemeinsam im Router registriert

#### Scenario: Auth-Route-Handler exhaustiv aufgelöst
- **WHEN** ein Auth-Route-Pfad zur Laufzeit aufgelöst wird
- **THEN** wird der zugehörige Handler aus einem typsicheren `Record<AuthRoutePath, Handler>`-Mapping geladen
- **AND** bei einem unbekannten Pfad wird ein expliziter Fehler geworfen statt eines stillschweigenden Fallbacks

#### Scenario: Fehlender Handler wird zur Compile-Time erkannt
- **WHEN** ein neuer Auth-Route-Pfad zum Union-Type hinzugefügt wird
- **AND** kein Handler-Eintrag im Mapping existiert
- **THEN** meldet der TypeScript-Compiler einen Fehler

## ADDED Requirements

### Requirement: Root-Level Error Boundary
Die App SHALL auf Root-Route-Ebene ein `errorComponent` bereitstellen, das unbehandelte Runtime-Fehler abfängt und eine benutzerfreundliche Fehlerseite rendert.

#### Scenario: Unbehandelter Runtime-Fehler in einer Route
- **WHEN** eine Route einen unbehandelten Fehler wirft
- **THEN** wird die Error-Fallback-Komponente gerendert
- **AND** der Benutzer sieht eine verständliche Fehlermeldung mit Retry-Option

#### Scenario: Fehlerseite ist barrierefrei
- **WHEN** die Error-Fallback-Komponente angezeigt wird
- **THEN** ist sie per Keyboard navigierbar
- **AND** Screen Reader erhalten `role="alert"` und `aria-live="assertive"`

### Requirement: Stabile Dependency-Versionen
Die App SHALL ausschließlich stabile Release-Versionen für Laufzeit-Dependencies verwenden und Framework-Versionen workspace-weit synchronisieren.

#### Scenario: Keine Nightly-Dependencies in Produktion
- **WHEN** die Dependency-Liste der App geprüft wird
- **THEN** enthält sie keine `nightly`-, `canary`- oder `latest`-Tags für Laufzeit-Dependencies

#### Scenario: TanStack-Router-Version synchronisiert
- **WHEN** `@tanstack/react-router` in mehreren Packages verwendet wird
- **THEN** ist die aufgelöste Version im gesamten Workspace identisch
