# ui-layout-shell Specification

## Purpose
Die UI-Layout-Shell beschreibt die gemeinsame Grundstruktur des Studios mit Sidebar, Kopfzeile, Contentbereich und den dazugehörigen Lade-, Theme- und Responsivitätsregeln.
## Requirements
### Requirement: Erweiterbare Layout-Shell
Das System SHALL eine erweiterbare Layout-Shell bereitstellen, die die Bereiche Sidebar, Kopfzeile und Contentbereich klar trennt und dabei eine Tailwind-/shadcn-kompatible Grundstruktur für spätere UI-Erweiterungen bietet.

#### Scenario: Standard-Layout wird gerendert
- **WHEN** ein Benutzer eine reguläre Route der App öffnet
- **THEN** wird eine Shell mit Sidebar, Kopfzeile und Contentbereich angezeigt
- **AND** der Contentbereich enthält den jeweiligen Routeninhalt

#### Scenario: Bereiche sind unabhängig erweiterbar
- **WHEN** später neue Navigationselemente, Menüs oder Header-Aktionen ergänzt werden
- **THEN** können Sidebar und Kopfzeile ohne Umbau des Contentbereichs erweitert werden
- **AND** die Shell bleibt mit semantischen Tailwind-/shadcn-Primitives kompatibel

### Requirement: Skeleton UI für Shell-Bereiche
Das System SHALL Skeleton-UI-Zustände für Sidebar, Kopfzeile und Contentbereich bereitstellen.

#### Scenario: Shell lädt in Pending-Zustand
- **WHEN** ein Ladezustand für die Shell aktiv ist
- **THEN** werden Skeleton-Platzhalter für Sidebar, Kopfzeile und Contentbereich angezeigt

#### Scenario: Inhalt ist verfügbar
- **WHEN** der Ladezustand beendet ist
- **THEN** werden die regulären Layout-Inhalte ohne Skeleton angezeigt

### Requirement: Barrierefreie Grundstruktur
Die Layout-Shell SHALL eine barrierefreie Grundstruktur für Navigation und Hauptinhalt bereitstellen.

#### Scenario: Tastaturnutzer überspringt Navigation
- **WHEN** ein Tastaturnutzer die Seite betritt
- **THEN** ist ein Skip-Link vorhanden, der direkt zum Contentbereich führt

#### Scenario: Screenreader erkennt Hauptbereiche
- **WHEN** ein Screenreader die Seite analysiert
- **THEN** sind Kopfzeile, Sidebar-Navigation und Hauptinhalt über semantische Landmarks erkennbar

### Requirement: Responsives Verhalten der Shell
Die Layout-Shell SHALL auf kleinen und großen Viewports nutzbar sein und auf mobilen Geräten eine reduzierte, nicht-blockierende Navigations- und Header-Variante bereitstellen.

#### Scenario: Mobile Viewport mit Drawer-Navigation
- **WHEN** die App auf einem mobilen Gerät angezeigt wird
- **THEN** bleibt die Kopfzeile erreichbar
- **AND** die Navigation kann als Drawer/`Sheet` geöffnet werden
- **AND** Sidebar und Contentbereich bleiben nutzbar, ohne horizontales Layout-Breaking

#### Scenario: Desktop Viewport
- **WHEN** die App auf einem großen Viewport angezeigt wird
- **THEN** werden Sidebar und Contentbereich nebeneinander dargestellt
- **AND** die Shell verwendet eine stabile Desktop-Struktur ohne verpflichtende komplexe Flyout-Muster

### Requirement: Design-Token-basierte Shell-Farben
Das System SHALL für die Layout-Shell semantische Farb- und Flächentokens verwenden, die auf der SVA-Studio-Farbpalette aus dem Vorgängerprojekt basieren.

#### Scenario: Shell-Flächen nutzen semantische Tokens
- **WHEN** Header, Sidebar oder Content-Surfaces gerendert werden
- **THEN** verwenden sie semantische Farben wie `background`, `foreground`, `card`, `popover`, `sidebar`, `primary`, `muted`, `border`, `ring` und `destructive`
- **AND** die zugrundeliegenden Werte sind zentral über CSS-Variablen definiert

#### Scenario: Direkte Shell-Farben werden reduziert
- **WHEN** Shell-nahe Komponenten migriert werden
- **THEN** werden direkte Tailwind-Farbwerte wie `slate-*`, `emerald-*` oder `red-*` in diesen Komponenten durch semantische Klassen ersetzt
- **AND** der visuelle Schwerpunkt liegt auf der Übernahme der SVA-Studio-Farben

### Requirement: Theme- und Modusfähige Token-Architektur
Das System SHALL die Shell-Farben so modellieren, dass mehrere Themes sowie Light- und Dark-Mode unterstützt werden können.

#### Scenario: Light und Dark Mode werden unterstützt
- **WHEN** die Shell in Light oder Dark Mode gerendert wird
- **THEN** werden Farben, Borders, Fokuszustände und Flächen über denselben semantischen Token-Satz aufgelöst
- **AND** die Shell verwendet keine fest verdrahteten Einzelfarben, die einen Modus ausschließen

#### Scenario: Theme wird über `instanceId` bestimmt
- **WHEN** für eine App-Instanz eine `instanceId` bekannt ist
- **THEN** kann die Shell daraus eine Theme-Variante ableiten oder auswählen
- **AND** die Theme-Auflösung bleibt kompatibel mit Light- und Dark-Mode
- **AND** eine fehlende oder unbekannte `instanceId` fällt auf ein definiertes Basis-Theme zurück
- **AND** falls der Wert aus Backend- oder Datenbankschichten als `instance_id` geliefert wird, ist das Mapping ins Frontend eindeutig dokumentiert

### Requirement: Niedrigrisiko-Interaktionen für die Shell
Das System SHALL neue Shell-Interaktionen auf wartbare, zugängliche Standardmuster begrenzen und komplexe Spezialmuster nur als Folgeschritt zulassen.

#### Scenario: Mobile Navigation und kleine Menüs werden eingeführt
- **WHEN** neue Shell-Interaktionen benötigt werden
- **THEN** werden bevorzugt standardisierte Primitives wie `Sheet` oder `DropdownMenu` verwendet
- **AND** Tastatur- und Screenreader-Nutzung bleiben ohne Speziallogik nachvollziehbar

#### Scenario: Komplexe Alt-Muster sind nicht Teil des Initial-Scope
- **WHEN** die Shell an das Vorgängerprojekt angeglichen wird
- **THEN** sind kollabierte Flyout-Submenüs, pixelgenaue Active-Indikatoren und umfangreiche Header-Sonderlogik nicht verpflichtender Bestandteil der ersten Umsetzung
- **AND** diese Muster werden nur bei klarem Mehrwert in einem späteren Follow-up betrachtet

### Requirement: Sichtbarer Runtime-Health-Indikator in der Shell
Die Layout-Shell SHALL auf allen Studioseiten am unteren Ende eine dauerhaft sichtbare Runtime-Health-Anzeige für zentrale Plattformabhängigkeiten bereitstellen.

#### Scenario: Health-Indikator wird auf regulären Studioseiten angezeigt
- **WHEN** ein Benutzer eine reguläre Studioseite öffnet
- **THEN** zeigt die Shell am Ende der Seite eine kompakte Health-Anzeige
- **AND** die Anzeige ist nicht auf Admin-Unterseiten beschränkt
- **AND** die Anzeige ist in allen Environments sichtbar

#### Scenario: Mehrere Dienstzustände werden verständlich dargestellt
- **WHEN** der Runtime-Healthcheck Zustände für Datenbank, Redis, Keycloak oder weitere relevante Dienste liefert
- **THEN** zeigt die Shell jeden Dienst mit Label und Statuszustand an
- **AND** Zustände wie `ready`, `degraded`, `not_ready` und `unknown` sind visuell unterscheidbar

#### Scenario: Health-Abfrage schlägt fehl
- **WHEN** die Shell den Runtime-Health-Status nicht laden kann
- **THEN** bleibt die restliche Shell nutzbar
- **AND** die Health-Anzeige wechselt in einen sichtbaren Fehler- oder `unknown`-Zustand
- **AND** der Benutzer erhält keinen leeren oder irreführend grünen Zustand

#### Scenario: Anzeige bleibt zugänglich und mobil nutzbar
- **WHEN** die Shell auf kleinen oder großen Viewports gerendert wird
- **THEN** bleibt die Health-Anzeige lesbar und erreichbar
- **AND** Screenreader können Dienstname und Status semantisch erfassen
- **AND** die Anzeige verursacht kein horizontales Layout-Breaking

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

