# Events- und POI-UI an News-Plugin angleichen Design

## Kontext

Das `News`-Plugin wurde bereits auf eine deutlich strukturiertere Detailansicht mit eigener Detailseite, klaren Seitenaktionen und einer festen Tab-Navigation umgebaut. `Events` und `POI` verwenden dagegen noch stärker monolithische Editorseiten. Dadurch entstehen drei unterschiedliche Bedienlogiken für redaktionell ähnliche Aufgaben.

Für Redakteure ist das unnötig teuer: dieselben Navigations- und Speicheraufgaben fühlen sich je Plugin anders an, obwohl sie im Studio-Kontext denselben Bearbeitungsmodus repräsentieren. Gleichzeitig sind `Events` und `POI` fachlich nicht identisch mit `News`, sodass eine 1:1-Feldkopie das Datenmodell eher verschleiern würde als helfen.

Das Ziel ist deshalb eine gezielte Angleichung an das neue `News`-Muster:

- gleiche Seitenarchitektur
- gleiche Tab-Reihenfolge und Tab-Bedeutung
- gleiche Lage der Seitenaktionen und Statusflächen
- gleiche mentale Nutzerführung
- aber plugin-spezifische Card-Inhalte innerhalb der Tabs

## Ziele

- `Events` und `POI` übernehmen dieselbe Detailseitenarchitektur wie `News`.
- Alle drei Plugins verwenden dieselbe feste Tab-Struktur:
  - `Basis`
  - `Inhalt`
  - `Einstellungen`
  - `Historie`
- Die Unterschiede zwischen `News`, `Events` und `POI` werden nicht über abweichende Tabs modelliert, sondern ausschließlich über die Cards innerhalb der Tabpanels.
- Die Listenansichten von `Events` und `POI` werden an die neuere `News`-Qualität hinsichtlich Seitenkopf, Primäraktion, Zustandsdarstellung und Konsistenz angepasst.
- Die Umsetzung bleibt typensicher und trennt Formularmodell, Mapping und UI-Komposition sauber voneinander.

## Nicht-Ziele

- Kein erzwungener Gleichzug der Fachmodelle von `News`, `Events` und `POI`
- Keine Vereinheitlichung der Mainserver-APIs
- Kein Aufbau eines vollständig generischen Content-Editors für alle Content-Typen
- Kein Redesign der öffentlichen App-Darstellung von Events oder POI
- Keine künstliche Historienfunktion mit Daten, die lokal nicht belastbar verfügbar sind

## Bewertete Ansätze

### Ansatz A: Nur visuelle Angleichung

`Events` und `POI` behalten ihre bestehenden Seitenstrukturen, erhalten aber ähnliche Abstände, Buttons, Karten und Tabellenstile wie `News`.

Vorteile:

- geringster Eingriff
- schnelle optische Konsistenz

Nachteile:

- Interaktionsmuster bleiben unterschiedlich
- spätere Pflege bleibt teuer
- Nutzer müssen je Plugin weiter umlernen

### Ansatz B: Vollständige Übernahme des News-Musters inklusive fester Tabs, aber mit plugin-spezifischen Cards

`Events` und `POI` erhalten dieselbe Seitenarchitektur und dieselben Tabs wie `News`. Fachliche Unterschiede werden nur innerhalb der Tabpanels über unterschiedliche Cards und Feldgruppen abgebildet.

Vorteile:

- konsistente UX über alle drei Plugins
- klare Wiederverwendung des neuen Qualitätsniveaus
- gute Balance aus Einheitlichkeit und Fachmodelltreue

Nachteile:

- größerer Umbau als reine UI-Politur
- benötigt neue Aufteilung der bisherigen Editorlogik

### Ansatz C: Vollständig generischer Content-Host mit schemaähnlicher Feldbeschreibung

Alle drei Plugins würden auf einen stark generischen Editor umgestellt, der Felder über gemeinsame Descriptoren rendert.

Vorteile:

- maximale strukturelle Vereinheitlichung

Nachteile:

- für den aktuellen Bedarf zu groß
- hohes Risiko künstlicher Abstraktion
- schlechtere Lesbarkeit bei plugin-spezifischen Spezialfällen

## Entscheidung

Es wird Ansatz B umgesetzt.

Die feste Tab-Struktur des `News`-Plugins wird zur verbindlichen Referenz für `Events` und `POI`. Die redaktionelle Einheitlichkeit entsteht über identische Navigations- und Bedienmuster. Die fachliche Passung bleibt erhalten, indem die Card-Inhalte je Plugin individuell auf das jeweilige Datenmodell zugeschnitten werden.

## Zielbild

### 1. Seitenarchitektur

`Events` und `POI` erhalten dieselbe grundlegende Bearbeitungsarchitektur wie `News`:

- eigene Detailseite für Create/Edit
- globaler Seitenkopf mit Titel, Kontext und primären Aktionen
- durchgängige Statusflächen für Laden, Fehler und Save-Feedback
- feste Tab-Navigation mit identischer Reihenfolge
- tabbezogene Panels mit einheitlicher äußerer Struktur
- weiße Arbeits-Cards innerhalb der Tabpanels

Die Detailseite soll sich bei allen drei Plugins wie dieselbe Produktoberfläche anfühlen. Unterschiede dürfen in den Inhalten sichtbar sein, nicht in der Navigation oder Seitenmechanik.

### 2. Feste Tab-Struktur

Alle drei Plugins verwenden dieselben Tabs:

#### Tab `Basis`

Der Tab `Basis` bündelt allgemeine redaktionelle Stammdaten und Kerndaten des Datensatzes.

Beispiele:

- `News`: Titel, Autor, Kategorien, Basis-Metadaten
- `Events`: Titel, Kategorie, primäre Beschreibung, grundlegende Zuordnung
- `POI`: Name, Kategorie, Aktiv-Status, Kurzbeschreibung

Wichtig ist nicht Feldgleichheit, sondern Funktionsgleichheit: Der Tab enthält die zuerst erwarteten Kerndaten eines Inhalts.

#### Tab `Inhalt`

Der Tab `Inhalt` ist bei allen Plugins der Sammelort für sämtliche fachlich-inhaltlichen Daten. Es werden keine zusätzlichen Spezialtabs für Termine, Kontakt oder Öffnungszeiten eingeführt.

Beispiele:

- `News`: Textinhalt, Quellen, fachliche Medienzuordnung
- `Events`: Termine, Adressen, Kontakt, Links, Wiederholungsregeln, POI-Bezug
- `POI`: Langbeschreibung, mobile Beschreibung, Kontakt, Öffnungszeiten, Weblinks, Payload-/Zusatzdaten

Die Untergliederung erfolgt ausschließlich über Cards innerhalb dieses Tabs.

#### Tab `Einstellungen`

Der Tab `Einstellungen` bündelt Metadaten, Medienbezüge, statusnahe Felder und sonstige Konfigurationsaspekte, soweit sie im jeweiligen Plugin fachlich sinnvoll sind.

Beispiele:

- Kategorien oder Klassifizierungen, wenn sie nicht schon im Basistab liegen
- Medienreferenzen
- Sichtbarkeitsnahe oder aktivitätsnahe Steuerungen
- technische oder sekundäre Zusatzfelder, die nicht zum primären Inhaltsfluss gehören

Der Tab darf kein Restcontainer ohne Struktur werden. Auch hier müssen die Inhalte in klar benannte Cards aufgeteilt werden.

#### Tab `Historie`

Der Tab `Historie` bleibt über alle Plugins an derselben Stelle und verwendet dieselbe Oberfläche wie `News`.

Wenn für `Events` oder `POI` noch keine echte fachliche Historie belastbar angezeigt werden kann, wird kein abweichendes Sonderlayout eingeführt. Stattdessen wird ein konsistenter reduzierter Zustand verwendet:

- Tabelle oder Historienfläche im gleichen Muster
- klarer Leer- oder Hinweiszustand
- keine vorgetäuschte Vollständigkeit

### 3. Card-Zuschnitt je Plugin

Die Tabs bleiben gleich, die Cards nicht.

#### Events

Vorgesehene Card-Typen:

- `Basis`
  - Stammdaten
  - redaktionelle Kerndaten
- `Inhalt`
  - Termine
  - Orte und Adressen
  - Kontakt
  - Links
  - Wiederholung
  - POI-Verknüpfung
- `Einstellungen`
  - Medien
  - sekundäre Konfigurationen und Metadaten
- `Historie`
  - konsistente Historienansicht oder Placeholder

#### POI

Vorgesehene Card-Typen:

- `Basis`
  - Stammdaten
  - Aktiv-Status
  - redaktionelle Kurzbeschreibung
- `Inhalt`
  - Beschreibungen
  - Kontakt
  - Lage/Adresse
  - Öffnungszeiten
  - Weblinks
  - Zusatzdaten/Payload
- `Einstellungen`
  - Medien
  - sekundäre Metadaten oder technische Zusatzkonfiguration
- `Historie`
  - konsistente Historienansicht oder Placeholder

### 4. Listenansichten

Auch die Listenansichten von `Events` und `POI` werden an das `News`-Niveau angepasst, ohne fachlich identisch werden zu müssen.

Verbindlich angleichen:

- Seitenkopf mit konsistenter Primäraktion
- einheitliche Lade-, Fehler- und Leerzustände
- konsistente Tabellenpräsentation
- identische Pagination-Muster
- gleiche Grundsprache bei Aktionen wie `Anlegen`, `Bearbeiten` und Seitenfeedback

## Technisches Zielbild

### 1. Strukturprinzip

Die heutige Logik in `events.pages.tsx` und `poi.pages.tsx` wird in dieselbe Richtung geschnitten wie beim `News`-Plugin:

- schlanke Routing-/Entry-Komponenten
- zentrale Detailseite pro Plugin
- separate Tab-Komponenten
- getrenntes Formularmodell und Mapping
- saubere Hilfsfunktionen für Dirty-State, Validierung und Payload-Transformation

### 2. Wiederverwendung

Wo `News` bereits ein belastbares Muster vorgibt, soll dieses übernommen oder parallel aufgebaut werden:

- Tab-Definitionen
- Detailseiten-Layout
- globale Save-/Delete-Aktionen
- Form-Summary und Statusmeldungen
- Historien-Tab-Integration

Die Wiederverwendung soll aber nicht zu fachlich unlesbaren Super-Abstraktionen führen. Gemeinsame Mechanik ist erwünscht, erzwungene Feldgenerik nicht.

### 3. Formular- und Mapping-Grenzen

Die Plugin-Logik bleibt Eigentümer ihrer Fachmodelle.

Deshalb gilt:

- `Events` behält ein eigenes typensicheres Formularmodell für Termine, Adressen, Kontakte, Wiederholungen und Links.
- `POI` behält ein eigenes typensicheres Formularmodell für Adresse, Öffnungszeiten, Weblinks, Payload und Aktiv-Status.
- Die UI ordnet diese Daten neu an, verändert aber nicht implizit die Mainserver-Verträge.

## UX- und Qualitätsanforderungen

- Tastaturbedienbare Tabs und korrekte semantische Rollen
- konsistente Fokusführung bei Tab-Wechsel und Save-Feedback
- keine nur farbbasierten Zustandsindikatoren
- gleiche Lage der primären Aktionen über alle Plugins
- gleiche Mentalität der Oberfläche: erst Orientierung, dann fachliche Cards, dann Speichern

## Testfolgen

Die Änderung ist kein reines CSS-Update. Entsprechend müssen Tests auf mehreren Ebenen angepasst werden:

- Unit-Tests für neue Detailseiten- und Tab-Komposition
- Validierungs- und Mapping-Tests für umgeschnittene Formularmodelle
- bestehende Plugin-Seitentests für `Events` und `POI`
- E2E-Anpassungen für die geänderte Nutzerführung, insbesondere im gemeinsamen Pfad für Events/POI

## Offene technische Leitplanken für die Implementierung

- Die Tab-Struktur ist fest und darf nicht je Plugin abweichen.
- Fachliche Unterschiede werden nur innerhalb der Cards modelliert.
- Historie darf bei fehlender Datengrundlage reduziert sein, aber nicht aus der Tab-Navigation verschwinden.
- Die Umsetzung soll möglichst eng an den bereits eingeführten `News`-Mustern bleiben, statt ein viertes eigenständiges UI-Muster im Studio zu schaffen.
