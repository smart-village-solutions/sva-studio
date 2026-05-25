# Studio-Standard für Listen- und Tabellen-Seiten

## Ziel

Verwaltungsseiten im Studio sollen dieselbe Grundstruktur nutzen:

- Breadcrumbs aus der bestehenden Shell
- Seitentitel
- Beschreibungs- oder Infotext
- optionale Primäraktion auf Titelhöhe rechts
- Tabellenfläche mit Toolbar
- Auswahlspalte links, Aktionsspalte rechts
- sortierbare Spaltenköpfe
- Tabs nur bei mehreren gleichrangigen Tabellenbereichen

Der Standard gilt gleichermaßen für host-eigene Verwaltungslisten und für Plugin-Custom-Views, sofern diese primär als Listen- oder Tabellenarbeitsfläche genutzt werden.

## Kanonischer Aufbau

Listen- und Tabellen-Seiten folgen einer festen Hierarchie. Das Ziel ist, dass Nutzerinnen und Nutzer nach dem Öffnen der Seite zuerst den Kontext verstehen, dann den aktiven Arbeitsbereich erkennen und erst danach in Aktionen oder Datensätze einsteigen.

1. Breadcrumbs aus der Shell
2. Seitentitel als `H1`
3. kurze Seitenbeschreibung
4. optionale Primäraktion auf Seitenkopfebene
5. optionale primäre Tab-Navigation für gleichrangige Fachbereiche
6. aktives Tabpanel oder direkter Listenbereich
7. Bereichsüberschrift als `H2` im aktiven Arbeitsbereich
8. kurze Bereichsbeschreibung
9. Toolbar oder Action-Bar des Listenbereichs
10. Tabelle oder Liste
11. Pagination mit Ergebniskontext und Page-Size-Auswahl

Wenn eine Seite keine Tabs benötigt, entfällt nur der Schritt zwischen Seitenkopf und Arbeitsbereich. Die restliche Struktur bleibt gleich.

## Referenzmuster für Plugin-Workspaces

Die Waste-Management-Seite `Abfallkalender` unter `/plugins/waste-management` ist die Referenz für einen tab-basierten Plugin-Workspace mit Tabellenarbeitsfläche.

### Seitenkopf

Der Seitenkopf besteht aus:

- Breadcrumbs zur Shell-Navigation
- einer fachlichen `H1`
- genau einem kurzen Beschreibungssatz
- optionalen globalen Aktionen auf Seitenebene, falls sie nicht fachlich an ein einzelnes Tabpanel gebunden sind

Für Plugin-Seiten gilt:

- Der Seitentitel benennt die Capability oder das Fachmodul, nicht den gerade selektierten Datensatz.
- Der Beschreibungstext erklärt den Gesamtzweck des Plugins, nicht den Zweck eines einzelnen Tabs.
- Globale Aktionen gehören nur dann in den Seitenkopf, wenn sie tabübergreifend gelten.

### Primäre Tabs

Tabs strukturieren gleichrangige Fachbereiche innerhalb derselben Route. Im Referenzmuster des Abfallkalenders sind das zum Beispiel `Abfallarten`, `Touren`, `Abholorte`, `Ausweichtermine`, `Ausgabe`, `Datentools` und `Einstellungen`.

Regeln:

- Tabs werden nur für gleichrangige Teilbereiche verwendet.
- Der aktive Tab muss über typisierte Search-Params abbildbar und nach Reload wiederherstellbar sein.
- Jeder Tab erhält genau ein zugehöriges Tabpanel.
- Tabs ersetzen keine Breadcrumbs und keine Detailnavigation.
- Tabs werden semantisch korrekt als Tablist, Tab und Tabpanel modelliert.

### Tabpanel als eigenständiger Arbeitsbereich

Jedes Tabpanel ist ein vollständiger Arbeitsbereich mit eigener interner Informationshierarchie. Für tabbasierte Listenbereiche ist folgende Reihenfolge verbindlich:

1. `H2` für den aktiven Fachbereich
2. kurze Bereichsbeschreibung
3. tab-spezifische Action-Bar
4. Tabelle oder Liste
5. tab-spezifische Pagination

Das Tabpanel darf nicht direkt mit einer Tabelle beginnen. Nutzerinnen und Nutzer müssen vor der ersten Interaktion erkennen können, in welchem Teilbereich sie sich befinden und was dort gepflegt wird.

### Tab-Headline und Tab-Beschreibung

Die `H2` im Tabpanel benennt den aktiven Fachbereich präzise. Die darunterstehende Beschreibung beantwortet in einem Satz:

- welche fachlichen Objekte hier verwaltet werden
- welche fachliche Verantwortung der Bereich hat
- worin er sich von benachbarten Tabs unterscheidet

Die Bereichsbeschreibung ist knapp zu halten. Sie ersetzt keine Inline-Hilfen und keine Feldbeschriftungen.

## Standard für Tabellen-Workspaces

### Action-Bar oberhalb der Tabelle

Oberhalb jeder Tabelle liegt eine einheitliche Action-Bar. Für andere Plugins ist folgendes Drei-Zonen-Muster verbindlich:

1. links: Bulk-Aktionen
2. Mitte: Filter, Suche und sekundäre Workspace-Steuerung
3. rechts: Primäraktion

Dieses Muster gilt auch dann, wenn einzelne Zonen im ersten Schritt noch leer bleiben. Leerzustände werden layoutstabil behandelt; Zonen dürfen nicht je nach Seite die Position wechseln.

### Bulk-Aktionen

Bulk-Aktionen beziehen sich ausschließlich auf die aktuelle Auswahl in der Tabelle.

Regeln:

- Bulk-Aktionen stehen links.
- Sie sind deaktiviert oder verborgen, solange keine Auswahl existiert.
- Destruktive Bulk-Aktionen werden eindeutig benannt, zum Beispiel `Markierte löschen`.
- Bulk-Aktionen dürfen keine globalen Seitenaktionen verdrängen.

### Filter und Suche

Filter, Suche und ähnliche Workspace-Steuerungen gehören in die mittlere Zone der Action-Bar.

Regeln:

- Filterzustände werden über typisierte Search-Params modelliert, wenn sie teilbar oder testrelevant sind.
- Suchfelder, Statusfilter, Ansichtsumschalter und Facetten gehören nicht in den Seitenkopf.
- Wenn ein Workspace aktuell keine Filter anbietet, bleibt die mittlere Zone dennoch als vorgesehener Slot Teil des Standards.

### Primäraktion

Die Primäraktion steht rechts und beschreibt die wichtigste Erstellungs- oder Hinzufügehandlung des aktuellen Arbeitsbereichs.

Regeln:

- Die Beschriftung benennt das Fachobjekt konkret, zum Beispiel `Fraktion anlegen`.
- Die Primäraktion ist tab-spezifisch, wenn sie nur den aktiven Bereich betrifft.
- Tab-spezifische Primäraktionen gehören nicht in den globalen Seitenkopf.

### Tabellenkörper

Die Tabelle selbst folgt diesem Grundmuster:

- optionale Auswahlspalte links
- fachliche Hauptspalte als primärer Einstieg
- weitere Fach-, Status- und Metadatenspalten
- feste Aktionsspalte rechts

Regeln:

- Spaltenköpfe sind sortierbar, wenn Sortierung fachlich relevant ist.
- Die erste fachliche Hauptspalte trägt den wichtigsten Identitätswert.
- Status wird konsistent über Badge, Switch oder vergleichbare Standardmuster dargestellt.
- Zeilenaktionen bleiben sekundär gegenüber der Hauptnavigation und der Primäraktion des Workspaces.

### Tabellenbeschreibung und Caption

Vor oder semantisch an der Tabelle wird eine kurze Beschreibung des Tabelleninhalts bereitgestellt. Diese Beschreibung darf als sichtbarer Einleitungssatz, Caption oder vergleichbare zugängliche Tabellenbeschreibung umgesetzt sein.

Sie beantwortet knapp:

- welche Einträge die Tabelle zeigt
- welche fachlichen Informationen oder Aktionen enthalten sind

### Pagination

Die Pagination bildet den Abschluss des Tabellen-Workspaces und besteht mindestens aus:

- Page-Size-Auswahl
- Ergebniskontext, zum Beispiel `1 bis 25 von 123 Ergebnissen`
- Vor-/Zurück-Navigation oder Seitennavigation

Regeln:

- Pagination gehört immer unter die Tabelle und nie in den Seitenkopf.
- Page-Size, Seite und Sortierung sind bei Reload wiederherstellbar.
- Die Ergebnisanzeige ist Teil des Musters und darf nicht entfallen, nur weil aktuell wenige Einträge vorhanden sind.

## Muster für andere Plugin-Seiten

Wenn andere Plugin-Seiten auf dieses Muster gebracht werden, ist die Zielstruktur:

1. Shell-Breadcrumbs
2. `H1` des Plugins oder Fachmoduls
3. ein globaler Beschreibungssatz
4. primäre Bereichs-Tabs, falls mehrere gleichrangige Workspaces existieren
5. pro aktivem Tabpanel eine `H2` plus Bereichsbeschreibung
6. pro Tabpanel genau ein konsistenter Listen- oder Arbeitsflächenkopf
7. tab-spezifische Primäraktion im Workspace
8. Tabelle oder Liste
9. Pagination und Ergebniskontext

Neue Plugin-Custom-Views sollen dieses Muster übernehmen, bevor zusätzliche Sonderlayouts eingeführt werden. Abweichungen brauchen einen nachvollziehbaren fachlichen oder ergonomischen Grund.

## Bausteine

Neue wiederverwendbare Listen- und Seitenbausteine werden über `@sva/studio-ui-react` bereitgestellt, sobald sie Host- und Plugin-Custom-Views gemeinsam nutzen sollen. App-interne Komponenten bleiben nur Übergangsadapter oder Shell-nahe Implementierungsdetails.

Plugin-Listen dürfen fachliche Wrapper aufbauen, müssen dabei aber `@sva/studio-ui-react` komponieren. Lokale Basis-Tabellen, eigene Button-/Input-Systeme oder App-interne UI-Imports werden über `pnpm check:plugin-ui-boundary` und ESLint blockiert.

### `StudioListPageTemplate`

Verantwortlich für:

- Titel
- Beschreibung
- optionale Primäraktion
- optionale Tabs
- definierte Slot-Reihenfolge für Seitenkopf und Tabpanel-Kopf

Nicht verantwortlich für:

- Breadcrumbs
- Shell-Layout
- fachliche Datenbeschaffung

### `StudioDataTable`

Verantwortlich für:

- Sortierung
- optionale Mehrfachauswahl
- Bulk-Aktionsleiste
- Toolbar-Slots für Bulk-Aktionen, Filter/Suche, Sekundäraktionen und Primäraktion
- feste Aktionsspalte
- mobile Kartenansicht
- Pagination-Region mit Ergebniskontext

## Einsatzregeln

- `Neu erstellen` nur anzeigen, wenn die Seite tatsächlich eine Erstellungsaktion anbietet.
- Tabs nur für gleichrangige Tabellenbereiche verwenden, nicht als Ersatz für Detail-Navigation.
- Die erste Spalte ist reserviert für Auswahl-Checkboxen, wenn Mehrfachauswahl aktiv ist.
- Die letzte Spalte ist reserviert für Zeilenaktionen.
- Fachliche Hooks, Mutationen und Dialoge bleiben in der Route; Layout- und Tabellenlogik liegt in den Shared-Komponenten.
- Tabpanels mit Tabellenarbeitsflächen beginnen immer mit `H2` und Bereichsbeschreibung vor der Action-Bar.
- Workspace-Primäraktionen sind konkret auf das Fachobjekt benannt und stehen rechts in der Action-Bar.
- Filter- und Suchmuster bleiben in derselben Zone der Action-Bar, auch wenn sie je nach Seite unterschiedlich konkret ausgeprägt sind.

## Bereits migrierte Seiten

- Benutzerverwaltung
- Rollenverwaltung
- Inhaltsliste

## Noch offene Migrationen

- Gruppenverwaltung
- Instanzverwaltung
- weitere Verwaltungslisten im Studio
