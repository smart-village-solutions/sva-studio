# Design: Erweiterte Touren-Filter für Waste-Management

## Kontext

Der Touren-Tab verwendet bereits ein Filter-Modal mit lokalem Draft-Zustand für `Name` und `Status`. Für die fachliche Eingrenzung der Touren reicht das nicht aus, weil Touren oft nach ihrer Abfallart sowie nach ihrem ersten und letzten Termin gesucht werden.

Die Tour-Datensätze enthalten diese Informationen bereits über `firstDate` und `endDate`. Die Erweiterung soll deshalb in das bestehende Touren-Modal integriert werden, statt ein separates Filtermuster einzuführen.

## Ziele

- Der Touren-Filter unterstützt Datumsbereichsfilter für den ersten Termin.
- Der Touren-Filter unterstützt Datumsbereichsfilter für den letzten Termin.
- Der Touren-Filter unterstützt eine einfache Auswahl genau einer Abfallart.
- Die neuen Filter verhalten sich konsistent mit dem bestehenden Modal-Draft-Modell.
- Die aktive Filterung bleibt deep-link-fähig und reload-stabil über Search-Params.
- `Filter zurücksetzen` setzt auch die Datumsfilter ohne Modal direkt zurück.

## Nicht-Ziele

- Keine serverseitige Filterung oder API-Erweiterung.
- Keine neue generische Datumsfilter-Komponente für andere Tabs.
- Keine Mehrfachauswahl von Abfallarten in diesem Schritt.
- Keine unscharfe Textsuche über Datumsdarstellungen.

## Empfohlener Ansatz

Das bestehende Touren-Filtermodal wird um fünf optionale Filter ergänzt:

- `Abfallart`

- `Erster Termin von`
- `Erster Termin bis`
- `Letzter Termin von`
- `Letzter Termin bis`

Die Abfallart arbeitet als einfacher Single-Select. Die Datumsfelder arbeiten als inklusive Bereichsgrenzen auf ISO-Datumswerten. Die aktive Filterung bleibt clientseitig und wird in den Touren-Search-Params persistiert.

## Filtersemantik

### Abfallart

- Wenn keine Abfallart gewählt ist, wirkt kein Fraktionsfilter.
- Wenn `tourWasteFractionId` gesetzt ist, wird eine Tour nur angezeigt, wenn ihre `wasteFractionIds` diese Fraktion enthalten.
- Die Auswahl unterstützt in diesem Schritt genau eine Abfallart gleichzeitig.
- Das Modal bietet zusätzlich eine neutrale Option `Alle`, die den Fraktionsfilter zurücksetzt.

### Erster Termin

- `Erster Termin von`: Tour wird nur angezeigt, wenn `firstDate >= firstDateFrom`
- `Erster Termin bis`: Tour wird nur angezeigt, wenn `firstDate <= firstDateTo`

### Letzter Termin

- `Letzter Termin von`: Tour wird nur angezeigt, wenn `endDate >= endDateFrom`
- `Letzter Termin bis`: Tour wird nur angezeigt, wenn `endDate <= endDateTo`

### Fehlende Datumswerte

Wenn für eine Tour das fachlich benötigte Datum fehlt, wird sie bei einem aktiven Filter auf dieses Feld aus dem Ergebnis ausgeschlossen.

Beispiele:

- Eine Tour ohne `firstDate` fällt heraus, sobald `Erster Termin von` oder `Erster Termin bis` gesetzt ist.
- Eine Tour ohne `endDate` fällt heraus, sobald `Letzter Termin von` oder `Letzter Termin bis` gesetzt ist.

### Kombinierte Filter

Der Fraktionsfilter und die Datumsfilter wirken zusätzlich zu `Name` und `Status`. Eine Tour bleibt nur sichtbar, wenn alle aktiven Kriterien gleichzeitig erfüllt sind.

## Zustandsmodell

Der bestehende lokale Draft-Zustand des Touren-Modals wird um vier Draft-Felder ergänzt:

- `draftTourWasteFractionId`

- `draftFirstDateFrom`
- `draftFirstDateTo`
- `draftEndDateFrom`
- `draftEndDateTo`

Regeln:

- Beim Öffnen des Modals werden die Draft-Werte aus dem aktiven Search-Zustand übernommen.
- `Abbrechen` verwirft nicht angewendete Datumsänderungen.
- `Anwenden` schreibt alle Touren-Filter in einem gemeinsamen Schritt in den Router.
- `Filter zurücksetzen` setzt `q`, `status`, `tourWasteFractionId` und alle Datumsfilter auf ihre Standardwerte zurück.

## Search-Params

Die Touren-Suche wird um fünf optionale Search-Params erweitert:

- `tourWasteFractionId`

- `firstDateFrom`
- `firstDateTo`
- `endDateFrom`
- `endDateTo`

Anforderungen:

- leere oder whitespace-only Werte werden auf `undefined` normalisiert
- ungültige Datumsformate werden nicht als aktive Filter akzeptiert
- unbekannte Fraktions-IDs werden nicht als aktive Filter akzeptiert
- bestehende Deep Links ohne diese Parameter bleiben unverändert gültig
- Der neue Fraktionsfilter verwendet bewusst einen eigenen Search-Param `tourWasteFractionId` und nicht den bestehenden globalen `wasteFractionId`, damit Touren-Filterung und Fraktionen-Stammdatenrouting nicht miteinander kollidieren.

## UI-Design

Das bestehende Touren-Filtermodal bleibt der einzige Einstiegspunkt für die erweiterten Filter. Neben `Name` und `Status` erscheinen dort eine Abfallart-Auswahl und vier Datumsfelder.

Empfohlene Reihenfolge:

1. `Name`
2. `Status`
3. `Abfallart`
4. `Erster Termin von`
5. `Erster Termin bis`
6. `Letzter Termin von`
7. `Letzter Termin bis`

Die Abfallart soll als einfaches Select mit `Alle` plus den verfügbaren Fraktionen erscheinen. Die Datumsfelder sollen als klare Formularfelder mit typischem Datums-Input-Verhalten erscheinen. Zusätzliche Hilfetexte sind in diesem Schritt nicht nötig.

## Reset- und Empty-State-Verhalten

Der bestehende Schnell-Reset außerhalb des Modals bleibt erhalten und setzt auch den Fraktionsfilter sowie die neuen Datumsfilter zurück.

Wenn Touren fachlich vorhanden sind, aber die Kombination aus Text-, Status- und Datumsfiltern kein Ergebnis liefert, muss die Listenansicht mit Toolbar sichtbar bleiben. Das Empty-State-Gating darf die Reset-Möglichkeit nicht verdrängen.

## Übersetzungen

Zusätzliche i18n-Keys werden für die Abfallart- und Datumsfilter benötigt:

- `Abfallart`
- `Alle`

- `Erster Termin von`
- `Erster Termin bis`
- `Letzter Termin von`
- `Letzter Termin bis`

Die bestehenden Keys für Modal, Reset und Aktionen bleiben erhalten.

## Tests

Mindestens folgende Tests werden ergänzt oder angepasst:

- Search-Param-Normalisierung für die vier neuen Touren-Datumsfilter
- Search-Param-Normalisierung für `tourWasteFractionId`
- kombinierter Router-Writeback für `q`, `status`, `tourWasteFractionId` und Datumsbereiche
- clientseitige Filterlogik für die gewählte Abfallart
- clientseitige Filterlogik für inklusive Unter- und Obergrenzen
- Ausschluss bei fehlendem `firstDate` oder `endDate`, wenn der jeweilige Filter aktiv ist
- Modal-Draft für Fraktion und Datumswerte mit `Anwenden` und `Abbrechen`
- Schnell-Reset setzt auch Fraktion und Datumsfelder zurück

## Architektur- und Dokuwirkung

Die Änderung bleibt innerhalb der bestehenden Waste-Management-Frontend-Architektur. Serververtrag, Datenmodell und Ladepfade ändern sich nicht.

Eine Fortschreibung der Architektur-Dokumentation ist voraussichtlich nicht nötig, solange die Erweiterung auf bestehende Felder und clientseitige Filterung beschränkt bleibt.
