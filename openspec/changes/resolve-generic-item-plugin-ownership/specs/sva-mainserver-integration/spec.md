## ADDED Requirements

### Requirement: Projektionsadapter verwenden die registrierte GenericItem-Zuständigkeit

Das System MUST Slim-, Legacy- und mutationsbezogene Projektionspfade mit derselben aus dem Build-time-Registry-Snapshot abgeleiteten Zuordnung von `genericType` zu `contentType` betreiben. Die Adapter MUST für die gemeinsame Inhaltsübersicht genau den aufgelösten Content-Type persistieren und zuvor vorhandene Geschwisterrepräsentationen bei vollständiger oder zielgerichteter Reconciliation entfernen.

#### Scenario: Vollständiger Refresh bereinigt doppelte Projektionen

- **GIVEN** ein Mainserver-GenericItem besitzt eine generische und eine fachliche Projektionszeile
- **AND** ein registriertes Fachplugin übernimmt seinen `genericType`
- **WHEN** ein vollständiger Projektionsrefresh erfolgreich abgeschlossen wird
- **THEN** bleibt ausschließlich die fachliche Projektionszeile bestehen
- **AND** meldet der abgeschlossene Snapshot keine generische Geschwisterrepräsentation

#### Scenario: Generic-Type wechselt zu einem registrierten Fachtyp

- **GIVEN** ein bislang unbekannter `genericType` wurde generisch projiziert
- **WHEN** eine erfolgreiche Mutation den Wert auf einen registrierten Fachtyp ändert
- **THEN** persistiert der Mutation-Follow-up die fachliche Repräsentation
- **AND** entfernt er die zuvor generische Repräsentation

#### Scenario: Generic-Type verliert seine registrierte Zuständigkeit

- **GIVEN** ein GenericItem wurde fachlich projiziert
- **WHEN** sein `genericType` erfolgreich auf einen nicht registrierten Wert geändert wird
- **THEN** persistiert der Mutation-Follow-up die generische Repräsentation
- **AND** entfernt er die zuvor fachliche Repräsentation

#### Scenario: Adapter erhalten die Zuordnung vom Host

- **WHEN** der Host einen Projektionsadapter initialisiert
- **THEN** übergibt er die aus der Plugin-Registry abgeleitete Zuständigkeitszuordnung über einen expliziten Vertrag
- **AND** importiert der Mainserver-Adapter weder die React-Anwendung noch einzelne Fachplugins

#### Scenario: Fremde Diskriminatoren füllen eine Upstream-Seite

- **GIVEN** eine angeforderte GenericItem-Projektion findet auf der ersten Upstream-Seite keinen passenden Diskriminator
- **AND** eine spätere Upstream-Seite enthält einen passenden Datensatz
- **WHEN** der Adapter die fachliche Projektionsseite lädt
- **THEN** scannt er bis zum passenden Datensatz oder bis zum Upstream-Ende weiter
- **AND** beendet der Host den Snapshot nicht aufgrund der leeren gefilterten Zwischenmenge

#### Scenario: Registry-Ziel besitzt keine GenericItem-Projektion

- **GIVEN** eine Ownership-Deklaration verweist auf einen Content-Type ohne Mainserver-GenericItem-Projektion
- **WHEN** der Host die serverseitige Zuordnung validiert
- **THEN** schlägt der Registry-Aufbau fail-fast fehl
- **AND** wird der Content-Type nicht für GenericItem-Mutation-Follow-ups verwendet
