# News-Editor Redaktionelle Vereinfachung Design

## Kontext

Die Bearbeitungsansicht des News-Plugins ist aktuell technisch nah an der Mainserver-/GraphQL-Struktur aufgebaut. Innerhalb der Tabpanels stehen viele Felder in einer flachen Formularfläche. Für Redakteure ist die Oberfläche dadurch schwerer zu scannen und stärker vom technischen Datenmodell geprägt als vom redaktionellen Arbeitsablauf.

Gleichzeitig existiert im Studio bereits ein klareres Workspace-Muster, etwa im Waste-Management: eine äußere Panel-Fläche pro Tab und darin fachlich getrennte weiße Arbeitskarten. Dieses Muster soll auf die News-Bearbeitung übertragen werden.

Zusätzlich soll die Oberfläche redaktionell vereinfacht werden:

- nur noch ein globales `Speichern`
- weniger technische Felder
- klarere Gruppierung nach Arbeitsaufgaben
- ein echter Entwurfsmodus auf Basis der separaten Visibility-Mutation

## Ziele

- Die News-Detailansicht arbeitet innerhalb jedes Tabpanels mit klar getrennten weißen Cards.
- Die Oberfläche orientiert sich an redaktionellen Aufgaben statt an der 1:1-Abbildung des GraphQL-Modells.
- `Speichern` sichert immer den gesamten Formularzustand über alle Tabs.
- Entwürfe werden über die separate Visibility-Mutation auf unsichtbar gesetzt und bleiben in der Studio-Newsliste sichtbar.
- In der Studio-Inhaltsliste bleibt für Redakteure jeder Inhalt sichtbar; Sichtbarkeit wird dort zusätzlich direkt über einen Schieberegler steuerbar.
- Die vereinfachte Oberfläche mappt weiterhin auf das bestehende News-Modell, insbesondere auf den ersten `contentBlock`.
- Push-Benachrichtigungen bleiben pro News maximal einmal auslösbar.

## Nicht-Ziele

- Kein vollständiger Neuaufbau des News-Datenmodells im Mainserver.
- Keine Einführung eines zweiten, separaten Draft-Speichers neben dem Mainserver.
- Keine Galerieauswahl für Medien in diesem Change.
- Kein Ausbau der öffentlichen App-Darstellung von News.
- Kein 1:1-Nachbau aller historischen oder technischen Mainserver-Felder in der neuen Studio-Oberfläche.

## Bestehender Stand

- Die News-Detailansicht besitzt bereits Tabs für `Basis`, `Inhalte`, `Veröffentlichung`, `Einstellungen` und `Historie`.
- Das Formular speichert heute tabweise Teilmutationen.
- Die Oberfläche verwendet aktuell Felder wie `keywords`, `externalId`, `newsType`, `charactersToBeShown`, `fullVersion`, `pointOfInterestId`, `teaserImageAssetId` und `headerImageAssetId`.
- Die Mainserver-News-Typen sind lokal auf `status: 'published'` und ein Pflichtfeld `publishedAt` zugeschnitten.
- Das Upstream-Newsmodell liefert `visible`.
- Die echte GraphQL-API verwendet für Sichtbarkeit eine separate Mutation `changeVisibility(id, recordType, visible)`.
- Der aktuelle lokale Studio-/Mainserver-Adapter bildet diese Visibility-Mutation für News noch nicht ab.
- Die Studio-Newsliste liest aktuell denselben News-Pfad, der unsichtbare News herausfiltert.
- Die Historie existiert bereits über `fetchIamContentHistory`, wird aber im Detailtab als Timeline-ähnliche Liste dargestellt.

## Bewertete Ansätze

### Ansatz A: Reine UI-Politur ohne fachliche Änderungen

Die Tabpanels würden nur optisch in Cards gegliedert, die bestehende tabweise Speicherlogik und das bestehende Formularmodell blieben weitgehend erhalten.

Vorteile:
- geringerer Eingriff
- wenig Risiko in Adapter und Tests

Nachteile:
- löst die redaktionelle Vereinfachung nur oberflächlich
- Entwurfsmodus bleibt unecht
- technische Felder und tabweise Saves bleiben bestehen

### Ansatz B: Redaktionelle UI-Vereinfachung mit Adapter-Mapping und separater Visibility-Steuerung für Entwürfe

Die Oberfläche wird fachlich neu geschnitten, speichert aber weiterhin in die bestehende News-Struktur. Der Entwurfsmodus wird über die separate Mutation `changeVisibility(..., visible: false)` hergestellt. Studio-Liste und Mainserver-Adapter werden dafür gezielt erweitert.

Vorteile:
- klarer redaktioneller Workflow
- vorhandene Upstream-Sichtbarkeitslogik wird sinnvoll genutzt
- keine unnötige Parallelpersistenz
- UI und Studio-Liste bilden Entwürfe konsistent ab

Nachteile:
- ist kein reiner UI-Fix mehr
- erfordert gezielte Änderungen in Route, Adapter, Typen und Liste

### Ansatz C: Neuer separater Draft-Mechanismus außerhalb des News-Pfads

Entwürfe würden in einer eigenen lokalen oder Studio-spezifischen Persistenz verwaltet und erst bei Veröffentlichung in den Mainserver geschrieben.

Vorteile:
- maximale Studio-Kontrolle über Entwürfe

Nachteile:
- deutlich größerer Architektur-Change
- doppeltes Datenmodell
- unnötige Komplexität für das aktuelle Ziel

## Entscheidung

Es wird Ansatz B umgesetzt: redaktionelle UI-Vereinfachung mit gezieltem Adapter-Mapping und separater Visibility-Steuerung als Entwurfsmodus.

Diese Entscheidung hält den Change inhaltlich auf den News-Editor fokussiert, löst aber den Entwurfsmodus fachlich korrekt statt nur kosmetisch. Die vorhandene Upstream-Sichtbarkeitslogik wird bewusst als redaktioneller Veröffentlichungszustand genutzt. Dafür werden der News-Write-Pfad, eine dedizierte Visibility-Operation und die Studio-Newsliste erweitert, ohne einen zweiten Persistenzpfad einzuführen.

## Zielbild

### 1. Grundstruktur der Seite

- Die bestehende Tab-Hülle bleibt erhalten.
- Die Seite erhält eine globale Save-Action oben rechts außerhalb der Tabs.
- Diese Save-Action ist als Gesamtspeichern erkennbar und unabhängig vom aktiven Tab.
- Jedes Tabpanel besitzt weiterhin eine äußere Workspace-Fläche mit Titel und Beschreibung.
- Innerhalb des Panels werden die Inhalte in weiße Cards gegliedert.
- Der Save-Button speichert immer das gesamte Formular über alle Tabs.
- Dirty-Indikatoren können pro Tab sichtbar bleiben, blockieren den Tabwechsel aber nicht mehr tabweise.

### 2. Tabs und Cards

#### Tab `Basis`

Card `Titel & Kategorien`

- Das Feld `Titel` bleibt das primäre redaktionelle Titelfeld.
- Wenn ein News-Datensatz keinen expliziten Titel besitzt, wird der Titel beim Laden initial aus der Headline des ersten `contentBlock` vorbelegt.
- Danach ist der Titel ein eigenständiges, editierbares Feld.
- Kategorien werden als wiederholbare Auswahlzeilen modelliert.
- Die verfügbaren Kategorien werden aus der bestehenden Kategorien-Query geladen.
- Ein Add-Button fügt jeweils eine weitere Kategorien-Auswahl hinzu.
- Beim Speichern werden Kategorien dedupliziert und leere Einträge entfernt.

Card `Autor & Metadaten`

- Der Autor wird aus Benutzer- und Organisationskontext vorbelegt.
- Das Feld wird nie als Freitext dargestellt.
- Bei `org_only` ist der Autor fest gesetzt und als nicht editierbarer Wert sichtbar.
- Bei `org_or_personal` wird zwischen zulässigen Autorquellen über ein Dropdown gewählt: aktive Organisation oder aktueller Benutzer.
- Wenn keine aktive Organisation vorhanden ist, bleibt nur der Benutzer als Autorquelle.
- Im Edit-Modus zeigt die Card zusätzlich:
  - `Erstellt`
  - `Veröffentlicht`
  - `Zuletzt geändert`
- Fehlende Zeitwerte werden als `--.--.-- --:--` angezeigt.
- `keywords` entfallen vollständig aus der Oberfläche.

#### Tab `Inhalte`

Card `Textinhalt`

- Redaktionell wird der Titel im Tab `Basis` erstellt und bearbeitet.
- Technisch wird dieser Titel weiterhin in `contentBlocks[0].title` geschrieben.
- `Headline` wird im Tab `Inhalte` nur noch als read-only Information angezeigt.
- `Teaser` wird als einfaches Textfeld geführt und auf `contentBlocks[0].intro` gemappt.
- `Inhalt` wird als Rich-Text-Feld geführt und auf `contentBlocks[0].body` gemappt.
- Für den Rich-Text wird der vorhandene Studio-Rich-Text-Editor wiederverwendet.

Card `Medien`

- Alle in Studio bearbeitbaren Medien liegen ausschließlich im ersten `contentBlock.mediaContents`.
- `teaserImageAssetId` und `headerImageAssetId` werden nicht mehr angezeigt und nicht mehr aktiv bearbeitet.
- Die Card zeigt ein vereinfachtes Medienfeld mit einer zugehörigen Liste der angehängten Dateien.
- Dieses Feld darf mehrere Dateien enthalten.
- Die Vereinfachung ist fachlich vertretbar, weil die angebundene App ebenfalls nur diese angehängten Medien nutzt.
- Upload/Drag-and-Drop wird im UI-Pfad vorbereitet; die spätere Galerieauswahl bleibt explizit außerhalb dieses Changes.

Card `Quelle`

- Die Card enthält nur:
  - Link
  - Linktext
- Diese Felder werden auf `sourceUrl.url` und `sourceUrl.description` gemappt.
- Ein separater Öffnungsmodus wird nicht eingeführt.

#### Tab `Einstellungen`

Card `Push-Benachrichtigungen`

- Solange noch keine Push-Benachrichtigung versendet wurde, ist ein Schalter sichtbar.
- Aktiviert der Nutzer diesen Schalter und speichert eine veröffentlichte News, wird Push wie bisher einmalig ausgelöst.
- Sobald `pushNotificationsSentAt` gesetzt ist, wird kein erneuter Schalter mehr angeboten.
- Stattdessen zeigt die Card nur noch den Versandzeitpunkt.
- Ein erneutes Speichern einer bereits gepushten News löst keinen zweiten Versand aus.

Card `Veröffentlichung`

- Die Card bietet drei redaktionelle Modi:
  - `Entwurf`
  - `Sofort veröffentlichen`
  - `Zeitgesteuert`
- `Entwurf` speichert News-Inhalt und setzt die Sichtbarkeit anschließend über `changeVisibility(..., false)` auf unsichtbar.
- `Sofort veröffentlichen` speichert News-Inhalt und stellt die Sichtbarkeit anschließend über `changeVisibility(..., true)` sicher.
- `Zeitgesteuert` speichert News-Inhalt mit einem frei wählbaren Veröffentlichungszeitpunkt und stellt die Sichtbarkeit anschließend über `changeVisibility(..., true)` sicher.
- Der gewählte Zeitpunkt darf in der Vergangenheit oder Zukunft liegen.
- Bei bereits gespeicherten News zeigt die Card zusätzlich das tatsächliche Veröffentlichungsdatum des Datensatzes.

#### Tab `Historie`

- Die Historie wird als Tabelle statt als Karten-/Timeline-Liste dargestellt.
- Vorgesehene Spalten:
  - Zeitpunkt
  - Aktion
  - Akteur
  - Zusammenfassung
- Wenn keine Historie vorhanden ist, erscheint ein klarer Leerzustand.

## Datenmodell und Mapping

### 1. Vereinfachtes Editor-Formmodell

Die neue Oberfläche arbeitet mit einem redaktionellen Formularmodell, das nicht 1:1 dem Mainserver-Input entspricht.

Relevante UI-Felder:

- `title`
- `authorMode`
- `author`
- `categories[]`
- `contentTeaser`
- `contentBody`
- `contentMedia[]`
- `sourceUrl`
- `sourceUrlDescription`
- `pushNotificationEnabled`
- `publicationMode`
- `scheduledPublicationAt`

### 2. Mapping auf die bestehende News-Struktur

- `title` bleibt das explizite Titelfeld der News.
- `title` wird zusätzlich auf `contentBlocks[0].title` gespiegelt.
- `contentTeaser` wird auf `contentBlocks[0].intro` gemappt.
- `contentBody` wird auf `contentBlocks[0].body` gemappt.
- `contentMedia[]` wird auf `contentBlocks[0].mediaContents` gemappt.
- `sourceUrl` und `sourceUrlDescription` werden auf `sourceUrl` gemappt.
- Kategorien werden auf `categories` gemappt.

Wenn beim Laden keine `contentBlocks` vorhanden sind, wird weiterhin ein erster Block erzeugt. Die vereinfachte Oberfläche arbeitet immer gegen diesen ersten Block.

### 3. Legacy-Felder außerhalb des vereinfachten UI-Scope

Folgende Felder werden in der neuen Oberfläche nicht mehr aktiv angeboten:

- `keywords`
- `externalId`
- `newsType`
- `charactersToBeShown`
- `fullVersion`
- `pointOfInterestId`
- `showPublishDate`
- `teaserImageAssetId`
- `headerImageAssetId`

Regel:

- Beim Editieren bestehender News bleiben vorhandene Werte dieser Felder erhalten.
- Die globale Save-Logik darf sie nicht versehentlich löschen.
- Neue Records senden diese Felder nicht, solange es keine dedizierte UI dafür gibt.

## Veröffentlichungslogik

### 1. Redaktionelle Statusableitung

Der für Studio sichtbare Status wird aus Sichtbarkeit und `publishedAt` abgeleitet:

- unsichtbar => `Entwurf`
- sichtbar und `publishedAt` in der Zukunft => `Geplant`
- sichtbar und `publishedAt` in der Vergangenheit oder Gegenwart => `Veröffentlicht`

Ein separater Mainserver-Status für Drafts wird nicht eingeführt.

### 2. Persistenzregeln

Der Change erweitert den lokalen Studio-Adapter gezielt:

- die normale News-Mutation bleibt für Inhaltsfelder zuständig
- die separate Mutation `changeVisibility(id, recordType, visible)` wird als neue Operation ergänzt
- für News wird dabei `recordType: 'NewsItem'` verwendet
- der Sichtbarkeitswechsel gilt beim Anlegen und Bearbeiten gleichermaßen
- `publishedAt` bleibt Bestandteil der normalen News-Mutation

Konkrete Regeln:

- `Entwurf`
  - News-Inhalt wird zuerst über `createNews/updateNews` gespeichert
  - danach wird `changeVisibility(..., false)` ausgeführt
  - `publishedAt` bleibt als technischer Zeitwert gesetzt
  - bei neuen Entwürfen wird dafür standardmäßig der Save-Zeitpunkt verwendet
- `Sofort veröffentlichen`
  - `createNews/updateNews` setzt `publishedAt=jetzt`
  - danach wird `changeVisibility(..., true)` ausgeführt
  - `publicationDate` folgt demselben Zeitpunkt
- `Zeitgesteuert`
  - `createNews/updateNews` setzt `publishedAt=<gewählter Zeitpunkt>`
  - danach wird `changeVisibility(..., true)` ausgeführt
  - `publicationDate=<gewählter Zeitpunkt>`

Wichtig:

- Der Sichtbarkeitswechsel ist immer ein zweiter technischer Schritt nach der Inhaltsmutation.
- Das gilt sowohl beim erstmaligen Anlegen als auch bei späteren Wechseln `Entwurf <-> sichtbar`.
- Der redaktionelle Status `Entwurf` wird im Studio aus der Unsichtbarkeit abgeleitet, nicht aus einem leeren `publishedAt`.

## Studio-Liste

Die normale Studio-Newsliste muss Entwürfe weiterhin anzeigen.

Dafür wird der Studio-Lesepfad vom öffentlichen Sichtbarkeitsfilter getrennt:

- öffentliche bzw. sichtbarkeitsorientierte Listen blenden `visible=false` weiterhin aus
- die Studio-Newsliste fordert News inklusive unsichtbarer Datensätze an
- für Redakteure bleiben damit alle News sichtbar, weil sie sonst den Veröffentlichungszustand nicht ändern könnten

Technisch wird dafür ein expliziter Studio-Lesepfad benötigt, zum Beispiel über einen dedizierten Parameter oder eine getrennte interne Listenoperation. Wichtig ist nicht die konkrete URL-Form, sondern die klare Semantik: authentifizierte Studio-Listen dürfen Drafts sehen, öffentliche Pfade nicht.

In der Liste wird ein verständlicher redaktioneller Status angezeigt:

- `Entwurf`
- `Geplant`
- `Veröffentlicht`

Zusätzlich erhält die Studio-Inhaltsliste eine eigene Sichtbarkeitsinteraktion:

- pro Zeile gibt es einen Schieberegler für `sichtbar` / `nicht sichtbar`
- der Schieberegler arbeitet gegen dieselbe Visibility-Operation wie der Editor
- die Zeile bleibt auch nach dem Umschalten sichtbar und wechselt nur ihren redaktionellen Status
- dieses Listenmuster ist so geschnitten, dass es später auch für andere Content-Typen nutzbar ist

Zusätzlich gibt es ein passendes Filterkriterium:

- `Alle`
- `Sichtbar`
- `Nicht sichtbar`

Der Sichtbarkeitsfilter ergänzt den bestehenden redaktionellen Statusfilter, ersetzt ihn aber nicht.

## Historie

- Die bestehende IAM-History bleibt die Datenquelle.
- Es wird keine zweite, News-spezifische Historienpersistenz eingeführt.
- Die Darstellung wechselt auf eine Tabelle.
- Die vorhandenen zusammenfassenden Texte und geänderten Felder werden weiterverwendet, aber tabellarisch gerahmt.

## Architektur und Bausteine

### Plugin-News UI

- baut die Tab-Inhalte in Card-Sektionen um
- ersetzt tabweise Save-Buttons durch eine globale Save-Action im Seitenkopf oberhalb der Tabs
- führt das vereinfachte Formularmodell ein
- verwendet den bestehenden Rich-Text-Editor

### Plugin-News Mapping

- liest und schreibt `contentBlocks[0]` als primäres Redaktionsmodell
- kapselt die Ableitung zwischen `publicationMode`, Sichtbarkeit, `publishedAt` und `publicationDate`
- erhält nicht sichtbare Legacy-Felder bei Updates

### SVA-Mainserver Route und Operations

- ergänzt eine dedizierte News-Visibility-Operation für `changeVisibility(id, recordType, visible)`
- verwendet dafür den Record-Typ `NewsItem`
- orchestriert beim Speichern zwei Schritte:
  - `createNews/updateNews`
  - danach optional `changeVisibility`
- hält den normalen News-Mutationsvertrag frei von direktem `visible`-Schreiben
- passt den lokalen Adapter so an, dass Studio-Status und Visibility-Wechsel konsistent zusammenarbeiten

### Studio-Newsliste

- lädt Drafts mit
- zeigt redaktionellen Status statt nur technischer Felder
- bietet einen Schieberegler pro Zeile für den Visibility-Wechsel
- ergänzt ein Filterkriterium für `sichtbar` / `nicht sichtbar`

## Fehlerbehandlung

- Ungültige oder fehlende Veröffentlichungszeitpunkte blockieren `Sofort veröffentlichen` und `Zeitgesteuert`, nicht aber `Entwurf`.
- Ist kein zulässiger Autor konfigurierbar, wird ein klarer Fehler in der Autoren-Card gezeigt.
- Fehler in Kategorien-, Historien- oder Medien-Nebenpfaden bleiben lokal an der jeweiligen Card sichtbar.
- Ein Save-Fehler betrifft weiterhin das Gesamtformular und wird zentral als Formularzusammenfassung ausgegeben.
- Schlägt ein Visibility-Wechsel direkt in der Liste fehl, bleibt die Zeile sichtbar und zeigt den Fehler kontextnah am Schieberegler.

## Tests

### Unit- und Komponententests

- Mapping zwischen vereinfachtem Formular und `contentBlocks[0]`
- Statusableitung aus `visible` und `publishedAt`
- Autorenlogik für `org_only` und `org_or_personal`
- Push-Einmaligkeit
- Card-Struktur und Leerzustände
- Tabellenansicht der Historie
- Titelbearbeitung in `Basis` bei gleichzeitigem Schreiben nach `contentBlocks[0].title`

### Adapter- und Routentests

- Draft-Save mit nachgelagertem `changeVisibility(..., false)`
- sofortige Veröffentlichung mit `visible=true` und aktuellem Zeitpunkt
- zeitgesteuerte Veröffentlichung mit vergangenem und zukünftigem Zeitpunkt
- Studio-Liste inklusive unsichtbarer News
- Sichtbarkeitswechsel per Listenschieberegler
- Sichtbarkeitsfilter `Alle` / `Sichtbar` / `Nicht sichtbar`

### E2E

- News als Entwurf anlegen und in der Studio-Liste wiederfinden
- Entwurf öffnen und veröffentlichen
- News zeitgesteuert speichern
- bereits gepushte News ohne erneuten Push speichern

## Auswirkungen und Risiken

- Der Change berührt nicht nur das Plugin, sondern auch den lokalen Mainserver-Adapter und den Studio-Listenpfad.
- Die neue lokale Visibility-Operation muss mit dem realen Upstream-GraphQL-Vertrag synchron gehalten werden.
- Die globale Save-Logik darf versteckte Legacy-Felder bei Updates nicht verlieren.
- Der zweite technische Schritt `changeVisibility` braucht ein sauberes Fehlerverhalten, damit klar ist, ob der Inhalts-Save erfolgreich war, aber der Sichtbarkeitswechsel nicht.
- Der vereinfachte Fokus auf `contentBlocks[0]` ist bewusst redaktionell sinnvoll, setzt aber voraus, dass zusätzliche Content-Blöcke nicht parallel in derselben UI gepflegt werden sollen.

## Umsetzungshinweise

- Bestehende Tab- und Panel-Patterns aus dem Waste-Management sollen wiederverwendet werden.
- Für den Rich-Text-Einsatz soll der bestehende Host-Editor genutzt werden, nicht ein zweiter Editor-Stack.
- Vor jeder Implementierung müssen die kleinsten relevanten Nx-Testpfade und die betroffenen Type-Checks grün gehalten werden.
