# content-management Specification

## Purpose

Definiert die fachliche Inhaltsverwaltung für SVA Studio mit tabellarischer Admin-Ansicht, erweiterbarem Core-Modell, kontrolliertem Statusmodell, JSON-Payload-Validierung und nachvollziehbarer Historie.

## Requirements

### Requirement: Inhaltsübersicht als tabellarische Admin-Ansicht

Das System MUST eine Seite `Inhalte` bereitstellen, die vorhandene Inhalte in einer tabellarischen Admin-Ansicht darstellt.

Die Seite MUST für sichtbare Inhaltstypen eine einzige führende serverseitige Listenquelle verwenden und darf für den produktiven Listenpfad keine browserseitigen Vollscans über mehrere Fachlisten ausführen.

#### Scenario: Inhaltsliste wird geladen

- **WENN** ein berechtigter Benutzer die Seite `Inhalte` öffnet
- **DANN** zeigt das System eine semantische Tabelle mit den Spalten Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Status und Historie
- **UND** jede Tabellenzeile repräsentiert genau einen Inhalt
- **UND** der Inhaltstyp ist pro Zeile erkennbar
- **UND** das System zeigt einen Ladezustand, bis mindestens vollständige oder partielle Inhaltsdaten verfügbar sind

#### Scenario: Mainserver-gestützte Inhaltstypen erscheinen über die führende Listenquelle

- **WENN** für die aktive Instanz lesbare News-, Event-, POI-, Generic-Item-, FAQ- oder Survey-Inhalte nur im Mainserver existieren
- **DANN** erscheinen sie dennoch in der Seite `Inhalte`
- **UND** die Seite liest sie über dieselbe führende serverseitige Listenquelle wie andere sichtbare Inhalte
- **UND** der Browser führt dafür keinen lokalen Vollscan über mehrere Mainserver-Fachlisten aus

#### Scenario: Inhaltsliste nutzt serverseitige Pagination

- **WENN** die Seite `Inhalte` mit `page`, `pageSize`, `sortBy`, `sortDirection`, `q`, `type`, `status` oder `visibleType` angefragt wird
- **DANN** wendet das System diese Parameter serverseitig auf die führende Listenquelle an
- **UND** der Browser erhält nur die angeforderte Ergebnis-Seite
- **UND** die Seite lädt nicht den vollständigen Mainserver-Bestand vor der Anzeige

#### Scenario: Partieller Snapshot wird sofort angezeigt

- **WENN** für einen Mainserver-Inhaltstyp mindestens eine Seite erfolgreich lokal persistiert wurde
- **UND** weitere Seiten noch im Hintergrund geladen werden
- **DANN** zeigt die Inhaltsübersicht die bereits persistierten und autorisierten Zeilen sofort an
- **UND** kennzeichnet sie als partiellen Snapshot im Aufbau
- **UND** behauptet keine endgültige Trefferzahl, Seitenzahl oder Vollständigkeit

#### Scenario: Partielle Pagination bleibt vorläufig

- **WENN** mindestens ein angefragter Mainserver-Inhaltstyp nur partiell materialisiert ist
- **DANN** entspricht `pagination.total` aus Kompatibilitätsgründen ausschließlich der aktuell autorisiert verfügbaren lokalen Treffermenge
- **UND** liefern additive Metadaten `availableCount`, `isTotalFinal = false` sowie den typbezogenen Snapshot-Zustand
- **UND** fehlt `totalCount`, bis der angefragte Bestand vollständig reconciled wurde
- **UND** erlaubt die Oberfläche die Navigation zwischen den aus `pagination.total` ableitbaren, bereits materialisierten lokalen Seiten, ohne eine endgültige Gesamtseitenzahl auszuweisen
- **UND** bietet die Oberfläche keine Navigation auf noch nicht materialisierte Seiten an
- **UND** kennzeichnet sie Sortierung und Filterung als vorläufig auf die lokal verfügbare Menge begrenzt

#### Scenario: Gemischte Inhaltstypen besitzen unterschiedliche Vollständigkeit

- **WENN** eine Listenanfrage vollständige und partielle Mainserver-Inhaltstypen kombiniert
- **DANN** ist die Gesamtantwort partiell, sobald mindestens ein angefragter Typ partiell ist
- **UND** bleiben Vollständigkeit und Fehlerzustand pro Inhaltstyp separat in den Metadaten erhalten
- **UND** bewertet ein expliziter Typfilter nur den angefragten Typ

#### Scenario: Vorhandener Snapshot wird während einer Aktualisierung weiterverwendet

- **WENN** beim Öffnen der Inhaltsübersicht bereits ein lesbarer lokaler Snapshot existiert
- **DANN** zeigt das System diesen ohne Warten auf den Mainserver sofort an
- **UND** startet die Revalidierung im Hintergrund
- **UND** kennzeichnet einen veralteten oder laufend aktualisierten Stand, ohne die Tabelle durch einen Vollseiten-Ladezustand zu ersetzen

#### Scenario: Hintergrund-Refresh liefert weitere lokale Seiten

- **WENN** während einer geöffneten Inhaltsübersicht neue oder aktualisierte Projektionszeilen lokal persistiert werden
- **DANN** revalidiert der Browser die führende Listenquelle mit begrenzter Frequenz und Backoff
- **UND** zeigt die Tabelle die neuen lokalen Ergebnisse zeitnah an
- **UND** bleiben Fokus, Zeilenauswahl, Filter, Sortierung und aktuelle Seite erhalten, soweit die angefragten Daten dies zulassen

#### Scenario: Manueller Refresh beendet die priorisierte Phase

- **WENN** ein Redakteur `Aktualisieren` auslöst
- **UND** die neuesten Seiten der angefragten Inhaltstypen erfolgreich persistiert wurden
- **DANN** meldet die Oberfläche den erfolgreichen Hot-Refresh
- **UND** zeigt die neuen lokalen Zeilen
- **UND** darf die vollständige Reconciliation weiterer Seiten im Hintergrund fortgesetzt werden

#### Scenario: Spätere Seite schlägt nach partiellem Erfolg fehl

- **WENN** bereits persistierte Seiten eines Mainserver-Inhaltstyps lesbar sind
- **UND** eine spätere Seite nicht geladen oder verarbeitet werden kann
- **DANN** bleiben die bereits persistierten Zeilen sichtbar
- **UND** zeigt die Seite einen regulären Hinweis auf den partiellen, nicht vollständig aktualisierten Stand
- **UND** verbleibt nicht in einem unendlichen Ladezustand

#### Scenario: Downstream-Fehler ohne lesbaren Snapshot

- **WENN** eine für die Inhaltsübersicht benötigte Mainserver-Quelle fehlschlägt oder ausläuft
- **UND** für den betroffenen Typ weder ein vollständiger noch ein partieller Snapshot existiert
- **DANN** beendet die Seite den Ladezustand deterministisch
- **UND** zeigt sie einen regulären Fehlerzustand statt eines dauerhaften "Inhalte werden geladen ..."

### Requirement: Inhalt ist ein erweiterbares Core-Element

Das System MUST `Inhalt` als kanonisches Core-Element modellieren, das über definierte SDK-Erweiterungspunkte für spezielle Datentypen erweitert werden kann, referenzbasierte Mediennutzung unterstützt und IAM-Ownership getrennt von Ersteller, Bearbeiter und sichtbarem Autor hält.

#### Scenario: Core-Inhalt wird mit Basiskern angelegt

- **WENN** ein Inhalt gespeichert oder geladen wird
- **DANN** enthält er mindestens `contentType`, Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Payload, Status, Historie, `ownerUserId` und `ownerOrganizationId`
- **UND** diese Core-Felder bleiben unabhängig vom konkreten Inhaltstyp verfügbar
- **UND** `ownerUserId` und `ownerOrganizationId` steuern IAM-Zugriff, nicht sichtbare Autorenanzeige

#### Scenario: SDK erweitert einen speziellen Inhaltstyp

- **WENN** für einen registrierten `contentType` eine SDK-Erweiterung vorhanden ist
- **DANN** kann diese zusätzliche Validierung, UI-Bereiche, Tabelleninformationen oder Aktionen bereitstellen
- **UND** der Core-Vertrag des Inhalts bleibt unverändert gültig

#### Scenario: Plugin überschreibt den Core-Vertrag nicht

- **WENN** ein Plugin oder SDK-Modul einen speziellen Inhaltstyp registriert
- **DANN** darf es die Bedeutung oder Pflichtigkeit der Core-Felder nicht brechen
- **UND** Statusmodell, Historie und Core-Metadaten bleiben systemweit konsistent

#### Scenario: Inhalte binden Bibliotheksmedien referenzbasiert an

- **WENN** ein Inhalt ein Asset aus der zentralen Medienbibliothek verwendet
- **DANN** speichert Studio eine `MediaReference` mit Asset, fachlicher Rolle, Ziel und Reihenfolge
- **UND** der Plugin-Vertrag erhält keine MinIO-Bucket-Namen, Object-Keys oder presigned URLs
- **UND** ein externer Mainserver-Vertrag darf parallel einen kompatiblen URL-/Metadaten-Snapshot erhalten

#### Scenario: Plugin nutzt hostseitigen Media-Picker

- **WENN** ein Plugin ein Bibliotheksmedium für einen Inhalt oder ein Fachobjekt auswählen lässt
- **DANN** verwendet es den hostseitigen Media-Picker oder dessen SDK-Vertrag
- **UND** das Plugin deklariert erlaubte Medienrollen und Medientypen
- **UND** es erhält keine direkte Storage-Schnittstelle

#### Scenario: Mainserver benötigt weiterhin URL-basierte Medienfelder

- **WENN** die externe Mainserver-GraphQL-API ein Bild über `imageUrl`, `sourceUrl`, `mediaContents` oder ein analoges URL-basiertes Feld erwartet
- **DANN** persistiert der Plugin-Adapter einen kontrollierten Snapshot aus dauerhafter Auslieferungs-URL und unterstützten contentbezogenen Metadaten
- **UND** speichert Studio für eine Bibliotheksverwendung parallel die zugehörige `MediaReference`
- **UND** eine kurzlebige, presigned oder anderweitig nicht dauerhaft geeignete URL wird nicht als Content-Snapshot gespeichert

#### Scenario: Manuelle URL bleibt als eigenständige Mainserver-Verwendung verfügbar

- **WENN** ein Redakteur ein Bild ausschließlich über eine manuelle URL anlegt
- **DANN** speichert der Plugin-Adapter diese URL im bestehenden Mainserver-Fachvertrag
- **UND** erzeugt Studio dafür weder ein `MediaAsset` noch eine `MediaReference`
- **UND** stellt die Oberfläche die manuelle Verwendung nicht als Bibliotheksverknüpfung dar

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

- **WENN** ein berechtigter Benutzer die Tabellenansicht oeffnet
- **DANN** ist ein sichtbarer Button `Neuer Inhalt` vorhanden
- **UND** der Button fuehrt in die Erstellungsansicht fuer einen neuen Inhalt

#### Scenario: Survey ist als neuer Inhalt waehlbar

- **WENN** ein berechtigter Benutzer den Flow `Neuer Inhalt` oeffnet
- **DANN** kann er `Survey` oder `Umfrage` als weiteren Inhaltstyp auswaehlen
- **UND** das System fuehrt danach in die Survey-Erstellungsansicht des Standard-Content-Plugins

#### Scenario: Survey-Editor folgt in Create und Edit demselben Arbeitsrahmen

- **WENN** ein berechtigter Benutzer eine neue Survey anlegt oder eine bestehende Survey bearbeitet
- **DANN** verwendet die Content-Verwaltung fuer beide Faelle denselben Survey-Editor-Rahmen
- **UND** wechseln Create und Edit nicht zwischen unterschiedlichen Hauptnavigationsstrukturen

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

Das System MUST eine Erstellungs- und eine Bearbeitungsansicht für Inhalte bereitstellen und Ownership serverseitig nach IAM-Regeln setzen.

#### Scenario: Inhalt anlegen

- **WENN** ein berechtigter Benutzer einen neuen Inhalt anlegt
- **DANN** kann er mindestens Inhaltstyp, Titel, Veröffentlichungsdatum, Payload und Status erfassen
- **UND** das System setzt Erstellungsdatum, Änderungsdatum, Autor, `ownerUserId` und bei aktiver Organisation `ownerOrganizationId` systemseitig
- **UND** der gespeicherte Inhalt ist nach erfolgreichem Speichern in der Inhaltsliste sichtbar, wenn derselbe Scope auch den Detailzugriff erlauben würde

#### Scenario: Inhalt bearbeiten

- **WENN** ein berechtigter Benutzer einen bestehenden Inhalt bearbeitet
- **DANN** kann er Titel, Veröffentlichungsdatum, Payload, Status und bei ausreichender `update`-Permission Ownership-Felder ändern
- **UND** das Änderungsdatum wird nach erfolgreichem Speichern aktualisiert
- **UND** die Bearbeitungsansicht zeigt die aktuellen Metadaten des Inhalts an
- **UND** ein normales Update ändert den sichtbaren Autor nicht automatisch

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

The host-owned core contract SHALL include at least `contentId`, `contentType`, `instanceId`, optional `organizationId`, optional `ownerUserId`, optional `ownerOrganizationId`, `status`, `validationState`, optional `publishedAt`, optional `publishFrom`, optional `publishUntil`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `author`, `historyRef`, optional `currentRevisionRef`, and optional `lastAuditEventRef`.

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

The News plugin SHALL treat `contentBlocks` as the leading and exclusive News text model. It SHALL model introductions and bodies only as `contentBlocks[].intro` and `contentBlocks[].body`. It SHALL NOT expose `payload.teaser` or `payload.body` as part of the News contract and SHALL NOT derive a virtual content block from legacy payload values. Saves SHALL write `contentBlocks` and SHALL NOT write payload. The editor SHALL label and model the introduction as a content-block introduction.

#### Scenario: Legacy payload-only News is loaded

- **GIVEN** an existing Mainserver News item has no `contentBlocks` but contains legacy `payload.teaser` or `payload.body` data
- **WHEN** the editor loads the item
- **THEN** the editor keeps the content-block list empty
- **AND** the editor does not derive an introduction or body from the legacy payload

#### Scenario: User edits multiple content blocks

- **GIVEN** the user edits multiple content blocks with introductions, bodies, and media URL references
- **WHEN** the item is saved
- **THEN** the host sends the complete `contentBlocks` list as the new Mainserver state
- **AND** individual block IDs are not required because `ContentBlockInput` does not expose IDs
- **AND** the host does not send payload or a root-level teaser field

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

### Requirement: POI-Redaktionsflow trennt Kernpflege und Zusatzdaten

Das System MUST die POI-Pflege so strukturieren, dass Redakteure einen minimalen, fachlich sinnvollen POI zuerst anlegen und ihn danach ohne technische Reibung schrittweise anreichern können.

#### Scenario: Erstnutzer legt einen neuen POI an

- **WENN** ein Redakteur einen neuen POI erstellt
- **DANN** beginnt der Flow mit den Kernbereichen `Basis` und `Ort`
- **UND** der Redakteur muss keine seltenen Spezialfelder aus `Erweiterte Daten` vor dem ersten Speichern ausfüllen
- **UND** das System kann nach der ersten Speicherung auf den nächsten sinnvollen Bereich hinweisen

#### Scenario: Wiederkehrer pflegt einen bestehenden POI nach

- **WENN** ein Redakteur einen bestehenden POI gezielt aktualisieren will
- **DANN** kann er direkt in den relevanten Bereich wie `Öffnungszeiten`, `Links` oder `Preise` springen
- **UND** der Editor zwingt ihn nicht durch einen linearen Assistentenpfad

### Requirement: POI-Ortsdaten nutzen Adresse, Geo-Koordinaten und Karte

Das System MUST für POI-Ortsdaten eine strukturierte Adresspflege mit Geo-Koordinaten und Kartenunterstützung bereitstellen.

#### Scenario: POI-Ort wird visuell verortet

- **WENN** ein Redakteur den Bereich `Ort` bearbeitet
- **DANN** kann er Straße, PLZ, Ort und einen adressbezogenen Zusatz pflegen
- **UND** er sieht eine Karte mit dem Stil `https://tileserver-gl.smart-village.app/styles/osm-bright/`
- **UND** Geo-Koordinaten sind sichtbar und editierbar

#### Scenario: Koordinaten werden über Karteninteraktion gepflegt

- **WENN** ein Redakteur den Kartenmarker verschiebt oder einen Kartenpunkt setzt
- **DANN** synchronisiert das System die zugehörigen `latitude`- und `longitude`-Werte in den Formularfeldern
- **UND** textuelle Koordinaten-Änderungen bleiben ebenfalls möglich

#### Scenario: Adresssuche erzeugt POI-Ortsdaten

- **WENN** ein Redakteur im Bereich `Ort` eine Adresse oder einen Ort sucht
- **DANN** zeigt das System passende Vorschläge an
- **UND** die Auswahl eines Vorschlags kann Adressfelder, Kartenposition und Geo-Koordinaten des POI befüllen

#### Scenario: Eingegebene Adresse wird geokodiert

- **WENN** ein Redakteur Straße, PLZ und Ort manuell eingibt
- **UND** eine Geokodierung auslösen möchte
- **DANN** kann das System daraus einen Geo-Treffer bestimmen
- **UND** Marker und Koordinaten werden aus dem Treffer aktualisiert
- **UND** die Adresse bleibt für den Redakteur weiter prüf- und korrigierbar

#### Scenario: Ortsdaten bleiben ohne direkte Kartenbedienung pflegbar

- **WENN** ein Redakteur die Karteninteraktion nicht nutzen kann oder nicht nutzen möchte
- **DANN** kann er Ortsdaten über Adresssuche, manuelle Adresspflege und Koordinatenfelder vollständig bearbeiten
- **UND** Kartenprobleme blockieren die restliche POI-Bearbeitung nicht

### Requirement: POI-Mehrfachdaten werden als wiederholbare Listen gepflegt

Das System MUST wiederholbare POI-Daten als strukturierte Listen-Editoren statt als Einzelfelder behandeln.

#### Scenario: Mehrere Öffnungszeiten werden gepflegt

- **WENN** ein Redakteur mehrere Öffnungszeiten für einen POI hinterlegt
- **DANN** kann er mehrere strukturierte Einträge mit Wochentag, Zeitfenster, Beschreibung und Offen-Status anlegen
- **UND** das System beschränkt die UI nicht auf den ersten Eintrag

#### Scenario: Mehrere Links, Preise oder Dateien werden gepflegt

- **WENN** ein Redakteur mehrere Links, Preise oder Dateien erfassen muss
- **DANN** bietet das System für jeden dieser Bereiche einen konsistenten Listen-Editor mit `Hinzufügen` und `Entfernen`
- **UND** jeder Eintrag bleibt in seiner eigenen fachlichen Struktur editierbar

### Requirement: Betreiber und allgemeiner POI-Kontakt bleiben getrennt

Das System MUST den allgemeinen POI-Kontakt und den Betreiber als getrennte Redaktionskonzepte behandeln.

#### Scenario: Betreiber weicht vom allgemeinen Kontakt ab

- **WENN** ein POI einen institutionellen Betreiber hat, der nicht identisch mit dem allgemeinen Kontakt ist
- **DANN** kann der Redakteur im Bereich `Betreiber` einen eigenen Namen, Kontakt und eine eigene Adresse pflegen
- **UND** der allgemeine Kontakt im Bereich `Kontakt` bleibt davon unabhängig

#### Scenario: Betreiberdaten sind nicht erforderlich

- **WENN** ein POI keinen abweichenden Betreiber benötigt
- **DANN** bleibt der Bereich `Betreiber` optional
- **UND** das System verlangt keine redundanten Doppeleingaben

### Requirement: Erweiterte POI-Daten bleiben aus dem Hauptflow herausgezogen

Das System MUST technische oder nicht benötigte POI-Zusatzdaten aus der redaktionellen Oberfläche ausblenden. Schlagwörter, Tags, Zertifikate, Accessibility-Daten und freie Payload-Bearbeitung MUST weiterhin im internen Formular- und Mainserver-Mapping erhalten bleiben, dürfen aber nicht redaktionell bearbeitbar sein.

#### Scenario: POI-Einstellungen zeigen nur die technische Kennung

- **WENN** ein Redakteur die Einstellungen eines POI öffnet
- **DANN** zeigt das System die externe ID als technische Metadaten
- **UND** es zeigt keine Schlagwörter, Tags, Zertifikate, Accessibility-Daten oder freie Payload-Bearbeitung

#### Scenario: Bestehende ausgeblendete POI-Daten bleiben erhalten

- **GEGEBEN** ein bestehender POI enthält Schlagwörter, Tags, Zertifikate, Accessibility-Daten oder Payload-Daten
- **WENN** ein Redakteur ein weiterhin sichtbares Feld ändert und den POI speichert
- **DANN** überträgt das System die bestehenden ausgeblendeten Werte unverändert an den Mainserver

### Requirement: Ownership-Transfer autorisiert den aktuellen Inhalt

Das System SHALL Ownership-Transfers als Mutation am aktuellen Inhalt autorisieren. Der Actor benötigt dafür die passende Update-Permission auf den aktuell sichtbaren Inhalt. Der Ziel-Owner SHALL validiert werden, setzt aber keine zusätzliche Berechtigung des Actors auf den Zielbereich voraus.

#### Scenario: Eigener Inhalt wird an anderen Benutzer übertragen

- **GIVEN** ein Benutzer besitzt `content.updateMetadata` mit Scope `own`
- **AND** ein Inhalt gehört diesem Benutzer über `ownerUserId`
- **WHEN** der Benutzer `ownerUserId` auf einen anderen gültigen Benutzer derselben Instanz ändert
- **THEN** erlaubt das System die Mutation ohne zusätzliche Zielbereich-Berechtigung
- **AND** anschließende Lesezugriffe werden anhand der neuen Ownership erneut autorisiert

#### Scenario: Organisationsinhalt wird in andere Organisation übertragen

- **GIVEN** ein Benutzer besitzt die passende Update-Permission auf einen Inhalt im aktuellen Organisationsscope
- **WHEN** der Benutzer `ownerOrganizationId` auf eine andere gültige Organisation ändert
- **THEN** entscheidet die Autorisierung über den aktuellen Inhalt vor der Änderung
- **AND** der Zielwert wird auf Existenz, Instanzzugehörigkeit und zulässigen Owner-Typ validiert

#### Scenario: Ownerloser Inhalt wird ohne globale Berechtigung zugewiesen

- **GIVEN** ein Inhalt besitzt weder `ownerUserId` noch `ownerOrganizationId`
- **AND** ein Benutzer besitzt nur `own`- oder `organization`-Scope
- **WHEN** der Benutzer dem Inhalt einen Owner zuweisen will
- **THEN** verweigert das System die Mutation
- **AND** nur eine passende globale Update-Berechtigung kann ownerlose Inhalte zuweisen

### Requirement: Sichtbare Autorenanzeige ist von Ownership getrennt

Das System SHALL die sichtbare Autorenanzeige eines lokalen Inhalts als fachliche Inhaltsmetadaten modellieren und von technischer IAM-Ownership trennen. Für Mainserver-basierte Inhalte SHALL der bestätigte GraphQL-`dataProvider` den ursprünglichen Inhaber und sichtbaren Autor bestimmen.

Bei lokalen Inhalten SHALL `ownerUserId` und `ownerOrganizationId` ausschließlich Autorisierung und technische Zuständigkeit steuern. Bei Mainserver-Inhalten dürfen diese Felder nur aus einer konfliktfreien automatischen DataProvider-Bindung als rekonstruierbare IAM-Projektion abgeleitet werden. Ein freier `author`-String, aktueller Credential-Kontext, Actor oder lokale History-Metadaten SHALL keinen Mainserver-Inhaber begründen.

#### Scenario: Lokaler Inhalt wird mit Organisationsanzeige angelegt

- **GIVEN** ein Actor legt im aktiven Organisationskontext einen lokalen Inhalt an
- **WHEN** keine abweichende Autorenanzeige gewählt wird
- **THEN** setzt das System technische Ownership aus dem aktiven Kontext
- **AND** setzt die sichtbare Autorenanzeige standardmäßig auf die Organisation, sofern eine Organisation verfügbar ist

#### Scenario: Organisation erzwingt Organisationsanzeige für lokalen Inhalt

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_only'`
- **WHEN** ein Benutzer persönliche Autorenanzeige für einen lokalen Inhalt speichern möchte
- **THEN** weist das System die Änderung mit einem Validierungsfehler ab
- **AND** technische Ownership bleibt unverändert

#### Scenario: Persönliche Anzeige ist für lokalen Inhalt zulässig

- **GIVEN** die aktive Organisation hat `content_author_policy = 'org_or_personal'`
- **AND** der Actor ist für persönliche Anzeige zulässig
- **WHEN** der Actor persönliche Autorenanzeige auswählt
- **THEN** speichert das System den Modus getrennt von `ownerUserId` und `ownerOrganizationId`
- **AND** spätere Ownership-Änderungen ändern die Anzeige nicht stillschweigend

#### Scenario: Mainserver liefert den ursprünglichen Inhaber

- **GIVEN** ein Mainserver-Inhalt besitzt einen DataProvider
- **WHEN** Studio Inhalt oder Listenprojektion anzeigt
- **THEN** verwendet es Namen und Identität dieses DataProviders als ursprünglichen Inhaber und sichtbaren Autor
- **AND** lokale Owner-Projektionen oder ein abweichender `author`-String überschreiben die Anzeige nicht

#### Scenario: Fehlende Principal-Bindung erfindet keinen lokalen Inhaber

- **GIVEN** die aktuelle Credential-Version besitzt keine konfliktfreie Identity-Bindung
- **WHEN** Studio einen Mainserver-Inhalt anzeigt oder autorisiert
- **THEN** zeigt es den Content-DataProvider soweit vorhanden an
- **AND** erfindet keine lokale Owner-Zuordnung
- **AND** lehnt der automatische Resolver eine Scope-Mutation fail-closed ab

### Requirement: Formularweite Speichern-Aktion am Anfang und Ende von Inhaltseditoren

Das System SHALL in tab-basierten Inhaltseditoren die formularweite Speichern- beziehungsweise Anlegen-Aktion sowohl im Seitenkopf als auch direkt unterhalb der Editor-Tabs anbieten. Beide Aktionen SHALL denselben Submit-Pfad, dieselbe Beschriftung sowie dieselben Lade-, Disabled- und Berechtigungszustände verwenden.

#### Scenario: Redaktion speichert am Ende eines langen Editor-Tabs

- **GIVEN** eine berechtigte Person bearbeitet News, Events, FAQs, POIs, Umfragen, generische Inhalte oder einen Kern-Inhalt
- **WHEN** sie die Aktion unterhalb der Tabs auslöst
- **THEN** speichert das System das gesamte Formular über denselben Pfad wie die Aktion im Seitenkopf
- **AND** es wird kein tab-spezifischer Speichervorgang erzeugt

#### Scenario: Speichern bleibt im Historien-Tab erreichbar

- **GIVEN** ein Inhaltseditor besitzt einen schreibgeschützten Historien-Tab
- **WHEN** die Person diesen Tab öffnet
- **THEN** bleiben die formularweiten Speichern-Aktionen im Seitenkopf und unterhalb der Tabs sichtbar
- **AND** zuvor vorgenommene Änderungen aus anderen Tabs können weiterhin gespeichert werden

#### Scenario: Speichern ist nicht erlaubt oder läuft bereits

- **GIVEN** die formularweite Speichern-Aktion ist durch Berechtigungen, Validierungszustand oder einen laufenden Submit deaktiviert
- **WHEN** der Editor beide Aktionspositionen rendert
- **THEN** spiegeln beide Positionen denselben Disabled- und Ladezustand wider

### Requirement: The system SHALL update Mainserver-backed content list projections incrementally after successful single-record mutations

Das System SHALL die fuehrende serverseitige Listenquelle fuer Mainserver-gestuetzte Inhaltstypen nach erfolgreichen Studio-initiierten Einzelmutationen gezielt fuer den betroffenen Datensatz aktualisieren und keinen typweiten Vollrefresh als Standardpfad verwenden.

#### Scenario: Create aktualisiert nur den neuen Datensatz in der Inhaltsliste

- **WENN** ein berechtigter Benutzer einen neuen News-, Event- oder POI-Datensatz erfolgreich ueber Studio im Mainserver anlegt
- **DANN** aktualisiert das System die fuehrende Listenquelle gezielt fuer genau diesen Datensatz
- **UND** der restliche Projektionsbestand desselben Inhaltstyps bleibt unveraendert
- **UND** der neue Datensatz erscheint ohne erzwungenen Vollrefresh des gesamten Inhaltstyps in der Inhaltsliste

#### Scenario: Update aktualisiert nur den geaenderten Datensatz in der Inhaltsliste

- **WENN** ein berechtigter Benutzer einen bestehenden News-, Event- oder POI-Datensatz erfolgreich ueber Studio aendert
- **DANN** aktualisiert das System die fuehrende Listenquelle gezielt fuer genau diesen Datensatz
- **UND** die Listenansicht zeigt die geaenderten Metadaten, ohne alle Datensaetze dieses Typs neu aufzubauen

#### Scenario: Delete entfernt nur den betroffenen Datensatz aus der Inhaltsliste

- **WENN** ein berechtigter Benutzer einen bestehenden News-, Event- oder POI-Datensatz erfolgreich ueber Studio loescht
- **DANN** entfernt das System gezielt genau diesen Datensatz aus der fuehrenden Listenquelle
- **UND** der Loeschvorgang startet keinen typweiten Neuaufbau aller Datensaetze desselben Inhaltstyps

### Requirement: The system SHALL retain periodic full refresh only as reconciliation path for Mainserver-backed content lists

Das System SHALL den periodischen Vollabgleich fuer Mainserver-gestuetzte Inhaltstypen als Reconciliation-Pfad fuer externe Aenderungen, Drift und Fehlerfaelle behalten, aber nicht als Standardreaktion auf jede erfolgreiche Einzelmutation verwenden.

#### Scenario: Externe Mainserver-Aenderung wird weiter ueber Reconciliation sichtbar

- **WENN** ein News-, Event- oder POI-Datensatz ausserhalb von Studio direkt im Mainserver geaendert, angelegt oder geloescht wird
- **DANN** darf das System diese Aenderung weiterhin ueber den periodischen Vollabgleich in die fuehrende Listenquelle uebernehmen
- **UND** der gezielte Mutationspfad muss dafuer nicht alle externen Aenderungen selbst abdecken

#### Scenario: Gezielte Nachsynchronisation scheitert nach erfolgreicher Mutation

- **WENN** eine Studio-Mutation im Mainserver erfolgreich war, aber die gezielte Projektionsaktualisierung den Datensatz nicht deterministisch nachladen oder entfernen kann
- **DANN** bleibt die Mutation fachlich erfolgreich
- **UND** das System protokolliert den Fehler deterministisch
- **UND** der periodische Vollabgleich bleibt fuer die spaetere Reconciliation zustaendig

### Requirement: The system SHALL keep Mainserver-backed list snapshots account-isolated and stale-readable

Das System SHALL die fuehrende Listenquelle fuer Mainserver-gestuetzte Inhaltstypen pro Account und effektivem Scope isoliert persistieren und bei Listenanfragen immer einen vorhandenen Snapshot ausliefern koennen, auch wenn dieser veraltet ist.

#### Scenario: Zwei Accounts derselben Organisation teilen keinen Snapshot

- **WENN** zwei Benutzer derselben Instanz und derselben Organisation unterschiedliche `actorAccountId`-Kontexte haben
- **DANN** teilen sie keine Mainserver-Projektionszeilen oder Sync-Zustaende derselben Inhaltsliste
- **UND** ein bereits geladener Snapshot des einen Accounts wird nicht als Fuehrungsquelle fuer den anderen Account wiederverwendet

#### Scenario: Persistenz-Scope verwendet den account- und organisationsgebundenen Vertrag

- **WENN** das System eine Mainserver-Projektion liest, schreibt, dedupliziert oder loescht
- **DANN** verwendet es konsistent einen Scope-Vertrag aus `instanceId`, `actorAccountId`, `activeOrganizationId` und `contentType`
- **UND** es verwendet fuer diese Operationen keinen `keycloakSubject`-Fallback als persistenten Scope-Ersatz

#### Scenario: Tabelle zeigt veralteten Snapshot waehrend Hintergrund-Refresh

- **WENN** fuer einen Account bereits eine persistierte Mainserver-Projektion existiert
- **UND** im Hintergrund ein Refresh neuerer Daten laeuft oder fehlschlaegt
- **DANN** liefert die Inhaltsliste weiterhin den vorhandenen Snapshot aus
- **UND** die Tabelle bleibt nutzbar, statt auf die Vollstaendigkeit des Refreshs zu warten

### Requirement: The system SHALL refresh newest Mainserver list pages first after login or session activation

Das System SHALL fuer sichtbare Mainserver-Inhaltstypen nach Login oder relevantem Session-Aufbau zuerst die jeweils neuesten Datensaetze in die persistierte Listenquelle laden und erst danach aeltere Daten nachziehen.

#### Scenario: Erste Seiten aller sichtbaren Typen werden zuerst geladen

- **WENN** ein berechtigter Benutzer eine Session mit sichtbaren Mainserver-Inhaltstypen aufbaut
- **DANN** startet das System einen Hintergrund-Refresh fuer alle sichtbaren Mainserver-Typen
- **UND** es laedt fuer jeden Typ zuerst die erste Seite mit den neuesten Datensaetzen
- **UND** es arbeitet im initialen Rollout konservativ sequentiell, um die Last auf Studio und Mainserver zu begrenzen
- **UND** es wartet nicht auf den Vollimport aller aelteren Seiten, bevor erste Ergebnisse in der Liste verfuegbar sind

#### Scenario: Aeltere Seiten folgen erst nach dem ersten Seitenblock

- **WENN** fuer alle sichtbaren Mainserver-Typen die erste Seite erfolgreich geschrieben oder zumindest versucht wurde
- **DANN** darf das System aeltere Seiten derselben Typen progressiv nachladen
- **UND** die Inhaltsliste bleibt waehrenddessen auf dem bereits verfuegbaren Snapshot lesbar

#### Scenario: Hintergrund-Refresh laeuft auch ohne spaeteren Listenaufruf weiter

- **WENN** der Login-nahe Refresh bereits gestartet wurde
- **UND** der Benutzer die Inhaltsliste in dieser Session zunaechst nicht oeffnet
- **DANN** darf der Refresh trotzdem weiterlaufen
- **UND** er setzt sich seitenweise fort, bis das Ende des verfuegbaren Upstream-Bestands erreicht ist

### Requirement: Event-Editor fokussiert redaktionell benötigte Felder

Das System MUST den Event-Editor auf die redaktionell benötigten Felder begrenzen. Die optionale POI-Verknüpfung, Barrierefreiheitsdaten, Schlagwörter und Tags MUST im Event-Editor ausgeblendet sein, ohne die zugehörigen Mainserver-Verträge zu entfernen.

#### Scenario: Event wird ohne unnötige Zusatzfelder bearbeitet

- **WENN** ein Redakteur ein Event erstellt oder bearbeitet
- **DANN** zeigt der Editor keine POI-Verknüpfung, Barrierefreiheitsdaten, Schlagwörter oder Tags
- **UND** der Editor lädt keine POI-Auswahlliste

#### Scenario: Bestehende ausgeblendete Event-Daten bleiben erhalten

- **GEGEBEN** ein bestehendes Event enthält eine POI-Verknüpfung, Barrierefreiheitsdaten, Schlagwörter oder Tags
- **WENN** ein Redakteur ein weiterhin sichtbares Feld ändert und das Event speichert
- **DANN** überträgt das System die bestehenden ausgeblendeten Werte unverändert an den Mainserver

### Requirement: Deutsche Inhaltsbegriffe sind redaktionell verständlich

Das System MUST in sichtbaren deutschen Produkttexten die Begriffe `Nachrichten`, `Veranstaltungen` und `Generische Inhalte` verwenden. Redaktionelle Haupttextfelder MUST als `Überschrift` und kurze einleitende Texte als `Einleitung` bezeichnet werden.

#### Scenario: Redaktion öffnet die Inhaltsverwaltung auf Deutsch

- **WENN** ein Redakteur Navigation, Listen oder Editoren für Nachrichten, Veranstaltungen oder generische Inhalte öffnet
- **DANN** verwendet das System die festgelegten deutschen Inhaltsbegriffe
- **UND** es zeigt für redaktionelle Felder weder `News`, `Events`, `Generic Items`, `Title`, `Headline`, `Titel`, `Teaser` noch `Intro` an

#### Scenario: Technische Verträge bleiben stabil

- **WENN** die sichtbaren deutschen Bezeichnungen geändert werden
- **DANN** bleiben API-Feldnamen, Routen, TypeScript-Symbole und englische Übersetzungen unverändert

### Requirement: Listen- und Detailautorisierung sind deckungsgleich

Das System SHALL für Inhaltslisten, Inhaltsdetails und Inhaltsmutationen dieselben Owner- und Scope-Regeln verwenden.

#### Scenario: Own-Scoped Listeneintrag

- **WENN** ein Benutzer nur `content.read` mit Scope `own` besitzt
- **UND** ein Inhalt `owner_user_id` gleich dem aktuellen Account besitzt
- **DANN** erscheint der Inhalt in der Liste
- **UND** derselbe Benutzer kann die Detailansicht öffnen

#### Scenario: Ownerloser Inhalt

- **WENN** ein Inhalt weder `owner_user_id` noch `owner_organization_id` besitzt
- **UND** ein Benutzer nur `own` oder `organization` Scope besitzt
- **DANN** erscheint der Inhalt nicht in der Liste
- **UND** die Detailansicht wird verweigert

### Requirement: Featured Projects sind eigenständige GenericItem-Fachinhalte

Das System MUST Featured Projects als eigenständigen Content-Type `projects.project` bereitstellen und als GenericItem mit `genericType` gleich `FeaturedProject` speichern. Die fachliche Projektansicht MUST diese Datensätze als `projects.project` darstellen. Der generische Zugriff MUST denselben Mainserver-Datensatz zusätzlich als `generic-items.generic-item` bereitstellen, wenn die handelnde Person über `generic-items.*` verfügt. Der frühere Diskriminator `PROJECT` MUST nicht als Featured Project behandelt werden.

#### Scenario: Featured Project wird angelegt

- **WHEN** ein Benutzer mit `projects.create` ein Featured Project anlegt
- **THEN** zeigt das System ausschließlich die fachlich erlaubten Felder
- **AND** speichert den Datensatz mit `genericType` gleich `FeaturedProject`
- **AND** projiziert ihn als `projects.project`

#### Scenario: Featured Project besitzt zwei autorisierte Repräsentationen

- **GIVEN** ein GenericItem mit `genericType` gleich `FeaturedProject`
- **AND** ein Benutzer besitzt `projects.read` und `generic-items.read`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** erscheint der Datensatz als `projects.project`
- **AND** zusätzlich als `generic-items.generic-item`

#### Scenario: Alter Diskriminator wird nicht übernommen

- **GIVEN** ein GenericItem mit `genericType` gleich `PROJECT`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** behandelt das System es nicht als Featured Project
- **AND** darf es weiterhin als generischen Inhalt darstellen

### Requirement: Featured Projects besitzen einen eigenständigen API-Vertrag

Das System MUST je Featured Project `Id`, `Language`, `Title`, `Description`, `FullText`, `Images`, `Status`, `Published`, `PublishedAt`, `Author`, `Deleted`, `CreatedAt` und `UpdatedAt` bereitstellen. Der host-owned `Status` MUST die führende redaktionelle Information sein; `Published` MUST ein nur lesbares, daraus abgeleitetes Feld sein. `Author` MUST genau eine Organisation oder Person repräsentieren und von technischer Ownership getrennt bleiben. Die Projekte-Collection MUST ausschließlich Featured Projects enthalten und darf kein `Type`-, `Translations`-, `ImageUrl`-, `ImageCaption`- oder `ImageCredits`-Feld ausgeben.

#### Scenario: Vollständiges Featured Project wird gelesen

- **WHEN** ein berechtigter Benutzer ein Featured Project liest
- **THEN** enthält die Antwort genau den fachlichen FeaturedProject-Vertrag
- **AND** enthält sie weder ein Typfeld noch Übersetzungsverknüpfungen oder abgelöste Einzelbildfelder

#### Scenario: Sprachfassungen bleiben unabhängig

- **GIVEN** mehrere Featured Projects verwenden unterschiedliche oder gleiche Werte in `Language`
- **WHEN** eines dieser Projekte geändert oder gelöscht wird
- **THEN** verändert das System keinen anderen Datensatz
- **AND** führt keinen Sprach-Fallback aus

### Requirement: Featured Projects minimieren ihre redaktionellen Pflichtfelder

Das System MUST ausschließlich `Title`, `Status` und genau einen Autor als fachliche Pflichtangaben behandeln. `Language`, `Description` und `FullText` MUST leer gespeichert werden können. Ein vorhandener Wert für `Language` MUST als getrimmter und jederzeit editierbarer Freitext ohne feste Werteliste gespeichert werden. `FullText` MUST Rich Text unterstützen.

#### Scenario: Beliebiges Sprachkürzel wird gespeichert

- **WHEN** ein Benutzer einen freien Wert in `Language` eingibt
- **THEN** speichert das System den getrimmten Wert ohne Wertelisten- oder BCP-47-Prüfung

#### Scenario: Optionale Textfelder bleiben leer

- **WHEN** `Language`, `Description` oder `FullText` leer übermittelt wird
- **THEN** speichert das System das Featured Project ohne Platzhaltertext

#### Scenario: Titel fehlt

- **WHEN** `Title` leer übermittelt wird
- **THEN** weist das System die Speicherung feldbezogen ab
- **AND** führt keine Mainserver-Mutation aus

### Requirement: Featured Projects bilden den host-owned Lifecycle abwärtskompatibel auf GenericItem ab

Das System MUST den host-owned Lifecycle-Status eines Featured Projects für den unveränderten Mainserver-Transport als `payload.status` mit `draft`, `published` oder `archived` spiegeln. Der Payload-Wert darf den host-owned Core-Status nicht ersetzen oder abweichend definieren. Der Adapter MUST `visible` deterministisch auf `true` nur für `published` sowie auf `false` für `draft` und `archived` abbilden. Bei `published` MUST der Host konsistente Veröffentlichungsmetadaten einschließlich `PublishedAt` verwalten. Dieser Change MUST die Abbildung ausschließlich für Featured Projects aktivieren.

#### Scenario: Neues Projekt beginnt als Entwurf

- **WHEN** ein Featured Project ohne bestehenden Status angelegt wird
- **THEN** setzt das System `payload.status` auf `draft`
- **AND** setzt es `visible` auf `false`
- **AND** gibt es `Published` als `false` aus

#### Scenario: Projekt wird veröffentlicht

- **WHEN** ein Benutzer den Projektstatus auf `published` setzt
- **THEN** speichert das System `payload.status` als `published`
- **AND** setzt es `visible` auf `true`
- **AND** gibt es `Published` als `true` aus
- **AND** setzt oder erhält einen konsistenten `PublishedAt`-Wert

#### Scenario: Projekt wird archiviert

- **WHEN** ein Benutzer den Projektstatus auf `archived` setzt
- **THEN** speichert das System `payload.status` als `archived`
- **AND** setzt es `visible` auf `false`
- **AND** gibt es `Published` als `false` aus

#### Scenario: Bestehender GenericItem-Fachtyp besitzt keinen Payload-Status

- **GIVEN** ein bestehender GenericItem-, FAQ- oder Kacheldatensatz besitzt kein `payload.status`
- **WHEN** der Host seinen redaktionellen Status darstellt
- **THEN** leitet er ihn weiterhin als Entwurf oder veröffentlicht aus `visible` ab
- **AND** migriert oder verändert diesen Datensatz nicht automatisch

#### Scenario: Mutation enthält das abgeleitete Feld Published

- **WHEN** ein Client `Published` als Mutationseingabe übermittelt
- **THEN** weist das System das nicht beschreibbare Feld zurück
- **AND** führt keine Mainserver-Mutation aus

### Requirement: Featured Projects verwenden den host-owned Autorenvertrag

Das System MUST für jedes Featured Project genau einen ursprünglichen Inhaber und sichtbaren Autor als Organisation oder Person führen. Der bestätigte Mainserver-`dataProvider` MUST diese Identität bestimmen. Die aktive Organisationsrichtlinie MUST den Create-Principal serverseitig begrenzen; bei Bestandsmutationen MUST die konfliktfreie Ownership-Bindung den Principal bestimmen. Der Mainserver-Wert `author` und lokale Projects-Autorenmetadaten dürfen weder DataProvider-Identität noch automatische Principal-Bindung ersetzen.

#### Scenario: Organisation erstellt ein Featured Project

- **GIVEN** die aktive Autorenrichtlinie verlangt oder erlaubt organisatorisches Handeln
- **WHEN** ein Projekt mit `actingPrincipalType = organization` angelegt wird
- **THEN** verwendet der Server die Credentials der aktiven Organisation
- **AND** übernimmt den bestätigten Organisations-DataProvider als ursprünglichen Inhaber
- **AND** bestätigt ausschließlich die vor dem Create verifizierte Organisationsbindung

#### Scenario: Persönlicher Create ist nicht zulässig

- **GIVEN** die aktive Autorenrichtlinie erlaubt ausschließlich organisatorisches Handeln
- **WHEN** ein Benutzer `actingPrincipalType = user` übermittelt
- **THEN** weist der Server die Mutation vor der Mainserver-Persistenz ab

#### Scenario: Project-Update ändert weder Inhaber noch Mapping

- **GIVEN** ein Featured Project besitzt einen bestätigten DataProvider
- **WHEN** ein berechtigter Benutzer das Projekt mit einem zulässigen Mutationsprincipal bearbeitet
- **THEN** bleibt der bestehende DataProvider der ursprüngliche Inhaber
- **AND** erzeugt das Update kein Mapping des Mutationsprincipal
- **AND** lokale Projects-Autorenmetadaten werden weder als Inhaber geprüft noch neu geschrieben

### Requirement: Featured Projects besitzen eine geordnete optionale Bildergalerie

Das System MUST null oder mehr Bilder in einer stabilen Reihenfolge verwalten. Jedes Bild MUST `Url`, `AltText` und `Position` besitzen; `Caption` und `Credits` sind optional. Das erste Bild MUST als Titel- und Vorschaubild gelten.

#### Scenario: Mehrere Bilder werden sortiert

- **WHEN** ein Benutzer mehrere gültige Bilder speichert oder umsortiert
- **THEN** persistiert das System sie in der gewählten Reihenfolge
- **AND** gibt lückenlose Positionen entsprechend dieser Reihenfolge zurück
- **AND** verwendet das Bild an erster Position als Titel- und Vorschaubild

#### Scenario: Bildmetadaten sind unvollständig

- **WHEN** ein vorhandenes Bild keine URL oder keinen Alternativtext besitzt
- **THEN** weist das System die Speicherung feldbezogen ab
- **AND** verändert keinen bestehenden Datensatz

### Requirement: Verborgene GenericItem-Felder bleiben erhalten

Das System MUST alle nicht im FeaturedProject-Modell sichtbaren GenericItem-Felder bei Aktualisierungen über den Studio-Schreibpfad auf Basis des unmittelbar zuvor gelesenen Datensatzes erhalten. Das Ausblenden eines Feldes darf seinen vorhandenen Wert weder löschen noch zurücksetzen. Der Vertrag MUST keine konfliktfreie Zusammenführung paralleler externer Änderungen versprechen, solange der Mainserver keine Revision oder vergleichbare Vorbedingung unterstützt.

#### Scenario: Projekt mit verborgenen Bestandsdaten wird aktualisiert

- **GIVEN** ein Projekt besitzt Werte in einem nicht sichtbaren GenericItem-Feld oder unbekannte Payload-Schlüssel
- **WHEN** ein Benutzer ein sichtbares Projektfeld ändert
- **THEN** speichert das System die Änderung
- **AND** erhält alle nicht kontrollierten Bestandswerte unverändert

### Requirement: Featured Projects werden intern weich gelöscht

Das System MUST `Deleted` im Studio-Vertrag systemverwaltet führen. Eine autorisierte Studio-Löschaktion MUST den Datensatz über `payload.deleted` als gelöscht markieren und aus aktiven Studio-Listen sowie -Projektionen entfernen, ohne `Deleted` als editierbares Formularfeld anzubieten. Diese Anforderung darf keine globale Löschgarantie für externe Mainserver-Clients behaupten.

#### Scenario: Featured Project wird gelöscht

- **WHEN** ein Benutzer mit `projects.delete` ein aktives Featured Project löscht
- **THEN** markiert das System den Datensatz intern als gelöscht
- **AND** entfernt ihn aus der aktiven Projekte-Collection und Inhaltsprojektion

#### Scenario: Fremdtyp wird über Projekte-Endpunkt gelöscht

- **WHEN** eine ID eines anderen GenericItem-Typs an den Projekte-Löschpfad übermittelt wird
- **THEN** behandelt das System die ID wie eine unbekannte Projekt-ID
- **AND** führt keine Mutation aus

### Requirement: Mainserver-Schreibaktionen behandeln Inhaber und Mutationsprincipal getrennt

Das System SHALL bei der Erstellung eines Mainserver-basierten Contents den serverseitig validierten `actingPrincipalType` als Quelle der OAuth-Credentials verwenden und den daraus vom Mainserver gesetzten `dataProvider` als unveränderlichen ursprünglichen Inhaber übernehmen. Vor dem Create SHALL der Identity-Endpunkt die aktuelle Credential-Version binden; der bestätigte Create-DataProvider SHALL diese Bindung anschließend konsistent bestätigen.

Jede Studio-initiierte Schreibaktion zum Erstellen, Aktualisieren, Veröffentlichen, Archivieren, Wiederherstellen oder Löschen SHALL einen expliziten Principal-Typ verwenden. Beim Create SHALL `contentAuthorPolicy` die zulässige Eigentümerwahl begrenzen. Bei bestehenden eigenen oder organisatorischen Inhalten SHALL die konfliktfreie DataProvider-Bindung zusammen mit der Ressourcen-Capability den Principal und die Credential-Quelle bestimmen; die Oberfläche SHALL keinen freien Principal-Wechsel anbieten. Keine Aktion SHALL ein neues Principal-Mapping aus einem Content-Read begründen oder den bestehenden DataProvider ändern beziehungsweise als geändert darstellen.

#### Scenario: Organisation erstellt einen Inhalt mit vorab verifizierter Bindung

- **GIVEN** die aktive Organisation erlaubt organisatorisches Handeln und besitzt Mainserver-Credentials
- **AND** der Identity-Endpunkt hat die aktuelle Credential-Version konfliktfrei gebunden
- **WHEN** ein Benutzer einen Inhalt mit `actingPrincipalType = organization` erstellt
- **THEN** führt der Server den Create ausschließlich mit deren Credentials aus
- **AND** liest er den bestätigten DataProvider aus Response oder Same-Credential-Re-Read
- **AND** bestätigt er damit ausschließlich die bereits verifizierte credential-versionierte Organisationsbindung

#### Scenario: Person erstellt einen Inhalt mit vorab verifizierter Bindung

- **GIVEN** persönliches Handeln ist zulässig
- **AND** der Identity-Endpunkt hat die aktuelle persönliche Credential-Version konfliktfrei gebunden
- **WHEN** ein Benutzer einen Inhalt mit `actingPrincipalType = user` erstellt
- **THEN** führt der Server den Create ausschließlich mit den persönlichen Credentials aus
- **AND** bestätigt der Content-DataProvider ausschließlich die bereits verifizierte Bindung

#### Scenario: Create kollidiert mit bestehender Bindung

- **GIVEN** die aktuelle Credential-Version ist bereits einem anderen DataProvider zugeordnet
- **WHEN** ein erfolgreicher Create einen abweichenden DataProvider bestätigt
- **THEN** überschreibt Studio die Bindung nicht
- **AND** markiert Mapping und lokale Folgearbeit als `reconciliation_required`
- **AND** stellt den bestätigten Provider-Erfolg nicht als zurückgerollt dar

#### Scenario: Bearbeitung verwendet den gebundenen Ownership-Principal

- **GIVEN** ein bestehender Inhalt besitzt einen DataProvider
- **AND** dessen konfliktfreie Bindung weist auf den persönlichen Principal des Actors oder die aktive Organisation
- **AND** Permission und Ressourcen-Capability erlauben die Bearbeitung
- **WHEN** ein Benutzer die Mutation ausführt
- **THEN** verwendet das System den gebundenen Ownership-Principal für Same-Credential-Pre-Read und Write
- **AND** zeigt weiterhin den bestehenden DataProvider als ursprünglichen Inhaber
- **AND** bietet keinen freien Wechsel zum anderen Principal an

#### Scenario: Persönliches Eigentum bleibt dauerhaft persönlich

- **GIVEN** ein Inhalt wurde zulässig mit `actingPrincipalType = user` erstellt
- **WHEN** die aktive Organisation, deren Autorenrichtlinie oder die Mitgliedschaft des Actors später wechselt
- **THEN** bleibt der bestätigte persönliche DataProvider ursprünglicher Inhaber
- **AND** überträgt Studio den Inhalt nicht auf eine Organisation

#### Scenario: Organisationseigentum bleibt dauerhaft organisatorisch

- **GIVEN** ein Inhalt wurde zulässig mit `actingPrincipalType = organization` erstellt
- **WHEN** der ursprüngliche Actor die Organisation verlässt oder sein Account gesperrt wird
- **THEN** bleibt der bestätigte Organisations-DataProvider ursprünglicher Inhaber
- **AND** können andere berechtigte Mitglieder der Organisation den Inhalt weiter verwalten

#### Scenario: Jede Schreibaktion übermittelt den Principal explizit

- **GIVEN** ein Benutzer löst Erstellen, Aktualisieren, Veröffentlichen, Archivieren, Wiederherstellen oder Löschen aus
- **WHEN** der Server die jeweilige Mainserver-Mutation vorbereitet
- **THEN** liegt `actingPrincipalType` explizit als `organization` oder `user` vor
- **AND** eine fehlende oder ungültige Auswahl wird vor dem Mainserver-Aufruf abgewiesen

#### Scenario: Freie Principal- oder Autorenangabe ist unzulässig

- **WHEN** ein Client statt eines erlaubten `actingPrincipalType` einen Namen, Credentials, eine DataProvider-ID, eine Account-ID oder eine Organisations-ID übermittelt
- **THEN** verwendet der Server diese Werte nicht zur Principal-, Mapping- oder Credential-Auswahl
- **AND** lehnt einen ungültigen Transportvertrag vor dem Mainserver-Aufruf ab

### Requirement: Mainserver-Inhalte bleiben bis zur automatischen Bindung credential-sichtbar bearbeitbar

Das System SHALL für `own` und `organization` `credential_visible_compatibility` ausschließlich verwenden, wenn der Resolver explizit im beobachtenden `shadow`- oder im Rollbackmodus `compatibility` läuft. Im automatischen Zielmodus SHALL eine fehlende oder konfliktbehaftete erforderliche Principal-Bindung die Mutation fail-closed ablehnen.

#### Scenario: Shadow-Modus wertet credential-sichtbaren fremden Provider aus

- **GIVEN** der Resolver läuft explizit im Shadow-Modus
- **AND** der Benutzer besitzt die passende Update-Permission
- **AND** der Mainserver liefert den Inhalt mit dem ausgewählten Credential
- **WHEN** Studio das Update ausführt
- **THEN** schränkt es die Aktion nicht anhand eines vermuteten DataProvider-Mappings ein
- **AND** verwendet es denselben Credential-Kontext für Pre-Read und Write

#### Scenario: Credential-sichtbarer Inhalt wird hart gelöscht

- **GIVEN** der relevante Scope verwendet `credential_visible_compatibility`
- **AND** der Benutzer besitzt die passende Delete-Permission
- **AND** der Same-Credential-Pre-Read ist erfolgreich
- **WHEN** der Mainserver den Hard Delete erlaubt
- **THEN** darf Studio den Inhalt löschen
- **AND** persistiert es DataProvider und weitere Audit-Metadaten aus dem Preimage
- **AND** verlangt keinen Post-Delete-Read

#### Scenario: Fehlende Delete-Permission blockiert Hard Delete

- **GIVEN** ein Inhalt ist mit dem ausgewählten Credential verfügbar
- **AND** der Benutzer besitzt keine Delete-Permission
- **WHEN** er Hard Delete anfordert
- **THEN** lehnt Studio die Aktion vor dem Mainserver-Aufruf ab
- **AND** leitet aus Update- oder Read-Rechten kein Löschrecht ab

#### Scenario: Abweichender Principal ersetzt den Ownership-Principal nicht

- **GIVEN** ein Inhalt ist konfliktfrei an den DataProvider der aktiven Organisation gebunden
- **WHEN** ein Client für die Mutation `actingPrincipalType = user` übermittelt
- **THEN** weist Studio den abweichenden Principal vor dem Write zurück
- **AND** autorisiert weder die Organisationsprojektion noch eine persönliche Read-Sicht diese Mutation

### Requirement: Freies GraphQL-author bleibt nicht autoritative Legacy-Metadatum

Das System SHALL bestehende freie GraphQL-`author`-Werte bei Updates serverseitig unverändert erhalten, SHALL sie nicht mehr als redaktionell bearbeitbares Feld anbieten und SHALL sie bei neuen Mainserver-Inhalten nicht setzen. Der Wert SHALL weder Inhaber, sichtbaren kanonischen Autor, Mutationsprincipal, Principal-Bindung, Credential-Quelle, Audit noch IAM-Autorisierung bestimmen.

#### Scenario: Update erhält einen bestehenden Legacy-author

- **GIVEN** ein bestehender News- oder Generic-Item-Inhalt enthält einen freien GraphQL-`author`-Wert
- **WHEN** der Inhalt im Studio aktualisiert wird
- **THEN** liest und erhält der serverseitige Adapter den vorhandenen Wert innerhalb des bestätigten Read-/Write-Vertrags
- **AND** die Oberfläche bietet ihn nicht als bearbeitbare Autorenidentität an

#### Scenario: Neuer Inhalt setzt keinen freien author

- **WHEN** das Studio einen neuen Mainserver-Inhalt erstellt
- **THEN** setzt es keinen freien GraphQL-`author`-Wert
- **AND** verwendet es den bestätigten DataProvider als ursprünglichen Inhaber und sichtbaren Autor

### Requirement: Cockpit Cards sind eigenständige GenericItem-Fachinhalte

Das System MUST Cockpit Cards als eigenständigen Content-Type `cockpit-cards.cockpit-card` bereitstellen und als GenericItem mit `genericType` gleich `COCKPIT_CARD` speichern. Die gemeinsame Inhaltsübersicht MUST Cockpit Cards ausschließlich als diesen Fachtyp darstellen.

#### Scenario: Cockpit Card wird angelegt

- **WHEN** ein Benutzer mit `cockpit-cards.create` eine Cockpit Card anlegt
- **THEN** zeigt das System ausschließlich die fachlich erlaubten Felder
- **AND** speichert den Datensatz mit `genericType` gleich `COCKPIT_CARD`
- **AND** projiziert ihn als `cockpit-cards.cockpit-card`

#### Scenario: Cockpit Card erscheint nicht doppelt

- **GIVEN** ein GenericItem mit `genericType` gleich `COCKPIT_CARD`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** erscheint es als `cockpit-cards.cockpit-card`
- **AND** nicht zusätzlich als `generic-items.generic-item`

### Requirement: Cockpit Cards besitzen ein begrenztes Fachmodell

Das System MUST Überschrift, optionalen Nur-Text, optionalen Sprachcode, genau eine bestehende Kategorie, null oder mehr Bilder, höchstens einen HTTPS-Link mit optionalem Linktext und Öffnungsverhalten, Sortiergewicht, Sichtbarkeit und Veröffentlichungszeitpunkt bearbeiten. Ausschließlich Überschrift und Kategorie MUST fachliche Pflichtfelder sein. Andere GenericItem-Bereiche und technische Herkunftsfelder MUST verborgen bleiben.

#### Scenario: Cockpit Card mit optionalen Inhalten wird gespeichert

- **WHEN** ein Benutzer Überschrift und Kategorie sowie optional Text, Sprache, gültige Bilder und einen HTTPS-Link speichert
- **THEN** persistiert das System Überschrift in `title`, Kategorie in `categories`, vorhandenen Text als alleinigen Content-Block, Bilder in `mediaContents`, den Link in `webUrls[0].url`, den Linktext in `webUrls[0].description` und das Öffnungsverhalten in `payload.openInNewTab`
- **AND** erhält es `externalId`, unbekannte bestehende Payload-Schlüssel und unterstützte Medienmetadaten

#### Scenario: Öffnungsverhalten ohne Link wird normalisiert

- **WHEN** ein Benutzer keinen Link speichert
- **THEN** speichert das System keine `webUrls`
- **AND** normalisiert `payload.openInNewTab` auf `false`

#### Scenario: Ungültige Kardinalität wird abgewiesen

- **WHEN** keine oder mehrere Kategorien oder mehrere Links übermittelt werden
- **THEN** weist das System die Speicherung feldbezogen ab
- **AND** verändert keinen bestehenden Datensatz

#### Scenario: Optionale Inhalte bleiben leer

- **WHEN** weder Text noch Sprache noch Bilder übermittelt werden
- **THEN** speichert das System die Cockpit Card ohne Content-Block und ohne Medien
- **AND** überlässt die sprachliche Standardabbildung dem konsumierenden Frontend

#### Scenario: Fachfremde Inhalte werden abgewiesen

- **WHEN** HTML-Text, Nicht-Bild-Medien, ein Nicht-HTTPS-Link, Kontakte oder Orte übermittelt werden
- **THEN** weist das System die Speicherung ab
- **AND** führt keine Mainserver-Mutation aus

### Requirement: Text und Bilder teilen den Inhalts-Tab

Das System MUST für gespeicherte Kacheln die Tabs `Basis`, `Inhalt`, `Einstellungen` und `Historie` anbieten. `Basis` MUST Überschrift, Sprachcode und Kategorie enthalten. `Inhalt` MUST Text und Bilder gemeinsam enthalten. `Einstellungen` MUST Link, Linktext, Öffnungsverhalten und Publikationsmetadaten enthalten.

#### Scenario: Inhalt wird gemeinsam bearbeitet

- **WHEN** ein Benutzer den Tab `Inhalt` öffnet
- **THEN** kann er dort den Text bearbeiten
- **AND** Bilder auswählen, hochladen, sortieren und entfernen
- **AND** den Alternativtext in Vorschaukarten und als einziges Medienmetadatum im gemeinsamen Medienauswahldialog bearbeiten
- **AND** gibt es keinen separaten Medien-Tab

#### Scenario: Neue Cockpit Card besitzt noch keine Historie

- **WHEN** ein Benutzer eine Cockpit Card anlegt
- **THEN** zeigt das System `Basis`, `Inhalt` und `Einstellungen`
- **AND** keinen Historie-Tab vor dem ersten Speichern

### Requirement: Die gemeinsame Inhaltsübersicht bietet kanonische Typ-Schnellfilter

Das System MUST häufig verwendete Inhaltstypen in der gemeinsamen Inhaltsübersicht direkt filterbar machen, ohne eine zweite Listenquelle oder typspezifische Paralleltabelle einzuführen.

#### Scenario: Redaktion filtert schnell nach Nachrichten

- **WENN** ein Benutzer Nachrichten lesen darf und den Schnellfilter `Nachrichten` auswählt
- **DANN** navigiert die gemeinsame Inhaltsübersicht auf `/admin/content` mit dem registrierten Nachrichten-`contentType` als `type`-Search-Parameter
- **UND** die führende serverseitige Listenquelle filtert den Gesamtbestand vor Pagination nach diesem Typ
- **UND** die aktuelle Seite wird auf `1` zurückgesetzt
- **UND** Statusfilter, Sortierung und Seitengröße bleiben erhalten

#### Scenario: Redaktion filtert schnell nach Veranstaltungen

- **WENN** ein Benutzer Veranstaltungen lesen darf und den Schnellfilter `Veranstaltungen` auswählt
- **DANN** verwendet die gemeinsame Inhaltsübersicht denselben kanonischen `type`-Search-Parameter und dieselbe führende serverseitige Listenquelle
- **UND** es wird keine separate Veranstaltungs-Liste geladen

#### Scenario: Redaktion kehrt zu allen Inhalten zurück

- **WENN** ein Benutzer den Schnellfilter `Alle` auswählt
- **DANN** entfernt die Inhaltsübersicht den expliziten Typfilter aus der kanonischen URL
- **UND** zeigt sie alle im aktuellen Kontext lesbaren Inhaltstypen

#### Scenario: Weitere Inhaltstypen bleiben im Dropdown erreichbar

- **WENN** ein Benutzer weitere lesbare Inhaltstypen wie POI, Umfragen, Generische Inhalte, FAQ, Kacheln oder Projekte besitzt
- **DANN** bietet das Typ-Dropdown diese Typen an
- **UND** enthält das Dropdown Nachrichten und Veranstaltungen nicht zusätzlich zu deren Schnellfiltern
- **UND** ein Wechsel auf einen weiteren Typ setzt die Seite auf `1` zurück und erhält Statusfilter, Sortierung und Seitengröße

#### Scenario: Nicht lesbarer Schnellfilter bleibt verborgen

- **WENN** dem Benutzer die typbezogene Read-Action für Nachrichten oder Veranstaltungen fehlt
- **DANN** zeigt die Inhaltsübersicht den entsprechenden Schnellfilter nicht an
- **UND** ein gespeicherter oder manuell gesetzter Typfilter erweitert die serverseitigen Leserechte nicht

### Requirement: News-Editor unterstützt Push-Ziele nach Abholort

Der News-Editor MUST berechtigten Redakteuren erlauben, Ziel-Abholorte unabhängig von der öffentlichen Sichtbarkeit einer Nachricht zu verwalten.

#### Scenario: Redaktion wählt gezielte Empfänger

- **WHEN** die Redaktion aktive Abholorte im Zielgruppen-Overlay auswählt und die Auswahl übernimmt
- **THEN** zeigt der Zielgruppenbereich den deduplizierten gezielten Modus und die ausgewählten Adressen
- **AND** gehen vorherige Auswahlen durch Filtern oder Seitenwechsel nicht verloren

#### Scenario: Redaktion schränkt eine vorgemerkte Auswahl ein

- **GIVEN** die Redaktion hat mehrere Filtertreffer vorgemerkt
- **WHEN** sie den Filter weiter einschränkt
- **THEN** zeigt und zählt der Editor nur die Schnittmenge aus vorgemerkter Auswahl und aktuellen Treffern
- **AND** erscheinen die zuvor vorgemerkten Treffer beim erneuten Erweitern des Filters wieder als ausgewählt
- **AND** entfernt ein manuelles Abwählen den Treffer dauerhaft aus der vorgemerkten Auswahl

#### Scenario: Redaktion übernimmt eine gefilterte Auswahl

- **GIVEN** ein Filter blendet einen Teil der vorgemerkten gültigen Ziele aus
- **WHEN** die Redaktion die Auswahl übernimmt
- **THEN** ersetzt nur die wirksame Schnittmenge die bisherigen gültigen Zielschlüssel
- **AND** bleiben vorhandene nicht auflösbare Zielschlüssel erhalten, bis die Redaktion sie ausdrücklich entfernt

#### Scenario: Vorhandenes Ziel kann nicht aufgelöst werden

- **WHEN** ein vorhandener Abholortschlüssel nicht mehr anhand der aktuellen Waste-Stammdaten aufgelöst werden kann
- **THEN** erhält der Editor den Schlüssel und kennzeichnet ihn als veraltet, bis die Redaktion ihn ausdrücklich entfernt

#### Scenario: Waste-Daten sind nicht verfügbar

- **WHEN** der Redaktion der Zugriff auf Waste-Stammdaten fehlt
- **THEN** wird der Zielgruppenbereich ausgeblendet
- **AND** bleiben vorhandene Zielschlüssel beim Speichern anderer Nachrichtenfelder erhalten

#### Scenario: Waste-Daten können nicht geladen werden

- **WHEN** eine berechtigte Redaktion die Zielauswahl öffnet und die Waste-Stammdaten nicht geladen werden können
- **THEN** bleibt der Zielgruppenbereich sichtbar und zeigt einen verständlichen Fehlerzustand
- **AND** kann die Redaktion den Ladevorgang erneut auslösen
- **AND** bleiben vorhandene Zielschlüssel unverändert

#### Scenario: Push wurde bereits zugestellt

- **WHEN** eine Nachricht einen bestätigten Zustellzeitpunkt besitzt
- **THEN** zeigt der Zielgruppenbereich die gespeicherten Empfänger schreibgeschützt
- **AND** kann die Redaktion Ziele weder hinzufügen noch entfernen

#### Scenario: Filterergebnis ändert sich

- **WHEN** Suche, Hierarchiefilter oder Seite im Zielauswahldialog geändert werden
- **THEN** kündigt der Editor die aktualisierte Treffer- und Seiteninformation über eine Live-Region an

### Requirement: Globaler Nachrichten-Push erfordert ausdrückliche Bestätigung

Der News-Editor MUST eine ausdrückliche Bestätigung verlangen, wenn der aktuelle Speichervorgang eine Push-Benachrichtigung ohne Abholortziele auslöst.

#### Scenario: Redaktion bestätigt globalen Push

- **WHEN** Push aktiviert ist, kein Ziel ausgewählt wurde und die Redaktion einen Speichervorgang ausführt, der die Push-Zustellung auslöst
- **THEN** fragt das Studio vor dem Senden der Mutation nach einer Bestätigung
- **AND** weist die Bestätigung bei verfügbarer Zielgruppenauswahl darauf hin, dass keine Abholorte ausgewählt sind
- **AND** suggeriert die Bestätigung keine auswählbare Zielliste, wenn der Redaktion der Waste-Zugriff fehlt
- **AND** weist die Bestätigung bei einem Ladefehler auf nicht verfügbare Abholortdaten hin

### Requirement: Generische Inhalte bilden alle Mainserver-GenericItems ab

Das System MUST im Generic-Items-Modul alle Mainserver-Datensätze vom Typ `GenericItem` unabhängig von ihrem `genericType` anzeigen und über den generischen Editor bearbeitbar machen. Dies MUST bekannte Fachtypen wie `FeaturedProject`, `FAQ` und `COCKPIT_CARD` sowie unbekannte oder zukünftige Diskriminatoren einschließen.

#### Scenario: Fachlich spezialisierter Datensatz wird generisch geöffnet

- **GIVEN** ein Mainserver-GenericItem besitzt `genericType` gleich `FAQ`, `COCKPIT_CARD` oder `FeaturedProject`
- **AND** der Benutzer besitzt die erforderliche `generic-items.read`-Berechtigung
- **WHEN** er das Generic-Items-Modul öffnet
- **THEN** erscheint der Datensatz in der generischen Liste
- **AND** lässt sich über die generische Detailansicht öffnen

#### Scenario: Unbekannter Diskriminator bleibt generisch nutzbar

- **GIVEN** ein Mainserver-GenericItem besitzt einen dem Studio unbekannten `genericType`
- **WHEN** ein berechtigter Benutzer es generisch liest oder bearbeitet
- **THEN** filtert das System den Datensatz nicht aufgrund seines Diskriminators aus
- **AND** erhält es nicht bearbeitete GenericItem-Felder und unbekannte Payload-Schlüssel

#### Scenario: Generischer und fachlicher Zugriff bestehen gleichzeitig

- **GIVEN** ein Benutzer besitzt sowohl generische als auch passende fachliche Leserechte
- **WHEN** die gemeinsame Inhaltsübersicht die autorisierten Projektionen lädt
- **THEN** darf derselbe Mainserver-Datensatz als generischer und als fachlicher Inhalt erscheinen
- **AND** bleiben beide Repräsentationen anhand ihres Content-Types unterscheidbar

### Requirement: News Content Is Optional

Das System MUST Nachrichten ohne redaktionellen Inhalt speichern können. `contentBlocks` MUST fehlen, `null`, leer oder ohne sichtbaren Body-Text sein dürfen. Wenn Inhaltsblöcke übermittelt werden, MUST das System deren Struktur, Medien-URLs und Längengrenzen weiterhin validieren.

#### Scenario: Nachricht ohne Inhaltsblöcke wird gespeichert

- **WENN** ein berechtigter Benutzer eine ansonsten gültige Nachricht ohne `contentBlocks` speichert
- **DANN** akzeptiert die serverseitige News-Route die Nachricht
- **UND** sendet keinen synthetischen Inhalt an den Mainserver

#### Scenario: Nachricht mit leerem Inhalt wird gespeichert

- **WENN** ein berechtigter Benutzer eine ansonsten gültige Nachricht mit `contentBlocks: []` oder einem Inhaltsblock ohne sichtbaren Body-Text speichert
- **DANN** akzeptiert die serverseitige News-Route die Nachricht
- **UND** erhält die ausdrücklich übermittelte Inhaltsstruktur

#### Scenario: Übermittelter Nachrichteninhalt bleibt geschützt

- **WENN** eine Nachricht fehlerhaft strukturierte Inhaltsblöcke, unsichere Medien-URLs oder einen Body oberhalb der Längengrenze enthält
- **DANN** lehnt die serverseitige News-Route die Nachricht vor dem GraphQL-Aufruf ab

### Requirement: Lokale Content-Bilder bleiben bis zum Speichern ein Browser-Entwurf

Das System MUST eine im Content-Editor lokal ausgewählte Bilddatei bis zum ausgelösten Content-Speichern ausschließlich als transienten Browser-Entwurf behandeln. Der Entwurf MUST Vorschau und contentbezogene Metadaten ermöglichen, darf aber weder ein `MediaAsset`, eine `MediaReference` noch einen persistierbaren Medienwert erzeugen.

#### Scenario: Lokale Datei wird als Vorschau ausgewählt

- **WENN** ein berechtigter Redakteur in einem unterstützten Content-Editor eine gültige lokale Bilddatei auswählt
- **DANN** zeigt der gemeinsame Bildblock unmittelbar eine lokale Vorschau
- **UND** hält er Datei, Vorschau und noch nicht gespeicherte Metadaten ausschließlich im Browser-Entwurf
- **UND** ruft die Auswahl keinen Media-Upload-, Asset-Create- oder Reference-Endpunkt auf
- **UND** kennzeichnet die Oberfläche das Bild barrierefrei als noch nicht gespeichert

#### Scenario: Lokale Auswahl wird vor dem Speichern verworfen

- **WENN** der Redakteur die lokale Bildverwendung entfernt, den Dialog abbricht oder die Seite ohne Speichern verlässt
- **DANN** gibt das System die lokale Vorschau und Dateireferenz frei
- **UND** entsteht weder ein Medienobjekt in der Mediathek noch eine Content-Verwendung oder `MediaReference`

#### Scenario: Content-Validierung schlägt vor dem Upload fehl

- **WENN** ein Content mit lokaler Bildverwendung die clientseitige Formularvalidierung nicht besteht
- **DANN** startet das System keinen Upload und keine Content-Media-Save-Operation
- **UND** bleibt der lokale Entwurf für die Korrektur erhalten

#### Scenario: Bereits vorhandenes Bibliotheksasset wird ausgewählt

- **WENN** der Redakteur statt einer lokalen Datei ein bestehendes Asset aus der Mediathek auswählt
- **DANN** übernimmt der Editor weiterhin nur dessen Referenz und persistierbaren Content-Snapshot in den Formularentwurf
- **UND** lädt er die Datei nicht erneut hoch
- **UND** wird die Referenz erst mit dem Content-Speichern übernommen

### Requirement: Content-Speicherung löst lokale Medien kontrolliert auf

Das System MUST lokale Bildentwürfe erst innerhalb eines gemeinsamen Content-Speichervorgangs hochladen, in persistierbare Verwendungen auflösen und mit dem gespeicherten Content verknüpfen. Der Speichervorgang MUST bestätigte Mainserver- und Studio-Zustände unterscheiden und wiederholbar behandeln.

#### Scenario: Content mit lokalen Bildern wird vollständig gespeichert

- **WENN** ein gültiger Content-Entwurf mit einer oder mehreren lokalen Bilddateien gespeichert wird
- **DANN** lädt das System die Dateien als provisorische Assets hoch
- **UND** baut es den Mainserver-Payload erst aus den erfolgreich aufgelösten dauerhaften Asset-URLs
- **UND** speichert es den Mainserver-Content
- **UND** ersetzt es anschließend den vollständigen Studio-Referenzsatz und aktiviert die verwendeten neuen Assets
- **UND** meldet es erst danach einen vollständigen Speichererfolg

#### Scenario: Content-Speicherung schlägt eindeutig fehl

- **WENN** Uploads erfolgreich waren, der Mainserver die Content-Speicherung aber eindeutig ablehnt
- **DANN** bleibt kein neues Asset in Mediathek, Suche oder Picker sichtbar
- **UND** verwirft das System die provisorischen Assets über den idempotenten Operations-Cleanup
- **UND** bleibt der lokale Browser-Entwurf für einen erneuten Speicherversuch erhalten

#### Scenario: Mainserver-Erfolg und Referenzabschluss laufen auseinander

- **WENN** der Mainserver-Content bestätigt gespeichert wurde, aber Reference-Replace oder Asset-Aktivierung fehlschlägt
- **DANN** löscht das System die provisorischen Assets nicht
- **UND** hält es Ziel-ID, gewünschten Referenzsatz und Operationszustand für eine idempotente Wiederholung fest
- **UND** zeigt die Oberfläche einen unterscheidbaren Teilfehler
- **UND** wiederholt ein Retry den Mainserver-Write nicht

#### Scenario: Ergebnis der Content-Speicherung ist technisch unklar

- **WENN** das System nicht sicher feststellen kann, ob die Mainserver-Mutation erfolgreich war
- **DANN** behauptet es weder vollständigen Erfolg noch sicheren Fehlschlag
- **UND** löscht es die verborgenen provisorischen Assets nicht automatisch
- **UND** markiert es die Operation als reconciliation-pflichtig
- **UND** bietet es eine sichere Statusprüfung oder Wiederaufnahme an

### Requirement: Alle bildfähigen Content-Editoren teilen denselben Medien-Speicherlebenszyklus

Das System MUST News, Events, POI, Generic Items, Projects und Cockpit Cards über denselben lokalen Draft-, Upload-, Commit-, Abandon- und Recovery-Vertrag anbinden. Plugins dürfen keinen abweichenden eigenen Uploadzeitpunkt oder Cleanup-Lebenszyklus einführen.

#### Scenario: Unterstützte Plugins verwenden den gemeinsamen Ablauf

- **WENN** ein unterstützter Content-Typ lokale Bilder auswählt oder speichert
- **DANN** verwendet sein Editor den gemeinsamen Overlay- und Save-Orchestrator
- **UND** beschränkt sich der Plugin-Adapter auf fachliche Validierung, Mainserver-Mapping und Zusatzfelder
- **UND** bleiben Reihenfolge, unbekannte Fachfelder und bestehende URL-/Metadaten-Snapshots beim Roundtrip erhalten

#### Scenario: Content-Save zeigt phasengenaues Feedback

- **WENN** ein Speichervorgang lokale Bilder verarbeitet
- **DANN** unterscheidet die Oberfläche Upload, Content-Speicherung, Medienverknüpfung, Cleanup und unklaren Ausgang textuell
- **UND** verhindert sie konkurrierendes Speichern, Entfernen oder Umsortieren während der laufenden Operation
- **UND** bleiben Fokusführung und Statusmeldungen barrierefrei nachvollziehbar

### Requirement: Inhaltslisten-Sortierung gilt für den vollständigen verfügbaren Trefferbestand

Das System MUST die Sortierung der paginierten Inhaltsübersicht serverseitig auf den vollständigen, durch Berechtigungen und aktuelle Filter definierten verfügbaren Trefferbestand anwenden und erst danach die angeforderte Seite bilden. Es MUST dafür ausschließlich die sichtbaren Felder `title`, `createdAt`, `updatedAt` und `publishedAt` unterstützen und standardmäßig `updatedAt desc` verwenden.

#### Scenario: Inhaltsübersicht erhält eine serverseitig sortierte Seite

- **GIVEN** die aktuellen Inhaltsfilter ergeben mehr Treffer als auf eine Seite passen
- **WHEN** ein Benutzer ein unterstütztes Sortierfeld auswählt
- **THEN** wendet die führende serverseitige Listenquelle Filterung und Sortierung vor der Pagination an
- **AND** liefert sie nur die angeforderte Ergebnisseite an den Browser
- **AND** sortiert die gemeinsame Tabellenkomponente diese Seite nicht nochmals lokal

#### Scenario: Zuletzt bearbeitete Inhalte stehen standardmäßig zuerst

- **GIVEN** die Inhaltsübersicht wird ohne gültigen expliziten Sortierwert geöffnet
- **WHEN** das System die erste Seite lädt
- **THEN** sortiert die führende Listenquelle den vollständigen gefilterten Bestand nach `updatedAt desc`
- **AND** zeigt der Tabellenkopf diesen Default aktiv an

#### Scenario: Erstellung und Veröffentlichung werden vollständig serverseitig sortiert

- **GIVEN** die aktuellen Inhaltsfilter ergeben mehr Treffer als auf eine Seite passen
- **WHEN** ein Benutzer `createdAt` oder `publishedAt` auswählt
- **THEN** führen sowohl der native Inhalts- als auch der Projektionspfad das gewählte Feld und die Richtung aus
- **AND** stehen Inhalte ohne `publishedAt` unabhängig von der Richtung am Ende
- **AND** stabilisiert `ID asc` gleiche Zeitwerte

#### Scenario: Übersetzte Typ- und Statuswerte täuschen keine alphabetische Sortierung vor

- **WHEN** die Inhaltsübersicht lokalisierte Inhaltstypen und Statuswerte anzeigt
- **THEN** bieten die Spalten Inhaltstyp und Status keine Sortieraktion an
- **AND** sortiert das System sie nicht nach ihren abweichenden technischen Werten

#### Scenario: Ungültige Sortierparameter werden nicht still umgedeutet

- **GIVEN** ein direkter API-Request enthält ein unbekanntes Sortierfeld oder eine unbekannte Richtung
- **WHEN** der Inhaltsendpunkt den Request validiert
- **THEN** antwortet er mit `400 invalid_request`
- **AND** wechselt er nicht still auf `updatedAt desc`

#### Scenario: Partieller Snapshot begrenzt den verfügbaren Trefferbestand

- **GIVEN** die Inhaltsprojektion ist für mindestens einen angefragten Typ noch partiell
- **WHEN** die Inhaltsübersicht gefiltert und sortiert wird
- **THEN** gilt der vollständige Sortierumfang für alle aktuell autorisiert verfügbaren Projektionszeilen
- **AND** bleibt die bestehende Kennzeichnung erhalten, dass Filterung, Sortierung und Gesamtzahl bis zur vollständigen Reconciliation vorläufig sind

### Requirement: Lokale Content-Projektionen bleiben austauschbare Mainserver-Caches

Das Content-Management MUST lokale Listenprojektionen Mainserver-basierter Inhalte als vollständig rekonstruierbare, account- und credential-scope-isolierte Caches behandeln. Ein fehlender Content-Core, eine fehlende External-Content-Reference oder eine fehlende Studio-History darf einen vom Mainserver gelieferten und durch IAM autorisierten Inhalt nicht dauerhaft aus der Fachliste oder Detailansicht entfernen.

#### Scenario: Vollständige Reconciliation entdeckt externen Inhalt

- **GIVEN** ein Inhalt wurde außerhalb des Studios im Mainserver angelegt
- **WHEN** die vollständige typisierte Reconciliation den Inhalt liest
- **THEN** materialisiert oder aktualisiert sie dessen lokale Listenprojektion
- **AND** erfindet keinen lokalen fachlichen Lifecycle, Autor oder Owner

### Requirement: History beschreibt ausschließlich beobachtete Studio-Mutationen

Das Content-Management MUST Mainserver-Inhalte auch ohne lokale History anzeigen und bearbeiten können. Die History-API MUST ihre Abdeckung als `coverage = studio_mutations` ausweisen und darf externe Mainserver-Änderungen ohne bestätigten Event-Vertrag nicht als vollständig historisiert darstellen.

#### Scenario: Extern erzeugter Inhalt besitzt keine Studio-History

- **GIVEN** ein Mainserver-Inhalt wurde außerhalb des Studios erzeugt und nie im Studio mutiert
- **WHEN** ein autorisierter Benutzer dessen Detailansicht öffnet
- **THEN** ist der fachliche Inhalt vollständig verfügbar
- **AND** die History ist leer oder nicht verfügbar mit `coverage = studio_mutations`
- **AND** der fehlende lokale History-Core blockiert weder Detail noch Bearbeitung

### Requirement: Verhaltensgleiche Event-Formularserialisierung

Das Events-Plugin SHALL die Serialisierung des Detailformulars in fachlich getrennte, paketinterne und frameworkfreie Serializer gliedern, ohne Feldpräsenz, Normalisierung, Kompatibilitätswerte, Array-Reihenfolge oder den bestehenden `EventFormInput`-Vertrag zu verändern.

#### Scenario: Leere und optionale Eventwerte bleiben kompatibel

- **WHEN** ein Event-Detailformular leere, fehlende, `null`-, `false`-, `0`- oder nicht-endliche optionale Werte enthält
- **THEN** bleiben bestehende Omit-, Kompaktierungs- und Erhaltungsregeln unverändert
- **AND** der öffentliche Formular-Mapper liefert dasselbe exakte Output-Shape wie vor der Modularisierung

#### Scenario: Datum und Zeit werden ohne semantische Korrektur serialisiert

- **WHEN** das Formular ganztägige, lokale oder Offset-tragende Datums- und Zeitwerte enthält
- **THEN** bleiben Wert, Feldpräsenz und Reihenfolge unverändert
- **AND** die Serialisierung führt keine neue Zeitzonen- oder Validierungssemantik ein

#### Scenario: Strukturierte Eventbereiche bewahren Datenintegrität

- **WHEN** Adressen, Geo-Koordinaten, Kontakte, URLs, Medien, Preise oder Barrierefreiheitsinformationen serialisiert werden
- **THEN** bleiben partielle und ungültige Grenzwerte nach den bestehenden Regeln erhalten oder ausgelassen
- **AND** wiederholte Einträge behalten ihre bestehende Reihenfolge

#### Scenario: Paketgrenzen bleiben unverändert

- **WHEN** die Event-Serialisierung modularisiert wird
- **THEN** bleiben die Serializer intern in `@sva/plugin-events`
- **AND** es entsteht keine neue Shared-API und keine Änderung an POI- oder Mainserver-Verträgen

### Requirement: Featured-Project-Texte teilen einen kontrollierten ersten Content-Block

Das System MUST `Description` eines Featured Projects auf `contentBlocks[0].intro` und `FullText` auf `contentBlocks[0].body` abbilden. Bei Updates MUST es weitere Eigenschaften des ersten Blocks und alle weiteren Content-Blocks erhalten, soweit sie nicht vom Featured-Project-Vertrag kontrolliert werden. Es MUST keinen historischen Top-Level-Teaser als Description-Fallback verwenden.

#### Scenario: Projektbeschreibung und Volltext werden gespeichert

- **WHEN** ein Redakteur Description und FullText eines Featured Projects speichert
- **THEN** schreibt das System beide Werte in `intro` und `body` desselben ersten Content-Blocks
- **AND** sendet kein Top-Level-Teaser-Feld

#### Scenario: Projekt besitzt weitere Content-Blocks

- **GIVEN** ein Featured Project besitzt einen ersten Textblock und weitere fachfremde Content-Blocks
- **WHEN** Description oder FullText geändert wird
- **THEN** aktualisiert das System ausschließlich die kontrollierten Felder des ersten Blocks
- **AND** erhält die weiteren Content-Blocks unverändert

### Requirement: News-Kompatibilitätsfelder bleiben snapshotbasiert und verlustfrei

Der News-Editor MUST historische Compatibility-Aliaswerte nur bei einem ausdrücklich gesetzten Touched-Marker und passendem Laufzeittyp in den bestehenden Legacy-Snapshot übernehmen. Vereinfachte redaktionelle Felder MUST bei der Mutation führend bleiben; Publication-, Push-, Address- und ContentBlocks-Sonderregeln MUST ihre bestehende Priorität behalten.

#### Scenario: Unberührter oder typfalscher Alias wird ignoriert

- **WHEN** ein Compatibility-Alias keinen Touched-Marker besitzt, ausdrücklich unberührt ist oder einen falschen Laufzeittyp trägt
- **THEN** bleibt der vorhandene Snapshotwert unverändert
- **AND** die Mutation übernimmt keinen typfalschen Aliaswert

#### Scenario: Mehrere gültige Aliase werden gemeinsam übernommen

- **WHEN** mehrere Compatibility-Aliase als berührt markiert sind und passende Laufzeittypen tragen
- **THEN** aktualisiert der Editor alle zugehörigen Snapshotwerte
- **AND** nicht berührte bestehende Snapshotwerte bleiben erhalten

#### Scenario: Vereinfachte redaktionelle Felder widersprechen Legacy-Inhalten

- **WHEN** vereinfachte Titel-, Intro-, Body- oder Medienwerte gleichzeitig widersprüchliche Compatibility-ContentBlocks begleiten
- **THEN** schreibt die Create- oder Edit-Mutation die vereinfachten redaktionellen Werte
- **AND** die Compatibility-Werte ändern keine öffentliche Form- oder API-Semantik

### Requirement: POI-Formtransformationen erhalten den bestehenden Datenvertrag

Das System SHALL bei der Characterization des POI-Formvertrags und dem verhaltensgleichen Refactoring der Serialisierung die bestehende Übersetzung zwischen Mainserver-Inhalten und Editorformular vollständig erhalten.

#### Scenario: Bestehender POI wird in Formularwerte gemappt

- **GIVEN** ein POI mit vollständigen, partiellen oder Legacy-Feldern
- **WHEN** der Inhalt in POI-Formularwerte übersetzt wird
- **THEN** bleiben Defaults, Kategorienpriorität, Aktivstatus, Listenreihenfolge und Wochentagsnormalisierung unverändert
- **AND** bleiben nichtendliche Numerik, Payload-Runtime-Shapes und bestehendes Clone- beziehungsweise Referenzverhalten charakterisiert

#### Scenario: Bearbeitete Formularwerte werden serialisiert

- **GIVEN** POI-Formularwerte mit vollständigen, leeren, partiellen oder ungültigen Runtime-Feldern
- **WHEN** daraus der Mainserver-Mutationsinput erzeugt wird
- **THEN** bleiben Trimming, explizite Leerungen, Deduplikation, Filter, Fallbacks und Listenreihenfolge unverändert
- **AND** werden falsche numerische Runtime-Werte weiterhin für die nachgelagerte Validierung erkennbar erhalten

#### Scenario: Serialisierungsrefactoring verändert keine angrenzenden Verträge

- **GIVEN** die POI-Formularserialisierung wird vereinfacht und das Inbound-Mapping bleibt produktiv unverändert
- **WHEN** die Änderung abgeschlossen wird
- **THEN** bleiben öffentliche POI-Typen, Mainserver-Vertrag, Validierung und Editor-UI unverändert
- **AND** entsteht keine neue Cross-Plugin- oder Shared-Package-Ownership-Grenze

### Requirement: Die gemeinsame Inhaltsübersicht verwendet eine eindeutige GenericItem-Repräsentation

Das System MUST jedes Mainserver-GenericItem in der gemeinsamen Inhaltsübersicht genau einmal darstellen. Deklariert ein registriertes Fachplugin die Zuständigkeit für den exakten `genericType`, MUST dessen Fach-Content-Type die Darstellung übernehmen. Ohne registrierte Zuständigkeit MUST `generic-items.generic-item` die Darstellung übernehmen. Die Klassifikation MUST vor und unabhängig von der benutzerspezifischen Autorisierung erfolgen.

#### Scenario: Registriertes Fachplugin übernimmt die Darstellung

- **GIVEN** ein GenericItem besitzt `genericType` gleich `FeaturedProject`
- **AND** `projects.project` ist dafür in der Build-time-Registry registriert
- **WHEN** die gemeinsame Inhaltsübersicht projiziert wird
- **THEN** erscheint der Datensatz ausschließlich als `projects.project`
- **AND** erscheint er dort nicht zusätzlich als `generic-items.generic-item`

#### Scenario: Unbekannter Typ fällt auf generische Darstellung zurück

- **GIVEN** kein registriertes Fachplugin übernimmt den `genericType` eines GenericItems
- **WHEN** die gemeinsame Inhaltsübersicht projiziert wird
- **THEN** erscheint der Datensatz als `generic-items.generic-item`
- **AND** bleibt über dessen generischen Detailpfad erreichbar

#### Scenario: Fehlendes Fachrecht erzeugt keinen generischen Ersatz

- **GIVEN** ein registriertes Fachplugin übernimmt den `genericType` eines GenericItems
- **AND** die Person besitzt `generic-items.read`, aber nicht das erforderliche Fach-Leserecht
- **WHEN** sie die gemeinsame Inhaltsübersicht öffnet
- **THEN** erscheint der Datensatz dort weder fachlich noch generisch
- **AND** verändert die Berechtigung nicht seinen kanonischen Content-Type

#### Scenario: Technischer Vollzugriff bleibt separat erhalten

- **GIVEN** eine Person besitzt `generic-items.read`
- **WHEN** sie das eigenständige Modul „Generische Inhalte“ öffnet
- **THEN** enthält dessen technische Liste weiterhin alle Mainserver-GenericItems unabhängig vom `genericType`
- **AND** gilt die eindeutige Repräsentation ausschließlich für die gemeinsame Inhaltsübersicht

### Requirement: Alle redaktionell veränderbaren Plugin-Inhalte besitzen eine funktionale Historie

Das System MUST für jede aktive Plugin-Contribution mit redaktionell veränderbaren Datensätzen eine funktionale, hostseitig geladene Historienansicht bereitstellen. Ein sichtbarer Platzhalter oder eine dauerhaft leere Schein-Historie erfüllt diese Anforderung nicht.

#### Scenario: Bestehendes Content-Plugin zeigt echte Historieneinträge

- **WENN** ein berechtigter Benutzer die Historie eines bestehenden Plugin-Inhalts öffnet
- **DANN** lädt der Host die für diesen Inhalt erfassten Änderungen
- **UND** das Plugin zeigt mindestens Zeitpunkt, lokalisierte Aktion, Actor und Änderungsgegenstand an
- **UND** Lade-, Leer-, Fehler- und Erfolgszustand sind unterscheidbar

#### Scenario: Plugin besitzt keine redaktionell veränderbaren Datensätze

- **WENN** eine Plugin-Contribution ausschließlich Infrastruktur, SDK-Funktionen, Auswahlwerte oder andere nicht redaktionell mutierbare Beiträge bereitstellt
- **DANN** klassifiziert der Host sie explizit als nicht historienpflichtig
- **UND** die UI zeigt dafür keinen funktionslosen Historien-Tab

### Requirement: Mainserver-Inhalte zeigen ausschließlich Studio-seitige Änderungen

Das System MUST für Mainserver-basierte Inhalte eine Studio-Mutationshistorie führen, die ausschließlich erfolgreich über das Studio ausgeführte Änderungen enthält. Das System MUST diese Historie als Studio-seitig und nicht als vollständige Mainserver-Historie kennzeichnen.

#### Scenario: Studio ändert einen Mainserver-Inhalt erfolgreich

- **WENN** eine autorisierte Änderung eines Mainserver-Inhalts über das Studio fachlich erfolgreich abgeschlossen wird
- **DANN** erzeugt der Host einen korrelierbaren Historieneintrag für den Inhalt
- **UND** der Eintrag enthält die Studio-Aktion, den autorisierten Actor, den Zeitpunkt und die bekannten Änderungsfelder

#### Scenario: Mainserver-Mutation schlägt fehl

- **WENN** eine über das Studio ausgelöste Mainserver-Mutation abgelehnt wird oder technisch fehlschlägt
- **DANN** erscheint sie nicht als erfolgreiche Änderung in der sichtbaren Inhaltshistorie
- **UND** der Versuch bleibt gemäß Audit-Vertrag nachvollziehbar

#### Scenario: Inhalt wird außerhalb des Studios verändert

- **WENN** ein Mainserver-Inhalt direkt im Mainserver oder über ein anderes System verändert wird
- **DANN** erzeugt das Studio keinen synthetischen Historieneintrag
- **UND** die Historienansicht behauptet keine vollständige Erfassung externer Änderungen

#### Scenario: Featured Project erhält die nachgelagerte Historie

- **WENN** ein Featured Project bereits die allgemeine External-Content-Referenz aus `add-featured-projects-plugin` besitzt
- **UND** der History-Change das Projekte-Plugin anbindet
- **DANN** verwendet der Host dieselbe lokale Content-ID und externe Referenz für die Historie
- **UND** ergänzt das Plugin den gemeinsamen Historien-Tab ohne zweite Identitäts- oder Mutation-Persistenz

### Requirement: Plugin-Historien verwenden ein gemeinsames Darstellungsmodell

Das System SHALL Plugin-Historien mit einem gemeinsamen, lokalisierten und barrierefreien Darstellungsmodell ausgeben. Die Historienansicht MUST schreibgeschützt sein und MUST Herkunft sowie Abdeckungsgrenze erkennbar machen, wenn die führende Datenquelle außerhalb des Studios liegt.

#### Scenario: Historie wird erfolgreich dargestellt

- **WENN** Historieneinträge geladen wurden
- **DANN** zeigt die UI Zeitpunkt in der konfigurierten Editor-Zeitzone, Aktion, Actor, Zusammenfassung und vorhandene geänderte Felder
- **UND** verwendet sie semantische Listen- oder Tabellenstrukturen mit zugänglichen Beschriftungen
- **UND** enthält das History-Panel keine Aktion zum Speichern des aktuellen Editorformulars

#### Scenario: Historie kann nicht geladen werden

- **WENN** der History-Read fehlschlägt oder nicht autorisiert ist
- **DANN** zeigt die UI einen lokalisierten und für assistive Technologien wahrnehmbaren Fehlerzustand
- **UND** stellt keine veralteten oder fremden Historieneinträge als aktuellen Erfolg dar

### Requirement: Zentrale Inhaltstabelle verwendet die gemeinsamen Tabelleninteraktionen

Die zentrale Inhaltstabelle MUST die gemeinsamen Studio-Muster für anklickbare Informationen, Status-Badges, Icon-Aktionen, mobile Aktionsbeschriftungen und oben ausgerichtete Body-Zellen verwenden. Die Migration MUST bestehende Berechtigungs-, Principal-, Projektions-, Sortier-, Paginierungs- und Mutationsverträge unverändert erhalten.

#### Scenario: Benutzer darf einen Inhalt öffnen

- **WENN** ein Inhalt gemäß der bestehenden Zeilenzugriffsauflösung lesbar ist
- **DANN** erscheint sein Titel als primäre anklickbare Information
- **UND** führt der Titel zum bereits aufgelösten `editPath`
- **UND** beschreibt sein zugänglicher Name weiterhin, ob der Inhalt bearbeitbar oder nur lesbar geöffnet wird
- **UND** rendert die Aktionsspalte kein redundantes Öffnen-/Bearbeiten-Icon für dasselbe Ziel

#### Scenario: Benutzer darf einen Inhalt nicht öffnen

- **WENN** ein Inhalt gemäß der bestehenden Zeilenzugriffsauflösung nicht lesbar ist
- **DANN** erscheint sein Titel als reiner Text ohne Fokusziel und ohne irreführende Interaktivität
- **UND** erzeugt die Tabelle keinen Link auf ein nicht erlaubtes Ziel

#### Scenario: Benutzer betrachtet oder ändert den Content-Status

- **WENN** die Inhaltstabelle einen Content-Status rendert
- **DANN** verwendet sie das gemeinsame beschriftete Status-Badge
- **UND** bleibt ein nicht änderbarer Status rein informativ
- **UND** öffnet ein änderbarer Status weiterhin den bestehenden Statusdialog unter Beibehaltung von Berechtigungs- und Principal-Auflösung
- **UND** bleibt der Dialog bei einem Mutationsfehler geöffnet und zeigt einen verständlichen nächsten Schritt

#### Scenario: Benutzer löscht einen Inhalt

- **WENN** die bestehende Berechtigungs- und Principal-Auflösung das Löschen erlaubt
- **DANN** erscheint Löschen als gemeinsame destruktive Icon-Aktion
- **UND** bleibt die bestehende Bestätigung vor der Mutation erhalten
- **UND** erhält die Aktion in der mobilen Kartenansicht eine sichtbare Beschriftung

#### Scenario: Inhaltstabelle verarbeitet Daten und Navigation

- **WENN** die Inhaltstabelle auf die gemeinsamen Interaktionsmuster migriert wird
- **DANN** bleiben Projection, Filterung, globale Sortierung, Pagination, Content-Typ-Auflösung und Mainserver-Mutationsverträge unverändert
- **UND** bleiben alle Body-Zellen nach dem gemeinsamen Tabellenstandard oben ausgerichtet

### Requirement: Bildfähige Inhaltseditoren verwenden einen gemeinsamen Bildblock

Das System MUST News, Events, POI, Generic Items, Projects und Cockpit Cards über einen gemeinsamen hostseitigen Kernbildblock bearbeiten, während fachliche Pflichtigkeit, Zusatzfelder und Persistenzmapping beim jeweiligen Plugin verbleiben.

#### Scenario: Editor zeigt gemeinsame Kerninteraktion

- **WENN** ein Redakteur Bilder in einem unterstützten Inhaltseditor bearbeitet
- **DANN** stellt der Bildblock Bildliste, Vorschau, unterstützte contentbezogene Metadaten, Validierungsanzeige, Entfernen und Umsortieren bereit
- **UND** bietet er abhängig von den Berechtigungen `Aus Mediathek auswählen`, `Bild hochladen` und `Bild-URL manuell eingeben`
- **UND** entscheidet das Plugin weiterhin über Pflichtfelder, Maximalanzahl, Duplikate und Zusatzfelder

#### Scenario: Manuelle Bild-URL wird im gemeinsamen Block angelegt

- **WENN** ein berechtigter Redakteur `Bild-URL manuell eingeben` auswählt
- **DANN** fügt der Bildblock eine Verwendung mit stabiler UI-Identität, aber ohne `assetId` hinzu
- **UND** setzt den Fokus auf deren URL-Feld
- **UND** aktualisiert eine eingegebene URL die Vorschau, ohne das Bild in die Medienbibliothek zu importieren

#### Scenario: Bildverwendung wird barrierefrei umsortiert

- **WENN** ein Redakteur eine Bildverwendung nach oben oder unten verschiebt
- **DANN** bleibt der Fokus nachvollziehbar bei derselben Verwendung
- **UND** meldet die Oberfläche die neue Position und Gesamtzahl textuell
- **UND** sind am Listenanfang und Listenende nicht mögliche Verschiebeaktionen deaktiviert

#### Scenario: Plugin-Adapter erhält fachliche Daten

- **WENN** der gemeinsame Bildblock ein Plugin-Formular liest, verändert oder neu ordnet
- **DANN** bildet ein typsicherer Plugin-Adapter den neutralen Verwendungsvertrag auf das bestehende Fachmodell ab
- **UND** bleiben nicht im gemeinsamen Kern bearbeitete und unbekannte fachliche Felder beim Roundtrip erhalten
- **UND** normalisiert der Adapter fachliche Reihenfolgen wie Project-`position` deterministisch

### Requirement: Asset-Metadaten und contentbezogene Medienmetadaten bleiben getrennt

Das System MUST globale Metadaten eines `MediaAsset` von den Metadaten seiner konkreten Content-Verwendung trennen.

#### Scenario: Asset wird erstmals in einen Content übernommen

- **WENN** ein Redakteur ein Bibliotheks- oder Upload-Asset nach dem Review mit `Medium übernehmen` bestätigt
- **DANN** kopiert der Plugin-Adapter die unterstützten aktuellen Asset-Metadaten als Startwerte in den Content-Snapshot
- **UND** speichert die Verwendung die `assetId` für die parallele Studio-Referenz
- **UND** bleiben Asset-Metadaten und Content-Snapshot danach unabhängig bearbeitbar

#### Scenario: Asset-Metadaten ändern sich nach der Verknüpfung

- **WENN** globale Metadaten eines bereits verwendeten Assets später geändert werden
- **DANN** verändert das System bestehende Content-Snapshots nicht automatisch
- **UND** erhalten neue Verknüpfungen die dann aktuellen Asset-Metadaten als Startwerte

#### Scenario: Redakteur aktualisiert ausgewählte Felder aus der Mediathek

- **WENN** ein Redakteur für eine Asset-basierte Verwendung `Metadaten aus Mediathek aktualisieren` öffnet
- **DANN** zeigt das System je unterstütztem Feld Asset- und Content-Wert nebeneinander
- **UND** kann der Redakteur die zu übernehmenden Felder einzeln auswählen
- **UND** bleiben lokale Abweichungen standardmäßig abgewählt, sofern ihre Herkunft nicht sicher als unveränderter Startwert nachweisbar ist
- **UND** wird eine ausgewählte persistierbare Asset-Auslieferungs-URL ebenfalls in den Content-Snapshot übernommen
- **UND** verändert die Aktion das globale Asset nicht

### Requirement: Mainserver-Snapshot und Studio-Medienreferenzen werden kontrolliert koordiniert

Das System MUST die externe Mainserver-Persistenz und die Studio-Referenzpersistenz in einer festen, wiederholbaren Reihenfolge koordinieren.

#### Scenario: Content und Referenzen werden erfolgreich gespeichert

- **WENN** ein Content mit Asset-basierten Bildverwendungen gespeichert wird
- **DANN** speichert das System zuerst den Mainserver-Content einschließlich URL-/Metadaten-Snapshots
- **UND** ersetzt es nach Erhalt der stabilen Ziel-ID die Studio-`MediaReference`s für dieses Ziel idempotent
- **UND** zeigt es den gesamten Speichervorgang erst nach beiden erfolgreichen Schritten als vollständig erfolgreich an

#### Scenario: Referenzsynchronisation schlägt nach Mainserver-Erfolg fehl

- **WENN** der Mainserver-Content erfolgreich gespeichert wurde, aber das Ersetzen der Studio-Referenzen fehlschlägt
- **DANN** führt das System keinen vermeintlichen Cross-System-Rollback aus
- **UND** zeigt es einen unterscheidbaren Teilfehler statt eines vollständigen Erfolgs an
- **UND** bietet es eine idempotente Wiederholung der Referenzsynchronisation ohne erneutes Mainserver-Schreiben an

#### Scenario: Geladener Content und Studio-Referenzen weichen ab

- **WENN** Mainserver-Snapshots und Studio-Referenzen beim Laden nicht konsistent zusammengeführt werden können
- **DANN** bleiben die Mainserver-Daten die sichtbaren Content-Werte
- **UND** zeigt das System fehlende, zusätzliche oder nicht auflösbare Referenzen als Synchronisationszustand an
- **UND** erfindet, ersetzt oder löscht es keine Referenzen stillschweigend

#### Scenario: Bildverwendung wird entfernt

- **WENN** eine Asset-basierte Bildverwendung aus dem Content entfernt und erfolgreich gespeichert wird
- **DANN** fehlt ihre Referenz im anschließenden Replace-Vertrag
- **UND** bleibt das `MediaAsset` selbst in der Medienbibliothek bestehen

### Requirement: Medienaktionen im Content-Editor folgen abgestuften Berechtigungen

Das System MUST Content- und Medienberechtigungen für jede Bildaktion getrennt prüfen und client- sowie serverseitig konsistent durchsetzen.

#### Scenario: Redakteur verwendet eine manuelle URL

- **WENN** ein Redakteur die fachliche Content-Create- oder Content-Update-Berechtigung besitzt
- **DANN** darf er eine manuelle Bild-URL bearbeiten
- **UND** benötigt er dafür keine Medienbibliotheksberechtigung

#### Scenario: Redakteur wählt oder lädt ein Asset

- **WENN** ein Redakteur ein Bibliotheksasset auswählen möchte
- **DANN** benötigt er zusätzlich `media.read` und `media.reference.manage`
- **UND** benötigt er für einen Upload zusätzlich `media.create`

#### Scenario: Redakteur darf globale Metadaten nicht ändern

- **WENN** ein Redakteur den Media-Review ohne `media.update` öffnet
- **DANN** zeigt das System die Asset-Metadaten schreibgeschützt
- **UND** bleibt `Medium übernehmen` bei ansonsten ausreichenden Berechtigungen verfügbar
- **UND** darf er contentbezogene Overrides anschließend mit seiner fachlichen Content-Berechtigung bearbeiten

#### Scenario: Berechtigung läuft während des Flows ab

- **WENN** eine erforderliche Medienberechtigung vor Abschluss des Overlay- oder Referenzschritts nicht mehr wirksam ist
- **DANN** lehnt der Server die Aktion fail-closed ab
- **UND** bleibt das offene Content-Formular durch den fehlgeschlagenen Overlay-Abschluss unverändert
- **UND** zeigt die Oberfläche einen unterscheidbaren Berechtigungsfehler

#### Scenario: Geschütztes Asset besitzt keine geeignete dauerhafte Auslieferung

- **WENN** ein Asset nur über eine kurzlebige oder für den Mainserver-Vertrag ungeeignete URL ausgeliefert werden kann
- **DANN** darf der Content-Editor diese URL nicht persistieren
- **UND** erklärt die Oberfläche, warum das Asset in diesem Zielkontext nicht übernommen werden kann

### Requirement: Upload-Abbruch trennt Asset-Erzeugung und Content-Zuordnung

Das System MUST einen abgeschlossenen Asset-Upload von seiner späteren Content-Zuordnung unterscheiden.

#### Scenario: Overlay wird vor abgeschlossenem Upload abgebrochen

- **WENN** ein Benutzer den Overlay-Flow vor erfolgreichem Upload-Abschluss abbricht
- **DANN** entsteht keine Content-Verwendung und keine `MediaReference`

#### Scenario: Overlay wird nach abgeschlossenem Upload abgebrochen

- **WENN** der Upload bereits ein `MediaAsset` erzeugt hat, der Benutzer aber vor `Medium übernehmen` abbricht
- **DANN** bleibt das eigenständige Asset in der Medienbibliothek bestehen
- **UND** entsteht weder ein neuer Eintrag im Content-Formular noch eine `MediaReference`

### Requirement: Mainserver-Editoren bleiben bei Teilabweichungen nutzbar

Das System MUST einen erfolgreich gelieferten Mainserver-Datensatz anzeigen, sobald dessen stabile Mainserver-ID und die für die autorisierte typisierte Route erforderlichen harten Mindestfelder sicher erkannt wurden. Der Inhaltstyp MUST aus der typisierten Route stammen und darf nicht aus fehlenden Antwortfeldern erraten werden. Abweichungen in optionalen Feldern oder Fehler in zusätzlichen Studio-Diensten MUST auf die betroffene Feldgruppe oder Zusatzfunktion begrenzt bleiben und dürfen die Anzeige oder unabhängige Bearbeitung des übrigen Datensatzes nicht verhindern.

#### Scenario: Optionales Mainserver-Feld besitzt eine unerwartete Form

- **WENN** die Detailantwort eine sichere Mainserver-ID enthält und der Inhaltstyp durch die autorisierte typisierte Route feststeht
- **UND** ein optionales Feld oder ein einzelner optionaler Listeneintrag nicht dem bestätigten Adaptervertrag entspricht
- **DANN** zeigt der Editor alle sicher interpretierbaren Daten an
- **UND** kennzeichnet ausschließlich die betroffene Feldgruppe als degradiert oder schreibgeschützt
- **UND** unabhängige Feldgruppen bleiben bearbeitbar

#### Scenario: Optionaler Zusatzdienst schlägt fehl

- **WENN** der Mainserver-Detailrequest erfolgreich ist
- **UND** Medienreferenzen, Kategorien, Historie, Karte oder ein vergleichbarer Zusatzdienst nicht geladen werden können
- **DANN** bleibt der Mainserver-Datensatz sichtbar und bearbeitbar
- **UND** der betroffene Abschnitt zeigt einen lokalisierten, wiederholbaren Fehlerzustand
- **UND** die UI bezeichnet den Datensatz nicht als fehlend oder vollständig nicht ladbar

#### Scenario: Hartes Mindestfeld kann nicht sicher bestimmt werden

- **WENN** die Mainserver-Detailantwort keine sicher verwendbare Inhalts-ID oder keinen für die Fachroute erforderlichen Typdiskriminator besitzt
- **DANN** blockiert das System die Detailbearbeitung mit einem deterministischen Vertragsfehler
- **UND** es erzeugt keinen synthetischen Datensatz und führt keine Mutation aus

### Requirement: Degradierte Mainserver-Felder werden verlustarm bearbeitet

Das System MUST bei einer Aktualisierung ausschließlich die vom jeweiligen Editor kontrollierten und gültigen Feldgruppen ersetzen. Unbekannte Payload-Schlüssel und deklarierte Passthrough-Felder, die unmittelbar zuvor über den bestätigten GraphQL-Vertrag verlustfrei gelesen wurden und vom Mutation-Input akzeptiert werden, MUST erhalten bleiben. Nicht sicher interpretierbare Feldgruppen MUST unverändert und schreibgeschützt bleiben, wenn Auslassung nachweislich Erhaltung bedeutet oder die Gruppe vollständig aus dem aktuellen Read rekonstruiert werden kann.

#### Scenario: Benutzer bearbeitet unabhängige Felder neben einer Abweichung

- **GIVEN** ein geladener Datensatz besitzt eine nicht sicher interpretierbare optionale Feldgruppe
- **AND** andere Editorfelder sind gültig und bearbeitbar
- **WHEN** der Benutzer ausschließlich gültige Editorfelder aktualisiert
- **THEN** ersetzt der Schreibpfad nur die kontrollierten geänderten Feldgruppen
- **AND** erhält die abweichende Feldgruppe sowie deklarierte Payload- und Passthrough-Werte unverändert
- **AND** sendet keine unbekannten oder nur gelesenen Felder an den Mutation-Input

#### Scenario: Mutation kann eine abweichende Feldgruppe nicht sicher erhalten

- **GIVEN** der Mainserver-Mutationsvertrag verlangt eine Feldgruppe, die Studio nicht sicher rekonstruieren oder durch Auslassung erhalten kann
- **WHEN** der Benutzer speichern möchte
- **THEN** blockiert das System die unsichere Mutation vor dem GraphQL-Aufruf
- **AND** erklärt feldbezogen, welche Daten nicht sicher erhalten werden können
- **AND** der geladene Datensatz bleibt weiterhin sichtbar und anderweitig nutzbar

#### Scenario: Feld liegt außerhalb des GraphQL-Vertrags

- **WHEN** ein Wert vom bestätigten GraphQL-Lesevertrag nicht abgefragt oder vom Mutation-Input nicht akzeptiert wird
- **THEN** verspricht Studio weder Anzeige noch Erhaltung oder Bearbeitung dieses Werts
- **AND** führt keinen untypisierten GraphQL-Bypass oder vollständigen Rohdateneditor ein

#### Scenario: Parallele externe Änderung tritt zwischen Read und Write auf

- **GIVEN** der Mainserver bietet keine Revision, keinen ETag und keine vergleichbare Mutationsvorbedingung
- **WHEN** sich ein Providerfeld zwischen dem vorbereitenden Read und der Mutation extern ändert
- **THEN** verspricht Studio keine konfliktfreie Zusammenführung
- **AND** stellt es Read-Merge-Write nicht als Schutz vor Last-Writer-Wins-Verlusten dar

### Requirement: FAQ ist ein abgegrenzter GenericItem-Fachinhalt

Das System MUST FAQ als namespaceten Content-Type `faq.faq` und als eigenständige redaktionelle Fachfläche bereitstellen. FAQ-Datensätze MUST im Mainserver als GenericItem mit `genericType` gleich `FAQ` gespeichert und in der gemeinsamen Inhaltsübersicht ausschließlich als `faq.faq` dargestellt werden. Das FAQ-Plugin MUST dem etablierten Standard-Content-Plugin-Muster folgen: Es registriert eine FAQ-Admin-Ressource mit spezialisierten `list`-, `detail`- und `editor`-Bindings sowie FAQ-CRUD-Pfaden; der Host blendet deren eigene Navigation zugunsten der gemeinsamen Inhaltsübersicht aus.

#### Scenario: FAQ wird als Fachinhalt angelegt

- **WHEN** ein Benutzer mit `faq.create` eine FAQ anlegt
- **THEN** stellt das System ausschließlich die fachlich erlaubten FAQ-Felder bereit
- **AND** persistiert den Datensatz als GenericItem mit `genericType` gleich `FAQ`
- **AND** zeigt ihn in der Inhaltsübersicht als `faq.faq`

#### Scenario: FAQ wird aus der Inhaltsübersicht im Facheditor geöffnet

- **GIVEN** ein Benutzer darf `faq.read` ausführen
- **WHEN** er eine FAQ in der Inhaltsübersicht auswählt oder dort eine FAQ anlegt
- **THEN** navigiert der Host über den registrierten FAQ-Detail- oder Editor-Pfad zu dessen spezialisiertem Binding
- **AND** bleibt die FAQ in der gemeinsamen Inhaltsübersicht auffindbar
- **AND** bleiben Routing, Guards, Autorisierung, globale Aktionen und History hostgeführt

#### Scenario: FAQ-Navigation wird zugunsten der Inhaltsübersicht ausgeblendet

- **WHEN** der Host die FAQ-Admin-Ressource und ihre Navigation registriert
- **THEN** blendet er die direkte FAQ-Navigation in der Hauptnavigation aus
- **AND** bleibt die FAQ über die gemeinsame Inhaltsübersicht als `faq.faq` erreichbar

#### Scenario: FAQ wird nicht als offenes GenericItem doppelt angezeigt

- **GIVEN** ein GenericItem mit `genericType` gleich `FAQ`
- **WHEN** die Inhaltsprojektion oder die offene GenericItem-Liste aktualisiert wird
- **THEN** klassifiziert das System den Datensatz als `faq.faq`
- **AND** zeigt ihn nicht zusätzlich als `generic-items.generic-item` an

### Requirement: FAQ-Fachmodell ist auf Frage, Antwort, Sprache und Publikationsmetadaten begrenzt

Das System MUST für FAQ ausschließlich Frage, Nur-Text-Antwort, Sprachcode, Sortiergewichtung, Sichtbarkeit und Veröffentlichungszeitpunkt bearbeiten. Frage, Antwort und Sprachcode MUST Pflichtfelder sein. Der Sprachcode MUST ein normalisierter BCP-47-Tag sein. Andere GenericItem-Eingabefelder, insbesondere Medien, Kategorien, Kontakte, Orte und freie Payload-Bearbeitung, MUST in der FAQ-Oberfläche nicht verfügbar sein.

#### Scenario: Gültige FAQ wird gespeichert

- **WHEN** ein Benutzer eine nichtleere Frage, eine nichtleere Nur-Text-Antwort und einen gültigen Sprachcode mit gültigen Publikationsmetadaten speichert
- **THEN** speichert das System die Frage in `title`, die Antwort als alleinigen Eintrag in `contentBlocks: [{ body: answer }]`, den Sprachcode in `payload.languageCode` und die Metadaten in ihren kanonischen GenericItem-Feldern

#### Scenario: HTML in der Antwort wird abgewiesen

- **WHEN** ein Benutzer eine Antwort mit HTML-Markup speichert
- **THEN** weist das System die Speicherung mit einer feldbezogenen Validierungsmeldung ab
- **AND** verändert keinen bestehenden Datensatz

### Requirement: FAQ-Editor folgt dem Standard-Content-Workspace

Das System MUST den FAQ-Editor mit dem etablierten Detail-Workspace der redaktionellen Content-Plugins darstellen. Für eine gespeicherte FAQ MUST der Workspace die Tabs `Basis`, `Inhalt`, `Einstellungen` und `Historie` in dieser Reihenfolge anbieten. Der Tab `Basis` MUST Frage und Sprachcode enthalten; der Tab `Inhalt` MUST ausschließlich die fachliche Nur-Text-Antwort enthalten; der Tab `Einstellungen` MUST Sichtbarkeit, Veröffentlichungszeitpunkt und Sortiergewicht enthalten. Der Tab `Historie` MUST die hostgeführte Inhaltshistorie lesbar darstellen. Medien, Kategorien, Orte, Kontakte und weitere nicht zum FAQ-Fachmodell gehörende Bereiche dürfen nicht ergänzt werden.

#### Scenario: Antwort wird im Inhalts-Tab bearbeitet

- **GIVEN** ein Benutzer öffnet eine bestehende FAQ zum Bearbeiten
- **WHEN** er den Tab `Inhalt` auswählt
- **THEN** kann er dort die Nur-Text-Antwort lesen und bearbeiten
- **AND** ist das Antwortfeld nicht im Tab `Basis` oder `Einstellungen` sichtbar

#### Scenario: Neue FAQ zeigt nur passende Fachbereiche

- **WHEN** ein Benutzer eine FAQ anlegt
- **THEN** zeigt das System die Tabs `Basis`, `Inhalt` und `Einstellungen`
- **AND** zeigt es keinen Historie-Tab, bevor eine Inhalts-ID existiert
- **AND** zeigt es keine Medien-, Kategorien-, Orts- oder Kontakt-Tabs

#### Scenario: Historie einer gespeicherten FAQ wird angezeigt

- **GIVEN** eine gespeicherte FAQ und ein Benutzer mit Leseberechtigung
- **WHEN** er den Tab `Historie` öffnet
- **THEN** lädt das System die hostgeführte Inhaltshistorie für die FAQ-ID
- **AND** zeigt Zeitpunkt, Aktion, Actor und Zusammenfassung je vorhandenem Eintrag
- **AND** zeigt es bei fehlenden Einträgen einen verständlichen Leerzustand

#### Scenario: Sprachfassungen werden als eigene FAQ gespeichert

- **GIVEN** eine gespeicherte FAQ mit Sprachcode `de`
- **WHEN** ein Benutzer dieselbe Frage und Antwort mit Sprachcode `en` anlegt
- **THEN** speichert das System einen weiteren eigenständigen FAQ-Datensatz
- **AND** meldet keinen Duplikatkonflikt allein wegen gleicher Frage

#### Scenario: Unvollständige FAQ wird abgewiesen

- **WHEN** eine Frage oder Antwort leer ist
- **THEN** weist das System die Speicherung mit einer feldbezogenen Validierungsmeldung ab
- **AND** verändert keinen bestehenden Datensatz

### Requirement: FAQ-Sortierung ist deterministisch steuerbar

Das System MUST im FAQ-Payload die kontrollierten Schlüssel `languageCode` und `sortWeight` führen. Fehlende historische Sprachcodes MUST als `und`, fehlende Sortiergewichte MUST als `0` behandelt werden. Beim Update MUST das System unbekannte bestehende Payload-Schlüssel erhalten und ausschließlich die kontrollierten FAQ-Schlüssel überschreiben. Die FAQ-Fachliste MUST nach Sprachcode, aufsteigendem Sortiergewicht, Frage mit der Locale des Sprachcodes und schließlich ID sortieren.

#### Scenario: Standardgewicht wird verwendet

- **GIVEN** eine FAQ ohne gespeichertes Sortiergewicht
- **WHEN** das System die FAQ liest oder in der Liste einsortiert
- **THEN** verwendet es das Sortiergewicht `0`

#### Scenario: Historischer Payload bleibt außerhalb des FAQ-Vertrags erhalten

- **GIVEN** eine FAQ mit dem Payload `{ "legacy": true, "sortWeight": 1 }`
- **WHEN** ein Benutzer die FAQ mit Sprachcode `de` und Sortiergewicht `2` speichert
- **THEN** persistiert das System `{ "legacy": true, "languageCode": "de", "sortWeight": 2 }`

#### Scenario: Negative und positive Gewichte steuern die Reihenfolge

- **GIVEN** FAQ mit den Sortiergewichten `-1`, `0` und `1`
- **WHEN** die Fachliste gerendert wird
- **THEN** steht die FAQ mit `-1` vor der FAQ mit `0`
- **AND** steht die FAQ mit `1` nach der FAQ mit `0`

#### Scenario: Gleichrangige FAQ bleiben stabil sortiert

- **GIVEN** zwei FAQ mit gleichem Sprachcode, gleichem Sortiergewicht und identischer Frage
- **WHEN** die Fachliste gerendert wird
- **THEN** ordnet das System sie aufsteigend nach ihrer ID

### Requirement: FAQ- und Kachel-Editoren bleiben fachlich reduziert und verwenden gemeinsame Studio-Flächen

Das System MUST FAQ und Kacheln weiterhin ausschließlich über ihre jeweiligen begrenzten Fachmodelle bearbeiten und MUST ihre Editorflächen zugleich auf den gemeinsamen Studio-Detail-Workspace vereinheitlichen. Die Layoutmigration darf keine fachlichen Felder, Persistenzpfade oder direkten Plugin-Abhängigkeiten ergänzen.

#### Scenario: FAQ wird im standardisierten Editor bearbeitet

- **WHEN** ein Benutzer eine FAQ erstellt oder bearbeitet
- **THEN** zeigt der Editor die Bereiche `Basis`, `Inhalt`, `Einstellungen` und bei gespeicherten FAQ `Historie` über den gemeinsamen Studio-Detail-Workspace
- **AND** bleiben ausschließlich Frage, Nur-Text-Antwort, Sprachcode, Sortiergewicht, Sichtbarkeit und Veröffentlichungszeitpunkt bearbeitbar
- **AND** bleiben bestehende Mapper, Payload-Erhaltung und Mainserver-Verträge unverändert

#### Scenario: Kachel wird im standardisierten Editor bearbeitet

- **WHEN** ein Benutzer eine Kachel erstellt oder bearbeitet
- **THEN** zeigt der Editor die Bereiche `Basis`, `Inhalt`, `Einstellungen` und bei gespeicherten Kacheln `Historie` über den gemeinsamen Studio-Detail-Workspace
- **AND** gliedert der Inhaltsbereich Text, Bilder und Link in getrennte fachliche Detailkarten
- **AND** bleiben Medienauswahl, Alternativtext, Feldpfade, Mapper, `externalId` und unbekannte technische Payload-Daten unverändert erhalten

#### Scenario: Kachel-Bilder überstehen Bereichswechsel

- **GIVEN** ein Benutzer hat mehrere Kachel-Bilder ausgewählt, sortiert oder mit Alternativtext versehen
- **WHEN** er zwischen `Inhalt`, `Basis` und `Einstellungen` wechselt
- **THEN** bleiben Bilder, Reihenfolge und Alternativtexte unverändert im Formular erhalten
- **AND** der Editor erzeugt keine doppelten Medienreferenzen

### Requirement: FAQ-Sprachfilter wirkt vor der fachlichen Pagination

Das System MUST den FAQ-Sprachfilter als optionalen URL-Search-Parameter behandeln und auf die vollständige nach `genericType` gleich `FAQ` abgegrenzte Datenmenge anwenden, bevor Sortierung, Gesamtzahl und Pagination berechnet werden. Eine browserseitige Filterung ausschließlich der bereits geladenen Seite ist unzulässig.

#### Scenario: Sprache wird aus der URL gefiltert

- **GIVEN** FAQ mehrerer Sprachcodes liegen über mehrere Mainserver-Seiten verteilt vor
- **WHEN** ein Benutzer die gemeinsame Inhaltsübersicht mit `type=faq.faq` und einem Sprachfilter öffnet
- **THEN** filtert der Host die vollständige FAQ-Teilmenge nach dem normalisierten Sprachcode
- **AND** sortiert und paginiert erst das gefilterte Ergebnis
- **AND** zeigt die UI den aktiven Filter aus dem URL-State an

#### Scenario: Gefilterte Seite enthält keine Treffer

- **WHEN** für den gewählten Sprachcode keine FAQ vorhanden ist
- **THEN** zeigt die gemeinsame Inhaltsübersicht einen regulären gefilterten Leerzustand
- **AND** behauptet sie nicht aufgrund einer nur lokal gefilterten Einzelseite, dass keine Treffer in der Gesamtmenge existieren

#### Scenario: Filter wird geändert oder entfernt

- **WHEN** ein Benutzer den Sprachfilter ändert oder entfernt
- **THEN** setzt die Liste die Seitennummer auf einen gültigen Ausgangswert zurück
- **AND** schreibt den neuen Zustand in die URL
- **AND** bleiben unabhängige Search-Parameter erhalten

### Requirement: FAQ- und Kachel-Fachlisten bieten vollständige URL-gesteuerte Pagination

Das System MUST in FAQ- und Kachel-Fachlisten den normalisierten Seitenzustand aus der URL lesen und sichtbare Vor-/Zurück-Navigation anhand der hostseitigen Pagination bereitstellen.

#### Scenario: Benutzer wechselt die Kachel-Seite

- **WHEN** ein Benutzer in der Kachel-Fachliste vor- oder zurücknavigiert
- **THEN** aktualisiert das Studio `page` und `pageSize` in der URL
- **AND** lädt ausschließlich die angeforderte, hostseitig berechnete Kachel-Seite
- **AND** deaktiviert Navigation über die erste oder letzte bekannte Seite hinaus

#### Scenario: Benutzer navigiert in der FAQ-Fachliste

- **WHEN** ein Benutzer bei aktivem oder inaktivem Sprachfilter die FAQ-Seite der gemeinsamen Inhaltsübersicht wechselt
- **THEN** bleiben Filter und andere unabhängige Search-Parameter erhalten
- **AND** beziehen sich Seitenangabe und Navigationszustand auf die vollständige fachlich gefilterte FAQ-Menge

#### Scenario: URL enthält ungültige Listenparameter

- **WHEN** `page` oder `pageSize` fehlt oder einen nicht unterstützten Wert enthält
- **THEN** normalisiert das Studio den Zustand auf definierte Standardwerte
- **AND** lädt keine negative, nicht ganzzahlige oder anderweitig ungültige Seite

### Requirement: FAQ- und Kachel-Fachlisten verwenden das vollständige Studio-Übersichtsmuster

Das System MUST FAQ- und Kachel-Fachlisten mit dem gemeinsamen Studio-Übersichtstemplate, einer fachlichen Seitenbeschreibung, der gemeinsamen Datentabelle und konsistenten Lade-, Fehler- und Leerzuständen darstellen.

#### Scenario: FAQ-Fachliste wird dargestellt

- **WHEN** ein Benutzer die FAQ-Fachliste öffnet
- **THEN** zeigt das Studio Titel, fachliche Beschreibung, Erstellen-Aktion, Sprachfilter und Datentabelle im gemeinsamen Übersichtslayout
- **AND** verwendet der Sprachfilter bestehende Studio-/shadcn-Formularprimitives

#### Scenario: Kachel-Fachliste wird dargestellt

- **WHEN** ein Benutzer die Kachel-Fachliste öffnet
- **THEN** zeigt das Studio Titel, fachliche Beschreibung, Erstellen-Aktion, Datentabelle und Pagination im gemeinsamen Übersichtslayout
- **AND** bleiben Lade-, Fehler- und Leerzustände visuell und semantisch konsistent

### Requirement: FAQ- und Kachel-Historien folgen einem gemeinsamen lesbaren Muster

Das System MUST die hostgeführte Historie von FAQ und Kacheln mit derselben semantischen Tabellenstruktur sowie konsistenten Lade-, Fehler- und Leerzuständen darstellen.

#### Scenario: Historie enthält Einträge

- **WHEN** ein Benutzer den History-Bereich einer gespeicherten FAQ oder Kachel öffnet
- **THEN** zeigt das Studio Zeitpunkt, lokalisierte Aktion, Actor und Änderungszusammenfassung in einer responsiv nutzbaren semantischen Tabelle
- **AND** sortiert die Einträge deterministisch nach dem neuesten Zeitpunkt zuerst

#### Scenario: Historie ist leer oder nicht verfügbar

- **WHEN** keine History-Einträge vorhanden sind oder das Laden fehlschlägt
- **THEN** zeigt das Studio den gemeinsamen Leer- beziehungsweise Fehlerzustand
- **AND** bleiben die übrigen Editorbereiche und vorhandenen Formulardaten nutzbar

### Requirement: Inhalts-Detailseiten unterscheiden Principal-Laden und Principal-Fehler

Das System SHALL während der vorgelagerten Auflösung des Ressourcenprincipals einer bestehenden Inhalts-Detailseite einen regulären Ladezustand anzeigen. Erst eine fehlgeschlagene oder uneindeutige Auflösung SHALL als dauerhafter Fehler dargestellt werden. In beiden Zuständen SHALL die bestehende Fail-closed-Sperre für Schreibaktionen erhalten bleiben.

#### Scenario: Ressourcenprincipal wird geladen

- **WENN** eine Inhalts-Detailseite den Ressourcenprincipal des bestehenden Inhalts noch auflöst
- **DANN** zeigt die Oberfläche einen neutralen, höflich angekündigten Ladezustand
- **UND** zeigt sie keinen destruktiven Alert und keine Fehlermeldung
- **UND** rendert sie den Editor noch nicht

#### Scenario: Ressourcenprincipal wurde erfolgreich aufgelöst

- **WENN** die Principal-Auflösung einen eindeutigen persönlichen oder organisatorischen Principal liefert
- **DANN** beendet die Oberfläche den Ladezustand unmittelbar
- **UND** rendert sie den Editor mit dem aufgelösten festen Principal
- **UND** wartet sie nicht auf einen Timer oder einen visuellen Übergang

#### Scenario: Ressourcenprincipal kann nicht aufgelöst werden

- **WENN** die Principal-Auflösung fehlschlägt oder keinen eindeutigen zulässigen Principal liefert
- **DANN** beendet die Oberfläche den Ladezustand
- **UND** zeigt sie eine dauerhafte destruktive Fehlermeldung
- **UND** rendert sie den Editor nicht und hält Schreibaktionen fail-closed gesperrt
