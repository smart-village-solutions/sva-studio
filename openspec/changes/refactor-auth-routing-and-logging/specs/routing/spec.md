## MODIFIED Requirements

### Requirement: Code-Route-Registry
Das System SHALL eine einzige, programmatische Route-Registry bereitstellen, die als Single Source of Truth für alle Auth-Route-Pfade und Handler-Zuordnungen dient. Parallele oder redundante Route-Registrierungen DÜRFEN NICHT existieren.

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

#### Scenario: Keine redundanten Route-Registrierungen
- **WHEN** die Codebasis nach Route-Registrierungen durchsucht wird
- **THEN** existiert genau eine Route-Registry (`@sva/routing`)
- **AND** es gibt keine parallelen Pfad-Arrays oder Handler-Maps in anderen Packages

## ADDED Requirements

### Requirement: Handler Error Observability
Auth-Route-Handler SHALL bei unbehandelten Fehlern strukturierte Logs mit Correlation-IDs erzeugen, um Server-seitige Fehlerpfade im Monitoring sichtbar zu machen.

#### Scenario: Error-Boundary loggt mit Kontext
- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** erzeugt die Error-Boundary einen `error`-Log-Eintrag über den SDK Logger
- **AND** der Eintrag enthält `requestId`, `traceId`, `route`, `method`, `error.message`
- **AND** es wird kein `console.error` verwendet

#### Scenario: JSON-Response bei Handler-Fehler
- **WHEN** ein Auth-Route-Handler einen unbehandelten Fehler wirft
- **THEN** antwortet der Server mit HTTP 500 und einem JSON-Body `{ error: "Internal Server Error" }`
- **AND** keine Stack-Traces oder interne Details werden an den Client übermittelt
