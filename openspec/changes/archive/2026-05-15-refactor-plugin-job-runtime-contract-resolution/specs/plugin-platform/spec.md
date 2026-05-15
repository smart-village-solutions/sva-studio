## MODIFIED Requirements

### Requirement: Serialisierbarer Plugin-Manifest-Vertrag

Das System SHALL für veröffentlichte Plugins einen serialisierbaren Plugin-Manifest-Vertrag definieren.

Der Manifest-Vertrag MUST mindestens enthalten:

- `pluginId`
- `version`
- Host-Kompatibilitätsangaben
- deklarierte Plattform-Capabilities
- Entry-Points für Browser, Server und optionale Job-/Worker-Beiträge
- optional deklarierte Migrations- oder Setup-Anforderungen
- optional deklarierte Runtime-Anforderungen für hostseitig bereitgestellte Ausführungskontexte

#### Scenario: Manifest beschreibt ein publizierbares Plugin vollständig

- **GIVEN** ein externes Plugin wird paketiert
- **WHEN** der Host nur das Manifest liest
- **THEN** kann er Kompatibilität, Plugin-Identität, verfügbare Entry-Points und benötigte Plattform-Capabilities prüfen
- **AND** er muss dafür keinen unvalidierten Plugin-Code vorzeitig ausführen

#### Scenario: Job-Entry-Point deklariert eine Host-Runtime-Anforderung

- **GIVEN** ein Plugin veröffentlicht einen `jobs`-Entry-Point
- **WHEN** der Host das Manifest validiert
- **THEN** enthält das Manifest eine deklarative Job-Runtime-Anforderung
- **AND** der Host kann daraus den benötigten host-owned Runtime-Contract bestimmen, bevor er Plugin-Code ausführt

### Requirement: Plugin-eigene Server- und Job-Beiträge laufen nur in Host-Kontexten

Das System SHALL pluginseitige Server-, Job- und Integrationsbeiträge nur innerhalb hostdefinierter Execution-Contexts ausführen.

#### Scenario: Plugin-Job-Handler läuft im Host-Kontext

- **GIVEN** ein Plugin liefert einen Job-Handler
- **WHEN** der Host den Handler ausführt
- **THEN** stellt er einen host-owned Execution-Context mit Request-/Instance-Kontext, Logger, Audit-Reporter und Job-Reporter bereit
- **AND** der Plugin-Handler erhält keinen parallelen direkten Zugriff auf hostinterne Runner-, Secret- oder Registry-Interna

#### Scenario: Plugin-Request-Handler läuft im Host-Kontext

- **GIVEN** ein Plugin liefert einen serverseitigen Request-Beitrag
- **WHEN** dieser Beitrag über einen hostgestützten Endpoint ausgeführt wird
- **THEN** erfolgt Authentifizierung, Instanzauflösung, Request-Kontext und Fehlervertrag host-owned
- **AND** das Plugin implementiert nur die fachliche Handler-Logik innerhalb dieses Kontexts

#### Scenario: Host löst Plugin-Job-Runtime über Contract-ID statt Plugin-ID auf

- **GIVEN** ein Plugin mit `jobs`-Entry-Point deklariert eine Job-Runtime-Contract-ID im Manifest
- **WHEN** der Host die Job-Handler aus dem kanonischen Plugin-Snapshot registriert
- **THEN** bindet er die Runtime über diese Contract-ID an den Plugin-Job-Entry-Point
- **AND** neue Plugins benötigen dafür keine pluginId-spezifische Host-Matrix
