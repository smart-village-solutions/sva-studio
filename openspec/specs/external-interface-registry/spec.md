# external-interface-registry Specification

## Purpose
TBD - created by archiving change add-external-interface-registry. Update Purpose after archive.
## Requirements
### Requirement: Host-Owned External Interface Registry

The system SHALL persist externally managed technical interfaces in a central, host-owned registry.

#### Scenario: Mainserver, S3, Supabase and PostgreSQL share one registry path

- **WHEN** an instance stores a `sva_mainserver`, `s3`, `supabase` or `postgresql` interface
- **THEN** the configuration is persisted in the central external-interface registry
- **AND** the host remains responsible for default resolution, status projection and authorization boundaries

### Requirement: Encrypted Secret Storage

The system SHALL store secret interface fields only in encrypted form.

#### Scenario: Secret fields are persisted as ciphertext

- **WHEN** an interface contains technical secrets such as API keys, database URLs or service-role keys
- **THEN** the host stores these values only as encrypted secret blocks
- **AND** browser-facing read models expose at most configured markers, never secret plaintexts

### Requirement: Plugin-Declared Interface Types

The system SHALL allow plugins to declare additional interface-type metadata without delegating persistence ownership.

#### Scenario: Plugin contributes an interface type

- **WHEN** a plugin declares an `externalInterfaceType`
- **THEN** the host validates and materializes the type metadata in its build-time registry
- **AND** the plugin does not gain direct access to host DB, secret storage or interface resolver internals

### Requirement: Das Studio bietet eine zentrale Mail-Transport-Schnittstelle für modulübergreifenden E-Mail-Versand
Das System SHALL eine zentrale Schnittstelle für technischen E-Mail-Versand bereitstellen, die von Fachmodulen wie `waste-management` genutzt werden kann.

#### Scenario: Mail-Transport wird als eigenständige technische Anbindung gepflegt
- **WHEN** ein berechtigter Benutzer im Studio technische Versandparameter für E-Mail pflegt
- **THEN** erfolgt diese Pflege in der zentralen Schnittstellen- oder Interface-Verwaltung
- **AND** die Konfiguration ist nicht an ein einzelnes Fachmodul gebunden
- **AND** Fachmodule referenzieren den Transport über einen stabilen technischen Vertrag

### Requirement: Die zentrale Mail-Transport-Schnittstelle verwaltet SMTP- oder Provider-Credentials serverseitig
Das System SHALL technische Versand-Credentials serverseitig und getrennt von Fachmodulen verwalten.

#### Scenario: SMTP-Parameter liegen außerhalb fachlicher Modulsettings
- **WHEN** die Mail-Transport-Schnittstelle SMTP oder einen alternativen E-Mail-Provider konfiguriert
- **THEN** verwaltet sie mindestens Host oder Provider, Port oder Transportmodus, TLS-Parameter, Benutzername und Secret-Referenz serverseitig
- **AND** diese Daten werden nicht in `waste-management` oder der Public-Waste-App gespeichert
- **AND** Secrets bleiben vom Browser fern

### Requirement: Die zentrale Mail-Transport-Schnittstelle besitzt einen expliziten Feldvertrag
Das System SHALL die Mail-Transport-Schnittstelle mit einem klaren, wiederverwendbaren Feldsatz modellieren.

#### Scenario: Mail-Transport wird als strukturierte technische Anbindung gespeichert
- **WHEN** eine Mail-Transport-Konfiguration im Studio gespeichert oder bearbeitet wird
- **THEN** enthält sie mindestens einen stabilen `transportId`, einen `transportType`, Host oder Provider-Endpunkt, Port oder Transportmodus, einen Security-Modus, einen Aktivstatus und eine Secret-Referenz
- **AND** sie kann zusätzlich Default-Absenderdaten, Batch-Limits und technische Gesundheitsinformationen führen
- **AND** der Vertrag bleibt von fachmodulspezifischen Texten oder Reminder-Regeln getrennt

### Requirement: Fachmodule übergeben normalisierte Versandaufträge an die Mail-Transport-Schnittstelle
Das System SHALL den Versandvertrag zwischen Fachmodulen und der zentralen Mail-Transport-Schnittstelle über normalisierte Versandaufträge abbilden.

#### Scenario: Waste nutzt die Mail-Schnittstelle ohne eigene Provider-Kopplung
- **WHEN** `waste-management` eine DOI-Mail, Aktivierungsbestätigung oder Reminder-Mail auslösen will
- **THEN** übergibt das Modul einen normalisierten Versandauftrag an die zentrale Mail-Transport-Schnittstelle
- **AND** der Auftrag enthält nur die für Template-Auflösung, Empfänger und Zustellung nötigen Daten
- **AND** das Fachmodul kennt weder SMTP-Details noch provider-spezifische API-Aufrufe

### Requirement: PostgreSQL-Schnittstellen besitzen einen providerneutralen Vertrag

Das System SHALL PostgreSQL-Datenbanken ohne Supabase-spezifische Pflichtfelder als technischen Schnittstellentyp `postgresql` verwalten.

#### Scenario: PostgreSQL-Verbindung wird vollständig serverseitig gespeichert

- **WHEN** ein berechtigter Benutzer eine PostgreSQL-Schnittstelle anlegt oder aktualisiert
- **THEN** speichert der Host die `databaseUrl` ausschließlich verschlüsselt
- **AND** kann ein optionales `schemaName` als öffentliche technische Konfiguration hinterlegt werden
- **AND** verlangt der Vertrag weder eine Supabase-Projekt-URL noch einen Service-Role-Key

#### Scenario: PostgreSQL-Healthcheck verwendet die Datenbankverbindung

- **WHEN** der Host den Zustand einer PostgreSQL-Schnittstelle prüft
- **THEN** führt er serverseitig eine minimale PostgreSQL-Verbindungsprüfung aus
- **AND** verwendet er keine Supabase-Storage- oder andere providerspezifische HTTP-API

#### Scenario: Supabase bleibt als eigenständiger Schnittstellentyp verfügbar

- **WHEN** der Schnittstellentyp `postgresql` eingeführt wird
- **THEN** bleibt der bestehende Typ `supabase` für unabhängige Integrationen registrier- und konfigurierbar
- **AND** PostgreSQL-Waste-Verbindungen werden nicht als Supabase maskiert

### Requirement: Pluginverwaltete Interfaces sind aus der Tenant-Verwaltung verborgen

Das System SHALL automatisch materialisierte, pluginverwaltete Interfaces von benutzerverwalteten Interfaces unterscheiden und aus der allgemeinen Tenant-Interface-Verwaltung ausschließen.

#### Scenario: Allgemeine Interface-Liste wird geladen

- **GIVEN** für die aktive Instanz existiert ein pluginverwaltetes Waste-PostgreSQL-Interface
- **WHEN** ein Tenant-Benutzer die Interface-Liste, einen Interface-Picker oder `/interfaces` öffnet
- **THEN** enthält das Read Model dieses verwaltete Interface nicht
- **AND** daraus entsteht kein direkter Detail- oder Bearbeitungslink

#### Scenario: Tenant-Benutzer adressiert das verborgene Interface direkt

- **WHEN** ein Tenant-Benutzer die Kennung eines pluginverwalteten Interfaces über eine allgemeine Read-, Update- oder Delete-Route adressiert
- **THEN** lehnt der Host den Zugriff fail-closed ab
- **AND** verrät die Antwort keine Secrets oder unnötigen technischen Details
- **AND** eine manipulierte Client-Anfrage kann die serverseitige Ownership nicht ändern

#### Scenario: Interne Runtime löst das verwaltete Interface auf

- **WHEN** die autorisierte Waste-Host-Fassade oder der Provisionierer die Datenquelle für eine konkrete Instanz benötigt
- **THEN** darf der Host das pluginverwaltete Interface intern tenantgebunden auflösen
- **AND** bleibt die allgemeine Benutzerverwaltung weiterhin ausgeschlossen
- **AND** Secrets werden ausschließlich serverseitig entschlüsselt

#### Scenario: Host-Operator diagnostiziert ein verwaltetes Interface

- **WHEN** ein ausdrücklich berechtigter Host-Operator Provisionierung oder Laufzeitstatus diagnostiziert
- **THEN** darf eine interne Betriebsansicht redigierte Ownership-, Status- und Fehlerdaten anzeigen
- **AND** sie bietet keine allgemeine Tenant-Bearbeitung und kein Secret-Plaintext an

### Requirement: Pluginverwaltete Interfaces besitzen einen eindeutigen Owner

Das System SHALL pluginverwaltete Interfaces mit einer unveränderlichen systemseitigen Ownership und einer tenantbezogenen fachlichen Eindeutigkeit persistieren.

#### Scenario: Waste-Provisionierer materialisiert das Interface

- **WHEN** der Waste-Provisionierer für eine Instanz ein PostgreSQL-Interface anlegt oder reconciled
- **THEN** kennzeichnet der Host den Datensatz eindeutig als von `waste-management` verwaltet
- **AND** erzwingt er höchstens ein aktives Waste-Datenbankinterface pro Instanz
- **AND** ein anderes Plugin oder eine allgemeine Interface-Mutation kann diese Ownership nicht übernehmen

