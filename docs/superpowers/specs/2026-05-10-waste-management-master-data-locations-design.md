# Design: Waste-Management Stammdaten- und Abholort-UX

## Kontext

Das Studio-Plugin `waste-management` soll die Userflows des `Newcms`-Prototyps für Stammdaten und Abholorte stärker übernehmen, ohne die Studio-Architektur, die Host-Fassade oder die Plugin-Grenzen zu verlassen.

Der aktuelle Studio-Stand ist fachlich vollständig, aber in der Bedienung für datenintensive Admin-Aufgaben schwächer als `Newcms`. Besonders betroffen sind die Pflege der Adresshierarchie und die operative Arbeit mit Abholorten.

## Ziel

Die UX für `master-data` wird so umgebaut, dass sie sich stärker wie das `Newcms`-Admin-Tool anfühlt, aber innerhalb der Studio-Struktur bleibt:

- `master-data` bleibt bestehender Haupttab
- innerhalb von `master-data` gibt es sekundäre Tabs `Fractions` und `Locations`
- `Locations` wird die primäre Arbeitsfläche für Region, Ort, Straße, Hausnummer, Abholort und Bulk-Zuordnungen
- `Fractions` bleibt ein kompakter Pflegebereich für Abfallarten

## Nicht-Ziele

- keine Übernahme produktiver `Newcms`-Runtime- oder Hook-Logik
- keine neue Host-API oder neue Rechtearchitektur
- kein vollständiges Redesign des gesamten Waste-Plugins in einem Schritt
- keine Änderung der Top-Level-Tabs `overview`, `master-data`, `tours`, `scheduling`, `tools`, `settings`

## Zielbild Informationsarchitektur

### Top-Level

Die bestehende Studio-Informationsarchitektur bleibt erhalten:

- `overview`
- `master-data`
- `tours`
- `scheduling`
- `tools`
- `settings`

### Innerhalb von `master-data`

Der Bereich wird in zwei sekundäre Arbeitsmodi aufgeteilt:

- `Fractions`
- `Locations`

`Fractions` dient der kompakten Pflege von Abfallarten.

`Locations` ist die zentrale Verwaltungsfläche für:

- Regionen
- Orte
- Straßen
- Hausnummern
- Abholorte
- Bulk-Zuordnungen zu Touren

Diese Aufteilung folgt dem Nutzerverhalten aus `Newcms`, ohne dessen Top-Level-Tabstruktur direkt zu kopieren.

## Userflows

### Fractions

`Fractions` bleibt bewusst leichtgewichtig:

- kompakte Darstellung der vorhandenen Abfallarten
- klarer Einstieg zum Anlegen
- direkte Bearbeitung bestehender Einträge
- kein schwerer Tabellenmodus erforderlich

### Locations

`Locations` übernimmt den Newcms-nahen Arbeitsmodus:

- oben eine dichte Aktionsleiste
- ein `Create ▼`-Menü mit:
  - `Neue Region`
  - `Neuer Ort`
  - `Neue Straße`
  - `Neuer Abholort`
- Such- und Statusfilter bleiben mit dem Studio-Suchmodell kompatibel
- zusätzlich ein tourbezogener Filter für Abholorte
- darunter eine dichtere Listen- oder Tabellenansicht für Abholorte
- Zeilenauswahl für Bulk-Zuordnungen
- direkte Row-Actions für Bearbeiten

Die Adresshierarchie wird dadurch nicht mehr als Reihe gleichgewichtiger Card-Blöcke präsentiert, sondern als fokussierte Arbeitsfläche.

### Hierarchiepflege

Regionen, Orte, Straßen und Hausnummern bleiben vollständig pflegbar, treten aber im UI hinter den Abholort-Workflow zurück. Die Pflege erfolgt kontextuell:

- über das `Create ▼`-Menü
- über bestehende Dialoge
- über verdichtete Begleitsektionen im `Locations`-Bereich statt als dominante Hauptfläche

### Bulk-Zuordnungen

Bulk-Zuordnungen zu Touren bleiben im Studio-Dialogmodell. Der Einstiegspunkt wandert jedoch in die neue `Locations`-Arbeitsfläche, damit der Flow dem `Newcms`-Arbeitsmodus entspricht:

- Auswahl mehrerer Abholorte in der Liste
- anschließender Einstieg in den Bulk-Assignment-Dialog
- keine neue Host-Logik, nur neue UI-Komposition

## Technischer Zuschnitt

Die Änderung ist eine reine Plugin-UI-Refaktorierung.

### Bleibt unverändert

- Host-Fassade `/api/v1/waste-management/*`
- Rechtepfade `waste-management.*`
- bestehende Waste-Controller und API-Clients
- bestehende Dialoge für Create, Edit und Bulk-Aktionen
- bestehende Top-Level-Navigation des Plugins

### Wird angepasst

- Layout-Komposition von `master-data`
- Präsentationslogik für `Locations`
- Untertab-Navigation innerhalb von `master-data`
- URL- oder Search-Param-Synchronisierung für den aktiven Untertab

## Such- und Zustandsmodell

Der aktive Untertab innerhalb von `master-data` soll URL-synchronisiert werden, damit die Arbeitsfläche deep-link-fähig bleibt und sich konsistent mit dem restlichen Studio verhält.

Anforderungen:

- `master-data` bleibt über bestehenden Top-Level-Search-Param erreichbar
- zusätzlicher Untertab-Zustand für `Fractions` oder `Locations`
- bestehende Filter `q` und `status` bleiben nutzbar
- der `Locations`-Bereich darf zusätzlich den vorhandenen oder erweiterten tourbezogenen Filter nutzen

## Komponenten-Zuschnitt

Die Umsetzung soll bestehende Plugin-Bausteine weiterverwenden und nur dort neue UI-Bausteine ergänzen, wo der neue Arbeitsmodus sie wirklich braucht.

Voraussichtlicher Zuschnitt:

- `waste-management.master-data-panel.tsx`
  - orchestriert sekundäre Tabs
- neue oder angepasste Präsentationskomponenten für:
  - `Fractions`-Subtab
  - `Locations`-Subtab
  - dichte Listen-/Tabellenfläche für Abholorte
  - `Create ▼`-Aktionsleiste
- bestehende Dialog-Komponenten bleiben angedockt

## Teststrategie

Vor der Umsetzung werden Tests für die neue Zielstruktur ergänzt.

Mindestens abzudecken:

- Untertab-Navigation innerhalb von `master-data`
- Default-Verhalten und Search-Param-Synchronisierung
- Sichtbarkeit des `Create ▼`-Menüs im `Locations`-Bereich
- Zugriff auf bestehende Create-/Edit-/Bulk-Flows aus der neuen Arbeitsfläche
- keine Regression für bestehende Rechte-, Lade- und Fehlerzustände

## Risiken

### Risiko 1: Zu starke Annäherung an `Newcms`

Wenn die neue UI die alte Informationsarchitektur zu direkt kopiert, verwässert das den Studio-Zuschnitt.

Gegenmaßnahme:

- Top-Level-Struktur des Studios bleibt unverändert
- nur Userflows und Arbeitsmodus werden übernommen

### Risiko 2: Zu schwache Verdichtung

Wenn `Locations` am Ende nur eine leicht umsortierte Card-Ansicht bleibt, wird das Ziel verfehlt.

Gegenmaßnahme:

- `Locations` bekommt eine bewusst dichtere operative Arbeitsfläche
- Fokus auf Auswahl, Filter, Row-Actions und schnelles Anlegen

### Risiko 3: Such- und Filtermodell wird inkonsistent

Wenn Untertab- und Filterzustände nicht sauber mit dem URL-Modell zusammenspielen, wird das Verhalten schwer erklärbar.

Gegenmaßnahme:

- Untertab-Zustand explizit modellieren
- bestehende Search-Param-Normalisierung gezielt erweitern

## Umsetzungsentscheidung

Die umzusetzende Richtung ist:

- Newcms-nahe Userflows
- Studio-konforme Architektur
- `master-data` mit sekundären Tabs `Fractions` und `Locations`
- `Locations` als primäre Admin-Arbeitsfläche
- interne Navigation als sekundäre Tabs, nicht als Sidebar-Arbeitsfläche
