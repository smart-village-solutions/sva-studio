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

#### Scenario: Plugin-Plattform verändert Entwicklungs-, Deployment- und Runtime-Grenzen

- **WHEN** ein Change lokale Plugin-Entwicklung ohne Core-Anpassung, veröffentlichte Plugin-Distribution oder hostseitige Loader-Runtime einführt
- **THEN** referenziert der Change mindestens Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Architekturentscheidungen, Qualitätsanforderungen und Risiken
- **AND** dokumentiert, ob ADR-034 fortgeschrieben oder durch eine neue ADR ergänzt wird

#### Scenario: Job-Runtime-Vertrag reduziert manuelle Host-Kopplung

- **GIVEN** die Plugin-Plattform nutzt deklarative Runtime-Anforderungen für Job-Entry-Points
- **WHEN** die Architekturdokumentation Risiken und technische Schulden beschreibt
- **THEN** benennt sie die generische host-owned Runtime-Auflösung über Contract-IDs als gültiges Zielbild für `jobs`
- **AND** grenzt verbleibende Folgearbeit für `server`- und `integrations`-Beiträge explizit ab

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

#### Scenario: Plugin-Plattform-v2 wird als Zielarchitektur dokumentiert

- **WHEN** ein Change die Plugin-Plattform von statischer Workspace-Registrierung auf ein Modell mit Manifest, Katalog und Loader erweitert
- **THEN** referenziert er `docs/architecture/package-zielarchitektur.md`
- **AND** benennt die Zielrollen für `@sva/plugin-sdk`, Manifest-, Loader- und Runtime-Bausteine
- **AND** dokumentiert, welche bisherigen Verantwortungen aus App oder SDK in diese Zielbausteine wandern

### Requirement: Hard-Cut-Fortschritt bleibt nachvollziehbar

Die Architektur- und Entwicklungsdokumentation MUST den Fortschritt der harten Package-Transition nachvollziehbar machen, inklusive alter Importpfade, entfernter Re-Exports, noch offener Boundary-Disables und verbleibender Risiken.

#### Scenario: Migrationsphase wird abgeschlossen

- **WHEN** eine Migrationsphase abgeschlossen wird
- **THEN** dokumentiert der PR entfernte alte Importpfade und aktivierte Enforcement-Regeln
- **AND** verbleibende Abweichungen sind mit Ticket, Risiko und geplantem Abbau dokumentiert

#### Scenario: Alter Sammelpfad bleibt voruebergehend bestehen

- **WHEN** ein alter Importpfad aus `@sva/auth`, `@sva/data` oder `@sva/sdk` voruebergehend bestehen bleibt
- **THEN** nennt die Dokumentation den Grund, die betroffenen Consumer und die Entfernungsvoraussetzung
- **AND** der Pfad wird nicht als stabiler oeffentlicher Vertrag beschrieben

#### Scenario: Dokumentation beschreibt finalen SDK-Zuschnitt konsistent

- **WHEN** Architektur- oder Entwicklerdokumentation Plugin- oder Runtime-Boundaries beschreibt
- **THEN** benennt sie `@sva/plugin-sdk` als kanonische Plugin-Boundary
- **AND** benennt sie `@sva/server-runtime` als kanonische Server-Runtime-Boundary
- **AND** beschreibt `@sva/sdk` hoechstens als deprecated Compatibility-Layer

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

### Requirement: Normative Architekturquellen widersprechen dem SDK-Hard-Cut nicht

Das System SHALL normative Architekturquellen so pflegen, dass sie den finalen SDK-Hard-Cut widerspruchsfrei beschreiben. Historische Aussagen duerfen erhalten bleiben, muessen aber sichtbar als ueberholt, fortgeschrieben oder supersediert markiert werden.

#### Scenario: Historische ADR nennt noch SDK als Plugin-Boundary

- **WHEN** eine bestehende ADR oder Architekturanmerkung `@sva/sdk` noch als oeffentliche Plugin-Boundary beschreibt
- **THEN** wird diese Aussage sichtbar fortgeschrieben, supersediert oder historisiert
- **AND** Reviewer koennen erkennen, welcher Boundary-Vertrag heute gilt

#### Scenario: Arc42 und Entwicklerdoku verwenden denselben Vertragsbegriff

- **WHEN** ein Teammitglied `package-zielarchitektur.md`, Bausteinsicht, Querschnittskonzepte, Plugin-Guide oder Monorepo-Guide liest
- **THEN** beschreiben diese Quellen denselben kanonischen Vertragszuschnitt fuer `@sva/plugin-sdk`, `@sva/server-runtime` und `@sva/sdk`
- **AND** widerspruechliche Importempfehlungen sind entfernt

### Requirement: Medienmanagement-Architektur in arc42 dokumentieren

Das System SHALL die Architekturwirkung des Medienmanagements in den betroffenen arc42-Abschnitten nachvollziehbar dokumentieren.

#### Scenario: Externe Medieninfrastruktur ist im Systemkontext beschrieben

- **WHEN** Medienmanagement MinIO als S3-kompatiblen Objektspeicher, CDN- oder geschützte Auslieferungspfade einführt
- **THEN** beschreiben die arc42-Abschnitte für Kontext, Deployment und Querschnitt die externen Systeme, Vertrauensgrenzen und Laufzeitverantwortlichkeiten
- **AND** sie duplizieren keine fachlichen Laufzeitregeln aus den Capability-Spezifikationen

#### Scenario: Medienbausteine sind in der Baustein- und Laufzeitsicht verortet

- **WHEN** die Medien-Capability umgesetzt wird
- **THEN** dokumentiert die arc42-Bausteinsicht die hostseitigen Medienbausteine, Schnittstellen und Abhängigkeiten zu Content, IAM und Audit
- **AND** die Laufzeitsicht beschreibt `/admin/media` als kanonischen Host-Einstieg sowie Upload, Variantenableitung, Verwendungsnachweis und kontrollierte Auslieferung auf Architektur-Ebene

#### Scenario: Host-Integration und Migrationspfad sind architektonisch beschrieben

- **WHEN** die Medien-Capability an das bestehende Plugin-, Admin-Resource- und Modulmodell angeschlossen wird
- **THEN** beschreibt die Architektur die Rolle des hostseitigen Admin-Einstiegs `/admin/media`, optionaler Unterrouten und des Bridge-Pfads für bestehende URL-basierte Plugin-Medienfelder
- **AND** sie grenzt Medienmanagement klar gegen plugin-eigene CRUD-, Storage- oder Routing-Pfade ab

#### Scenario: Querschnittliche Medienregeln referenzieren die fachlichen Specs

- **WHEN** Mandantentrennung, Löschschutz, geschützte Auslieferung oder Audit im Architekturkapitel behandelt werden
- **THEN** verweisen die Dokumentationsabschnitte auf `media-management`, `content-management`, `iam-access-control` und `iam-auditing`
- **AND** die Laufzeitregeln bleiben in diesen fachlichen Spezifikationen führend

#### Scenario: ADR für Package- und Storage-Entscheidungen ist verlinkt

- **WHEN** die Umsetzung startet
- **THEN** dokumentiert ADR-039 Package-Zuschnitt, Storage-/Processing-Vertrag und Bezug zum Plugin-SDK-Vertrag aus ADR-034
- **AND** `docs/architecture/09-architecture-decisions.md` referenziert diese Entscheidung

### Requirement: Entfernte Sammelpackages bleiben in aktiver Doku nicht referenziert

Die aktive Architektur- und Entwicklerdokumentation SHALL entfernte Sammelpackages nicht weiter als aktuelle Build-, Test-, Import- oder Ownership-Ziele fuehren.

#### Scenario: Teammitglied liest aktive Monorepo- und Architekturquellen nach der Entfernung

- **WHEN** ein Teammitglied `docs/monorepo.md`, `package-zielarchitektur.md`, relevante arc42-Abschnitte oder Governance-Dokumente liest
- **THEN** findet es keine aktiven Anweisungen mehr zu `packages/sdk`, `sdk:*` oder `@sva/sdk`
- **AND** die Quellen beschreiben stattdessen `@sva/plugin-sdk`, `@sva/server-runtime`, `@sva/core` und `@sva/monitoring-client/logging` als Zielpfade

### Requirement: Arc42 dokumentiert Waste-Management als Plugin- und Server-Capability

Das System SHALL die Waste-Management-Integration in den betroffenen Arc42-Abschnitten nachvollziehbar dokumentieren.

#### Scenario: Plugin-, Runtime- und Sicherheitsgrenzen werden fortgeschrieben

- **WHEN** der Change `add-waste-management-plugin` umgesetzt wird
- **THEN** dokumentieren die betroffenen Arc42-Abschnitte die Plugin-Boundary, die freie Route `/plugins/waste-management`, die hostgeführte Studio-Fassade und die Datenzugriffsgrenzen gegen Supabase/Postgres
- **AND** die Doku beschreibt, dass `Newcms` nur fachliche Referenz bleibt
- **AND** die Doku beschreibt die Portierungsgrenze zwischen zulässiger UX-Anlehnung und unzulässiger Architekturübernahme explizit

### Requirement: Arc42 dokumentiert Instanzisierung und Hochrisiko-Operationen

Das System SHALL die instanzbezogene Waste-Datenhaltung sowie Seed- und Reset-Schutzmechanismen architektonisch verankern.

#### Scenario: Architektur beschreibt Instanzisolierung und Reset-Risiko

- **WHEN** ein Teammitglied die Arc42-Dokumentation für Waste-Management nachschlägt
- **THEN** sind Instanzscoping, Migrationsrichtung des `waste_*`-Schemas, Auditverhalten und Hochrisiko-Schutz für Reset nachvollziehbar beschrieben
- **AND** die Dokumentation benennt die betroffenen Qualitäts- und Risikoaspekte explizit

### Requirement: Entwicklungsdokumentation beschreibt Studio-Plugin-Nutzung

Die Entwicklungsdokumentation SHALL Regeln, Beispiele und Review-Kriterien für die Nutzung der öffentlichen Plugin-Plattform enthalten.

#### Scenario: Externer Plugin-Entwickler sucht lokalen und publizierten Workflow

- **WHEN** ein Entwickler den Plugin-Guide liest
- **THEN** findet er Regeln für Authoring, lokalen Dev-Load, Manifest, Publish, Install und Aktivierung
- **AND** findet er die erlaubten öffentlichen Imports und Host-Entry-Points
- **AND** findet er die verbotenen Direktimporte in App-, Runtime-, IAM- oder Secret-Interna

### Requirement: Architekturdoku beschreibt scoped role permissions als getrenntes IAM-Pattern
Das System SHALL die neue Rollen-Rechte-Scope-Logik in der Architekturdokumentation als eigenes IAM-Pattern mit klarer Abgrenzung zu `permission.scope` dokumentieren.

#### Scenario: Architektur trennt Assignment-Scope von ABAC-Scope
- **WHEN** die Architektur- oder Entwicklungsdokumentation die IAM-Autorisierung beschreibt
- **THEN** unterscheidet sie explizit zwischen `role_permissions.access_scope` und dem generischen ABAC-Feld `permissions.scope`
- **AND** sie nennt die benoetigten Resource-Attribute fuer `own` und `organization`

### Requirement: Architekturdokumentation beschreibt `@sva/data` nur als kontrollierten Shim-Pfad

Die Architekturdokumentation MUST `@sva/data` als historisches Paket für Migrationen, Seeds, DB-Skripte/-Operationen und dokumentierte Kompatibilitäts-Re-Exports bzw. Delegation beschreiben. Sie MUST `@sva/data-repositories` gleichzeitig als einzige führende Repository-Schicht benennen.

#### Scenario: Zielarchitektur dokumentiert die Datenpaket-Grenze

- **WHEN** Teammitglieder `docs/architecture/package-zielarchitektur.md` oder `docs/architecture/package-gesamtuebersicht.md` lesen
- **THEN** beschreiben diese Quellen `@sva/data` nur als Migrations-, Seed-, DB-Skript/-Operations- und Kompatibilitätspfad
- **AND** benennen `@sva/data-repositories` als führende serverseitige Repository-Schicht

#### Scenario: Architekturänderung mit Datenpaket-Wirkung wird dokumentiert

- **WHEN** ein Change `@sva/data`, `@sva/data/server` oder `@sva/data-repositories` berührt
- **THEN** erklären die betroffenen Architekturquellen, ob `@sva/data` nur delegiert oder Re-Exports bereitstellt
- **AND** sie dokumentieren keine neue fachliche Repository-Ownership in `@sva/data`

### Requirement: Architektur dokumentiert isolierten Waste-Web-Releasepfad

Die Architektur- und Betriebsdokumentation SHALL den Releasepfad der
öffentlichen Waste-Web-App als vom normalen Studio getrennten Deployvertrag
beschreiben.

#### Scenario: Dokumentation beschreibt harte Stack- und Workflow-Trennung

- **WHEN** ein Teammitglied den öffentlichen Waste-Web-Releasepfad nachschlägt
- **THEN** dokumentieren `05-building-block-view`, `07-deployment-view` und `08-cross-cutting-concepts`
  die Trennung von eigenem Image, eigenem Stack, eigenem Variablenraum und eigenem Workflow
- **AND** die Doku grenzt diesen Vertrag explizit vom normalen `studio`-Releasepfad ab

#### Scenario: Betriebsdoku erklärt tag-basierten Release und Smoke-Checks

- **WHEN** ein Operator einen neuen öffentlichen Waste-Web-Release vorbereitet oder nachvollzieht
- **THEN** beschreibt das Runbook Git-Tags `waste-web-vX.Y.Z`, den Portainer-Variablenvertrag,
  den Stack-Rollout und die nachgelagerten Smoke-Checks
- **AND** die Doku benennt Rollback über einen früheren `PUBLIC_WASTE_IMAGE_TAG` als Standardpfad

### Requirement: Architektur dokumentiert GitHub Actions als kanonischen Staging-Pfad

Die Architektur- und Betriebsdokumentation SHALL GitHub Actions `Promote` als kanonischen mutierenden Staging-Pfad und den lokalen Operatorpfad als Diagnose-/Recovery-Werkzeug beschreiben.

#### Scenario: Staging- und Production-Grenzen sind nachvollziehbar

- **WHEN** ein Teammitglied den Studio-Rollout nachschlägt
- **THEN** beschreiben `07-deployment-view` und das Swarm-Runbook die Reihenfolge Preflight, Migration, optional Bootstrap, Postconditions, App-Deploy und Verifikation für Staging
- **AND** beschreibt `08-cross-cutting-concepts` die Environment-Freigabe, Wartungsfenster-Referenz, Geheimnisredaktion und Artefaktbindung
- **AND** dokumentieren sie Production als weiterhin verfügbaren App-only-Pfad mit gesperrten `run`-Modi und klaren Voraussetzungen für einen separaten Folgechange

#### Scenario: Rollout-Evidenz und Recovery sind dokumentiert

- **WHEN** ein Staging-Promote fehlschlägt oder eine Verifikation verletzt
- **THEN** beschreibt die Betriebsdokumentation die redigierten Evidenzartefakte, den vorherigen App-Digest, das Cleanup-Verhalten und den lokalen Recovery-Pfad
- **AND** grenzt sie automatisches Datenbank-Rollback ausdrücklich aus

