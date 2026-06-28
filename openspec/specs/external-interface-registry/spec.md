# external-interface-registry Specification

## Purpose
TBD - created by archiving change add-external-interface-registry. Update Purpose after archive.
## Requirements
### Requirement: Host-Owned External Interface Registry

The system SHALL persist externally managed technical interfaces in a central, host-owned registry.

#### Scenario: Mainserver, S3 and Supabase share one registry path

- **WHEN** an instance stores a `sva_mainserver`, `s3` or `supabase` interface
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

