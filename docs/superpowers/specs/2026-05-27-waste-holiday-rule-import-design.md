# Design: Feiertagsbasierte Regelentwürfe im Waste Management

## Kontext

Das Waste-Management-Plugin verwaltet bereits globale Datumsverschiebungen und modulbezogene Einstellungen. Es fehlt jedoch ein strukturierter Weg, Feiertage je Bundesland automatisiert zu laden, dauerhaft als fachliche Regelentwürfe zu verwalten und diese für spätere globale Verschiebungsregeln vorzubereiten.

Als externe Quelle steht `https://feiertage-api.de/api/?jahr=<YYYY>&nur_land=<KÜRZEL>` zur Verfügung. Die relevanten Feiertage hängen vom Bundesland ab. Dieses Bundesland soll pro Waste-Management-Instanz in den Einstellungen gepflegt und gespeichert werden.

## Ziele

- Waste-Management speichert ein relevantes Bundeslandkürzel in den Einstellungen.
- Beim Speichern der Einstellungen wird synchron ein Feiertagsabgleich für einen festen 10-Jahres-Horizont ausgelöst.
- Es gibt zusätzlich eine manuelle Aktion für einen erneuten Feiertagsabgleich.
- Für alle geladenen Feiertage werden persistierte Feiertags-Regelentwürfe angelegt.
- Pro Feiertag können Benutzer individuell `nur Feiertag|ganze Woche` und `Vorziehen|Nachholen` konfigurieren.
- Manuelle globale Verschiebungsregeln haben immer Vorrang und werden von der Automatik nie überschrieben.
- In diesem Change entstehen noch keine automatisch wirksamen globalen Date-Shifts.

## Nicht-Ziele

- Kein sofortiges Anwenden vollständig konfigurierter Feiertagsregeln auf globale Date-Shifts.
- Kein automatisches Löschen bereits importierter Feiertagsentwürfe, wenn sie in späteren API-Antworten fehlen.
- Kein Ersatz oder Umbau des bestehenden Modells für manuelle globale Datumsverschiebungen.
- Keine asynchrone Job-Orchestrierung für den Feiertagssync in diesem Change.

## Nutzerfluss

1. Ein Benutzer mit Settings-Recht öffnet den Settings-Bereich des Waste-Management-Plugins.
2. Er wählt das relevante Bundeslandkürzel für die aktive Instanz aus und speichert die Einstellungen.
3. Der Server speichert das Bundesland und startet in derselben Anfrage einen synchronen Feiertagsabgleich für das aktuelle Jahr bis einschließlich `aktuelles Jahr + 9`.
4. Für jedes Jahr werden die Feiertage des gewählten Bundeslands über die externe API geladen, normalisiert und als Feiertags-Regelentwürfe persistiert.
5. Die Settings-Antwort enthält neben dem Speichervorgang auch den Status des Feiertagssyncs: erfolgreich, teilweise erfolgreich oder fehlgeschlagen.
6. Im Scheduling-Bereich sieht der Benutzer eine eigene Liste `Feiertagsregeln` mit den importierten Entwürfen.
7. Pro Feiertag kann der Benutzer die beiden Fachentscheidungen pflegen:
   - Geltungsbereich: `nur Feiertag` oder `ganze Woche`
   - Strategie: `Vorziehen` oder `Nachholen`
8. Sobald beide Werte gesetzt sind, gilt der Feiertagseintrag als vollständig konfiguriert.
9. Vollständig konfigurierte Feiertagsentwürfe bleiben in diesem Change vorbereitende Fachregeln und erzeugen noch keine wirksamen globalen Date-Shifts.

## Fachmodell

### Neues Modell: Feiertags-Regelentwurf

Die Feiertagslogik wird als eigener persistierter Bestand modelliert und nicht in die bestehende Tabelle für globale Date-Shifts gemischt. Ein Feiertags-Regelentwurf repräsentiert genau einen importierten Feiertag für ein bestimmtes Jahr, Bundesland und Datum.

Jeder Eintrag enthält mindestens:

- eindeutige ID
- Feiertagsname
- Feiertagsdatum
- Jahr
- Bundeslandkürzel
- Quelltyp `feiertage-api.de`
- Importtyp `automatisch`
- fachlichen Konfigurationszustand
- Quellstatus aus letztem Sync
- Konfliktstatus mit manuellen globalen Regeln

Zusätzlich trägt der Entwurf die benutzerpflegbaren Felder:

- Geltungsbereich `holiday-only | full-week`
- Strategie `advance | postpone`

### Konfigurationszustände

Ein Feiertags-Regelentwurf kennt mindestens folgende Zustände:

- `draft`: Importiert, aber noch nicht vollständig fachlich konfiguriert
- `configured`: Geltungsbereich und Strategie sind vollständig gesetzt
- `conflict`: Der Entwurf kollidiert mit einer manuellen globalen Regel für denselben Wirkzeitraum
- `not-confirmed`: Der Eintrag wurde in einem späteren Sync nicht mehr aus der Quelle bestätigt

Diese Zustände können sich kombinieren, etwa `configured + conflict` oder `draft + not-confirmed`, sofern das Datenmodell dies explizit abbildet.

## Settings-Design

### Neues Feld in Waste-Einstellungen

Die Waste-Einstellungen erhalten ein neues Feld für das Bundeslandkürzel. Gespeichert wird das offizielle Kürzel der Feiertags-API, etwa `NW`, `BY` oder `TH`.

Das Feld ist fachlich Pflicht, sobald die Feiertagsregeln genutzt werden sollen. Die UI sollte die möglichen Bundesländer als kontrollierte Auswahl statt Freitext anbieten, damit nur gültige API-Kürzel gespeichert werden.

### Save-Verhalten

Beim Speichern der Settings wird das Bundesland persistiert und direkt danach synchron der Feiertagssync ausgeführt. Der Save-Vorgang bleibt eine einzige Benutzeraktion, aber das Antwortmodell muss zwei Ergebnisse transportieren:

- Ergebnis des Settings-Speicherns
- Ergebnis des Feiertagssyncs

Der Settings-Speicherpfad darf nicht unklar werden, wenn die API temporär nicht erreichbar ist. Deshalb gilt:

- Das Bundesland kann erfolgreich gespeichert werden, auch wenn der nachgelagerte Feiertagssync teilweise oder vollständig fehlschlägt.
- Der Sync-Status wird für den Benutzer explizit zurückgemeldet.

## Feiertagssynchronisation

### Zeitraum

Der Feiertagssync arbeitet mit einem festen gleitenden Horizont von 10 Kalenderjahren:

- Startjahr: aktuelles Kalenderjahr zum Zeitpunkt des Syncs
- Endjahr: `aktuelles Jahr + 9`

### API-Aufrufe

Für jedes Jahr des Horizonts ruft der Server die Feiertags-API mit folgendem Muster auf:

- `https://feiertage-api.de/api/?jahr=<YYYY>&nur_land=<KÜRZEL>`

Die Feiertags-API dokumentiert `jahr` als Pflichtparameter und `nur_land` als Filter auf ein einzelnes Bundesland. Die zulässigen Kürzel sind bundeslandspezifische Kürzel wie `BW`, `BY`, `NW`, `TH`; zusätzlich existiert laut API auch `NATIONAL`, wird hier aber nicht als Primärmodell verwendet, weil das Setting pro Bundesland geführt werden soll.

Quelle:
- https://feiertage-api.de/

### Synchronisationsregeln

Beim Sync gilt:

- Jeder gefundene Feiertag wird als Feiertags-Regelentwurf angelegt, falls er noch nicht existiert.
- Bereits automatisch importierte Feiertagsentwürfe für denselben fachlichen Schlüssel werden aktualisiert oder als erneut bestätigt markiert.
- Bereits importierte Entwürfe werden nicht automatisch gelöscht, wenn ein Feiertag später nicht mehr in der Quelle auftaucht.
- Statt Löschung wird der Quellstatus auf `not-confirmed` gesetzt.

## Konfliktregeln

Manuelle globale Verschiebungsregeln haben immer Vorrang.

Das bedeutet:

- automatische Feiertags-Regelentwürfe überschreiben niemals manuelle globale Date-Shifts
- die Automatik legt keine Änderungen an bestehenden manuellen globalen Regeln an
- wenn ein Feiertagsentwurf einen Wirkzeitraum berührt, für den bereits eine manuelle globale Regel existiert, markiert das System den Entwurf als Konflikt
- Konfliktmarkierung ist informativ und verändert keine manuelle Regel automatisch

## UI-Design

### Settings

Im Settings-Bereich wird die Bundeslandauswahl als kontrolliertes Auswahlfeld ergänzt. In unmittelbarer Nähe zum Speichern soll der Benutzer erkennen können, dass beim Speichern zusätzlich ein synchroner Feiertagsabgleich über 10 Jahre ausgeführt wird.

Die Save-Rückmeldung muss daher nicht nur `gespeichert` anzeigen, sondern den Sync-Status klar abbilden:

- Settings gespeichert, Feiertagssync erfolgreich
- Settings gespeichert, Feiertagssync teilweise erfolgreich
- Settings gespeichert, Feiertagssync fehlgeschlagen

### Scheduling-Bereich

Im Scheduling-Bereich erscheint eine eigene Liste oder Subsektion `Feiertagsregeln`. Diese zeigt:

- Datum
- Feiertagsname
- Jahr
- Bundesland
- Import-/Quellstatus
- Konfliktstatus
- Geltungsbereich
- Strategie

Wegen des 10-Jahres-Horizonts muss die Liste gruppier- oder filterbar sein. Standardmäßig sollte die UI auf aktuelles Jahr und Folgejahr fokussieren; weitere Jahre bleiben gezielt zugänglich, aber nicht ungefiltert dominant.

## Fehlerverhalten

### Grundsatz

Settings-Speichern und Feiertagssync sind fachlich gekoppelt, aber nicht untrennbar atomar. Das Bundesland-Setting soll nicht verloren gehen, nur weil die externe API schwankt.

### Ergebniszustände

Der Feiertagssync liefert mindestens:

- `success`
- `partial_success`
- `failed`

`partial_success` deckt Fälle ab, in denen einzelne Jahre erfolgreich geladen wurden, andere aber durch API-, Timeout- oder Normalisierungsprobleme fehlschlagen.

### Anforderungen

- Fehler der externen Feiertags-API werden benutzerführend angezeigt.
- Kein roher API-Stacktrace oder ungefilterte Fremdantwort im UI.
- Bereits persistierte Feiertagsentwürfe bleiben bei Sync-Fehlern erhalten.
- Der Benutzer kann den Sync manuell erneut ausführen.

## Manuelle Regeneration

Zusätzlich zum automatischen Sync beim Settings-Speichern gibt es eine manuelle Aktion zum erneuten Feiertagsabgleich.

Diese Aktion dient dazu:

- temporäre API-Fehler später nachzuziehen
- nach geänderten Settings einen neuen Import bewusst anzustoßen
- den 10-Jahres-Bestand erneut gegen die Quelle zu bestätigen

Die manuelle Aktion verwendet denselben 10-Jahres-Horizont und dieselben Konflikt- und Append-only-Regeln wie der automatische Sync.

## Ableitung globaler Verschiebungsregeln

In diesem Change bleiben Feiertags-Regelentwürfe vorbereitende Fachkonfigurationen. Auch ein vollständig konfigurierter Feiertagsentwurf erzeugt noch keine wirksamen globalen Date-Shifts.

Die fachliche Semantik wird aber bereits so festgelegt, dass eine spätere Ableitung möglich ist:

- `holiday-only + advance`: alle betroffenen Abholungen am Feiertag würden um einen Tag vorgezogen
- `holiday-only + postpone`: alle betroffenen Abholungen am Feiertag würden um einen Tag nachgeholt
- `full-week + advance`: alle Abholungen der betroffenen Woche würden um einen Tag vorgezogen
- `full-week + postpone`: alle Abholungen der betroffenen Woche würden um einen Tag nachgeholt

Diese Semantik wird jetzt bereits im Entwurfsmodell gepflegt, aber operative Wirksamkeit ist explizit vertagt.

## Architektur

Die Umsetzung sollte in vier klar getrennte Bausteine zerlegt werden:

1. Settings-Baustein für Bundeslandpersistenz
2. Serverseitiger Feiertags-Connector zur externen API
3. Persistenz- und Fachmodell für Feiertags-Regelentwürfe
4. Scheduling-UI für Feiertags-Regelpflege und Sync-Status

Diese Trennung ist erforderlich, weil externe Quelle, Regelentwurf und wirksame globale Verschiebung unterschiedliche Lebenszyklen haben und nicht in einem überladenen Modell vermischt werden sollen.

## Tests

### Connector-Tests

- Normalisierung der Feiertags-API-Antwort pro Jahr
- Verarbeitung mehrerer Jahre innerhalb des 10-Jahres-Horizonts
- Teilfehler über einzelne Jahre
- robustes Verhalten bei Timeout, leerer Antwort oder unvollständiger Struktur

### Handler- und Settings-Tests

- Bundesland wird gespeichert
- synchroner Feiertagssync wird beim Settings-Speichern ausgelöst
- Ergebnisstatus `success`, `partial_success`, `failed`
- manueller Feiertagssync ist separat ausführbar

### Persistenztests

- Import legt Feiertagsentwürfe an
- erneuter Import bestätigt bestehende automatische Einträge
- fehlende Feiertage werden nicht gelöscht, sondern als `not-confirmed` markiert
- manuelle globale Regeln werden nicht überschrieben
- Konfliktstatus wird korrekt gesetzt

### UI-Tests

- Bundeslandauswahl in Settings
- Save-Rückmeldung mit Sync-Status
- Feiertagsliste im Scheduling-Bereich
- Pflege von Geltungsbereich und Strategie pro Feiertag
- Jahrfilterung oder Gruppierung für den 10-Jahres-Bestand

## Auswirkungen auf bestehende Bausteine

- `packages/plugin-waste-management`: Settings-Formular, Scheduling-UI, Übersetzungen, Sync-Rückmeldung
- `packages/auth-runtime`: synchroner Feiertags-Connector, Settings-Handler-Erweiterung, manueller Sync-Pfad
- `packages/core` und/oder `packages/data-repositories`: neuer Vertrag und Persistenz für Feiertags-Regelentwürfe
- `openspec`: eigener Change für diese Capability-Erweiterung

## Empfehlung

Die Feiertagsfunktion sollte als eigener Waste-Management-Change umgesetzt werden: mit persisted Bundesland-Setting, synchronem 10-Jahres-Sync gegen `feiertage-api.de`, append-only Feiertags-Regelentwürfen und separater Regelpflege im Scheduling-Bereich. Damit bleibt die Lösung fachlich nachvollziehbar, überschreibt keine manuellen globalen Regeln und schafft eine saubere Grundlage für eine spätere automatische Erzeugung wirksamer globaler Date-Shifts.
