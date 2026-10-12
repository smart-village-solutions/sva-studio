## ADDED Requirements

### Requirement: Root-Administratoren können den Mainserver-Konfigurationsbestand aktiver Instanzen prüfen

Das System SHALL auf dem Studio-Root-Host für berechtigte Root-Administratoren den Status des kanonischen `sva_mainserver`-Default-Interfaces je aktiver Instanz lesbar machen. Die Übersicht SHALL fehlende, deaktivierte und vorhandene aktive Konfigurationen sowie Erhebungsfehler unterscheiden. Eine vorhandene aktive Konfiguration SHALL nicht als Nachweis für Provider-Readiness gelten.

#### Scenario: Aktive Instanzen werden ohne Mainserver-Pflicht inventarisiert

- **GIVEN** aktive Instanzen mit vorhandenem aktivem, deaktiviertem und fehlendem Mainserver-Default-Interface
- **WHEN** ein Root-Administrator den Mainserver-Bestand liest
- **THEN** erhält er je Instanz `configured`, `disabled` beziehungsweise `missing`
- **AND** das System legt für fehlende Einträge nichts automatisch an
- **AND** es behandelt eine optionale Mainserver-Anbindung nicht als Voraussetzung des Instanzstatus `active`

#### Scenario: Lesefehler wird nicht als fehlende Konfiguration ausgegeben

- **WHEN** die Schnittstelle einer aktiven Instanz nicht zuverlässig gelesen werden kann
- **THEN** weist die Übersicht diese Instanz mit `error` und einem stabilen Fehlercode aus
- **AND** sie behauptet für diese Instanz weder `missing` noch `configured`

#### Scenario: Tenant-Identität erhält keinen Root-Bestand

- **WHEN** ein Tenant-Host, Tenant-Token oder Actor ohne `instance_registry_admin` den Root-Bestand anfordert
- **THEN** lehnt das System den Zugriff vor instanzübergreifenden Datenbankabfragen ab

### Requirement: Root-Administratoren können die Mainserver-Schnittstelle einer gewählten Instanz pflegen

Das System SHALL auf dem Root-Host das Lesen und Speichern der öffentlichen Mainserver-Endpunkte und des Aktivstatus für eine ausdrücklich ausgewählte, vorhandene Instanz erlauben. Es SHALL den bestehenden Mainserver-Settings-Speicherpfad und dessen URL-Validierung verwenden sowie den Datenbankkontext auf die Zielinstanz begrenzen.

#### Scenario: Konfiguration wird gezielt gespeichert und zurückgelesen

- **GIVEN** ein berechtigter Root-Administrator hat eine vorhandene Instanz ausdrücklich gewählt
- **WHEN** er gültige `graphqlBaseUrl`, `oauthTokenUrl` und `enabled` speichert
- **THEN** schreibt das System den kanonischen `sva_mainserver`-Default-Eintrag dieser Instanz über den bestehenden Upsert-Pfad
- **AND** die gespeicherte öffentliche Konfiguration kann anschließend für dieselbe Instanz gelesen werden
- **AND** die Tenant-Verwaltung und die Runtime lösen denselben Eintrag auf

#### Scenario: Fremder Tenant oder ungültige Endpunkte werden abgewiesen

- **WHEN** ein unberechtigter Actor, ein Tenant-Host, eine unbekannte Instanz oder ein Payload mit zusätzlichen Feldern oder ungültigen URLs die Root-Mutation adressiert
- **THEN** lehnt das System die Mutation ab, ohne eine andere Instanz oder einen anderen Schnittstellentyp zu verändern
- **AND** die bestehende URL- und SSRF-Validierung bleibt maßgeblich

#### Scenario: Speichern ist keine Readiness-Bestätigung

- **WHEN** eine Mainserver-Konfiguration erfolgreich gespeichert wurde
- **THEN** meldet das System den gespeicherten Konfigurationszustand
- **AND** behauptet weder Provider-Erreichbarkeit noch gültige fachliche Credentials ohne gesonderte Prüfung

### Requirement: Root-Oberfläche und zentrales MCP verwenden dieselben Mainserver-Verträge

Das System SHALL den Root-Bestand und die gezielte Mainserver-Konfiguration in der vorhandenen Root-Instanzverwaltung und über das zentrale Studio-MCP zugänglich machen. Beide SHALL dieselben Root-HTTP-Verträge verwenden und ausschließlich secretfreie Projektionen erhalten.

#### Scenario: Root-UI und MCP lesen denselben Bestand

- **WHEN** Root-UI oder zentrales Studio-MCP den Mainserver-Status aktiver Instanzen lesen
- **THEN** erhalten sie denselben instanzbezogenen Status aus der kanonischen Interface-Registry
- **AND** sie erhalten weder Secret-Ciphertext noch freie Provider-Fehlertexte

#### Scenario: MCP speichert nur eine ausdrücklich gewählte Instanz

- **WHEN** das zentrale Studio-MCP eine Mainserver-Konfiguration speichert
- **THEN** übergibt es genau eine Ziel-`instanceId` an den autorisierten Root-Vertrag
- **AND** liest den Zielzustand nach dem Speichern zurück
- **AND** es greift weder direkt auf die Datenbank noch auf Tenant-Credentials zu

#### Scenario: Persönliche Tenant-Verwaltung bleibt instanzgebunden

- **WHEN** ein Tenant-Administrator die vorhandene `/interfaces`-Verwaltung oder den persönlichen Tenant-MCP benutzt
- **THEN** bleibt die Instanz aus seinem authentifizierten Tenant-Kontext bestimmt
- **AND** `integration.manage` bleibt erforderlich
- **AND** der Root-Verwaltungspfad erweitert seine Tenant-Rechte nicht
