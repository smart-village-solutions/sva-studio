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

Das System MUST `Inhalt` als kanonisches Core-Element modellieren, das über definierte SDK-Erweiterungspunkte für spezielle Datentypen erweitert werden kann.

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

