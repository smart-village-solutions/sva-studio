# Design: Tour-Duplizierung im Waste Management

## Kontext

Im Waste-Management-Plugin existiert bereits ein Create-/Edit-Workflow für Touren sowie ein separates Modell für Abholort-Zuordnungen und tourbezogene Datumsverschiebungen. Für Abholorte gibt es außerdem schon ein Copy-Muster, bei dem ein Datensatz in dieselbe Erstellungsansicht mit vorbelegten Werten überführt wird.

Neu benötigt wird eine Duplizierungsfunktion für Touren. Sie soll in der Tourentabelle als eigene Aktion verfügbar sein, die normale Tour-Erstellungsseite öffnen und diese mit den Daten der Quell-Tour vorbelegen. Zusätzlich sollen die zugehörigen Abholort-Zuordnungen und tourbezogenen Datumsverschiebungen der Quell-Tour nach dem Speichern auf die neue Tour übernommen werden. Die Original-Tour darf durch die Duplizierung nicht verändert werden.

## Ziele

- In der Tourentabelle steht pro Zeile eine neue Aktion `Duplizieren` zur Verfügung.
- Der Duplizieren-Flow nutzt dieselbe Erstellungsseite wie normales Anlegen, nicht eine Sonderseite.
- Die neue Tour wird mit vorbelegten Stammdaten der Quell-Tour geöffnet.
- Der Name wird initial mit dem Suffix ` (Kopie)` vorbelegt.
- Abholort-Zuordnungen und tourbezogene Datumsverschiebungen werden erst nach dem Speichern serverseitig auf die neue Tour kopiert.
- Die UI macht diesen verzögerten Übernahmezeitpunkt vor dem Speichern explizit sichtbar.
- Die Gesamtoperation wird fachlich als vollständige Duplizierung behandelt, nicht als zulässiger Teilerfolg.

## Nicht-Ziele

- Kein sofort sichtbares Bearbeiten der übernommenen Abholort-Zuordnungen innerhalb der Tour-Erstellungsseite.
- Kein neuer eigenständiger CRUD-Bereich für Duplikate.
- Keine Änderung an der fachlichen Bedeutung vorhandener Tour-, Link- oder Shift-Modelle.
- Keine Änderung an der Original-Tour oder ihren bestehenden Beziehungen.

## Nutzerfluss

1. Ein berechtigter Benutzer öffnet die Tourentabelle im Waste-Management-Plugin.
2. In der Zeile einer Tour wählt er die Aktion `Duplizieren`.
3. Das Plugin navigiert in den bestehenden Tour-Create-View.
4. Das Formular ist mit den Stammdaten der Quell-Tour vorbelegt:
   - Name als `Originalname (Kopie)`
   - Beschreibung
   - Abfallarten
   - Aktiv-Status
   - Wiederholung
   - Start-/Enddatum
   - benutzerdefinierte Termine
5. Die UI zeigt im Duplizierungsfall oberhalb der Speichern-Actions einen Hinweis an, dass Abholort-Zuordnungen und tourbezogene Datumsverschiebungen erst nach dem Speichern übernommen werden.
6. Beim Speichern sendet der Client die neue Tour-Payload plus den Verweis auf die Quell-Tour.
7. Der Server legt die neue Tour an und kopiert anschließend die zugehörigen Abholort-Zuordnungen und tourbezogenen Datumsverschiebungen auf die neue Tour.
8. Nach erfolgreicher Gesamtoperation erscheint eine Erfolgsmeldung, die die vollständige Duplizierung bestätigt.
9. Die Original-Tour bleibt unverändert.

## UI-Design

### Tabellenaktion

Die bestehende Row-Action-Struktur der Tourentabelle wird um `Duplizieren` erweitert. Die Aktion folgt demselben Bedienmuster wie bestehende zeilenbezogene Aktionen und wird nur dann angeboten, wenn der Benutzer die für die vollständige Duplizierung nötigen Rechte besitzt.

### Create-View mit Duplizierungs-Kontext

Der bestehende Tour-Create-View bleibt die kanonische Oberfläche. Es wird kein zusätzlicher Detailpfad eingeführt. Stattdessen erhält der View einen optionalen Duplizierungs-Kontext, der Folgendes enthält:

- Quell-Tour-ID
- Kennzeichnung, dass der aktuelle Create-Flow aus einer Duplizierung stammt
- optionalen Anzeigenamen der Quell-Tour für UI-Kopie

Damit kann das Formular den Hinweisblock und die angepasste Erfolgsmeldung nur im Duplizierungsfall anzeigen, ohne das Verhalten normaler Create-/Edit-Flows zu verändern.

### Hinweis vor dem Speichern

Im Duplizierungsfall wird direkt vor den primären Form-Actions ein statischer Infoblock angezeigt. Der Hinweis erklärt, dass die Abholort-Zuordnungen und tourbezogenen Datumsverschiebungen der Original-Tour erst nach dem Speichern auf die neue Tour übernommen werden.

Der Hinweis erscheint:

- nur im Duplizierungsfall
- im sichtbaren Bereich der Speichern-Actions
- nicht als Toast
- nicht modal

Damit wird das erwartbare Missverständnis vermieden, dass die Create-Seite unvollständig sei, weil die übernommenen Beziehungen dort zunächst nicht sichtbar sind.

## Zustandsmodell und Navigation

Die bestehende Suchparameter- und View-Logik für Touren kennt derzeit `list`, `create` und `edit`. Für die Duplizierung wird kein komplett neuer Seitenpfad eingeführt, aber der Create-Flow benötigt einen unterscheidbaren Kontext.

Empfohlenes Modell:

- `toursView` bleibt `create`
- zusätzlicher optionaler Search-Param oder äquivalenter View-State für `duplicateFromTourId`

Begründung:

- Der Host-Vertrag für den Create-View bleibt stabil.
- Das bestehende Muster `list/create/edit` wird nicht unnötig aufgefächert.
- Der View kann über einen expliziten Param erkennen, dass das Formular vorbelegt werden muss und Hinweistext plus Spezial-Submit-Verhalten aktiv sind.

## Datenmodell und API-Vertrag

### Client-Payload

Die bestehende Create-Payload für Touren wird um ein optionales Feld erweitert:

- `duplicateFromTourId?: string`

Dieses Feld ist ausschließlich im Duplizierungsfall gesetzt. Im normalen Create-Flow bleibt es leer.

### Semantik des Duplizierungsfelds

Wenn `duplicateFromTourId` gesetzt ist, bedeutet dies:

- Die anzulegende Tour wird aus den übergebenen Create-Feldern erstellt.
- Zusätzlich werden nach erfolgreicher Tour-Anlage die Abholort-Zuordnungen der Quell-Tour auf die neue Tour kopiert.
- Zusätzlich werden die tourbezogenen Datumsverschiebungen der Quell-Tour mit neuer ID und neuer `tourId` auf die neue Tour kopiert.

Die fachliche Quelle der kopierten Relationen ist also immer die serverseitig geladene Quell-Tour, nicht eine vom Client gelieferte Kopie dieser Relationen.

## Server-Design

### Empfohlener Ansatz

Die bestehende Tour-Create-Operation wird um den optionalen Duplizierungsmodus erweitert. Es wird kein separates `duplicate-tour`-Endpoint eingeführt.

Begründung:

- Die UX bleibt ein normaler Create-Flow.
- Die Kopierlogik wird zentral serverseitig gehalten.
- Validierung, Audit, Sichtbarkeitsstatus und bestehende Tour-Create-Infrastruktur bleiben wiederverwendbar.
- Die API-Oberfläche bleibt kleiner als bei einem dedizierten Spezial-Endpoint.

### Ablauf der Serveroperation

1. Berechtigungen prüfen.
2. Request validieren.
3. Falls `duplicateFromTourId` gesetzt ist:
   - Quell-Tour laden und Existenz prüfen
   - zugehörige Abholort-Zuordnungen laden
   - zugehörige tourbezogene Datumsverschiebungen laden
4. Neue Tour speichern.
5. Für jede Quell-Zuordnung einen neuen `location-tour-link` für die neue Tour anlegen.
6. Für jede Quell-Datumsverschiebung einen neuen tourbezogenen Shift mit neuer ID und neuer `tourId` anlegen.
7. Gesamtoperation verifizieren.
8. Audit als erfolgreiche Tour-Duplizierung bzw. Tour-Anlage protokollieren.

### Kopierregeln

#### Tour-Stammdaten

Folgende Stammdaten werden aus dem Formular der neuen Tour übernommen:

- Name
- Beschreibung
- Abfallarten
- Aktiv-Status
- Wiederholung
- Startdatum
- Enddatum
- benutzerdefinierte Termine

Die neue Tour erhält immer eine neue ID. Die Original-Tour bleibt unverändert.

#### Abholort-Zuordnungen

Für jede Quell-Zuordnung wird ein neuer Datensatz mit neuer ID erstellt. Übernommen werden:

- `locationId`
- `startDate`
- `endDate`

Neu gesetzt wird:

- `tourId` auf die neue Tour

#### Tourbezogene Datumsverschiebungen

Für jede Quell-Datumsverschiebung wird ein neuer Datensatz mit neuer ID erstellt. Übernommen werden:

- `originalDate`
- `actualDate`
- `hasYear`
- `reasonType`
- `reasonKey`
- `followUpMode`
- `description`

Neu gesetzt wird:

- `tourId` auf die neue Tour

## Berechtigungen

Die vollständige Duplizierung benötigt zwei fachliche Rechte:

- `waste-management.tours.manage`
- `waste-management.scheduling.manage`

Die Aktion `Duplizieren` wird nur angezeigt, wenn beide Rechte verfügbar sind. Dadurch wird vermieden, dass ein Benutzer einen angebotenen Flow erst beim Speichern wegen fehlender Shift-Kopierrechte verliert.

Serverseitig werden die Rechte trotzdem erneut geprüft. Wenn sich die Berechtigungslage zwischen Anzeige und Speichern ändert, schlägt die Operation mit einer eindeutigen Forbidden-Fehlermeldung fehl.

## Fehlerbehandlung und Konsistenz

Die Duplizierung wird fachlich als Gesamtoperation behandelt. Ein stiller Teilerfolg ist nicht zulässig.

### Fehlerfälle

- Quell-Tour nicht gefunden
- fehlende Berechtigung
- neue Tour kann nicht erstellt werden
- Abholort-Zuordnungen können nicht vollständig kopiert werden
- tourbezogene Datumsverschiebungen können nicht vollständig kopiert werden
- Verifikationsfehler nach Speicherung

### Konsistenzregel

Entweder werden neue Tour, Abholort-Zuordnungen und tourbezogene Datumsverschiebungen vollständig angelegt oder die Operation gilt als fehlgeschlagen.

Bevorzugt wird eine echte transaktionale Serverausführung. Falls die aktuelle Repository-Schicht keinen gemeinsamen Transaktionsrahmen für alle Schritte anbietet, ist ein sauberes Kompensationsverhalten erforderlich:

- Wenn die neue Tour angelegt wurde und eine nachgelagerte Kopie scheitert, muss die neu angelegte Tour einschließlich bereits erzeugter abhängiger Datensätze wieder entfernt werden.

Damit bleibt ausgeschlossen, dass halbfertige Duplikate im System verbleiben.

## Übersetzungen und UX-Kopie

Benötigt werden neue Übersetzungsschlüssel mindestens für:

- Tabellenaktion `Duplizieren`
- Hinweistext im Duplizierungsfall
- Erfolgsmeldung für vollständige Duplizierung
- ggf. spezifische Fehlermeldung für fehlgeschlagene Duplizierung

Alle Texte folgen den bestehenden i18n-Regeln des Projekts. Hardcodierte Strings in der UI sind ausgeschlossen.

## Tests

### Plugin-/UI-Tests

- Row-Action `Duplizieren` wird bei ausreichenden Rechten angezeigt.
- Row-Action wird bei fehlenden Rechten nicht angezeigt.
- Klick auf `Duplizieren` navigiert in den Create-View.
- Formular wird mit Quell-Tour-Daten vorbelegt.
- Name erhält das Suffix ` (Kopie)`.
- Hinweisblock erscheint nur im Duplizierungsfall.
- Normales Erstellen und Bearbeiten bleiben unverändert.
- Submit sendet `duplicateFromTourId` nur im Duplizierungsfall.
- Erfolgsmeldung kommuniziert vollständige Duplizierung.

### Server-/Handler-Tests

- erfolgreiche Duplizierung mit kopierten Abholort-Zuordnungen
- erfolgreiche Duplizierung mit kopierten tourbezogenen Datumsverschiebungen
- Quell-Tour nicht gefunden
- fehlende Berechtigungen
- Fehler beim Kopieren von Abholort-Zuordnungen
- Fehler beim Kopieren von tourbezogenen Datumsverschiebungen
- Rollback/Kompensation bei nachgelagertem Kopierfehler
- Original-Tour bleibt unverändert

### Fachnahe Integrationstests

- Nach erfolgreichem Reload erscheint die neue Tour mit übernommenen Zuordnungen und übernommenen tourbezogenen Datumsverschiebungen in den Overviews.
- Die Original-Tour zeigt weiterhin ihre ursprünglichen Beziehungen ohne Seiteneffekte.

## Auswirkungen auf bestehende Bausteine

- `packages/plugin-waste-management`: Tabellenaktion, Navigation, Formular-Kontext, Hinweisblock, Submit-Verhalten, Übersetzungen, Tests
- `packages/auth-runtime`: Erweiterung des Tour-Create-Handlers oder eines eng benachbarten Servicepfads um serverseitige Kopierlogik, Rechteprüfung, Konsistenzsicherung und Tests
- ggf. `packages/core` oder gemeinsame Waste-Typen: optionales Duplizierungsfeld im Create-Vertrag
- `openspec`: Für die eigentliche Umsetzung ist ein Change-Proposal für die neue Capability-Erweiterung erforderlich

## Offene Architekturentscheidung

Die fachliche Richtung ist festgelegt, aber für die Umsetzung muss vor dem Coden entschieden werden, ob die bestehende Persistenzschicht eine echte transaktionale Ausführung für Tour-Anlage plus Relationenkopie erlaubt. Falls nicht, muss das Kompensationsverhalten explizit im Implementierungsplan heruntergebrochen werden.

## Empfehlung

Umsetzen als Erweiterung des bestehenden Tour-Create-Flows mit optionalem Feld `duplicateFromTourId` und vollständig serverseitiger Kopierlogik. Dieser Ansatz erfüllt den gewünschten UX-Vertrag, hält die Integrität der Daten besser als eine Client-Orchestrierung und vermeidet unnötige zusätzliche API-Oberfläche.
