## MODIFIED Requirements

### Requirement: Responsives Verhalten der Shell

Die Layout-Shell SHALL auf kleinen und großen Viewports nutzbar sein und auf
mobilen Geräten eine reduzierte, nicht-blockierende Navigations- und
Header-Variante bereitstellen. Sie SHALL ihre responsive Standarddarstellung
mit dem überarbeiteten Studio-Designsystem abstimmen und dabei bewusste
gespeicherte Navigationseinstellungen sowie alle vorhandenen Funktionen erhalten.

#### Scenario: Mobile Viewport mit Drawer-Navigation

- **WHEN** die App auf einem mobilen Gerät angezeigt wird
- **THEN** bleibt die Kopfzeile erreichbar
- **AND** die Navigation kann als Drawer/`Sheet` geöffnet werden
- **AND** Sidebar und Contentbereich bleiben nutzbar, ohne horizontales Layout-Breaking

#### Scenario: Desktop Viewport

- **WHEN** die App auf einem großen Viewport angezeigt wird
- **THEN** werden Sidebar und Contentbereich nebeneinander dargestellt
- **AND** die Shell verwendet eine stabile Desktop-Struktur ohne verpflichtende komplexe Flyout-Muster

#### Scenario: Responsive Standardmodi berücksichtigen bewusste Einstellungen

- **GIVEN** keine ausdrückliche gespeicherte Navigationspräferenz bestimmt den Modus
- **WHEN** die verfügbare Viewportbreite unter 1024, zwischen 1024 und 1279 oder ab 1280 CSS-Pixeln liegt
- **THEN** verwendet die Shell standardmäßig Drawer, 80-Pixel-Rail beziehungsweise 288-Pixel-Sidebar
- **AND** ein automatischer Viewportwechsel überschreibt keine gespeicherte Nutzerpräferenz
- **AND** jeder Navigationsmodus erhält zugängliche Namen, Fokusführung und alle berechtigten Navigationsziele

#### Scenario: Legacy-Navigationspräferenzen bleiben kompatibel

- **GIVEN** der bisherige Sidebar-Pfad hat gültige gespeicherte Werte `0` oder `1` auch für seine initiale Standarddarstellung geschrieben
- **WHEN** die neue responsive Standarddarstellung eingeführt wird
- **THEN** bleiben diese Werte als vorhandene Präferenz erhalten
- **AND** verwenden fehlende oder ungültige Werte den neuen responsiven Default
- **AND** schreiben weder initiale Default-Auflösung noch automatische Viewportwechsel eine neue Präferenz
- **AND** ändert erst eine ausdrückliche Nutzeraktion die gespeicherte Präferenz

#### Scenario: Schmale Inhalte behalten ihre Funktionen

- **WHEN** Seitenkopf, Tab-Navigation, Formular oder komplexe Tabelle in geringer Inhaltsbreite gerendert werden
- **THEN** bleiben Aktionen, Felder, Auswahl, Sortierung und fachliche Informationen erreichbar
- **AND** notwendige horizontale Scrollbereiche bleiben auf die betreffende Tabbar oder Tabelle begrenzt
- **AND** ein reiner Darstellungswechsel verändert weder Eingaben noch fachliche Zustände

### Requirement: Design-Token-basierte Shell-Farben

Das System SHALL für die Layout-Shell semantische Farb- und Flächentokens
verwenden, deren Gestaltung aus dem überarbeiteten SVA-Studio-Designsystem
abgeleitet wird. Es SHALL dabei den bestehenden zentralen Tokenpfad sowie
die unterstützten Themes und Modi erhalten.

#### Scenario: Shell-Flächen nutzen semantische Tokens

- **WHEN** Header, Sidebar oder Content-Surfaces gerendert werden
- **THEN** verwenden sie semantische Farben wie `background`, `foreground`, `card`, `popover`, `sidebar`, `primary`, `muted`, `border`, `ring` und `destructive`
- **AND** die zugrundeliegenden Werte sind zentral über CSS-Variablen definiert

#### Scenario: Direkte Shell-Farben werden reduziert

- **WHEN** Shell-nahe Komponenten migriert werden
- **THEN** werden direkte Tailwind-Farbwerte wie `slate-*`, `emerald-*` oder `red-*` in diesen Komponenten durch semantische Klassen ersetzt
- **AND** der visuelle Schwerpunkt liegt auf der Übernahme der SVA-Studio-Farben

#### Scenario: Fehlende Theme-Referenz entfernt keine Theme-Funktion

- **GIVEN** eine vorhandene Theme-Variante besitzt noch keine bestätigte neue Designpalette
- **WHEN** gemeinsame Komponenten an das überarbeitete Designsystem angepasst werden
- **THEN** bleiben Variante, Modusumschaltung und bestehende Farbidentität erhalten
- **AND** wird die fehlende Gestaltung als Designlücke dokumentiert
- **AND** werden Fokus, deaktivierte Zustände und Kontraste auch für diese Variante geprüft

### Requirement: Gemeinsame Editor-Primitives übernehmen bewährtes Verhalten ohne Plugin-Duplikate

Das Studio MUST gemeinsame Editor-Primitives aus nachgewiesenen
Verhaltensmustern mehrerer produktiver Content-Plugins ableiten. Die
Vereinheitlichung MUST allgemeine Layout- und Interaktionsverantwortung in
`studio-ui-react` bündeln und pluginlokale Basisimplementierungen entfernen
oder auf fachliche Zusammensetzung reduzieren. Eine Designmigration MUST
vorhandene Funktionen und Zustandsverträge erhalten und fachliche Lücken
des Designsystems ausdrücklich ausweisen.

#### Scenario: Gemeinsames Primitive wird aus realen Nutzungsmustern abgeleitet

- **GIVEN** News, Events, POIs, GenericItems, FAQ oder Kacheln besitzen ein vergleichbares Editor-Muster
- **WHEN** das Studio dafür ein gemeinsames Primitive einführt oder erweitert
- **THEN** ist dessen Verhalten gegen mindestens zwei reale Nutzungsmuster geprüft
- **AND** bleiben fachliche Feldmodelle, Mapper und Validierungen in den jeweiligen Plugins

#### Scenario: Referenzplugin besitzt eine lokale Basisimplementierung

- **WHEN** ein Referenzplugin Tabs, Section-Cards, Pagination oder Löschbestätigung lokal nachbildet
- **THEN** übernimmt die Vereinheitlichung das bewährte Verhalten, aber nicht automatisch die lokale Ownership-Struktur
- **AND** führt sie keine weitere parallele Basisimplementierung in FAQ, Kacheln oder GenericItems ein

#### Scenario: Abstraktion besitzt keine nachgewiesene Mehrfachnutzung

- **WHEN** eine vorgeschlagene Factory, ein Wrapper oder eine Konfigurationsschicht nur einen einzigen Editor bedienen würde
- **THEN** bleibt die fachliche Zusammensetzung lokal und direkt
- **AND** führt das Studio keine spekulative gemeinsame Abstraktion ein

#### Scenario: News verwendet gemeinsame Tabs ohne Verlust der Vorladung

- **GIVEN** News besitzt Vorladung bei Fokus oder Hover und erhält bereits besuchte Panels
- **WHEN** News auf die gemeinsamen `StudioDetailTabs` umgestellt wird
- **THEN** aktiviert News `preloadOnIntent` zusammen mit `keepMounted`
- **AND** markiert der zusätzliche Preload-Handler sichtbare und nicht deaktivierte Tabs idempotent als besucht, ohne selbst aktiven Bereich oder Fokus zu ändern
- **AND** bleiben die bestehende automatische Radix-Aktivierung bei Fokus und die Tastaturbedienung erhalten, während Hover allein keinen Tab aktiviert
- **AND** bleiben Eingaben, Dirty-Markierungen, mobile Bereichsauswahl, Tabaktionen und Historienzustände erhalten
- **AND** bleiben Verbraucher ohne aktivierte Intent-Vorladung in ihrem bestehenden Verhalten unverändert
- **AND** werden ersetzte lokale Darstellungs- und Mount-Verwaltungspfade im selben Lieferabschnitt entfernt

#### Scenario: React-Komposition erhält Formular- und Aktionsverträge

- **WHEN** Plugin-UI auf gemeinsame Komponenten umgestellt wird
- **THEN** besitzen die Eingaben weiterhin den zuständigen Formular-State und benötigten Context, auch innerhalb von Portalen
- **AND** entstehen keine verschachtelten Formulare oder interaktiven Controls
- **AND** behalten externe Submit-Aktionen ihre Formularzuordnung und andere Aktionen ihre bestehende Wirkung
- **AND** bleiben Eingaben und Editorzustände durch stabile Komponentenidentität erhalten

#### Scenario: Designreferenz bildet eine bestehende Funktion nicht ab

- **GIVEN** eine vorhandene Funktion besitzt kein bestätigtes Gegenstück im überarbeiteten Designsystem
- **WHEN** ihre Oberfläche migriert wird
- **THEN** bleibt die Funktion mit vorhandenen geeigneten Bausteinen bedienbar
- **AND** werden Funktion, Istverhalten, fehlende Gestaltung, Zustände, Evidenz, Priorität und Übergang dokumentiert
- **AND** führt die Designmigration weder still neue Backendverträge ein noch entfernt sie die Funktion
