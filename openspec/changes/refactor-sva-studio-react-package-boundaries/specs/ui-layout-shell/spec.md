## MODIFIED Requirements
### Requirement: Standardisiertes Listen-Seiten-Template

Das Studio SHALL fuer Verwaltungs- und Listenansichten ein gemeinsames Seiten-Template bereitstellen, das Breadcrumbs aus der Shell ergaenzt und darunter Titel, Beschreibung, optionale Primaeraktion sowie den Listeninhalt in konsistenter Struktur rendert. Die kanonische Implementierung dieses Templates SHALL ueber `@sva/studio-ui-react` bereitgestellt werden, damit App und Plugins denselben Vertrag nutzen.

#### Scenario: Listen-Seite nutzt das Standard-Template

- **WHEN** eine Verwaltungsseite des Studios gerendert wird
- **THEN** zeigt die Seite unterhalb der bestehenden Breadcrumbs einen Titel und optionalen Beschreibungstext
- **AND** eine optionale Primaeraktion wie `Neu erstellen` steht auf Titelhoehe rechts
- **AND** der Listeninhalt folgt einem gemeinsamen Layoutgeruest statt einer route-spezifischen Eigenstruktur

#### Scenario: App und Plugins konsumieren denselben Template-Vertrag

- **WHEN** eine App-Route oder ein Plugin ein Listen-Seiten-Template benoetigt
- **THEN** importiert sie dieses aus `@sva/studio-ui-react`
- **AND** `apps/sva-studio-react` pflegt dafuer keine zweite kanonische Template-Komponente

### Requirement: Standardisierte Datentabelle fuer Verwaltungslisten

Das Studio SHALL eine wiederverwendbare Datentabelle fuer Verwaltungslisten bereitstellen, die Auswahl, Sortierung, Toolbar-Aktionen und mobile Darstellung konsistent abbildet. Die kanonische Implementierung dieser Tabelle SHALL ueber `@sva/studio-ui-react` bereitgestellt werden.

#### Scenario: Tabelle mit Bulk-Aktionen und Sortierung

- **WHEN** eine Studio-Verwaltungsseite tabellarische Daten anzeigt
- **THEN** enthaelt die Tabelle optional eine Auswahlspalte als erste Spalte
- **AND** sortierbare Spaltenkoepfe zeigen ihren Sortierzustand zugaenglich an
- **AND** eine Aktionsspalte wird als letzte Spalte gerendert
- **AND** eine Toolbar oberhalb der Tabelle kann Bulk-Aktionen, Filter und sekundaere Aktionen aufnehmen

#### Scenario: Mobile Darstellung einer Verwaltungs-Tabelle

- **WHEN** eine Studio-Verwaltungsseite auf kleinem Viewport geoeffnet wird
- **THEN** wird die Tabelle als mobile Kartenansicht mit denselben Kerndaten und Aktionen nutzbar dargestellt
- **AND** Auswahl- und Aktionsmuster bleiben funktionsgleich erreichbar

#### Scenario: App und Plugins konsumieren denselben Tabellen-Vertrag

- **WHEN** eine App-Route oder ein Plugin eine Verwaltungs-Tabelle benoetigt
- **THEN** importiert sie diese aus `@sva/studio-ui-react`
- **AND** app-lokale Tabellenkopien werden nicht als zweite kanonische Implementierung weitergefuehrt
