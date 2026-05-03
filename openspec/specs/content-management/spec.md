# content-management Specification

## Purpose
Definiert die fachliche Inhaltsverwaltung für SVA Studio mit tabellarischer Admin-Ansicht, erweiterbarem Core-Modell, kontrolliertem Statusmodell, JSON-Payload-Validierung und nachvollziehbarer Historie.
## Requirements
### Requirement: Inhaltsübersicht als tabellarische Admin-Ansicht

Das System MUST eine Seite `Inhalte` bereitstellen, die vorhandene Inhalte in einer tabellarischen Admin-Ansicht darstellt.

#### Scenario: Inhaltsliste wird geladen

- **WENN** ein berechtigter Benutzer die Seite `Inhalte` öffnet
- **DANN** zeigt das System eine semantische Tabelle mit den Spalten Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Payload, Status und Historie
- **UND** jede Tabellenzeile repräsentiert genau einen Inhalt
- **UND** der Inhaltstyp ist pro Zeile erkennbar
- **UND** das System zeigt einen Ladezustand, bis die Inhaltsdaten verfügbar sind

### Requirement: Inhalt ist ein erweiterbares Core-Element

Das System MUST `Inhalt` als kanonisches Core-Element modellieren, das über definierte SDK-Erweiterungspunkte für spezielle Datentypen erweitert werden kann und referenzbasierte Mediennutzung unterstützt.

#### Scenario: Core-Inhalt wird mit Basiskern angelegt

- **WENN** ein Inhalt gespeichert oder geladen wird
- **DANN** enthält er mindestens `contentType`, Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Payload, Status und Historie
- **UND** diese Core-Felder bleiben unabhängig vom konkreten Inhaltstyp verfügbar

#### Scenario: SDK erweitert einen speziellen Inhaltstyp

- **WENN** für einen registrierten `contentType` eine SDK-Erweiterung vorhanden ist
- **DANN** kann diese zusätzliche Validierung, UI-Bereiche, Tabelleninformationen oder Aktionen bereitstellen
- **UND** der Core-Vertrag des Inhalts bleibt unverändert gültig

#### Scenario: Plugin überschreibt den Core-Vertrag nicht

- **WENN** ein Plugin oder SDK-Modul einen speziellen Inhaltstyp registriert
- **DANN** darf es die Bedeutung oder Pflichtigkeit der Core-Felder nicht brechen
- **UND** Statusmodell, Historie und Core-Metadaten bleiben systemweit konsistent

#### Scenario: Inhalte binden Medien referenzbasiert an

- **WENN** ein Inhalt ein Bild, Download oder anderes Medium benötigt
- **DANN** referenziert der Inhalt Medien über die zentrale Medien-Capability und fachliche Rollen
- **UND** der Inhalt speichert keine rohen Storage-Keys oder auslieferungsrelevanten Dateipfade als führenden Vertrag

#### Scenario: Plugin nutzt hostseitigen Media-Picker

- **WENN** ein Plugin ein Medium für einen Inhalt oder ein Fachobjekt auswählen lässt
- **DANN** verwendet es den hostseitigen Media-Picker oder dessen SDK-Vertrag
- **UND** das Plugin deklariert erlaubte Medienrollen, Medientypen und optionale Preset-Anforderungen
- **UND** es erhält keine direkte Storage-Schnittstelle und speichert keine MinIO-Bucket-Namen, Object-Keys oder presigned URLs als führenden Vertrag

#### Scenario: Bestehender URL-basierter Inhaltspfad wird migriert

- **WENN** ein bestehender Inhaltstyp Medien noch über URL-basierte Felder wie `imageUrl`, `sourceUrl` oder eingebettete Medien-URLs speichert
- **DANN** definiert das System einen kontrollierten Übergangspfad zur referenzbasierten Mediennutzung
- **UND** neue Host-Integrationen bevorzugen den Media-Picker und Medienreferenzen
- **UND** Legacy-URL-Felder bleiben nur übergangsweise zulässig

### Requirement: Lokaler Migrationspfad für das Inhaltsmodell ist verifiziert

Das System MUST Schemaänderungen für die Inhaltsverwaltung so ausliefern, dass die zugehörigen Datenbankmigrationen lokal reproduzierbar ausgeführt und verifiziert werden können.

#### Scenario: Inhaltsmigration läuft lokal erfolgreich

- **WENN** ein Entwickler die lokale Entwicklungsdatenbank für die Inhaltsverwaltung aufsetzt oder aktualisiert
- **DANN** lassen sich die erforderlichen Inhaltsmigrationen lokal ausführen
- **UND** das resultierende Schema unterstützt die Inhaltsliste, Detailansicht, Bearbeitung und Historie wie spezifiziert

#### Scenario: Up- und Down-Migrationen sind als Paar vorhanden

- **WENN** das Inhaltsmodell eine neue Schemaänderung benötigt
- **DANN** existiert eine versionierte Up-Migration und eine korrespondierende Down-Migration
- **UND** der lokale Migrationspfad ist dokumentiert und im Entwicklungsworkflow verifizierbar

#### Scenario: Inhaltsliste ist leer

- **WENN** noch keine Inhalte vorhanden sind
- **DANN** zeigt die Seite einen verständlichen Empty-State
- **UND** der Einstieg `Neuer Inhalt` bleibt sichtbar

### Requirement: Einstieg zum Anlegen neuer Inhalte

Das System MUST in der Tabellenansicht einen klaren Einstieg zum Anlegen neuer Inhalte bereitstellen.

#### Scenario: Neuer Inhalt wird gestartet

- **WENN** ein berechtigter Benutzer die Tabellenansicht öffnet
- **DANN** ist ein sichtbarer Button `Neuer Inhalt` vorhanden
- **UND** der Button führt in die Erstellungsansicht für einen neuen Inhalt

### Requirement: Design-System- und Tabellenkonsistenz im Admin-Bereich

Das System MUST die Inhaltsverwaltung mit den bestehenden `shadcn/ui`-Patterns und konsistent zu vorhandenen Admin-Tabellen umsetzen.

#### Scenario: Inhaltsliste folgt bestehendem Tabellenmuster

- **WENN** die Seite `Inhalte` gerendert wird
- **DANN** verwendet die Tabelle dieselben grundlegenden UI-Patterns wie bestehende Admin-Tabellen, insbesondere aus der Account-Verwaltung
- **UND** Tabellenkopf, Zellstruktur, Statusdarstellung, Abstände und Aktionsflächen folgen einem konsistenten Admin-Muster
- **UND** es wird keine parallele, inkompatible Tabellen-Basisimplementierung eingeführt

#### Scenario: Formularansicht nutzt bestehende UI-Bausteine

- **WENN** die Erstellungs- oder Bearbeitungsansicht eines Inhalts angezeigt wird
- **DANN** basieren Formularfelder, Buttons, Statusanzeigen, Dialoge und Fehlermeldungen auf den bestehenden `shadcn/ui`-Patterns der Anwendung
- **UND** die Inhaltsverwaltung wirkt visuell und interaktional als Teil derselben Admin-Oberfläche

#### Scenario: Mainserver-Plugin-Listen harmonisieren sich auf StudioDataTable

- **WENN** die Listenansichten der produktiven Mainserver-Plugins `news`, `events` oder `poi` gerendert werden
- **DANN** verwenden sie `StudioDataTable` als gemeinsame Tabellenbasis
- **UND** sie führen keine pluginlokalen parallelen Tabellen-Implementierungen für dieselbe Listenfunktionalität fort
- **UND** Aktionsspalten, Loading-State, Empty-State und semantische Tabellenstruktur folgen demselben Host-Muster

### Requirement: Erstellungs- und Bearbeitungsansicht für Inhalte

Das System MUST eine Erstellungs- und eine Bearbeitungsansicht für Inhalte bereitstellen.

#### Scenario: Inhalt anlegen

- **WENN** ein berechtigter Benutzer einen neuen Inhalt anlegt
- **DANN** kann er mindestens Inhaltstyp, Titel, Veröffentlichungsdatum, Payload und Status erfassen
- **UND** das System setzt Erstellungsdatum, Änderungsdatum und Autor systemseitig
- **UND** der gespeicherte Inhalt ist nach erfolgreichem Speichern in der Inhaltsliste sichtbar

#### Scenario: Inhalt bearbeiten

- **WENN** ein berechtigter Benutzer einen bestehenden Inhalt bearbeitet
- **DANN** kann er Titel, Veröffentlichungsdatum, Payload und Status gemäß seiner Berechtigungen ändern
- **UND** das Änderungsdatum wird nach erfolgreichem Speichern aktualisiert
- **UND** die Bearbeitungsansicht zeigt die aktuellen Metadaten des Inhalts an

#### Scenario: Typspezifische Erweiterungsfelder werden eingeblendet

- **WENN** ein Inhalt einen registrierten `contentType` mit SDK-Erweiterung besitzt
- **DANN** rendert die Erstellungs- oder Bearbeitungsansicht zusätzlich die zugehörigen typspezifischen UI-Bereiche
- **UND** die Core-Felder bleiben weiterhin sichtbar und konsistent bedienbar

### Requirement: Kontrolliertes Statusmodell für Inhalte

Das System MUST für Inhalte ein kontrolliertes Statusmodell verwenden.

#### Scenario: Gültiger Status wird gespeichert

- **WENN** ein Inhalt gespeichert wird
- **DANN** akzeptiert das System nur die Status `draft`, `in_review`, `approved`, `published` oder `archived`

#### Scenario: Veröffentlichter Inhalt ohne Veröffentlichungsdatum

- **WENN** ein Benutzer versucht, einen Inhalt mit Status `published` ohne Veröffentlichungsdatum zu speichern
- **DANN** weist das System die Speicherung mit einem Validierungsfehler ab

### Requirement: JSON-Payload wird validiert und lesbar dargestellt

Das System MUST das Feld `payload` als JSON-Daten behandeln.

#### Scenario: Gültiges JSON wird gespeichert

- **WENN** ein Benutzer in der Erstellungs- oder Bearbeitungsansicht syntaktisch gültiges JSON eingibt
- **DANN** speichert das System den Payload unverändert als JSON
- **UND** optionale typspezifische Validierungen des registrierten `contentType` werden zusätzlich angewendet

#### Scenario: Ungültiges JSON wird abgewiesen

- **WENN** ein Benutzer syntaktisch ungültiges JSON eingibt
- **DANN** weist das System die Speicherung mit einer feldbezogenen Fehlermeldung ab
- **UND** bestehende persistierte Daten bleiben unverändert

### Requirement: Historie pro Inhalt ist einsehbar

Das System MUST für jeden Inhalt eine lesbare Historie bereitstellen.

#### Scenario: Historie eines Inhalts anzeigen

- **WENN** ein berechtigter Benutzer die Historie eines Inhalts öffnet
- **DANN** zeigt das System die bisherigen Änderungen in chronologischer Reihenfolge an
- **UND** jeder Eintrag enthält mindestens Zeitpunkt, Actor, Aktion und betroffenen Änderungsgegenstand

### Requirement: Content Contributions Register Before UI Materialization
The system SHALL register and validate existing plugin-provided content type contributions in the content phase before later admin and routing phases publish host UI materialization outputs.

This change SHALL NOT introduce a new content admin extension contract. Generic admin resources remain validated by the existing admin resource contract.

#### Scenario: Content type validates before admin phase
- **GIVEN** a plugin declares a content type and an admin resource
- **WHEN** the host creates the registry snapshot
- **THEN** content type validation completes before the admin phase runs

#### Scenario: Invalid content contribution stops later phases
- **GIVEN** a plugin declares an invalid content type contribution
- **WHEN** the content phase validates plugin contributions
- **THEN** validation fails before admin or route materialization

#### Scenario: Generic admin resource remains content-independent
- **GIVEN** a plugin declares a generic admin resource without a content-type dependency
- **WHEN** the admin phase validates the contribution
- **THEN** the host validates the admin resource contract without requiring a content type

### Requirement: Host-Validated Plugin Content Contributions
The system SHALL accept plugin-provided content contributions only as declarative metadata and SHALL validate content type identifiers, fields, actions, and UI bindings before they become available in the Studio.

Plugin-provided content UI components MAY render host-provided data and trigger host-supported actions. Plugins SHALL NOT define direct persistence paths, server handlers, request validation bypasses, or dynamic content-type registration after the validated build-time snapshot is published.

#### Scenario: Valid content contribution is registered
- **GIVEN** a plugin declares a namespaced content type with host-supported bindings
- **WHEN** the host validates the plugin registry snapshot
- **THEN** the content contribution becomes available through host-owned content routes and actions

#### Scenario: Content contribution uses unsupported runtime behavior
- **GIVEN** a plugin declares content behavior that requires direct persistence, routing, or authorization control
- **WHEN** the host validates the contribution
- **THEN** the host rejects the contribution with a deterministic diagnostics result
- **AND** the diagnostics include one of `plugin_guardrail_persistence_bypass`, `plugin_guardrail_route_bypass`, `plugin_guardrail_authorization_bypass`, or `plugin_guardrail_unsupported_binding`

#### Scenario: Content UI triggers host-owned action
- **GIVEN** a plugin content UI renders a publish button bound to a declared host-supported action
- **WHEN** a user triggers the action
- **THEN** the host performs validation, authorization, persistence, and audit emission
- **AND** the plugin does not bypass the host content action path

#### Scenario: Plugin attempts dynamic content registration
- **GIVEN** a plugin tries to register a content type after the build-time registry snapshot was published
- **WHEN** the host receives the dynamic registration attempt
- **THEN** the host rejects the registration
- **AND** the diagnostics include `plugin_guardrail_dynamic_registration` with plugin namespace and contribution identifier

### Requirement: Content-Erweiterungen haengen am kanonischen Build-time-Registry-Vertrag

Das Content-Management SHALL Plugin-Content-Typen und die kanonische Content-Admin-Ressource ueber denselben Build-time-Registry-Vertrag des Hosts anbinden.

#### Scenario: Host liest Content-Typen und Content-Admin-Ressource aus demselben Snapshot

- **WHEN** der Host content-nahe Build-time-Beitraege initialisiert
- **THEN** stammen registrierte `contentType`-Erweiterungen und die kanonische Content-Admin-Ressource aus demselben Build-time-Registry-Snapshot
- **AND** der Host verwendet dafuer keine getrennten, unkoordinierten Merge-Pfade

### Requirement: Plugin-Content-Typen sind namespace-pflichtig

Das Content-Management MUST plugin-beigestellte `contentType`-Identifier in einem fully-qualified Format `<namespace>.<contentTypeName>` behandeln.

#### Scenario: Plugin registriert namespaceten Content-Typ

- **WHEN** ein Plugin mit Namespace `news` einen Content-Typ registriert
- **THEN** verwendet der `contentType` das Format `news.<contentTypeName>`
- **AND** der Identifier ist global kollisionsfrei pruefbar

#### Scenario: Plugin registriert unqualifizierten Content-Typ

- **WHEN** ein Plugin einen `contentType` wie `news` oder `article` ohne fully-qualified Format registriert
- **THEN** wird die Registrierung mit einem Validierungsfehler abgewiesen
- **AND** der Host akzeptiert keinen implizit aus dem Plugin abgeleiteten Fallback-Identifier

#### Scenario: Plugin registriert Content-Typ in fremdem Namespace

- **WHEN** ein Plugin mit Namespace `news` einen `contentType` wie `events.article` registrieren will
- **THEN** wird die Registrierung mit einem Ownership-Fehler abgewiesen
- **AND** nur ein expliziter Host-Bridge- oder Alias-Vertrag duerfte eine solche Ausnahme erlauben

#### Scenario: Core-Content-Typen bleiben von der Plugin-Namespace-Pflicht ausgenommen

- **WHEN** der Host oder ein Core-Vertrag einen bestehenden Content-Typ wie `generic` oder `legal` verwendet
- **THEN** darf dieser Identifier ohne plugin-spezifisches Namespace-Praefix bestehen bleiben
- **AND** daraus entsteht keine Pflicht, core-eigene Content-Typen nachtraeglich in das Plugin-Namensmodell zu migrieren

### Requirement: Content-Admin-Flaechen nutzen denselben Admin-Ressourcenvertrag

Das Content-Management SHALL seine CRUD-artigen Admin-Flaechen ueber denselben hostseitigen Registrierungsvertrag fuer Admin-Ressourcen beschreiben wie andere Verwaltungsbereiche.

#### Scenario: Inhaltsverwaltung wird als Admin-Ressource registriert

- **WHEN** die Inhaltsverwaltung ihre Listen-, Erstellungs- und Detailflaechen fuer den Host bereitstellt
- **THEN** erfolgt dies ueber eine kanonische Admin-Ressourcendefinition statt ueber isolierte Sonderverdrahtung im Host
- **AND** die bestehende Inhaltslogik fuer Core-Felder, Statusmodell und Historie bleibt davon unberuehrt

#### Scenario: Typspezifische Content-Erweiterungen bleiben unter demselben Ressourcenvertrag anschliessbar

- **WHEN** ein registrierter `contentType` zusaetzliche UI-Bereiche oder Aktionen beisteuert
- **THEN** werden diese an die bestehende Content-Admin-Ressource angehaengt statt eine zweite parallele Admin-Ressource fuer denselben Inhaltsbereich zu erzeugen
- **AND** die Inhaltsverwaltung bleibt fuer den Host als eine kanonische Admin-Ressource adressierbar

### Requirement: Minimal Content Core Contract
The system SHALL define a minimal host-owned content core contract for identity, content type, owner scope, lifecycle status, validation state, publication metadata, history references, revision references, and audit-relevant metadata.

The host-owned core contract SHALL include at least `contentId`, `contentType`, `instanceId`, optional `organizationId`, optional `ownerSubjectId`, `status`, `validationState`, optional `publishedAt`, optional `publishFrom`, optional `publishUntil`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `historyRef`, optional `currentRevisionRef`, and optional `lastAuditEventRef`.

Plugins MAY contribute payload schemas, field definitions, UI bindings, display metadata, and additional validation rules for their namespaced `contentType`. Plugins SHALL NOT redefine required core fields, lifecycle status semantics, owner-scope semantics, history/revision references, or audit metadata.

#### Scenario: Content item uses core fields
- **GIVEN** a content item is created for any registered content type
- **WHEN** the item is persisted
- **THEN** the host stores the required core fields independently from plugin-specific payload fields
- **AND** the persisted item can be loaded, authorized, listed, audited, and linked to history without interpreting the plugin payload

#### Scenario: Plugin attempts to redefine core semantics
- **GIVEN** a plugin declares a field or workflow that changes host-owned content status semantics
- **WHEN** the content type is registered
- **THEN** the host rejects the contribution with deterministic diagnostics
- **AND** a semantic change to the host-owned core contract requires a documented host migration instead of a plugin-local override

#### Scenario: Plugin contributes payload schema
- **GIVEN** a plugin declares a namespaced `contentType` with a payload schema and display metadata
- **WHEN** the host validates the content contribution
- **THEN** the host attaches the payload schema and display metadata below the content core contract
- **AND** the core fields remain typed, required, and owned by the host

#### Scenario: Existing content type is migrated into the contract
- **GIVEN** existing persisted content lacks one of the new host-owned core metadata fields
- **WHEN** the content model migration is applied
- **THEN** the migration populates or derives the missing core metadata deterministically
- **AND** records that cannot be migrated are reported with content identifier, content type, scope, and reason

### Requirement: Host-Owned Content Lifecycle Invariants
The system SHALL keep content lifecycle transitions, publication rules, validation state, history references, and revision references under host control for all content types.

#### Scenario: Status transition is accepted
- **GIVEN** a user requests a supported transition between host-defined content statuses
- **WHEN** validation and authorization succeed
- **THEN** the host applies the transition and updates validation, publication, history, revision, and audit metadata consistently

#### Scenario: Plugin declares unsupported lifecycle transition
- **GIVEN** a plugin declares a lifecycle transition outside the host-owned status model
- **WHEN** the host validates the plugin registry snapshot
- **THEN** the host rejects the contribution with a deterministic lifecycle diagnostics result

#### Scenario: Published content requires publication metadata
- **GIVEN** a content item is moved to a published state
- **WHEN** the host validates the mutation
- **THEN** required publication metadata is present and internally consistent
- **AND** invalid publication windows or missing required metadata reject the mutation before persistence

### Requirement: Content Actions Declare Capabilities
The system SHALL require mutating content actions to declare their domain capability so that UI availability, API authorization, diagnostics, and audit classification use the same mapping.

Read-only navigation MAY continue to use existing read permissions directly. Any action that creates, updates, deletes, publishes, archives, restores, bulk-edits, or changes review state SHALL declare a supported capability.

#### Scenario: Content action declares capability
- **GIVEN** a content action declares a supported domain capability
- **WHEN** the action is rendered or executed
- **THEN** the host uses the mapped primitive action for availability and authorization
- **AND** the action metadata exposes enough information for audit classification without allowing plugin-owned audit emission

#### Scenario: Content action omits capability
- **GIVEN** a mutating content action has no declared capability
- **WHEN** the content type is registered
- **THEN** the host rejects the action declaration with `capability_mapping_missing`
- **AND** the action is not published in the registry snapshot

#### Scenario: Content action declares unsupported capability
- **GIVEN** a content action declares a capability that is not supported by the host mapping
- **WHEN** the content phase validates plugin or core content contributions
- **THEN** validation fails before admin UI materialization
- **AND** the diagnostic includes the content type, action identifier, declared capability, and owning namespace when available

#### Scenario: Bulk action applies one mapping consistently
- **GIVEN** a user triggers a bulk content action for multiple content items
- **WHEN** the host evaluates the action
- **THEN** the same declared domain capability is resolved once per authorization context
- **AND** every affected item remains within the authorized scope before the bulk mutation is executed

### Requirement: News Plugin Uses Mainserver As Source Of Truth

The News plugin SHALL use the SVA Mainserver GraphQL API as the source of truth for News list, detail, create, update, and archive-or-delete operations.

The plugin SHALL keep its specialized News UI, validation, routes, Studio UI components, and action metadata, but its productive persistence path SHALL be host-owned and Mainserver-backed.

#### Scenario: News list renders Mainserver data

- **GIVEN** the SVA Mainserver integration is configured for the current instance
- **AND** the user has local permission to read News content
- **WHEN** the user opens `/plugins/news`
- **THEN** the News plugin loads items from the host-owned Mainserver-backed data source
- **AND** local IAM content records are not used as the productive News source

#### Scenario: News create writes to Mainserver

- **GIVEN** the user has local permission and valid Mainserver credentials
- **WHEN** the user creates a News entry through `/plugins/news/new`
- **THEN** the host writes the News entry through a typed Mainserver GraphQL mutation
- **AND** no local IAM content record is created as a parallel productive copy

#### Scenario: Mainserver integration is unavailable

- **GIVEN** the current instance has no valid Mainserver configuration or the integration is disabled
- **WHEN** the user opens the News plugin
- **THEN** the UI shows a deterministic configuration or integration-disabled state
- **AND** the UI does not silently fall back to local IAM content writes

### Requirement: News Plugin Uses Host-Owned Data Boundary

The News plugin SHALL receive Mainserver-backed data through a host-owned HTTP or injected data-source contract that preserves plugin package boundaries.

`@sva/plugin-news` SHALL NOT import App modules, Auth-Runtime server modules, or `@sva/sva-mainserver/server`.

#### Scenario: Plugin data facade calls host-owned contract

- **GIVEN** `packages/plugin-news/src/news.api.ts` loads or mutates News data
- **WHEN** the productive Mainserver-backed implementation is active
- **THEN** it calls a host-owned News data contract instead of `/api/v1/iam/contents`
- **AND** the plugin package keeps only allowed Workspace dependencies such as `@sva/plugin-sdk` and `@sva/studio-ui-react`

#### Scenario: Plugin imports server package directly

- **GIVEN** plugin code attempts to import `@sva/sva-mainserver/server`, `@sva/auth-runtime/server`, or `apps/sva-studio-react/src/**`
- **WHEN** dependency boundaries are checked
- **THEN** the build, lint, CI, or review gate rejects the import

### Requirement: News Plugin Model Maps To Mainserver News Contract

The News plugin SHALL maintain an explicit mapping between its form/content model and the SVA Mainserver News GraphQL contract.

The mapping SHALL define title, teaser, body, media URL, external URL, category or tags, publication timestamp, identifiers, author/display metadata, update timestamps, and status/sichtbarkeit where supported by the Mainserver schema.

#### Scenario: Mainserver item is displayed in plugin model

- **GIVEN** the Mainserver returns a `NewsItem`
- **WHEN** the host maps it for the plugin
- **THEN** the plugin receives a `NewsContentItem`-compatible model
- **AND** unsupported or missing optional fields are handled deterministically

#### Scenario: User submits invalid mapped payload

- **GIVEN** the user submits a News form value that cannot be mapped to the Mainserver News contract
- **WHEN** the host validates the mutation input
- **THEN** the mutation is rejected before the GraphQL call
- **AND** the UI receives field-level or operation-level validation errors

#### Scenario: Plugin status is not natively supported by Mainserver

- **GIVEN** the plugin has a status value such as `in_review` or `approved`
- **WHEN** the Mainserver contract does not expose an equivalent News workflow state
- **THEN** the host maps, restricts, or rejects that status deterministically
- **AND** the UI and runbook document the supported status behavior for this rollout

### Requirement: Local News Legacy Content Is Explicitly Handled

The system SHALL handle existing local `news.article` or legacy `news` content records through an explicit migration or legacy-read decision before switching the productive News plugin write path to Mainserver-only.

#### Scenario: Legacy content migration is selected

- **GIVEN** existing local News content records must remain available after the Mainserver switch
- **WHEN** the migration path is implemented
- **THEN** it provides a dry-run mode, an operator-readable report, idempotent execution, and deterministic failure records
- **AND** migrated records are not written twice on repeated runs

#### Scenario: Legacy content is not migrated

- **GIVEN** existing local News content records are intentionally not migrated
- **WHEN** the News plugin is switched to Mainserver-backed mode
- **THEN** the behavior is documented
- **AND** the UI or runbook explains that local legacy records are no longer the productive News source

#### Scenario: Dual-write is attempted

- **GIVEN** a News create or update operation succeeds against the Mainserver
- **WHEN** the operation completes
- **THEN** the host does not also write a productive local IAM content copy
- **AND** any optional migration or audit record is clearly separated from the content source of truth

### Requirement: Events Plugin Uses Mainserver As Source Of Truth

The Events plugin SHALL use the SVA Mainserver GraphQL API as the source of truth for Event list, detail, create, update, and archive-or-delete operations.

The plugin SHALL keep a specialized Events UI, validation, routes, Studio UI components, and action metadata, but its productive persistence path SHALL be host-owned and Mainserver-backed.

#### Scenario: Events list renders Mainserver data

- **GIVEN** the SVA Mainserver integration is configured for the current instance
- **AND** the user has local permission to read Event content
- **WHEN** the user opens `/plugins/events`
- **THEN** the Events plugin loads items from the host-owned Mainserver-backed data source
- **AND** local IAM content records are not used as the productive Events source

#### Scenario: Event create writes to Mainserver

- **GIVEN** the user has local permission and valid Mainserver credentials
- **WHEN** the user creates an Event through `/plugins/events/new`
- **THEN** the host writes the Event through a typed Mainserver GraphQL mutation
- **AND** no local IAM content record is created as a parallel productive copy

#### Scenario: Mainserver integration is unavailable for Events

- **GIVEN** the current instance has no valid Mainserver configuration or the integration is disabled
- **WHEN** the user opens the Events plugin
- **THEN** the UI shows a deterministic configuration or integration-disabled state
- **AND** the UI does not silently fall back to local IAM content writes

### Requirement: POI Plugin Uses Mainserver As Source Of Truth

The POI plugin SHALL use the SVA Mainserver GraphQL API as the source of truth for Point-of-Interest list, detail, create, update, and archive-or-delete operations.

The plugin SHALL keep a specialized POI UI, validation, routes, Studio UI components, and action metadata, but its productive persistence path SHALL be host-owned and Mainserver-backed.

#### Scenario: POI list renders Mainserver data

- **GIVEN** the SVA Mainserver integration is configured for the current instance
- **AND** the user has local permission to read POI content
- **WHEN** the user opens `/plugins/poi`
- **THEN** the POI plugin loads items from the host-owned Mainserver-backed data source
- **AND** local IAM content records are not used as the productive POI source

#### Scenario: POI create writes to Mainserver

- **GIVEN** the user has local permission and valid Mainserver credentials
- **WHEN** the user creates a POI through `/plugins/poi/new`
- **THEN** the host writes the POI through a typed Mainserver GraphQL mutation
- **AND** no local IAM content record is created as a parallel productive copy

#### Scenario: Mainserver integration is unavailable for POI

- **GIVEN** the current instance has no valid Mainserver configuration or the integration is disabled
- **WHEN** the user opens the POI plugin
- **THEN** the UI shows a deterministic configuration or integration-disabled state
- **AND** the UI does not silently fall back to local IAM content writes

### Requirement: Events And POI Use Host-Owned Data Boundaries

Events and POI plugins SHALL receive Mainserver-backed data through host-owned HTTP or injected data-source contracts that preserve plugin package boundaries.

`@sva/plugin-events` and `@sva/plugin-poi` SHALL NOT import App modules, Auth-Runtime server modules, or `@sva/sva-mainserver/server`.

#### Scenario: Events plugin data facade calls host-owned contract

- **GIVEN** `packages/plugin-events` loads or mutates Events data
- **WHEN** the productive Mainserver-backed implementation is active
- **THEN** it calls a host-owned Events data contract instead of `/api/v1/iam/contents`
- **AND** the plugin package keeps only allowed Workspace dependencies such as `@sva/plugin-sdk` and `@sva/studio-ui-react`

#### Scenario: POI plugin data facade calls host-owned contract

- **GIVEN** `packages/plugin-poi` loads or mutates POI data
- **WHEN** the productive Mainserver-backed implementation is active
- **THEN** it calls a host-owned POI data contract instead of `/api/v1/iam/contents`
- **AND** the plugin package keeps only allowed Workspace dependencies such as `@sva/plugin-sdk` and `@sva/studio-ui-react`

#### Scenario: Fachplugin imports server package directly

- **GIVEN** Events or POI plugin code attempts to import `@sva/sva-mainserver/server`, `@sva/auth-runtime/server`, or `apps/sva-studio-react/src/**`
- **WHEN** dependency boundaries are checked
- **THEN** the build, lint, CI, or review gate rejects the import

### Requirement: Events Plugin Model Maps To Mainserver Event Contract

The Events plugin SHALL maintain an explicit mapping between its form/content model and the SVA Mainserver Event GraphQL contract.

The mapping SHALL define title, description, date model, recurrence fields where supported, category, address/location, contacts, URLs, media, organizer, prices, accessibility information, tags, optional POI reference, identifiers, update timestamps, and status/sichtbarkeit where supported by the Mainserver schema.

#### Scenario: Mainserver Event is displayed in plugin model

- **GIVEN** the Mainserver returns an `EventRecord`
- **WHEN** the host maps it for the plugin
- **THEN** the plugin receives an Events editor-compatible model
- **AND** unsupported or missing optional fields are handled deterministically

#### Scenario: User submits invalid Event payload

- **GIVEN** the user submits an Event form value that cannot be mapped to the Mainserver Event contract
- **WHEN** the host validates the mutation input
- **THEN** the mutation is rejected before the GraphQL call
- **AND** the UI receives field-level or operation-level validation errors

#### Scenario: Event status is not natively supported by Mainserver

- **GIVEN** the plugin has a status value beyond Mainserver visibility support
- **WHEN** the Mainserver contract does not expose an equivalent Event workflow state
- **THEN** the host maps, restricts, or rejects that status deterministically
- **AND** the UI and runbook document the supported status behavior for this rollout

### Requirement: POI Plugin Model Maps To Mainserver POI Contract

The POI plugin SHALL maintain an explicit mapping between its form/content model and the SVA Mainserver Point-of-Interest GraphQL contract.

The mapping SHALL define name, description, mobile description, active state, category, address/location, contact, opening hours, operating company, web URLs, media, prices, certificates, accessibility information, tags, payload, identifiers, update timestamps, and status/sichtbarkeit where supported by the Mainserver schema.

#### Scenario: Mainserver POI is displayed in plugin model

- **GIVEN** the Mainserver returns a `PointOfInterest`
- **WHEN** the host maps it for the plugin
- **THEN** the plugin receives a POI editor-compatible model
- **AND** unsupported or missing optional fields are handled deterministically

#### Scenario: User submits invalid POI payload

- **GIVEN** the user submits a POI form value that cannot be mapped to the Mainserver POI contract
- **WHEN** the host validates the mutation input
- **THEN** the mutation is rejected before the GraphQL call
- **AND** the UI receives field-level or operation-level validation errors

#### Scenario: POI visibility and active state diverge

- **GIVEN** the POI form contains both publication visibility and active state
- **WHEN** the host maps the form to the Mainserver contract
- **THEN** `visible` and `active` behavior is documented and tested separately
- **AND** unsupported combinations are rejected or normalized deterministically

### Requirement: News Plugin Uses Complete Mainserver News Model

The News plugin SHALL use a plugin-owned model that covers the complete SVA Mainserver News data model available through the host-owned News facade.

The editable model SHALL include scalar mutation fields, nested mutation fields, operation options, and the existing News payload. The detail/list model SHALL additionally include read-only and derived Mainserver fields.

#### Scenario: Existing Phase-1 News item is edited

- **GIVEN** an existing Mainserver News item only contains the Phase-1 fields `title`, `publishedAt`, and `payload`
- **WHEN** the editor loads it after the full model expansion
- **THEN** the editor renders valid defaults for all newly supported optional fields
- **AND** saving the item preserves compatibility with the existing Mainserver update path

#### Scenario: Full News item is edited

- **GIVEN** a Mainserver News item includes scalar fields, categories, source URL, address, content blocks, media references, and read-only metadata
- **WHEN** the editor loads the item
- **THEN** all editable fields are represented in form state
- **AND** read-only metadata is available without becoming mutable input

### Requirement: News Editor Covers Snapshot-backed Mutation Fields

The News editor SHALL provide user-facing controls for all approved editable `createNewsItem` fields.

Editable fields SHALL include `title`, `author`, `keywords`, `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `publicationDate`, `publishedAt`, `showPublishDate`, `categoryName`, `categories`, `sourceUrl`, `address`, `contentBlocks`, `pointOfInterestId`, and the operation option `pushNotification`.

#### Scenario: User creates a full News item

- **GIVEN** the user has permission to create News
- **WHEN** the user completes the full News form and submits it
- **THEN** the plugin sends the complete editable model to the host-owned News facade
- **AND** the host writes only validated snapshot-backed fields to Mainserver
- **AND** the UI shows success feedback after the Mainserver response is mapped back

#### Scenario: User submits invalid full News form

- **GIVEN** the user submits invalid URLs, invalid dates, invalid `charactersToBeShown`, or invalid nested list values
- **WHEN** the form or host validates the input
- **THEN** the request is rejected before GraphQL execution
- **AND** the UI shows localized validation feedback

### Requirement: News Payload Does Not Hide Dedicated Mainserver Fields

The News plugin SHALL NOT store Mainserver fields with dedicated GraphQL arguments inside generic `payload`.

`payload` SHALL be treated as a legacy read fallback only. The plugin SHALL NOT send `payload` during create or update. `author`, `keywords`, `externalId`, `newsType`, `sourceUrl`, `address`, `categories`, `contentBlocks`, `pointOfInterestId`, and publication controls are represented as first-class fields.

#### Scenario: Plugin saves News with source URL and address

- **GIVEN** the user fills `sourceUrl` and `address`
- **WHEN** the News item is saved
- **THEN** those values are sent as `sourceUrl` and `address` mutation variables
- **AND** `payload` is not sent with the mutation

#### Scenario: Legacy payload contains overlapping values

- **GIVEN** an old News payload contains keys that overlap with dedicated Mainserver fields
- **WHEN** the item is loaded
- **THEN** the plugin normalizes legacy payload content into first-class editor fields such as `contentBlocks`
- **AND** save behavior follows the dedicated Mainserver fields without writing `payload`

### Requirement: News ContentBlocks Are The Leading Content Model

The News plugin SHALL treat `contentBlocks` as the leading News content model.

Existing payload-only News SHALL remain readable by mapping legacy payload values into a virtual content block on load. Saves SHALL write `contentBlocks` and SHALL NOT write payload.

#### Scenario: Legacy payload-only News is loaded

- **GIVEN** an existing Mainserver News item has no `contentBlocks` but contains legacy payload body data
- **WHEN** the editor loads the item
- **THEN** the editor shows a content block derived from the legacy payload
- **AND** the next save writes the block through `contentBlocks`
- **AND** the next save does not write payload

#### Scenario: User edits multiple content blocks

- **GIVEN** the user edits multiple content blocks with media URL references
- **WHEN** the item is saved
- **THEN** the host sends the complete `contentBlocks` list as the new Mainserver state
- **AND** individual block IDs are not required because `ContentBlockInput` does not expose IDs

### Requirement: News Read-only Metadata Is Visible Or Documented

The News plugin SHALL either display or explicitly document read-only Mainserver News metadata returned by the host facade.

Read-only metadata includes `id`, `createdAt`, `updatedAt`, `visible`, `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe`, and `pushNotificationsSentAt`.

#### Scenario: News has Mainserver metadata

- **GIVEN** the Mainserver returns read-only metadata for a News item
- **WHEN** the editor/detail view is rendered
- **THEN** the metadata is available to the user or documented as intentionally hidden
- **AND** it is not sent back as mutable input

### Requirement: News Facade Keeps Security Gates For Full Model Mutations

The host-owned News facade SHALL apply the same security gates to full-model News mutations as to the Phase-1 News mutations.

The facade SHALL validate session, instance context, local content primitives, CSRF, idempotency for create, Mainserver credentials, request shape, and plugin-facing error mapping before executing Mainserver writes.

#### Scenario: Full News create is retried

- **GIVEN** a user submits a full News create request with an `Idempotency-Key`
- **WHEN** the request is retried with the same payload
- **THEN** the host returns the idempotent replay response
- **AND** no duplicate Mainserver News item is created

#### Scenario: Full News mutation fails upstream

- **GIVEN** Mainserver rejects or fails a full News create request after idempotency reservation
- **WHEN** the host maps the error
- **THEN** the idempotency record is completed as failed
- **AND** the UI receives a stable plugin-facing error response

### Requirement: Standard Content Plugins Use A Shared CRUD Registration Path
The system SHALL treat CRUD-style content plugins as standard plugins that register their productive list, detail, and editor UI through the shared host-owned admin resource path.

Standard plugins SHALL use canonical host routes, host-owned guard evaluation, host-owned save and mutation dispatch, and host-owned global page actions.

#### Scenario: Standard content plugin registers admin resource
- **GIVEN** a content plugin exposes a normal CRUD workflow
- **WHEN** it is integrated productively into the Studio host
- **THEN** it registers through the shared admin resource path instead of relying on plugin-local top-level CRUD routes
- **AND** the host owns the canonical route tree for list, create, and detail

#### Scenario: Standard plugin tries to keep plugin-local CRUD route as productive path
- **GIVEN** a CRUD-style content plugin also declares free plugin routes for the same productive list, create, or detail workflow
- **WHEN** the shared content plugin contract is validated
- **THEN** the host rejects or flags that setup as an invalid bypass of the standard path
- **AND** the plugin must move the productive CRUD path to the shared host-owned resource contract

### Requirement: Registered Content View Bindings
The system SHALL allow standard content plugins to provide specialized content list, detail, and editor bindings only through an explicit content UI registration contract while preserving host-owned content core semantics.

The registration contract SHALL identify the affected admin resource or `contentType`, the binding kind (`list`, `detail`, or `editor`), and the React binding component or host-approved binding reference used for materialization.

#### Scenario: Package registers specialized editor binding
- **GIVEN** a package registers a specialized editor binding for its namespaced content type
- **WHEN** the host validates and publishes the content registry snapshot
- **THEN** the binding is attached to that content type through the content UI registration contract
- **AND** host-owned validation, permissions, persistence, and save behavior remain unchanged

#### Scenario: Package registers unsupported binding kind
- **GIVEN** a package attempts to register a binding outside the supported kinds `list`, `detail`, or `editor`
- **WHEN** the contract is validated
- **THEN** the registration is rejected with deterministic diagnostics

#### Scenario: Package replaces host-owned content core behavior
- **GIVEN** a package binding attempts to replace host-owned status, publication, history, or persistence behavior
- **WHEN** the UI contribution is validated
- **THEN** the host rejects the contribution as outside the specialization boundary

### Requirement: Existing Content Plugins Are The Reference Migration For The Standard Path
The system SHALL use the existing content plugins `@sva/plugin-news`, `@sva/plugin-events`, and `@sva/plugin-poi` as the reference migration set for the specialized content binding contract.

#### Scenario: Existing content plugins register specialized bindings
- **GIVEN** `@sva/plugin-news`, `@sva/plugin-events`, and `@sva/plugin-poi` expose their existing list, detail, or editor pages
- **WHEN** the migration to the new contract is completed
- **THEN** those bindings are registered through the shared host-owned admin resource and content UI registration contract
- **AND** the productive Mainserver-backed data path of each plugin remains unchanged

#### Scenario: Reference migration preserves host-owned responsibilities
- **GIVEN** one of the existing content plugins uses specialized bindings under the new contract
- **WHEN** a user loads, edits, saves, or deletes an item in that plugin
- **THEN** the host continues to own routing, guards, authorization, mutation dispatch, and global page actions
- **AND** the plugin contributes only the specialized binding surface

#### Scenario: Further content plugin reuses the same contract
- **GIVEN** a future content plugin is added after the reference migration
- **WHEN** it needs a specialized list, detail, or editor binding
- **THEN** it uses the same content UI registration contract
- **AND** it does not require a plugin-specific host extension path outside the shared mechanism

### Requirement: Exception Path Remains Available For Non-CRUD Plugin Flows
The system SHALL continue to allow free `plugin.routes` for documented non-CRUD plugin flows that do not fit the shared admin resource model.

#### Scenario: Plugin defines non-CRUD exception route
- **GIVEN** a plugin needs a wizard, dashboard, or another domain-specific workflow that is not a normal list-create-detail CRUD path
- **WHEN** it declares such a route through `plugin.routes`
- **THEN** the route remains allowed as an explicit exception path
- **AND** the exception does not become the productive CRUD path for the plugin's main content administration

### Requirement: Content Admin Resources Use Host Standards
The system SHALL expose content-management admin resources through the host admin resource standards for list filtering, search, bulk operations, history, and revisions instead of bespoke per-content implementations.

#### Scenario: Content list uses host filters
- **GIVEN** a content type declares host-supported filters
- **WHEN** the content list is opened
- **THEN** the host applies the standard filter model and passes normalized query input to the content data layer

#### Scenario: Content list replaces local-only filter state
- **GIVEN** the content admin resource declares host-managed search, status filters, sorting, or pagination
- **WHEN** the content list renders
- **THEN** the list derives its visible query state from the host resource standard instead of independent component-local filter state

#### Scenario: Content type requests unsupported list behavior
- **GIVEN** a content type declares a list behavior outside the host standard
- **WHEN** the resource is registered
- **THEN** the host rejects the unsupported declaration or marks it unavailable with diagnostics

### Requirement: Mainserver-Plugin-Listen verwenden serverseitige Pagination

Das System SHALL die Listenansichten der produktiven Mainserver-Plugins `news`, `events` und `poi` serverseitig paginieren, statt beim Seitenaufruf den kompletten Datenbestand vorzuladen.

#### Scenario: Plugin-Liste lädt nur die aktuelle Seite

- **GIVEN** ein Redakteur öffnet die Listenansicht für News, Events oder POI
- **WHEN** die erste Seite gerendert wird
- **THEN** fordert die UI nur die konfigurierte Seitengröße für die aktuelle Seite an
- **AND** sie lädt nicht mehr standardmäßig den gesamten Bestand

#### Scenario: Benutzer navigiert zur nächsten Seite

- **GIVEN** die aktuelle Plugin-Liste signalisiert weitere Ergebnisse
- **WHEN** der Benutzer die Aktion für die nächste Seite auslöst
- **THEN** sendet die UI eine neue List-Anfrage für die Zielseite
- **AND** die Tabelle aktualisiert ihren Lade- und Ergebniszustand ohne Vollabfrage des gesamten Bestands
- **AND** die aktuelle Seite bleibt über typsichere Search-Params in der URL abbildbar

#### Scenario: Upstream liefert keinen exakten Gesamtzähler

- **GIVEN** der Host kann für die angeforderte Plugin-Liste keinen belastbaren Gesamtzähler aus dem Mainserver-Vertrag ableiten
- **WHEN** die Pagination-UI gerendert wird
- **THEN** zeigt sie eine ehrliche Vor/Zurück-Navigation mit aktueller Seite
- **AND** sie zeigt keine erfundene Gesamtseitenzahl oder ein fingiertes `total`

#### Scenario: Browser-Navigation bleibt mit Listenstate konsistent

- **GIVEN** ein Benutzer öffnet eine Mainserver-Plugin-Liste auf einer späteren Seite
- **WHEN** er die Search-Params für `page` oder `pageSize` ändert oder Browser-Zurück/Vorwärts verwendet
- **THEN** spiegeln URL und Tabelle denselben Listenstate
- **AND** die Listenansicht bleibt per Deep-Link reproduzierbar

### Requirement: Standardisierte Content-Plugins nutzen gemeinsame SDK-Helfer ohne Plugin-Kopplung

Das System SHALL wiederkehrende technische Muster für standardisierte Content-Plugins über `@sva/plugin-sdk` bereitstellen, ohne direkte Abhängigkeiten zwischen einzelnen Fachplugins einzuführen.

#### Scenario: Standard-CRUD-Metadaten kommen aus dem SDK

- **GIVEN** ein standardisiertes Content-Plugin wie News, Events oder POI
- **WHEN** das Plugin Navigation, Actions, Permissions, Module-IAM und host-owned `adminResources` registriert
- **THEN** kann es dafür gemeinsame SDK-Helfer verwenden
- **AND** die erzeugten Beiträge bleiben namespacet und host-kompatibel

#### Scenario: Mainserver-CRUD-Basis bleibt plugin-isoliert

- **GIVEN** mehrere Content-Plugins sprechen unterschiedliche hostgeführte Mainserver-Fassaden an
- **WHEN** sie gemeinsame HTTP-Basislogik benötigen
- **THEN** nutzen sie gemeinsame SDK-Helfer für Request-, Fehler- und CRUD-Mechanik
- **AND** kein Plugin importiert ein anderes Plugin für diesen Zweck

#### Scenario: Fachlogik bleibt im Plugin

- **GIVEN** ein Plugin besitzt eigene Feldmodelle, Validierung oder Editor-Spezialisierungen
- **WHEN** gemeinsame SDK-Helfer eingesetzt werden
- **THEN** bleiben fachliche Typen, Validierung, Übersetzungen und Editor-Mappings weiterhin im jeweiligen Plugin
- **AND** das SDK übernimmt nur technische Wiederverwendung

