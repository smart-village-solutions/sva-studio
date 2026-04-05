## ADDED Requirements
### Requirement: Standardisiertes Listen-Seiten-Template
Das Studio SHALL für Verwaltungs- und Listenansichten ein gemeinsames Seiten-Template bereitstellen, das Breadcrumbs aus der Shell ergänzt und darunter Titel, Beschreibung, optionale Primäraktion sowie den Listeninhalt in konsistenter Struktur rendert.

#### Scenario: Listen-Seite nutzt das Standard-Template
- **WHEN** eine Verwaltungsseite des Studios gerendert wird
- **THEN** zeigt die Seite unterhalb der bestehenden Breadcrumbs einen Titel und optionalen Beschreibungstext
- **AND** eine optionale Primäraktion wie `Neu erstellen` steht auf Titelhöhe rechts
- **AND** der Listeninhalt folgt einem gemeinsamen Layoutgerüst statt einer route-spezifischen Eigenstruktur

### Requirement: Standardisierte Datentabelle für Verwaltungslisten
Das Studio SHALL eine wiederverwendbare Datentabelle für Verwaltungslisten bereitstellen, die Auswahl, Sortierung, Toolbar-Aktionen und mobile Darstellung konsistent abbildet.

#### Scenario: Tabelle mit Bulk-Aktionen und Sortierung
- **WHEN** eine Studio-Verwaltungsseite tabellarische Daten anzeigt
- **THEN** enthält die Tabelle optional eine Auswahlspalte als erste Spalte
- **AND** sortierbare Spaltenköpfe zeigen ihren Sortierzustand zugänglich an
- **AND** eine Aktionsspalte wird als letzte Spalte gerendert
- **AND** eine Toolbar oberhalb der Tabelle kann Bulk-Aktionen, Filter und sekundäre Aktionen aufnehmen

#### Scenario: Mobile Darstellung einer Verwaltungs-Tabelle
- **WHEN** eine Studio-Verwaltungsseite auf kleinem Viewport geöffnet wird
- **THEN** wird die Tabelle als mobile Kartenansicht mit denselben Kerndaten und Aktionen nutzbar dargestellt
- **AND** Auswahl- und Aktionsmuster bleiben funktionsgleich erreichbar

### Requirement: Tabs für mehrere Tabellenbereiche
Das Studio SHALL bei mehreren gleichrangigen Tabellenbereichen auf einer Seite ein gemeinsames Tabs-Muster verwenden.

#### Scenario: Seite mit mehreren Tabellenbereichen
- **WHEN** eine Verwaltungsseite mehrere gleichrangige Tabellenbereiche enthält
- **THEN** werden diese Bereiche über ein gemeinsames Tabs-Muster innerhalb des Seiten-Templates organisiert
- **AND** jeder Tab rendert seinen eigenen Tabellen- oder Listeninhalt, ohne ein zweites konkurrierendes Seitenlayout einzuführen
