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

### Requirement: Analysechanges mit Diagnosewirkung liefern versionierte Befundartefakte

Die Architektur- und Betriebsdokumentation SHALL bei Analysechanges mit IAM-, Auth-, Session-, Registry- oder Provisioning-Diagnosewirkung einen versionierten Bericht, einen expliziten Live-Triage-Status und eine nachvollziehbare Folgechange-Übergabe enthalten.

#### Scenario: Repo-Analyse wird als Bericht konserviert

- **WHEN** ein Analysechange die Diagnosefähigkeit eines kritischen Laufzeitpfads bewertet
- **THEN** wird der Befund als versionierter Bericht unter `docs/reports/` abgelegt
- **AND** der Bericht dokumentiert mindestens Fehlerklassen, heutige Signale, Recovery-Pfade, erkannte Lücken und empfohlene Folgearbeit

#### Scenario: Live-Triage darf nicht stillschweigend entfallen

- **WHEN** ein Analysechange einen verpflichtenden Live-Triage-Block gegen eine reale Umgebung vorsieht
- **THEN** dokumentiert die Architektur- oder Betriebsdoku explizit, ob dieser Block durchgeführt wurde, offen ist oder an fehlender Umgebung/Testdaten scheitert
- **AND** ein offener Live-Triage-Block wird nicht als erledigt oder implizit grün kommuniziert

#### Scenario: Folgechange-Übergabe bleibt entscheidungsfähig

- **WHEN** ein Analysechange mit priorisierter Folgearbeit endet
- **THEN** dokumentiert der Bericht mindestens mehrere Zuschnittsoptionen, eine Empfehlung und einen vorbereiteten Folgechange
- **AND** können Reviewer nachvollziehen, welche Folgearbeit auf welcher Analysebasis aufsetzt

### Requirement: Architektur dokumentiert finalen Runtime-Vertrag

Die Architektur- und Betriebsdokumentation SHALL den finalen Runtime-Vertrag fuer `studio` explizit gegenueber Intermediate-SSR-Artefakten und Legacy-Recovery-Pfaden abgrenzen.

#### Scenario: Arc42 beschreibt finale Runtime als Release-Wahrheit

- **WHEN** die Dokumentation den `studio`-Releasepfad beschreibt
- **THEN** benennen `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts` und `11-risks-and-technical-debt` das finale `.output/server/**`-Artefakt als verbindliche technische Wahrheit
- **AND** ordnen sie `.nitro/vite/services/ssr/**` als Diagnosematerial ein
- **AND** beschreiben sie den Entrypoint-Patch als Legacy-Recovery-Pfad mit explizitem Flag statt als Standardbetrieb

### Requirement: Package-Zielarchitektur als verbindlicher Architekturvertrag

Die Architekturdokumentation MUST die Package-Zielarchitektur als verbindlichen Architekturvertrag führen. OpenSpec-Changes mit Package-, IAM-, Daten-, Plugin-, Routing- oder Runtime-Wirkung MUST erklären, welche Zielpackages betroffen sind und ob der Change mit den Zielgrenzen vereinbar ist.

#### Scenario: Architekturwirksamer Change wird erstellt

- **WHEN** ein Change Package-Grenzen, Importkanten, IAM, Datenzugriff, Plugins, Routing oder Server-Runtime betrifft
- **THEN** referenziert er `docs/architecture/package-zielarchitektur.md`
- **AND** benennt die betroffenen Zielpackages
- **AND** dokumentiert Abweichungen als explizite technische Schuld mit Abbaupfad

#### Scenario: Zielpackage wird implementiert

- **WHEN** ein Zielpackage neu angelegt oder aus einem Sammelpackage herausgelöst wird
- **THEN** werden die betroffenen arc42-Abschnitte aktualisiert
- **AND** `package-zielarchitektur.md` bleibt konsistent mit Package-Exports, Nx-Tags und `depConstraints`

### Requirement: Hard-Cut-Fortschritt bleibt nachvollziehbar

Die Architektur- und Entwicklungsdokumentation MUST den Fortschritt der harten Package-Transition nachvollziehbar machen, inklusive alter Importpfade, entfernter Re-Exports, noch offener Boundary-Disables und verbleibender Risiken.

#### Scenario: Migrationsphase wird abgeschlossen

- **WHEN** eine Migrationsphase abgeschlossen wird
- **THEN** dokumentiert der PR entfernte alte Importpfade und aktivierte Enforcement-Regeln
- **AND** verbleibende Abweichungen sind mit Ticket, Risiko und geplantem Abbau dokumentiert

#### Scenario: Alter Sammelpfad bleibt vorübergehend bestehen

- **WHEN** ein alter Importpfad aus `@sva/auth`, `@sva/data` oder `@sva/sdk` vorübergehend bestehen bleibt
- **THEN** nennt die Dokumentation den Grund, die betroffenen Consumer und die Entfernungsvoraussetzung
- **AND** der Pfad wird nicht als stabiler öffentlicher Vertrag beschrieben

### Requirement: Architektur- und Entwicklerdokumentation entfernt veraltete Beispiel-Plugin-Referenzen

Die Architektur- und Entwicklerdokumentation SHALL das entfernte Beispiel-Plugin nicht weiter als aktiven Bestandteil des Studios fuehren.

#### Scenario: Dokumentation nach Paketentfernung bereinigt

- **WHEN** `plugin-example` aus Workspace und Host entfernt wurde
- **THEN** beschreiben Architektur- und Entwicklerdokumente das Beispiel-Plugin nicht mehr als aktives Paket oder aktiven Host-Bestandteil
- **AND** verbleibende Hinweise auf historische oder optionale Beispiele sind klar als nicht-produktiv markiert

### Requirement: arc42 documentation reflects implemented architecture

Die arc42-Dokumentation SHALL Studio als alternative Keycloak-Admin-UI, Keycloak-first Mutationen und die Scope-Trennung zwischen Platform und Tenant beschreiben.

#### Scenario: Architecture docs cover Keycloak-first IAM
- **WHEN** der Change umgesetzt wird
- **THEN** dokumentieren die betroffenen arc42-Abschnitte System-of-Record, Read-Models, Sync-/Reconcile-Flows, Bearbeitbarkeitsmatrix und Audit-Verhalten
- **AND** die Doku nennt die Grenzen gegenüber vollständiger Keycloak-Realm-/Client-Administration

### Requirement: Architektur dokumentiert Studio-UI-React-Boundary
Die Architekturdokumentation SHALL `@sva/studio-ui-react` als öffentliches React/UI-Zielpackage für Host und Plugin-Custom-Views dokumentieren.

#### Scenario: Package-Zielarchitektur enthält Studio UI
- **WHEN** ein Teammitglied `docs/architecture/package-zielarchitektur.md` liest
- **THEN** ist `@sva/studio-ui-react` als UI-only Zielpackage beschrieben
- **AND** die erlaubten Importkanten zu App und Plugins sind benannt
- **AND** die Abgrenzung zu `@sva/plugin-sdk`, `@sva/core` und App-internen Komponenten ist erklärt

#### Scenario: arc42 beschreibt Plugin-Custom-Views
- **WHEN** ein Teammitglied die arc42-Abschnitte zu Bausteinen und Querschnittskonzepten liest
- **THEN** ist nachvollziehbar, dass Plugin-Custom-Views gemeinsame Studio-UI über `@sva/studio-ui-react` nutzen
- **AND** host-rendered Admin-Ressourcen weiterhin der Standardfall bleiben

### Requirement: Entwicklungsdokumentation beschreibt Studio-UI-Nutzung
Die Entwicklungsdokumentation SHALL Regeln, Beispiele und Review-Kriterien für die Nutzung von `@sva/studio-ui-react` in Host und Plugins enthalten.

#### Scenario: Plugin-Entwickler sucht UI-Regeln
- **WHEN** ein Plugin-Entwickler den Plugin-Entwicklungsleitfaden liest
- **THEN** findet er erlaubte Imports aus `@sva/plugin-sdk` und `@sva/studio-ui-react`
- **AND** findet er Beispiele fuer Overview-, Detail-, Formular-, Action- und State-Kompositionen
- **AND** findet er die verbotenen App-Importe und Basis-Control-Duplikate

#### Scenario: Reviewer prüft UI-Konsistenz
- **WHEN** ein PR eine neue Host- oder Plugin-View enthält
- **THEN** kann der Reviewer anhand der Dokumentation prüfen, ob Studio-Templates, Controls, States, i18n und Accessibility-Konventionen eingehalten sind

