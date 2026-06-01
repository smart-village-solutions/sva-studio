# Design: Filter-Modal für Touren im Waste Management

## Kontext

Die Touren-Liste im Waste-Management-Plugin verwendet derzeit ein aufklappbares Inline-Filterpanel. Darin werden mindestens die Freitextsuche über den Namen und der Statusfilter gepflegt. Dieses Muster weicht von der neuen Fraktionen-Interaktion ab, bei der `Filtern` ein Modal öffnet und ein separater Schnell-Reset außerhalb des Modals verfügbar ist.

Für den Touren-Tab ist absehbar, dass weitere Filteroptionen hinzukommen werden. Das bestehende Inline-Panel skaliert dafür schlechter als ein fokussiertes Modal mit klaren Eingabebereichen und einem stabilen Draft-Zustand.

## Ziele

- Der Touren-Tab zeigt `Filtern` als Modal-Einstieg statt als Inline-Aufklapper.
- Das Filter-UI auf dem Touren-Tab orientiert sich am neuen Fraktionen-Muster.
- Aktive Touren-Filter lassen sich direkt per `Filter zurücksetzen` zurücknehmen, ohne das Modal zu öffnen.
- Das Modal bildet die bestehenden Touren-Filter `Name` und `Status` ab.
- Die bestehende Deep-Link- und Reload-Stabilität der Touren-Filter bleibt erhalten.
- Die Struktur bleibt erweiterbar für weitere Touren-Filter.

## Nicht-Ziele

- Kein generisches, tabübergreifendes Filter-Framework für alle Waste-Bereiche.
- Keine Änderung an der fachlichen Filterlogik selbst, solange die heutigen Touren-Filter unverändert bleiben.
- Keine serverseitige Änderung an Datenvertrag oder Ladepfad.

## Empfohlener Ansatz

Der Touren-Tab übernimmt das Interaktionsmuster der Fraktionen:

- Toolbar links: `Filter zurücksetzen` bei aktivem Filterzustand und `Filtern`
- Toolbar rechts: unverändert `Tour anlegen`
- Filterinhalte: in ein Modal ausgelagert
- Änderungen werden erst bei `Anwenden` aus dem Modal in den aktiven Routen-/Filterzustand übernommen

Die heute verwendeten Touren-Filter bleiben zunächst fachlich gleich:

- Freitextfilter über den Tour-Namen
- Statusfilter `all`, `active`, `inactive`

Die bestehenden Suchparameter bleiben in diesem Schritt erhalten. Die Änderung betrifft primär die Bedienoberfläche und den lokalen Draft-Zustand des Filters.

## Nutzerfluss

1. Ein Benutzer öffnet den Tab `Touren`.
2. In der Toolbar sieht er den Button `Filtern`.
3. Wenn bereits ein Name oder ein Statusfilter aktiv ist, sieht er zusätzlich `Filter zurücksetzen`.
4. Ein Klick auf `Filtern` öffnet ein Modal mit den Touren-Feldern `Name` und `Status`.
5. Änderungen im Modal wirken zunächst nur auf den Draft-Zustand.
6. Erst `Anwenden` schreibt die Werte in die aktive Touren-Filterung.
7. `Abbrechen` oder Schließen verwirft nicht angewendete Änderungen.
8. `Filter zurücksetzen` setzt den Touren-Namen auf leer und den Status auf `all`.

## UI-Design

### Toolbar

Die bisherige Touren-Toolbar mit Bulk-Aktionen bleibt grundsätzlich bestehen. Das Inline-Filterpanel entfällt. Stattdessen werden links neben den Bulk-Aktionen folgende Elemente platziert:

- `Filter zurücksetzen`, wenn mindestens ein Touren-Filter aktiv ist
- `Filtern` als Einstieg in das Modal

Rechts bleibt die Primäraktion `Tour anlegen`.

### Modal

Das Touren-Filtermodal enthält:

- Titel
- kurze Beschreibung
- Eingabefeld `Name`
- Auswahlfeld `Status`
- Sekundäraktion `Abbrechen`
- Primäraktion `Anwenden`

Die Statusoptionen entsprechen dem bestehenden Verhalten:

- `Alle`
- `Aktive Touren`
- `Inaktive Touren`

### Empty-State-Verhalten

Wenn Touren fachlich vorhanden sind, aber die aktiven Filter zu einem leeren Ergebnis führen, muss die Listenansicht mit Toolbar sichtbar bleiben. Das globale Touren-Empty-State darf in diesem Fall nicht den Schnell-Reset und den Filtereinstieg verdrängen.

## Zustandsmodell

Der Touren-Tab erhält einen lokalen Draft-Zustand für das Modal:

- Draft für `query`
- Draft für `status`
- Boolean für den geöffneten Modalzustand

Regeln:

- Beim Öffnen des Modals wird der Draft aus dem aktuell aktiven Filterzustand initialisiert.
- Beim Schließen ohne Anwenden wird der Draft verworfen.
- `Anwenden` überträgt den Draft in die bestehenden Touren-Search-Params.
- `Filter zurücksetzen` setzt die aktiven Touren-Filter direkt auf die Standardwerte zurück.

## Übersetzungen

Es werden zusätzliche i18n-Keys für die Touren-Filteroberfläche benötigt, analog zur Fraktionen-Struktur. Dazu gehören mindestens:

- `Filtern`
- `Filter zurücksetzen`
- Modal-Titel
- Modal-Beschreibung
- Feldlabel `Name`
- Feldlabel `Status`
- Platzhalter für den Namensfilter
- Optionen `Alle`, `Aktive Touren`, `Inaktive Touren`
- `Anwenden`
- `Abbrechen`

Hardcodierte UI-Texte sind ausgeschlossen.

## Tests

Mindestens folgende Tests werden ergänzt oder angepasst:

- Die Touren-Toolbar rendert `Filtern` und bei aktivem Filter zusätzlich `Filter zurücksetzen`.
- Ein Klick auf `Filtern` öffnet das Touren-Modal.
- Änderungen im Modal werden erst nach `Anwenden` in den aktiven Filterzustand übernommen.
- `Abbrechen` verwirft Draft-Änderungen.
- `Filter zurücksetzen` setzt Name und Status ohne Modal auf die Standardwerte zurück.
- Das bisherige Inline-Filterpanel wird nicht mehr gerendert.
- Bei leerem gefilterten Ergebnis bleibt die Touren-Listenansicht mit Toolbar sichtbar, solange Touren im zugrunde liegenden Datenbestand vorhanden sind.

## Architektur- und Dokuwirkung

Die Änderung bleibt innerhalb der bestehenden Waste-Management-UI-Struktur. Es entsteht kein neuer Architekturbaustein und kein geänderter Serververtrag.

Eine Fortschreibung der Architektur-Dokumentation ist voraussichtlich nicht nötig, solange die Filterlogik fachlich unverändert bleibt und nur das Interaktionsmuster der Oberfläche angepasst wird.
