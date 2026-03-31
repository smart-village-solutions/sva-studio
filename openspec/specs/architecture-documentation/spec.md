# architecture-documentation Specification

## Purpose
TBD - created by archiving change add-arc42-architecture-documentation. Update Purpose after archive.
## Requirements
### Requirement: Einheitliche Architekturstruktur nach arc42

Das System SHALL Architekturdokumentation in einer konsistenten, arc42-konformen Struktur führen.

#### Scenario: Architektur-Einstiegspunkt vorhanden

- **WHEN** ein Teammitglied die Architektur dokumentieren oder lesen möchte
- **THEN** existiert ein klarer Einstiegspunkt unter `docs/architecture/`
- **AND** die Inhalte sind nach arc42-Abschnitten gegliedert

### Requirement: Nachvollziehbare Architekturentscheidungen

Das System SHALL Architekturentscheidungen mit Kontext, Begründung und Auswirkungen dokumentieren.

#### Scenario: Änderung mit Architekturwirkung

- **WHEN** ein OpenSpec-Change mit Architekturwirkung erstellt wird
- **THEN** referenziert der Change die betroffenen arc42-Abschnitte
- **AND** die Entscheidung ist für Reviewer nachvollziehbar dokumentiert
- **AND** Betriebsannahmen zu Deployment-Topologie, Ingress und Konfigurationsmanagement werden explizit benannt

#### Scenario: Deployment- und Auth-Grenzen mit Architekturwirkung

- **WHEN** ein Change Deployment-Topologie, Host-Ableitung oder Auth-Grenzen verändert
- **THEN** referenziert der Change mindestens Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Architekturentscheidungen, Qualitätsanforderungen und Risiken
- **AND** dokumentiert, ob eine neue ADR erforderlich ist oder welche bestehende ADR fortgeschrieben wird

### Requirement: Verbindliche Pflege im Entwicklungsworkflow

Das System SHALL die Pflege der Architektur-Dokumentation als Teil des Delivery-Workflows verankern.

#### Scenario: PR mit Architekturänderung

- **WHEN** ein PR Architektur oder Systemgrenzen verändert
- **THEN** enthält der PR eine Aktualisierung der relevanten arc42-Abschnitte
- **AND** die Review-Checkliste prüft diese Aktualisierung

#### Scenario: Acceptance-Deployvertrag wird geändert

- **WHEN** sich der verbindliche Serverdeploypfad für `acceptance-hb` ändert
- **THEN** aktualisieren die arc42-Abschnitte `07-deployment-view` und `08-cross-cutting-concepts` den Releaseablauf, die Migrationsregeln und die Deploy-Evidenz
- **AND** das zugehörige Runbook beschreibt dieselbe Reihenfolge wie die implementierten Ops-Kommandos

### Requirement: Verankerung der arc42-Struktur in Agent- und Skill-Anweisungen

Das System SHALL die Vorgabe „Architektur-/Systemdoku erfolgt arc42-konform“ in den relevanten Agent- und Skill-Anweisungen verankern, sodass die Doku laufend konsistent und gut strukturiert erweitert wird.

#### Scenario: Agent schlägt Doku-Änderung vor

- **WHEN** ein Agent (oder Skill) eine Änderung mit Architektur-/Systembezug bewertet oder vorschlägt
- **THEN** referenziert er die betroffenen arc42-Abschnitte unter `docs/architecture/`
- **AND** fordert er die Aktualisierung dieser Abschnitte ein (oder dokumentiert bewusst begründete Abweichungen)

### Requirement: Architektur- und Betriebsdoku für Diagnosepfade

Das System SHALL Runtime-Diagnosepfade, Acceptance-Betriebsregeln und OTEL-Diagnosekonventionen explizit in der Architektur- und Betriebsdokumentation verankern.

#### Scenario: Runtime-Doctor ist dokumentiert

- **WHEN** ein Teammitglied das Betriebsmodell für `local-keycloak`, `local-builder` oder `acceptance-hb` nachschlägt
- **THEN** dokumentieren die Runbooks `doctor`, `smoke`, `migrate` und die kritischen Diagnose-Overrides konsistent
- **AND** die Doku beschreibt, welche Diagnosefelder öffentlich stabil sind und welche nur OTEL-intern bleiben

#### Scenario: OTEL-Diagnosekonzept ist in arc42 verankert

- **WHEN** ein OpenSpec-Change Runtime-Diagnostik oder Observability erweitert
- **THEN** beschreibt `docs/architecture/08-cross-cutting-concepts.md` die OTEL-Diagnoseattribute, stabilen `reason_code`s und den verbindlichen `env:doctor:<profil>`-Pfad

