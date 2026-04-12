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

#### Scenario: Studio-Deployvertrag wird geändert

- **WHEN** sich der verbindliche Serverdeploypfad für `studio` ändert
- **THEN** aktualisieren die arc42-Abschnitte `07-deployment-view` und `08-cross-cutting-concepts` den Releaseablauf, die Migrationsregeln und die Deploy-Evidenz
- **AND** das zugehörige Runbook beschreibt dieselbe Reihenfolge wie die implementierten Ops-Kommandos

#### Scenario: Rollout-Hardening ergänzt Netzwerk- und Ingress-Vertrag

- **WHEN** ein Change den Live-Rolloutpfad gegen Netzwerk- oder Ingress-Drift härtet
- **THEN** aktualisieren `07-deployment-view` und `08-cross-cutting-concepts` die Trennung zwischen Live-Stack und Temp-Job-Stacks, den verpflichtenden App-Netzvertrag sowie den Recovery-Pfad
- **AND** beschreibt das Runtime-Runbook dieselben Drift-Signale und dieselbe Operator-Reihenfolge wie die implementierten Prechecks und Deploy-Reports

### Requirement: Verankerung der arc42-Struktur in Agent- und Skill-Anweisungen

Das System SHALL die Vorgabe „Architektur-/Systemdoku erfolgt arc42-konform“ in den relevanten Agent- und Skill-Anweisungen verankern, sodass die Doku laufend konsistent und gut strukturiert erweitert wird.

#### Scenario: Agent schlägt Doku-Änderung vor

- **WHEN** ein Agent (oder Skill) eine Änderung mit Architektur-/Systembezug bewertet oder vorschlägt
- **THEN** referenziert er die betroffenen arc42-Abschnitte unter `docs/architecture/`
- **AND** fordert er die Aktualisierung dieser Abschnitte ein (oder dokumentiert bewusst begründete Abweichungen)

### Requirement: Architektur- und Betriebsdoku für Diagnosepfade

Das System SHALL Runtime-Diagnosepfade, Studio-Betriebsregeln und OTEL-Diagnosekonventionen explizit in der Architektur- und Betriebsdokumentation verankern.

#### Scenario: Runtime-Doctor ist dokumentiert

- **WHEN** ein Teammitglied das Betriebsmodell für `local-keycloak`, `local-builder` oder `studio` nachschlägt
- **THEN** dokumentieren die Runbooks `doctor`, `smoke`, `migrate` und die kritischen Diagnose-Overrides konsistent
- **AND** die Doku beschreibt, welche Diagnosefelder öffentlich stabil sind und welche nur OTEL-intern bleiben

#### Scenario: OTEL-Diagnosekonzept ist in arc42 verankert

- **WHEN** ein OpenSpec-Change Runtime-Diagnostik oder Observability erweitert
- **THEN** beschreibt `docs/architecture/08-cross-cutting-concepts.md` die OTEL-Diagnoseattribute, stabilen `reason_code`s und den verbindlichen `env:doctor:<profil>`-Pfad

### Requirement: Architektur dokumentiert tenant-lokale Auth-Flows

Die Architekturdokumentation SHALL tenant-lokale Login-, Callback-, Logout- und Reauth-Flows sowie den Wechsel vom globalen Realm-Modell auf instanzspezifische Realm-Auflösung beschreiben.

#### Scenario: Architekturänderung wird nach Implementierung nachvollzogen

- **WHEN** ein Entwickler oder Operator die Arc42- und ADR-Dokumentation liest
- **THEN** sind Request-Flows, Betriebsannahmen, Cache-Segmentierung und Sicherheitsgrenzen für realm-spezifisches Auth-Routing beschrieben

#### Scenario: Registry- und Provisioning-Modell mit Architekturwirkung

- **WHEN** ein Change die autoritative Quelle fuer Tenant-Freigaben von Runtime-Env auf eine zentrale Registry verlagert oder einen Provisioning-Lebenszyklus einfuehrt
- **THEN** referenziert der Change mindestens die arc42-Abschnitte `04`, `05`, `06`, `07`, `08`, `09`, `10` und `11`
- **AND** verlinkt fuer jeden referenzierten Abschnitt den konkreten Dokumentpfad unter `docs/architecture/` mit kurzer Aenderungszusammenfassung
- **AND** dokumentiert die Zieltopologie "ein Deployment, viele Tenant-Hosts" explizit
- **AND** beschreibt die Steuerung neuer Instanzen ueber eine Control Plane oder einen gleichwertigen Ops-Pfad
- **AND** benennt eine neue oder fortgeschriebene ADR mit konkreter ADR-ID

#### Scenario: Scope-Grenzen mit Architekturwirkung

- **WHEN** ein Change die Grenze zwischen Root-Host-Control-Plane und Tenant-Instanzen veraendert
- **THEN** dokumentiert die Architektur die Trennung `platform` vs. `instance` explizit in Bausteinsicht, Laufzeitsicht, Querschnittskonzepten und Risiken
- **AND** eine ADR beschreibt die Auswirkungen auf Audit, Logging und Error-Handling

### Requirement: Architektur- und Betriebsdoku fuer Registry-basierten Tenant-Lebenszyklus

Das System SHALL den Registry-basierten Tenant-Lebenszyklus und den Provisioning-Vertrag konsistent in Architektur- und Betriebsdokumentation verankern.

#### Scenario: Neue Instanz wird ueber die Dokumentation nachvollziehbar angelegt

- **WHEN** ein Teammitglied den Prozess fuer eine neue Studio-Instanz nachschlaegt
- **THEN** beschreiben Architektur- und Betriebsdoku die Schritte Validierung, Provisioning, Aktivierung, Smoke-Check und Auditierung konsistent
- **AND** benennen die beteiligten technischen Systeme wie Registry, Auth, Integrationen und Deploy-/Ops-Pfade

#### Scenario: Registry ersetzt env-basierte Tenant-Freigabe im Zielbild

- **WHEN** die Dokumentation das produktive Multi-Tenant-Modell beschreibt
- **THEN** wird die zentrale Registry als fuehrende Freigabequelle genannt
- **AND** env-basierte Tenant-Freigaben werden als lokaler oder migrierender Sonderfall eingeordnet
