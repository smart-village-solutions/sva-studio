## MODIFIED Requirements

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
- **UND** sie fuehren keine pluginlokalen parallelen Tabellen-Implementierungen fuer dieselbe Listenfunktionalitaet fort
- **UND** Aktionsspalten, Loading-State, Empty-State und semantische Tabellenstruktur folgen demselben Host-Muster

## ADDED Requirements

### Requirement: Mainserver-Plugin-Listen verwenden serverseitige Pagination

Das System SHALL die Listenansichten der produktiven Mainserver-Plugins `news`, `events` und `poi` serverseitig paginieren, statt beim Seitenaufruf den kompletten Datenbestand vorzuladen.

#### Scenario: Plugin-Liste lädt nur die aktuelle Seite

- **GIVEN** ein Redakteur oeffnet die Listenansicht fuer News, Events oder POI
- **WHEN** die erste Seite gerendert wird
- **THEN** fordert die UI nur die konfigurierte Seitengroesse fuer die aktuelle Seite an
- **AND** sie laedt nicht mehr standardmaessig den gesamten Bestand

#### Scenario: Benutzer navigiert zur naechsten Seite

- **GIVEN** die aktuelle Plugin-Liste signalisiert weitere Ergebnisse
- **WHEN** der Benutzer die Aktion fuer die naechste Seite ausloest
- **THEN** sendet die UI eine neue List-Anfrage fuer die Zielseite
- **AND** die Tabelle aktualisiert ihren Lade- und Ergebniszustand ohne Vollabfrage des gesamten Bestands
- **AND** die aktuelle Seite bleibt ueber typsichere Search-Params in der URL abbildbar

#### Scenario: Upstream liefert keinen exakten Gesamtzaehler

- **GIVEN** der Host kann fuer die angeforderte Plugin-Liste keinen belastbaren Gesamtzaehler aus dem Mainserver-Vertrag ableiten
- **WHEN** die Pagination-UI gerendert wird
- **THEN** zeigt sie eine ehrliche Vor/Zurueck-Navigation mit aktueller Seite
- **AND** sie zeigt keine erfundene Gesamtseitenzahl oder ein fingiertes `total`

#### Scenario: Browser-Navigation bleibt mit Listenstate konsistent

- **GIVEN** ein Benutzer oeffnet eine Mainserver-Plugin-Liste auf einer spaeteren Seite
- **WHEN** er die Search-Params fuer `page` oder `pageSize` aendert oder Browser-Zurueck/Vorwaerts verwendet
- **THEN** spiegeln URL und Tabelle denselben Listenstate
- **AND** die Listenansicht bleibt per Deep-Link reproduzierbar
