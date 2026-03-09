## MODIFIED Requirements

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

## ADDED Requirements

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

#### Scenario: Theme wird über `instance_id` bestimmt
- **WHEN** für eine App-Instanz eine `instance_id` bekannt ist
- **THEN** kann die Shell daraus eine Theme-Variante ableiten oder auswählen
- **AND** die Theme-Auflösung bleibt kompatibel mit Light- und Dark-Mode
- **AND** eine fehlende oder unbekannte `instance_id` fällt auf ein definiertes Basis-Theme zurück

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
