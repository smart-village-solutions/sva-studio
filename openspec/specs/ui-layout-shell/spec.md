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

Das Studio SHALL eine wiederverwendbare Datentabelle für Verwaltungslisten bereitstellen, die Auswahl, Sortierung, Toolbar-Aktionen und mobile Darstellung konsistent abbildet. Die Tabelle MUST ihren Sortiermodus explizit als deaktiviert, clientseitig auf einem vollständigen Datenbestand oder extern kontrolliert deklarieren. Eine bereits paginierte Ergebnismenge darf sie nicht nochmals als vermeintlichen Gesamtbestand sortieren. Externe Sortierung MUST genau ein aktives Feld besitzen, fehlende Werte unabhängig von der Richtung zuletzt einordnen und Gleichstände abschließend mit der eindeutigen Zeilenidentität aufsteigend stabilisieren.

#### Scenario: Tabelle mit Bulk-Aktionen und Sortierung

- **WHEN** eine Studio-Verwaltungsseite tabellarische Daten anzeigt
- **THEN** enthält die Tabelle optional eine Auswahlspalte als erste Spalte
- **AND** sortierbare Spaltenköpfe zeigen ihren Sortierzustand zugänglich an
- **AND** eine Aktionsspalte wird als letzte Spalte gerendert
- **AND** eine Toolbar oberhalb der Tabelle kann Bulk-Aktionen, Filter und sekundäre Aktionen aufnehmen

#### Scenario: Clientseitige Sortierung erhält den vollständigen gefilterten Datenbestand

- **GIVEN** eine Tabelle verwendet clientseitige Sortierung
- **WHEN** die Tabelle einen Sortierwechsel verarbeitet
- **THEN** enthält ihre Datenquelle den vollständigen, durch Berechtigungen und aktuelle Filter definierten Datenbestand
- **AND** erfolgt eine Pagination erst nach dieser Sortierung

#### Scenario: Extern sortierte Tabelle erhält eine einzelne Seite

- **GIVEN** eine Tabelle erhält nur eine bereits paginierte Ergebnisseite
- **WHEN** ein Benutzer die Sortierung ändert
- **THEN** delegiert die Tabelle die Sortierung an den kontrollierten externen Listenvertrag
- **AND** verändert die Tabellenkomponente die Reihenfolge der empfangenen Seite nicht selbst
- **AND** beginnt die externe Pagination wieder auf Seite eins

#### Scenario: Externe Sortierung besitzt keinen unsichtbaren Defaultzustand

- **GIVEN** eine paginierte Tabelle verwendet externe Sortierung
- **WHEN** ein Benutzer den aktiven Sortierkopf wiederholt betätigt
- **THEN** wechselt die Richtung ausschließlich zwischen aufsteigend und absteigend
- **AND** bleibt jederzeit genau ein Sortierfeld sichtbar aktiv
- **AND** entspricht der angezeigte Zustand den an die externe Quelle gesendeten Parametern

#### Scenario: Fehlende und gleiche Sortierwerte bleiben deterministisch

- **GIVEN** eine externe Liste enthält fehlende oder gleiche Werte im aktiven Sortierfeld
- **WHEN** die vollständige gefilterte Menge aufsteigend oder absteigend sortiert wird
- **THEN** stehen fehlende Werte in beiden Richtungen am Ende
- **AND** ersetzt das System fehlende Werte nicht durch ein anderes Fachfeld
- **AND** ordnet es Gleichstände abschließend nach eindeutiger Zeilenidentität aufsteigend

#### Scenario: Mobile Darstellung einer Verwaltungs-Tabelle

- **WHEN** eine Studio-Verwaltungsseite auf kleinem Viewport geöffnet wird
- **THEN** wird die Tabelle als mobile Kartenansicht mit denselben Kerndaten und Aktionen nutzbar dargestellt
- **AND** Auswahl- und Aktionsmuster bleiben funktionsgleich erreichbar
- **AND** ein vorhandener Sortierzustand entspricht demselben globalen Datenvertrag wie in der Desktop-Darstellung
- **AND** kann ein Benutzer ein unterstütztes Sortierfeld und dessen Richtung über zugängliche mobile Bedienelemente ändern
- **AND** verwenden Desktop- und Mobilbedienung denselben kontrollierten Zustand

#### Scenario: Nicht global unterstützte Sortierung wird nicht angeboten

- **GIVEN** eine paginierte Datenquelle kann ein sichtbares Feld nicht auf dem vollständigen gefilterten Datenbestand sortieren
- **WHEN** die Tabelle diese Ergebnisse darstellt
- **THEN** bietet sie für dieses Feld keine Sortieraktion an
- **AND** simuliert sie keine Sortierung ausschließlich auf der aktuell sichtbaren Seite

#### Scenario: Jeder Tabellenaufrufer deklariert seine Sortierownership

- **WHEN** eine App-Route oder ein Plugin die gemeinsame Datentabelle verwendet
- **THEN** deklariert der Aufrufer explizit deaktivierte, clientseitige oder externe Sortierung
- **AND** ist clientseitige Sortierung nur für den vollständigen gefilterten Datenbestand zulässig
- **AND** sind widersprüchliche Kombinationen aus Modus, Spalten, State und Handler typsicher oder durch eine Laufzeitinvariante abgewiesen

### Requirement: Tabs für mehrere Tabellenbereiche

Das Studio SHALL bei mehreren gleichrangigen Tabellenbereichen auf einer Seite ein gemeinsames Tabs-Muster verwenden.

#### Scenario: Seite mit mehreren Tabellenbereichen

- **WHEN** eine Verwaltungsseite mehrere gleichrangige Tabellenbereiche enthält
- **THEN** werden diese Bereiche über ein gemeinsames Tabs-Muster innerhalb des Seiten-Templates organisiert
- **AND** jeder Tab rendert seinen eigenen Tabellen- oder Listeninhalt, ohne ein zweites konkurrierendes Seitenlayout einzuführen

### Requirement: Standardisiertes Detail-Editor-Muster für umfangreiche Redaktionsobjekte

Das Studio SHALL für umfangreiche Redaktionsobjekte ein gemeinsames Detail-Editor-Muster bereitstellen, das mehrere gleichrangige Bearbeitungsbereiche innerhalb einer stabilen, aufgabenorientierten Oberfläche organisiert.

#### Scenario: Umfangreicher Facheditor nutzt Bereichsnavigation

- **WENN** eine Verwaltungs- oder Redaktionsansicht ein umfangreiches Fachobjekt mit mehreren Bearbeitungsbereichen rendert
- **DANN** stellt das Studio eine sichtbare Bereichsnavigation für diese Bearbeitungsbereiche bereit
- **UND** der Benutzer kann direkt zwischen den Bereichen wechseln, ohne konkurrierende Seitenlayouts oder versteckte Sektionen zu durchlaufen

#### Scenario: Bereichsstruktur bleibt für Create und Edit konsistent

- **WENN** derselbe Facheditor im Erstellungs- oder Bearbeitungsfall verwendet wird
- **DANN** bleibt die Bereichsstruktur konsistent
- **UND** das Studio darf den initialen Fokus je nach Modus unterschiedlich setzen, ohne zwei getrennte Editorarchitekturen zu erzeugen

### Requirement: Umfangreiche Formularflows priorisieren aufgabenorientierte Reihenfolge

Das Studio SHALL bei umfangreichen Formularflows die Reihenfolge der Bearbeitungsbereiche am mentalen Modell der Aufgabe statt an der Reihenfolge technischer Datenobjekte ausrichten.

#### Scenario: Redaktionsflow priorisiert Kernaufgaben zuerst

- **WENN** ein Redakteur einen umfangreichen Fachdatensatz erstmals erstellt
- **DANN** erscheinen die Kernaufgaben wie Identität, Ort und primäre Kontaktierbarkeit vor erweiterten oder seltenen Spezialdaten
- **UND** fortgeschrittene Bereiche verdrängen nicht den initialen Pflegefluss

#### Scenario: Erweiterte Daten bleiben außerhalb des Kernflows

- **WENN** ein Formular zusätzliche technische oder selten genutzte Daten enthält
- **DANN** gruppiert das Studio diese Daten in einem erkennbar sekundären Bereich wie `Erweiterte Daten`
- **UND** der Kernflow für Erstnutzer bleibt davon entlastet

### Requirement: Kartenbasierte Ortsbearbeitung ist als Studio-Standardlayout anschlussfähig

Das Studio SHALL für Fachobjekte mit geographischem Schwerpunkt ein anschlussfähiges Layoutmuster bereitstellen, das formularbasierte Ortsdaten und eine Kartenansicht in einer gemeinsamen, responsiven Sektion kombiniert.

#### Scenario: Ortsformular und Karte erscheinen gemeinsam

- **WENN** ein Facheditor räumliche Daten wie Adresse und Geo-Koordinaten pflegt
- **DANN** können Formularfelder und Kartenansicht gemeinsam in derselben Bearbeitungssektion erscheinen
- **UND** die Layoutstruktur bleibt auf Desktop und Mobilgeräten nutzbar

#### Scenario: Kartenbereich bleibt ein fachlicher Bestandteil der Sektion

- **WENN** ein Fachobjekt eine Karteninteraktion zur Datenpflege nutzt
- **DANN** erscheint die Karte als Teil der fachlichen Ortssektion und nicht als losgelöster technischer Spezialdialog
- **UND** Formular- und Karteninteraktion bleiben für Redakteure als zusammengehöriger Arbeitsschritt erkennbar

#### Scenario: Kartenbereich arbeitet mit Adresssuche zusammen

- **WENN** ein Facheditor eine adressbasierte Ortssuche anbietet
- **DANN** können Suchtreffer die Kartenposition und den Marker aktualisieren
- **UND** die Karte bleibt der führende visuelle Ort für Auswahl und Kontrolle der Geo-Position

### Requirement: Wiederholte Primäraktionen für lange Bearbeitungsflächen

Das Studio SHALL gemeinsame UI-Verträge bereitstellen, mit denen lange seitengroße oder eingebettete Bearbeitungsflächen dieselbe Primäraktion oberhalb und unterhalb ihres fachlichen Inhalts anzeigen. Die Verträge SHALL einheitliche Abstände, Ausrichtung und visuelle Trennung verwenden, ohne fachliche Aktionslogik zu besitzen.

#### Scenario: Detailseite stellt eine Primäraktion bereit

- **GIVEN** eine lange Detailseite übergibt eine Primäraktion
- **WHEN** das gemeinsame Detailseiten-Template gerendert wird
- **THEN** erscheint dieselbe Primäraktion im Seitenkopf und nach dem Seiteninhalt
- **AND** ausschließlich für den Seitenkopf bestimmte Sekundäraktionen werden nicht automatisch wiederholt

#### Scenario: Eingebettete Bearbeitungsfläche besitzt eine eigene Mutationsgrenze

- **GIVEN** eine lange Tabelle, Liste oder Teilfläche wird unabhängig von der umgebenden Detailseite gespeichert
- **WHEN** die gemeinsame Formular-Aktionsleiste verwendet wird
- **THEN** erscheint dieselbe Primäraktion oberhalb und unterhalb dieser Teilfläche
- **AND** die Aktion bleibt an deren eigenen Handler und Zustand gebunden

#### Scenario: Detailseite besitzt keine wiederholte Primäraktion

- **GIVEN** eine Detailseite übergibt keine Primäraktion
- **WHEN** das gemeinsame Detailseiten-Template gerendert wird
- **THEN** erzeugt das Template keine leere untere Aktionsfläche

### Requirement: Die Sidebar gruppiert die Inhaltsnavigation nach lesbarem Datentyp

Die Layout-Shell MUST den Bereich `Inhalte` als zugängliche Navigationsgruppe mit einem Einstieg für alle Inhalte und berechtigungsabhängigen Einstiegen für registrierte Inhaltstypen darstellen.

#### Scenario: Benutzer öffnet die Inhaltsgruppe

- **WENN** ein Benutzer mindestens einen Inhaltstyp lesen darf
- **DANN** zeigt die Sidebar `Inhalte` als aufklappbare Gruppe
- **UND** steht `Alle` als erster Unterpunkt zur Verfügung
- **UND** folgen ausschließlich registrierte Inhaltstypen, deren Read-Action und Modulzuweisung im aktuellen Kontext erfüllt sind
- **UND** verwenden alle Unterpunkte die kanonische gemeinsame Inhaltsroute `/admin/content`

#### Scenario: Benutzer öffnet einen typbezogenen Unterpunkt

- **WENN** ein Benutzer einen Inhaltstyp-Unterpunkt wie Nachrichten, Veranstaltungen oder POI auswählt
- **DANN** setzt die Navigation den registrierten `contentType` als `type`-Search-Parameter der gemeinsamen Inhaltsroute
- **UND** bleibt genau dieser Unterpunkt aktiv
- **UND** bleibt die Inhaltsgruppe geöffnet

#### Scenario: Alle Inhalte sind aktiv

- **WENN** die Route `/admin/content` keinen gültigen expliziten Typfilter enthält
- **DANN** ist ausschließlich der Unterpunkt `Alle` aktiv
- **UND** ist kein typbezogener Unterpunkt fälschlich aktiv

#### Scenario: Typbezogener Editor hält den Navigationskontext

- **WENN** ein Benutzer eine registrierte Erstellungs- oder Detailroute eines Inhaltstyps öffnet
- **DANN** bleibt die Inhaltsgruppe aktiv und geöffnet
- **UND** ist der zugehörige Inhaltstyp-Unterpunkt aktiv

#### Scenario: Inhaltsgruppe bleibt responsiv und zugänglich

- **WENN** die Sidebar erweitert, eingeklappt oder als mobiler Drawer dargestellt wird
- **DANN** bleiben alle sichtbaren Inhalts-Unterpunkte per Tastatur und Screenreader erreichbar
- **UND** sind Öffnungs- und Auswahlzustand semantisch erkennbar
- **UND** verursacht die Gruppe kein horizontales Layout-Breaking

### Requirement: Studio-Buttons bilden eine zugängliche Aktionshierarchie ab

Das Studio MUST für neutrale Aktionen die eindeutig benannten Buttonvarianten `primary`, `secondary` und `tertiary` bereitstellen. Primary MUST die wichtigste fachliche Aktion eines Bereichs kennzeichnen, Secondary MUST unterstützende sichtbare Aktionen abbilden und Tertiary MUST nachrangige oder kompakte Aktionen darstellen. Risikobehaftete Aktionen MUST über eine separate `destructive`-Variante erkennbar bleiben.

#### Scenario: Seite zeigt abgestufte Aktionen

- **WENN** eine Studioseite eine primäre, eine unterstützende und eine nachrangige Aktion gemeinsam rendert
- **DANN** verwendet sie dafür Primary, Secondary und Tertiary
- **UND** die Varianten bleiben ohne Kenntnis ihrer technischen Implementierungsnamen fachlich unterscheidbar
- **UND** die Seite erzeugt keine konkurrierende lokale Button-Hierarchie

#### Scenario: Buttonvariante wird ausgelassen

- **WENN** ein Studio-Button keine explizite Variante erhält
- **DANN** wird er als Primary gerendert
- **UND** diese Voreinstellung ist im Variantentyp und in automatisierten Tests eindeutig abgesichert

#### Scenario: Aktion ist destruktiv

- **WENN** eine Aktion eine risikobehaftete Wirkung wie Löschen, Deaktivieren oder Entziehen besitzt
- **DANN** verwendet sie die Destructive-Variante statt einer neutralen Hierarchiestufe
- **UND** bestehende Bestätigungs-, Berechtigungs- und Fehlerverträge bleiben erhalten

### Requirement: Buttonfarben sind theme-, modus- und zustandsübergreifend kontrastreich

Das Studio MUST Buttonfarben über zentrale semantische Action-State-Tokens für Default- und Forest-Theme sowie Light- und Dark-Mode auflösen. Aktiver Buttontext MUST in Default-, Hover-, Active-, Focus- und Loading-Zustand mindestens 4,5:1 Kontrast gegen seine unmittelbare Fläche erreichen. Fokusindikatoren und relevante nicht-textliche Zustandsinformationen MUST mindestens 3:1 Kontrast gegen angrenzende Farben erreichen.

#### Scenario: Theme oder Modus wechselt

- **WENN** ein Benutzer zwischen Light- und Dark-Mode wechselt oder das Studio Default- beziehungsweise Forest-Theme aktiviert
- **DANN** lösen Primary, Secondary, Tertiary und Destructive ihre Vordergrund-, Flächen- und Fokusfarben aus demselben semantischen Action-Tokenvertrag auf
- **UND** jede aktive Textkombination erreicht mindestens 4,5:1 Kontrast
- **UND** der Forest-Dark-Primary verwendet auf seiner hellen grünen Fläche einen ausreichend kontrastreichen Vordergrund

#### Scenario: Buttonzustand ändert sich

- **WENN** ein Button in Hover, Active, Focus oder Loading wechselt
- **DANN** verwendet der Zustand eine explizit definierte Tokenkombination
- **UND** der Zustand hängt nicht von einer transparenten Farbmischung mit dem unbekannten Untergrund ab
- **UND** die normativen Kontrastschwellen bleiben erfüllt

#### Scenario: Button liegt auf unterschiedlichen Studioflächen

- **WENN** derselbe Button auf Page-, Card-, Dialog- oder Popover-Flächen gerendert wird
- **DANN** bleiben Text, Zustand und Fokusindikator zugänglich erkennbar
- **UND** automatisierte Browserprüfungen decken die relevanten Untergründe ab

#### Scenario: Button ist deaktiviert

- **WENN** eine Aktion nicht ausführbar ist und der Button deaktiviert wird
- **DANN** verwendet er definierte Disabled-Farben statt ausschließlich die gesamte aktive Darstellung pauschal halbtransparent zu machen
- **UND** der Zustand ist visuell und semantisch als nicht bedienbar erkennbar

### Requirement: Studio-Buttons besitzen zugängliche Zielgrößen und Zustände

Das Studio MUST für Standard-, kompakte und Icon-Buttons eine wirksame Interaktionsfläche von mindestens 44 x 44 Pixel bereitstellen. Reine Icon-Buttons MUST einen zugänglichen Namen besitzen und ihren ergänzenden Tooltip bei Pointer-Hover und Tastaturfokus anzeigen. Lade- und Fokuszustände MUST semantisch und visuell erkennbar sein.

#### Scenario: Benutzer bedient einen Icon-Button

- **WENN** ein Benutzer einen reinen Icon-Button mit Pointer, Touch oder Tastatur erreicht
- **DANN** beträgt seine wirksame Interaktionsfläche mindestens 44 x 44 Pixel
- **UND** der Button besitzt einen zugänglichen Namen
- **UND** sein Tooltip erscheint bei Pointer-Hover und Tastaturfokus
- **UND** der Tooltip ersetzt den zugänglichen Namen nicht

#### Scenario: Button zeigt einen Ladezustand

- **WENN** eine Buttonaktion läuft
- **DANN** ist der Button gegen Doppelauslösung gesperrt
- **UND** stellt er den Ladezustand über `aria-busy` bereit
- **UND** bleibt sein sichtbarer Text- und Fokuskontrast innerhalb des aktiven Buttonvertrags

#### Scenario: Benutzer navigiert per Tastatur

- **WENN** ein Benutzer einen Button per Tastatur fokussiert und auslöst
- **DANN** ist ein mindestens 2 Pixel starker Fokusindikator mit mindestens 3:1 Kontrast sichtbar
- **UND** Hover-, Tooltip- oder Ladeverhalten verursacht keinen Fokusverlust

#### Scenario: Benutzer reduziert Bewegung

- **WENN** das Betriebssystem reduzierte Bewegung anfordert
- **DANN** verzichtet der Button auf nicht notwendige Zustandsanimationen
- **UND** alle Zustände bleiben ohne Bewegung erkennbar

### Requirement: Studio-Tabellen unterscheiden Aktionen, Status und anklickbare Informationen konsistent

Das Studio MUST für Tabellen drei gemeinsame Interaktionsmuster bereitstellen: Icon-Aktionen, Status-Badges und anklickbare Informationen. Die Muster MUST in `@sva/studio-ui-react` besessen werden und MUST ihre jeweilige Semantik, sichtbare Zustände und zugängliche Bedienung konsistent abbilden.

#### Scenario: Tabelle zeigt eine Icon-Aktion

- **WENN** eine Tabellenzeile eine Aktion wie Bearbeiten, Duplizieren, Löschen oder Öffnen eines Kalenders anbietet
- **DANN** verwendet die Aktion ein Icon mit zugänglichem Namen
- **UND** zeigt sie einen Tooltip bei Pointer-Hover und Tastaturfokus
- **UND** erhält sie bei Hover einen semantischen Aktionshintergrund
- **UND** behält sie die wirksame Mindestzielgröße des gemeinsamen Button-Vertrags
- **UND** wird ihr Tooltip nicht von scrollenden oder abgeschnittenen Tabellencontainern verdeckt

#### Scenario: Icon-Aktion erscheint in einer mobilen Tabellenkarte

- **WENN** eine nicht selbsterklärende Icon-Aktion ohne verlässlichen Hover in der mobilen Kartenansicht erscheint
- **DANN** erhält sie zusätzlich eine sichtbare Beschriftung
- **UND** bleibt ihr zugänglicher Name mit der Desktop-Aktion identisch
- **UND** wird eine fachlich komplexe Aktion nicht allein für visuelle Einheitlichkeit in ein mehrdeutiges Icon umgewandelt

#### Scenario: Tabelle zeigt anklickbare und reine Informationen

- **WENN** eine Zelle eine anklickbare Information neben nicht interaktiven Textzellen enthält
- **DANN** ist die anklickbare Information bereits im Ruhezustand durch semantische Aktionsfarbe und mindestens mittlere Schriftstärke unterscheidbar
- **UND** erhält sie bei Hover und Tastaturfokus eine Unterstreichung ohne Hintergrundwechsel
- **UND** besitzt sie einen sichtbaren Fokuszustand
- **UND** verwendet sie für Navigation einen Link und für Dialog- oder lokale Aktionen einen Button
- **UND** bleibt reiner Text ohne interaktive Darstellung und ohne Fokusziel

#### Scenario: Tabelle zeigt einen änderbaren Status

- **WENN** eine Zelle einen fachlichen Status darstellt
- **DANN** zeigt sie ein beschriftetes semantisches Status-Badge
- **UND** vermittelt sie den Status nicht ausschließlich durch Farbe
- **UND** öffnet ein änderbares Status-Badge über einen semantischen Button ein zugängliches Dialogmuster für Auswahl oder Bestätigung
- **UND** besitzt das änderbare Badge eine sichtbare Bearbeitungsaffordance
- **UND** schließt der Dialog nach einer Mutation nur bei Erfolg
- **UND** bleibt er bei einem Fehler mit verständlicher Fehlermeldung und nächstem Schritt geöffnet
- **UND** bleibt ein nicht änderbarer Status ohne irreführende Interaktivität sichtbar

#### Scenario: Primäre Zeilenidentität und Aktionsspalte führen zum selben Ziel

- **WENN** eine primäre anklickbare Information bereits das vorhandene Öffnen- oder Bearbeitungsziel einer Zeile anbietet
- **DANN** rendert die Aktionsspalte kein redundantes Icon für dasselbe Ziel
- **UND** bleiben eigenständige Aktionen mit abweichender Wirkung separat erreichbar

#### Scenario: Tabelle zeigt Beziehungen oder Metadaten

- **WENN** eine Zelle eine Beziehung oder Information wie Tour, Fraktion, Abholort oder Verschiebung darstellt
- **DANN** verwendet sie das Informationsmuster statt eines Status-Badges
- **UND** bleibt die fachliche Unterscheidung zwischen Zustand und Beziehung visuell eindeutig

### Requirement: Studio-Tabellen richten Body-Zellen einheitlich oben aus

Das Studio MUST alle Tabellen-Body-Zellen bei einheitlichem vertikalem Zell-Padding oben ausrichten. Controls MUST innerhalb ihrer eigenen Trefferfläche zentriert bleiben, ohne die Ausrichtung der umgebenden Zelle zu verändern.

#### Scenario: Zeile enthält unterschiedlich hohe Inhalte

- **WENN** eine Tabellenzeile einzeilige Werte, mehrzeilige Informationen, einen Status oder eine Aktionsgruppe enthält
- **DANN** beginnen alle Body-Zellen an derselben oberen Leselinie
- **UND** verwendet keine einzelne Body-Zelle aufgrund ihres Inhaltstyps eine abweichende vertikale Ausrichtung

#### Scenario: Oben ausgerichtete Zelle enthält ein Control

- **WENN** eine oben ausgerichtete Body-Zelle einen Button, ein Badge, eine Checkbox oder ein anderes Control enthält
- **DANN** bleibt das Control innerhalb seiner eigenen Trefferfläche zentriert
- **UND** bleibt die Trefferfläche als Ganzes an der oberen Zellkante ausgerichtet

#### Scenario: Tabelle rendert einen Tabellenkopf

- **WENN** eine Tabelle ihre Spaltenköpfe in einer festen Kopfhöhe rendert
- **DANN** dürfen die Inhalte der Kopfzellen innerhalb dieser Höhe mittig ausgerichtet werden
- **UND** ändert dies nicht den Top-Ausrichtungsstandard der Body-Zellen

### Requirement: Gemeinsame Editor-Primitives übernehmen bewährtes Verhalten ohne Plugin-Duplikate

Das Studio MUST gemeinsame Editor-Primitives aus nachgewiesenen Verhaltensmustern mehrerer produktiver Content-Plugins ableiten. Die Vereinheitlichung MUST allgemeine Layout- und Interaktionsverantwortung in `studio-ui-react` bündeln und pluginlokale Basisimplementierungen entfernen oder auf fachliche Zusammensetzung reduzieren.

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

### Requirement: Fachliche Content-Editoren verwenden den gemeinsamen Studio-Detail-Workspace

Das Studio MUST FAQ, Kacheln und offene GenericItems über die gemeinsamen Detailseiten-, Tab-, Panel-, Formularstatus- und Dialog-Primitives darstellen. Die Fachplugins MUST ihre fachlichen Felder und Validierungen selbst besitzen, dürfen aber keine parallelen Basisimplementierungen für dieselben Studio-Interaktionen einführen.

#### Scenario: Detail-Workspace wird auf Desktop dargestellt

- **WHEN** ein Benutzer FAQ, Kacheln oder GenericItems erstellt oder bearbeitet
- **THEN** verwendet der Editor das gemeinsame Detailseiten-Template und die gemeinsame Bereichsnavigation
- **AND** erklärt eine fachliche Seitenbeschreibung Zweck und Umfang des Editors
- **AND** Tab-Header, Panel-Flächen, Beschreibungen, Abstände und Aktionen folgen denselben semantischen Studio-Tokens
- **AND** pluginlokale Komponenten beschränken sich auf die Zusammensetzung fachlicher Felder

#### Scenario: Primäraktion erstellt einen neuen Fachinhalt

- **WHEN** ein Benutzer einen neuen Fachinhalt erstellt
- **THEN** benennt die Primäraktion das Erstellen eindeutig
- **AND** bleibt die Aktion bis zum Mutationsstart verfügbar und ist während der laufenden Mutation gesperrt

#### Scenario: Primäraktion aktualisiert einen bestehenden Fachinhalt

- **WHEN** ein Benutzer einen bestehenden Fachinhalt bearbeitet
- **THEN** benennt die Primäraktion das Aktualisieren eindeutig
- **AND** bleibt die Aktion bis zum Mutationsstart verfügbar und ist während der laufenden Mutation gesperrt

#### Scenario: Detail-Workspace wird mobil dargestellt

- **WHEN** ein Benutzer denselben Editor auf einem kleinen Viewport öffnet
- **THEN** bietet der gemeinsame Detail-Workspace eine sichtbare und beschriftete mobile Bereichsauswahl
- **AND** alle fachlichen Bereiche bleiben ohne horizontales Layout-Breaking erreichbar

#### Scenario: Formularzustand bleibt beim Bereichswechsel erhalten

- **GIVEN** ein Benutzer hat Werte, wiederholbare Einträge oder Validierungsfehler in einem Formularbereich
- **WHEN** er mehrfach zwischen Editorbereichen wechselt
- **THEN** bleiben Werte, Reihenfolge, Dirty-State und Fehler erhalten
- **AND** ein noch nicht besuchter History-Bereich darf weiterhin erst beim ersten Öffnen geladen werden

### Requirement: Studio-Formulare zeigen Status und Fehler einheitlich und feldbezogen

Das Studio MUST Speicherstatus, API-Fehler und Validierungsfehler in Content-Editoren über die gemeinsamen Form-Summary-Primitives darstellen. Feldbezogene Fehler MUST eine stabile Zuordnung zum betroffenen Feld und dessen Editorbereich besitzen.

#### Scenario: Fehler befindet sich im aktiven Bereich

- **WHEN** eine Formularvalidierung im sichtbaren Editorbereich fehlschlägt
- **THEN** zeigt das Studio den Fehler in der gemeinsamen Zusammenfassung und bei Bedarf inline am Feld
- **AND** ein Fehlerverweis fokussiert das eindeutig zugeordnete Feld

#### Scenario: Fehler befindet sich in einem anderen Bereich

- **WHEN** ein Fehlerverweis auf ein Feld in einem inaktiven Editorbereich zeigt
- **THEN** aktiviert das Studio zuerst den zugehörigen Bereich
- **AND** fokussiert anschließend das betroffene Feld
- **AND** verwirft keine bereits erfassten Formulardaten

#### Scenario: Mutation schlägt fehl

- **WHEN** Speichern oder Löschen serverseitig fehlschlägt
- **THEN** zeigt das Studio einen zugänglichen Fehlerstatus mit einer korrigierbaren nächsten Handlung
- **AND** bestehende Formularwerte bleiben erhalten

### Requirement: Destruktive Content-Aktionen verlangen eine gemeinsame Bestätigung

Das Studio MUST für das Löschen von FAQ, Kacheln und GenericItems denselben zugänglichen Bestätigungsdialog verwenden. Ohne ausdrückliche Bestätigung darf keine Löschmutation ausgeführt werden.

#### Scenario: Benutzer bricht das Löschen ab

- **WHEN** ein Benutzer den Löschdialog abbricht
- **THEN** führt das Studio keine Mutation und keine Navigation aus
- **AND** gibt den Fokus an die auslösende Aktion zurück

#### Scenario: Benutzer bestätigt das Löschen

- **WHEN** ein Benutzer das Löschen ausdrücklich bestätigt
- **THEN** sperrt das Studio weitere Lösch- und Bestätigungsaktionen bis zum Abschluss
- **AND** führt genau eine Löschmutation aus
- **AND** navigiert nach Erfolg zur kanonischen Inhaltsübersicht

#### Scenario: Bestätigte Löschung schlägt fehl

- **WHEN** die bestätigte Löschmutation fehlschlägt
- **THEN** bleibt der Dialog mit einem sichtbaren Fehlerzustand bedienbar
- **AND** der Benutzer kann abbrechen oder einen kontrollierten erneuten Versuch auslösen

### Requirement: Die Studio-Shell bietet kontextbezogene Seitenhilfe an

Die gemeinsame Studio-Shell MUST auf jeder dokumentierbaren produktiven Seite unmittelbar rechts neben der primären H1 einen konsistenten, zugänglichen Fragezeichen-Icon-Button für die aktuelle Anwenderdokumentation anzeigen. Beim Aktivieren MUST sie den Inhalt in einem responsiven Overlay darstellen, ohne den Zustand der darunterliegenden Fachseite zu verändern.

#### Scenario: Dokumentierbare Seite wird geöffnet

- **WENN** der tiefste aktive Route-Match eine Dokumentations-ID besitzt
- **DANN** zeigt die Shell unmittelbar rechts neben der primären H1 einen Fragezeichen-Icon-Button mit dem zugänglichen Namen „Hilfe öffnen“
- **UND** besitzt der Button eine mindestens 44 × 44 Pixel große interaktive Fläche
- **UND** zeigt die Shell kein zusätzliches flächiges Hilfehinweisfeld
- **UND** verwendet sie für alle zugänglichen oder sichtbaren Texte i18n-Schlüssel

#### Scenario: Ausgeschlossene Seite wird geöffnet

- **WENN** die aktive Seite einen Ausschlussgrund statt einer Dokumentations-ID besitzt
- **DANN** zeigt die Shell keinen kontextbezogenen Hilfeauslöser

#### Scenario: Anwender öffnet die Hilfe

- **WENN** der Anwender den Hilfe-Icon-Button per Maus, Tastatur oder assistiver Technologie aktiviert
- **DANN** öffnet die Shell ein benanntes Overlay mit Fokusfalle, Escape-Unterstützung und internem Scrollbereich
- **UND** setzt sie den Fokus beim Schließen auf den auslösenden Icon-Button zurück
- **UND** bietet sie einen Link zur vollständigen statischen Dokumentationsseite an

#### Scenario: Hilfe wird auf kleinem Viewport geöffnet

- **WENN** das Overlay auf einem kleinen Viewport dargestellt wird
- **DANN** nutzt es eine nahezu vollflächige, ohne horizontales Scrollen bedienbare Darstellung
- **UND** bleiben Schließen-Aktion und Dokumenttitel sichtbar beziehungsweise erreichbar

#### Scenario: Inhalt wird geladen

- **WENN** das Overlay geöffnet wird und der Inhalt noch nicht vorliegt
- **DANN** zeigt es einen neutralen, zugänglichen Ladezustand
- **UND** lädt es den Inhalt erst für die konkrete Interaktion

#### Scenario: Hilfe kann nicht geladen werden

- **WENN** die Hilfe-Fassade einen begrenzten Fehler zurückgibt oder Markdown nicht sicher gerendert werden kann
- **DANN** zeigt das Overlay einen verständlichen Fehlerzustand mit Retry-Aktion
- **UND** bleiben Navigation, Seiteninhalt, Formularzustand und Fachaktionen unterhalb des Overlays unverändert

#### Scenario: Markdown wird dargestellt

- **WENN** valider Markdown-Inhalt geladen wurde
- **DANN** rendert das Overlay Überschriften, Absätze, Listen, Tabellen, Links und Codeblöcke semantisch mit Studio-Design-Tokens
- **UND** hält die Überschriftenhierarchie den Overlay-Titel als führende Überschrift ein

### Requirement: Gemeinsamer Rich-Text-Editor bietet WYSIWYG und HTML-Quelltext

Das Studio MUST für HTML-basierte Rich-Text-Felder einen gemeinsamen Editor bereitstellen, der zwischen visueller Bearbeitung und editierbarem HTML-Quelltext wechseln kann, ohne einen parallelen fachlichen Wert oder eine zweite Editor-Engine einzuführen.

#### Scenario: Redaktion wechselt verlustfrei in die HTML-Ansicht

- **GIVEN** ein Rich-Text-Feld enthält gültiges, vom Editor unterstütztes HTML
- **WHEN** der Benutzer von WYSIWYG zu HTML wechselt, den Quelltext bearbeitet und zurückwechselt
- **THEN** verwenden beide Ansichten denselben kontrollierten HTML-Wert
- **AND** bleiben unterstützte Inhalte und Formatierungen erhalten
- **AND** bleiben numerische Startwerte nummerierter Listen erhalten

#### Scenario: Nicht unterstütztes HTML wird beim visuellen Wechsel normalisiert

- **GIVEN** der Benutzer trägt in der HTML-Ansicht nicht unterstützte Tags oder Attribute ein
- **WHEN** er zurück in die WYSIWYG-Ansicht wechselt
- **THEN** normalisiert der Editor den Wert deterministisch nach seinem konfigurierten Schema
- **AND** übermittelt er den tatsächlich dargestellten normalisierten HTML-Wert über denselben Änderungsvertrag

#### Scenario: Moduswechsel ist barrierefrei bedienbar

- **WHEN** ein Benutzer den Editor mit Tastatur oder assistiver Technologie bedient
- **THEN** sind WYSIWYG- und HTML-Modus eindeutig benannt und als aktueller Modus erkennbar
- **AND** besitzen Editor beziehungsweise Quelltextfeld dieselben Beschriftungs-, Beschreibungs- und Fehlerbeziehungen

### Requirement: Gemeinsamer Rich-Text-Editor führt Formatierung auf echter Auswahl aus

Das Studio MUST Link- und Blockformatierungsbefehle des gemeinsamen Rich-Text-Editors über die TipTap-Command-API auf der aktuellen Editor-Auswahl ausführen.

#### Scenario: Markierter Text erhält einen Link

- **GIVEN** ein Benutzer hat Text im WYSIWYG-Modus markiert
- **WHEN** er eine gültige Link-URL übernimmt
- **THEN** wird genau die aktuelle Markierung als Link formatiert
- **AND** bleibt der übrige Inhalt unverändert

#### Scenario: Absatz wird als Überschrift formatiert

- **GIVEN** die aktuelle Auswahl liegt in einem Absatz
- **WHEN** der Benutzer eine unterstützte Überschriftenebene wählt
- **THEN** formatiert TipTap den betroffenen Block als diese Überschrift
- **AND** übermittelt der Editor den aktualisierten HTML-Wert

#### Scenario: Gemischte Formatierung wird entfernt

- **GIVEN** markierter Text enthält unterschiedliche Inline-Formatierungen
- **WHEN** der Benutzer die Aktion „Formatierung entfernen“ ausführt
- **THEN** entfernt TipTap die Markierungen aus der aktuellen Auswahl
- **AND** bleibt der Textinhalt erhalten

### Requirement: Gemeinsame technische Content-Editor-Primitives

Das Studio SHALL in `studio-ui-react` gemeinsame React-Primitives und
Controller für nachweislich wiederkehrende technische Content-Editor-Abläufe
bereitstellen, damit mehrere Content-Editoren dieselben hosteigenen UI-, Map-,
Media-Picker- und Reference-Retry-Verträge nutzen.

#### Scenario: Mehrere Editoren nutzen denselben technischen Controller

- **GIVEN** mindestens zwei Content-Editoren besitzen denselben technischen
  Zustands- und Fehlerablauf
- **WHEN** dieser Ablauf konsolidiert wird
- **THEN** verwenden die Editoren denselben gemeinsamen Controller aus
  `studio-ui-react`
- **AND** pluginlokale Payloads, Texte, Navigation und Fachregeln bleiben über
  kleine explizite Eingaben beim jeweiligen Plugin

#### Scenario: Location-Map-Lifecycle wird gemeinsam betrieben

- **GIVEN** Events, Generic Items und POI verwenden denselben Map-, Marker-,
  Viewport- und Cleanup-Ablauf
- **WHEN** ihre Location-Editoren materialisiert werden
- **THEN** nutzen sie denselben strukturell typisierten React-Lifecycle
- **AND** der gemeinsame Vertrag führt keine zweite Map-Dependency oder
  Providerlogik ein

#### Scenario: Reference-Retry wiederholt keine Content-Mutation

- **GIVEN** ein Content-Item wurde gespeichert und nur seine
  Medienreferenz-Synchronisation ist fehlgeschlagen
- **WHEN** der Benutzer den Reference-Retry ausführt
- **THEN** wird ausschließlich die Referenzoperation wiederholt
- **AND** die bereits erfolgreiche Content-Mutation wird nicht erneut gesendet

### Requirement: Frameworkfreie gemeinsame Plugin-Clientverträge

Das Studio SHALL frameworkfreie Normalisierungs- und Host-Clientverträge, die
von mehreren Content-Plugins identisch benötigt werden, in `plugin-sdk`
besitzen.

#### Scenario: Listenparameter werden zentral normalisiert

- **GIVEN** Events, Generic Items, POI und Projects verwenden dieselben
  Seitengrößen-, Default- und Offsetregeln
- **WHEN** ein Plugin seine List-Search-Parameter normalisiert
- **THEN** verwendet es den gemeinsamen Vertrag aus `plugin-sdk`
- **AND** es existiert keine parallele pluginlokale Implementierung derselben
  Regeln

#### Scenario: Geocoding-Konfiguration wird zentral dedupliziert

- **GIVEN** mehrere Plugins lesen dieselbe hostseitige Map-/Geocoding-
  Konfiguration
- **WHEN** gleichzeitige Reads stattfinden
- **THEN** dedupliziert der gemeinsame Client den laufenden Read
- **AND** ein fehlgeschlagener Read bleibt nicht dauerhaft gecacht

### Requirement: Ersetzte Editor-Implementierungen werden entfernt

Das Studio SHALL bei der Einführung gemeinsamer Editor-Verträge die ersetzten
lokalen Implementierungen im selben Migrationsblock entfernen und eine
prüfbare Löschbilanz führen.

#### Scenario: Migration löscht den lokalen Altpfad

- **GIVEN** ein Plugin wurde auf einen gemeinsamen Editor-Vertrag umgestellt
- **WHEN** der Migrationsblock abgeschlossen wird
- **THEN** sind ersetzte lokale Dateien, Funktionen, Exporte, Zustände und
  Inline-Abläufe gelöscht
- **AND** es verbleibt kein dauerhafter Weiterleitungswrapper oder paralleler
  Altpfad

#### Scenario: Gemeinsamer Code reduziert den produktiven Zielscope

- **GIVEN** der Change fügt gemeinsamen Produktivcode hinzu
- **WHEN** seine Gesamtbilanz über `plugin-sdk`, `studio-ui-react` und alle
  migrierten Plugins erstellt wird
- **THEN** übersteigen hinzugefügte produktive TypeScript-/TSX-Zeilen die
  entfernten produktiven Zeilen nicht
- **AND** Tests und Dokumentation werden getrennt von dieser Bilanz
  ausgewiesen

#### Scenario: Spekulative Abstraktion wird abgewiesen

- **GIVEN** ein vorgeschlagener API-Parameter oder Abstraktionszweig besitzt
  weniger als zwei reale produktive Consumer
- **WHEN** der gemeinsame Vertrag reviewt wird
- **THEN** wird dieser Teil nicht in den gemeinsamen Vertrag aufgenommen
- **AND** die konkrete Fachlogik bleibt lokal lesbar
