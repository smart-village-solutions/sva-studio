# Design: Einheitliche Tabellen- und Detailansicht für Ausweichtermine im Waste Management

## Kontext

Der Tab `Ausweichtermine` im Waste-Management-Plugin zeigt heute fachlich zusammengehörige Daten aus drei unterschiedlichen Quellen:

- Feiertagsregeln
- globale Ausweichtermine
- tourbezogene Ausweichtermine

Die Listenanzeige ist bereits tabellarisch geprägt, aber die Bearbeitung und Erstellung ist derzeit auf mehrere spezialisierte Scheduling-Views aufgeteilt:

- `create`
- `create-global`
- `create-tour`
- `edit-global`
- `edit-tour`

Zusätzlich werden Feiertagsregeln heute separat oberhalb der eigentlichen Ausweichtermin-Tabelle gerendert. Dadurch entsteht ein uneinheitlicher Arbeitsfluss:

- unterschiedliche Listenbereiche für fachlich verwandte Einträge
- unterschiedliche Edit-Pfade je nach Typ
- keine gemeinsame Detailseite
- steigende UI-Komplexität im Scheduling-Tab

Ziel ist deshalb eine einheitliche Tabellenansicht für alle Ausweichtermine und eine gemeinsame Detailseite für Bearbeitung und Erstellung.

## Ziele

- Der Tab `Ausweichtermine` zeigt genau eine gemeinsame Tabelle für:
  - Feiertagsregeln
  - globale Ausweichtermine
  - tourbezogene Ausweichtermine
- Die Bearbeitung erfolgt ausschließlich über gemeinsame Detailseiten, nicht mehr über spezialisierte Inline-/Dialog-Flows.
- Die Scheduling-Routen werden auf ein gemeinsames Modell vereinfacht.
- Der Nutzer kann manuelle Ausweichtermine weiterhin anlegen.
- Feiertagsregeln bleiben bearbeitbar, aber im selben Listen- und Detailmuster wie die übrigen Ausweichtermine.
- Die bestehende Backend-Struktur bleibt unverändert; die Vereinheitlichung geschieht im Plugin.

## Nicht-Ziele

- Keine fachliche Zusammenlegung der drei Backend-Entitäten.
- Keine Änderung am Serververtrag für Feiertagsregeln, globale Ausweichtermine oder tourbezogene Ausweichtermine.
- Keine manuelle Neuanlage von Feiertagsregeln.
- Kein generisches tabübergreifendes CRUD-Framework für alle Waste-Bereiche.

## Empfohlener Ansatz

Der Scheduling-Tab erhält ein gemeinsames Listen-Read-Model und eine gemeinsame Detailansicht:

- Listenebene: gemeinsames `SchedulingTableEntry`-Modell
- Navigationsebene: gemeinsames Scheduling-Routing mit `list | create | edit`
- Detailebene: eine gemeinsame Scheduling-Detailseite mit typabhängigen Formularabschnitten

Die drei fachlichen Quelltypen bleiben intern getrennt, werden aber für Liste und Navigation normalisiert:

- `holiday-rule`
- `global-shift`
- `tour-shift`

Dieser Ansatz vereinheitlicht die Benutzerführung, ohne unnötig in den Backend-Vertrag oder die fachlichen Repository-Grenzen einzugreifen.

## Datenmodell der Tabellenansicht

Es wird ein gemeinsames Read-Model `SchedulingTableEntry` eingeführt. Jede Tabellenzeile enthält mindestens:

- `entryType`
  - `holiday-rule`
  - `global-shift`
  - `tour-shift`
- `entryId`
- `originalDate`
- `actualDate`
- `scopeLabel`
- `typeLabel`
- `descriptionLabel`
- `reasonLabel`
- `sortLabel`
- `editable`
- `deletable`

Zusätzliche typabhängige Informationen bleiben im Row-Payload erhalten, damit die Edit-Navigation und row-spezifische Aktionen weiterhin typsicher bleiben.

### Typsemantik

- `holiday-rule`
  - entsteht aus bestehenden Feiertagsregeln
  - ist bearbeitbar
  - ist nicht manuell neu anlegbar
  - ist nicht löschbar
- `global-shift`
  - entsteht aus globalen Ausweichterminen
  - ist bearbeitbar
  - ist manuell anlegbar
  - ist löschbar
- `tour-shift`
  - entsteht aus tourbezogenen Ausweichterminen
  - ist bearbeitbar
  - ist manuell anlegbar
  - ist löschbar

## Tabellenansicht

Der Tab `Ausweichtermine` zeigt nur noch eine einzige Tabelle. Der separate Feiertagsregel-Block oberhalb der Tabelle entfällt.

Die Tabelle enthält mindestens folgende Spalten:

- `Datum alt`
- `Datum neu`
- `Typ`
- `Kontext`
- `Beschreibung / Regel`
- `Aktionen`

### Spaltensemantik

- `Typ`
  - zeigt z. B. `Feiertag`, `Global`, `Tour`
- `Kontext`
  - Feiertagsregel: Feiertagsname bzw. Feiertagskontext
  - globaler Ausweichtermin: globaler Geltungsbereich, z. B. `Alle Touren`
  - tourbezogener Ausweichtermin: Tournamen
- `Beschreibung / Regel`
  - zeigt je nach Typ Regelbeschreibung, Freitext oder Begründung

### Aktionen

- `Bearbeiten` ist für alle drei Typen verfügbar.
- `Löschen` ist nur für manuelle globale und tourbezogene Ausweichtermine verfügbar.
- Feiertagsregeln erhalten keine Delete-Aktion.

### Bulk-Verhalten

Bulk-Löschaktionen bleiben nur für löschbare Einträge zulässig. Feiertagsregeln dürfen nicht versehentlich in einen Delete-Flow geraten.

Wenn die bestehende Tabelleninfrastruktur keine klare row-selektive Deaktivierung unterstützt, ist das Entfernen von Bulk-Löschung für diesen Tab zulässig. Die Priorität liegt auf einer sauberen, verständlichen Tabellen- und Detailnavigation, nicht auf dem Erzwingen von Bulk-Verhalten.

## Routing und Search-Params

Die heutige Scheduling-View-Aufspaltung wird ersetzt.

### Alt

- `list`
- `create`
- `create-global`
- `create-tour`
- `edit-global`
- `edit-tour`

### Neu

- `list`
- `create`
- `edit`

Zusätzlich werden gemeinsame Scheduling-Search-Params eingeführt:

- `schedulingEntryType`
  - `global-shift`
  - `tour-shift`
  - `holiday-rule`
- `schedulingEntryId`

### Routing-Regeln

- `list`
  - zeigt die gemeinsame Tabelle
- `create`
  - benötigt `schedulingEntryType`
  - zulässig für:
    - `global-shift`
    - `tour-shift`
- `edit`
  - benötigt `schedulingEntryType` und `schedulingEntryId`
  - zulässig für:
    - `holiday-rule`
    - `global-shift`
    - `tour-shift`

`holiday-rule` ist im Create-Fall ungültig, da Feiertagsregeln nicht manuell neu angelegt werden.

Die bestehenden Search-Params `globalDateShiftId` und `tourDateShiftId` entfallen aus dem Scheduling-Editfluss und werden durch den gemeinsamen `schedulingEntryId` ersetzt.

## Gemeinsame Detailseite

Die Detailseite ist eine gemeinsame Scheduling-Ansicht mit typabhängigen Formularfeldern.

### Create-Fall

Beim Anlegen sieht der Nutzer zunächst die Typwahl:

- `Globaler Ausweichtermin`
- `Tourbezogener Ausweichtermin`

Nach der Auswahl erscheinen die passenden Formularfelder.

### Edit-Fall

Beim Bearbeiten wird der Typ aus der Tabellenzeile übernommen und ist nicht mehr änderbar.

### Formularverhalten

Die Detailseite verwendet einen gemeinsamen äußeren Rahmen:

- Titel
- Beschreibung
- typabhängige Felder
- `Speichern`
- `Abbrechen`

Innerhalb dieses Rahmens bleiben die fachlichen Unterschiede erhalten:

- Feiertagsregel:
  - regelbezogene Felder
  - keine Typumschaltung
- globaler Ausweichtermin:
  - globale Verschiebungsfelder
- tourbezogener Ausweichtermin:
  - tourbezogene Verschiebungsfelder
  - Tourauswahl bzw. Tourreferenz

## Filter und Tabellensteuerung

Da Feiertagsregeln künftig Teil derselben Tabelle sind, wird der bestehende Scheduling-Kontextfilter erweitert.

### Alt

- `all`
- `global`
- `tour`

### Neu

- `all`
- `holiday`
- `global`
- `tour`

Damit bleibt die bestehende Filteridee erhalten, aber die neue Tabellenrealität wird korrekt abgebildet.

Paging, Seitengröße und bestehende Tabellenmechanik bleiben erhalten.

## Empty-State-Verhalten

Ein globaler leerer Zustand wird nur noch gezeigt, wenn der Scheduling-Tab fachlich gar keine Einträge enthält:

- keine Feiertagsregeln
- keine globalen Ausweichtermine
- keine tourbezogenen Ausweichtermine

Wenn Daten grundsätzlich vorhanden sind, aber aktive Filter zu keinem Ergebnis führen, bleibt die Tabellenansicht sichtbar. In diesem Fall darf die Toolbar mit Filter- und Navigationsaktionen nicht verschwinden.

## Navigation und Rücksprünge

- `Bearbeiten` aus der Tabelle navigiert immer auf die gemeinsame Detailseite.
- `Neu anlegen` aus dem Scheduling-Tab navigiert immer auf die gemeinsame Create-Detailseite.
- `Abbrechen` auf der Detailseite führt zurück zur Tabellenansicht.
- Erfolgreiches Speichern führt zurück zur Tabellenansicht und zeigt dort eine passende Erfolgsmeldung.

Die bisherigen spezialisierten Scheduling-Dialog- und Routenpfade sind nach der Umstellung nicht mehr Teil des Nutzerflusses.

## Übersetzungen

Es werden zusätzliche i18n-Keys für die gemeinsame Scheduling-Tabelle und die gemeinsame Detailseite benötigt, mindestens für:

- Typbezeichnungen
- gemeinsame Tabellenüberschriften
- gemeinsame Detailtitel und Beschreibungen
- Typwahl im Create-Fall
- typabhängige Navigations- und Leerzustandskopien
- erweiterten `shiftContext`-Filter inklusive `holiday`

Vorhandene Scheduling-Texte werden nach Möglichkeit wiederverwendet, aber die alten, spezialisierungsgebundenen Copy-Pfade dürfen nicht stillschweigend für widersprüchliche UI-Zustände missbraucht werden.

## Tests

Mindestens folgende Tests werden ergänzt oder angepasst:

- Normalisierung von Feiertagsregeln, globalen Ausweichterminen und tourbezogenen Ausweichterminen in ein gemeinsames `SchedulingTableEntry`-Modell
- gemeinsame Tabellenansicht rendert alle drei Typen in einer Tabelle
- `shiftContext` filtert korrekt auf `all`, `holiday`, `global`, `tour`
- `Bearbeiten` navigiert für alle drei Typen auf die gemeinsame Detailroute
- Create-Route unterstützt nur `global-shift` und `tour-shift`
- Edit-Route unterstützt `holiday-rule`, `global-shift` und `tour-shift`
- Feiertagsregeln bleiben bearbeitbar, aber nicht löschbar und nicht manuell neu anlegbar
- globale und tourbezogene Ausweichtermine bleiben löschbar
- Success-Redirects und Cancel-Navigation laufen auf die gemeinsame Tabellenansicht zurück
- die alten spezialisierten Scheduling-Edit-/Create-Routen werden nicht mehr als führender Nutzerpfad verwendet

## Architektur- und Dokuwirkung

Die Änderung bleibt auf Plugin-Ebene und verändert keine Backend- oder Repository-Grenzen. Sie hat aber deutliche Auswirkungen auf die UI-Struktur und die Search-Param-Modellierung des Scheduling-Tabs.

Eine Fortschreibung der Architektur-Dokumentation ist nur dann nötig, wenn die gemeinsame Scheduling-Navigation als neues dauerhaftes UI-Muster über den aktuellen Tab hinaus übernommen wird. Für die isolierte Umstellung innerhalb des Waste-Plugins reicht voraussichtlich die Produkt-/Implementierungsdokumentation im Plugin-Kontext.
