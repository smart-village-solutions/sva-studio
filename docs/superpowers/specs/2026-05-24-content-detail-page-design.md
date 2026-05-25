# Design: Einheitliches Detailseiten-Muster für redaktionelle Inhalte

## Kontext

Die aktuelle News-Detailseite ist funktional, aber als großer, zusammenhängender Formularblock aufgebaut. Dadurch fehlen klare Arbeitsbereiche, tabbezogene Verantwortlichkeiten, konsistentes Feedback und ein belastbares Muster für die spätere Übernahme durch `Events` und `POI`.

Parallel existiert mit dem Waste-Management-Plugin bereits ein Studio-Muster für gut strukturierte, responsiv bedienbare Arbeitsbereiche mit Tabs, Panel-Headern, klaren Aktionen und stabil gemounteten Inhalten. Dieses Muster soll für redaktionelle Detailseiten gezielt adaptiert werden, ohne die feste GraphQL-API für Inhalte umzubauen.

Die Änderung steht nicht isoliert, sondern ergänzt zwei bereits relevante Leitdokumente:

- [Studio-Standard für Übersichts- und Detailseiten](../../development/studio-uebersichts-und-detailseiten-standard.md)
- [Design: Studio-Daten-, Formular- und Test-Foundations schärfen](./2026-05-21-studio-data-form-and-test-foundations-design.md)

Zusätzlich ist sie als nächste Schicht unterhalb von [Design: Einheitlicher Einstiegspunkt für Inhalte](./2026-05-24-unified-content-entry-design.md) zu lesen: Dort bleibt Create/Edit zunächst typspezifisch hinter `/admin/content`; dieses Dokument definiert das angestrebte Muster für genau diese typspezifischen Detailseiten.

## Ziele

- Die Detailseite für `News` wird auf ein tab-basiertes, deutlich benutzerfreundlicheres Arbeitsmuster umgestellt.
- Das Seitenmuster ist so angelegt, dass `Events` und `POI` später mit begrenztem Zusatzaufwand folgen können.
- Die erste Iteration folgt dem Pareto-Prinzip:
  - gemeinsame Host- und UX-Muster sofort
  - nur die wirklich benötigten Abstraktionen sofort
  - typspezifische Feld- und API-Logik zunächst bei `News`
- `Freigabe` und `Historie` sind echte Bestandteile des Zielbilds und nicht nur spätere Ideen.
- Zeichenzähler, Fehlerhandling und visuelles Feedback werden verbindlich mitgeplant.
- Accessibility wird explizit als gleichrangiges Qualitätsziel mitgeplant und nicht nachgelagert behandelt.
- Die bestehende GraphQL-API bleibt unverändert; erforderliche Historienansichten dürfen auf lokale Host-/DB-Daten zugreifen.

## Nicht-Ziele

- Kein vollständig generisches, schemaübergreifendes Content-Formular in der ersten Iteration
- Keine erzwungene Vereinheitlichung aller Content-Domänenmodelle über `News`, `Events` und `POI`
- Keine API-Erweiterung oder API-Neudefinition für die GraphQL-Inhaltsverwaltung
- Keine Vorab-Implementierung aller künftigen Spezialfälle für `Events` oder `POI`

## Leitidee

Die Zielarchitektur liegt bewusst zwischen einem rein `News`-spezifischen Umbau und einem vollständig generischen Content-Editor.

Die Detailseite erhält einen gemeinsamen Host für Layout, Tabs, Status- und Feedbackflächen sowie tabbezogene Aktionen. Die einzelnen fachlichen Inhalte bleiben zunächst typspezifisch. Dadurch entsteht sofort ein belastbares UI-Muster, ohne frühzeitig ein zu großes gemeinsames Inhaltsmodell zu erzwingen.

Der Studio-Standard bleibt dabei maßgeblich: Die fokussierte Erstellungs-/Bearbeitungsseite ist weiterhin der Default. Die hier geplante Tab-Struktur ist eine bewusst begründete Ausnahme, weil für redaktionelle Detailseiten bereits jetzt mehrere gleichrangige Arbeitsbereiche, prozessuale Freigabeaspekte und eine eigene Historien-/Audit-Sicht zusammenkommen. Das Waste-Management-Plugin dient deshalb als UX-Referenz für die Ausprägung der Tabs, nicht als Ersatz für den Studio-Standard.

## UX-Zielbild

Die Detailseite orientiert sich stark am Waste-Management-Plugin:

- responsiver Tab-Switcher
- sichtbare, klar beschriftete Arbeitsbereiche
- Panel-Header mit Titel, Kurzbeschreibung und Aktionsslot
- stabil gemountete oder bewusst warm gehaltene Tab-Inhalte, damit Wechsel nicht unnötig Formularzustand verlieren
- klare Lade-, Fehler-, Erfolgs- und Leerzustände
- zugängliche Bedienung für Tastatur, Screenreader und Statusmeldungen

Die Seite soll sich wie ein zusammenhängendes redaktionelles Cockpit anfühlen, nicht wie ein einzelnes langes Formular mit angehängten Zusatzinformationen.

## Tab-Struktur

Die Detailseite wird in vier primäre Arbeitsbereiche gegliedert:

- `Basis`
- `Inhalte`
- `Freigabe`
- `Historie`

### Basis

Der Tab `Basis` enthält redaktionelle Metadaten und querliegende Stammdaten des Eintrags.

Für `News` gehören dazu mindestens:

- Titel
- Kategorie bzw. Kategorienbezug
- Autor
- Slug, sofern vorhanden oder aus bestehender Datenstruktur ableitbar
- Veröffentlichungsdatum bzw. VÖ-Datum
- Erstellungsdatum
- letzte Änderung
- externe ID
- Sichtbarkeits- oder ähnliche Basiseigenschaften, soweit über die bestehende API verfügbar

Der Tab ist auf schnelle, häufige redaktionelle Änderungen optimiert und bündelt keine tiefen Inhaltsstrukturen.

### Inhalte

Der Tab `Inhalte` enthält die eigentlichen fachlichen Inhaltsdaten des Typs.

Für `News` umfasst das mindestens:

- Inhaltsblöcke
- Blocktitel und Intros
- Body-Felder
- Medienbezüge
- Teaser- und Headerbild
- Quellenangaben
- weitere textnahe Felder, die unmittelbar den veröffentlichten Inhalt prägen

Dieser Tab bleibt bewusst typspezifisch. `Events` und `POI` sollen später denselben Host-Slot nutzen, aber jeweils eine eigene inhaltliche Ausprägung erhalten.

### Freigabe

Der Tab `Freigabe` bündelt prozessuale und veröffentlichungsnahe Aspekte.

Da die GraphQL-API als fix behandelt wird, umfasst dieser Bereich nur Felder und Aktionen, die sich auf Basis der heutigen Verträge sauber lesen oder schreiben lassen. Der Plan muss diesen Tab deshalb in zwei Kategorien trennen:

- sofort nutzbare Freigabeinformationen und -aktionen
- klar benannte spätere Workflow-Erweiterungen, die nicht implizit vorausgesetzt werden

Der Tab darf nicht mit einem künstlich generischen Workflow-Modell überfrachtet werden.

### Historie

Der Tab `Historie` ist read-only und wird aus lokalen Host-/DB-Daten gespeist, nicht aus neuen GraphQL-Anforderungen.

Ziel ist eine vertrauenswürdige Timeline, keine scheinbar vollständige, aber lückenhafte Pseudo-Historie. Gezeigt werden nur Ereignisse, die lokal belastbar rekonstruiert werden können, zum Beispiel:

- erstellt
- bearbeitet
- veröffentlichungsnahe Änderungen
- medienbezogene Änderungen, sofern lokal nachvollziehbar

## Interaktionsmodell

### Tabbezogene Verantwortlichkeiten

Jeder Tab besitzt eine eigene fachliche Verantwortung. Die Detailseite fühlt sich für Nutzer zusammenhängend an, intern werden Zuständigkeiten aber bewusst getrennt.

### Speichern

`Basis` und `Inhalte` erhalten eigene Speichern-Aktionen. Diese können im Panel-Header oder im Panel-Footer positioniert werden, müssen aber klar dem jeweiligen Tab zugeordnet sein.

`Freigabe` erhält eigene prozessbezogene Aktionen statt eines zwanghaft generischen Formular-Speicherns, wenn das fachlich sauberer ist.

`Historie` bleibt ohne Mutationen.

### Dirty-State

Ungespeicherte Änderungen werden pro Tab geführt. Der aktive Zustand eines Tabs soll nicht der einzige Indikator sein; stattdessen wird ein sichtbarer Dirty-Hinweis im Tab selbst vorgesehen.

Beim Verlassen eines Tabs mit ungespeicherten Änderungen erscheint eine klare Bestätigung. Die Seite darf Änderungen nicht stillschweigend verwerfen.

### Fehler- und Erfolgsmeldungen

Feedback wird zweistufig modelliert:

- global auf Seitenebene für Ladefehler, fehlende Berechtigung oder schwerwiegende Speicherfehler
- lokal innerhalb des Tabs für Feldvalidierung, tabbezogene API-Rückmeldungen und konkrete Korrekturhinweise

Statusmeldungen müssen so eingebunden werden, dass sie auch assistive Technologien zuverlässig erreichen, insbesondere bei Save-Erfolg, Validierungsfehlern und blockierten Tab-Wechseln.

### Zeichenzähler

Zeichenzähler sind verbindlicher Teil des UI-Musters und keine optionale Verzierung.

Sie werden feldnah für redaktionell relevante Textfelder vorgesehen, insbesondere:

- Titel
- Intro
- Body oder Body-nahe Vorschautexte
- weitere textnahe Felder mit Qualitäts- oder Längenrelevanz

Die Zähler reagieren live, markieren Grenzbereiche visuell und arbeiten mit Validierungsfehlern zusammen statt davon getrennt zu existieren.

## Accessibility-Anforderungen

Die Detailseite muss WCAG 2.1 AA entsprechen und Accessibility als Kernanforderung behandeln.

Verbindlich eingeplant werden mindestens:

- vollständig tastaturbedienbare Tab-Navigation
- korrekte Rollen, Zustände und Beziehungen für Tabs, Panels, Fehlertexte und Statusmeldungen
- verständliche Fokusführung beim Tab-Wechsel, bei Validierungsfehlern und nach Speicheraktionen
- nicht nur farbbasiertes Feedback für Dirty-State, Fehler und Erfolg
- saubere Beschriftung von Zeichenzählern, Hilfetexten und Feldfehlern für Screenreader
- robuste Bedienbarkeit auf mobilen Breakpoints ohne Verlust semantischer Orientierung

## Technisches Zielbild

Die Lösung wird in drei Schichten geschnitten:

1. gemeinsamer Detailseiten-Host im Studio-Kontext
2. typspezifische Tab-Panels für `News`
3. schmale Datenadapter zur bestehenden API und zur Historienquelle

## Plugin- und SDK-Grenzen

Die neue Detailseite muss die bestehende Package- und Plugin-Architektur respektieren. Das Ziel ist kein zentraler Host, der Fachlogik aus Plugins absorbiert, sondern ein klar abgegrenztes Zusammenspiel aus Studio-Host, Plugin-Oberfläche und SDK-Verträgen.

### Host-Verantwortung

Der Studio-Host beziehungsweise die hostnahen UI-Pakete verantworten ausschließlich generische Detailseitenmechanik und keine fachtypspezifische Inhaltslogik.

Dazu gehören insbesondere:

- gemeinsamer Detailseitenrahmen
- generische Tab-Navigation und Deeplink-Fähigkeit
- Slots für Status, Aktionen und Metadaten
- gemeinsame Orchestrierung für Dirty-State, Wechselwarnungen und globale Feedbackflächen
- wiederverwendbare UI-Bausteine, die auch andere Content-Typen nutzen können

### Plugin-Verantwortung

Das jeweilige Content-Plugin bleibt Eigentümer seiner Fachlogik. Für die erste Iteration bedeutet das vor allem:

- `@sva/plugin-news` verantwortet Feldstruktur, Validierung, Textlogik und API-Mapping für `News`
- spätere `Events`- oder `POI`-Umsetzungen liefern ihre eigenen Panels und Adapter in derselben Architektur
- fachliche Besonderheiten werden nicht in generische Host-Komponenten gedrückt, nur um eine scheinbar perfekte Wiederverwendung zu erreichen

### SDK-Verantwortung

Das SDK bildet die stabile Integrationsschicht zwischen Host und Plugins. Wenn für das neue Detailseiten-Muster gemeinsame Verträge benötigt werden, müssen diese als kleine, belastbare SDK- oder plattformnahe Verträge formuliert werden statt als implizite Kopplung zwischen Host und einzelnen Plugins.

Das betrifft insbesondere:

- tabbezogene Descriptoren oder Adapterverträge
- gemeinsame Typen für Actions-Slots oder Statusflächen
- mögliche Registrierungs- oder Einhängepunkte für typspezifische Detailseiten-Panels

Das SDK soll dabei nur die wirklich stabilen Integrationspunkte tragen. Kurzlebige `News`-Spezifika dürfen nicht vorschnell in öffentliche Plattformverträge gehoben werden.

Der geplante Detailseitenvertrag darf nicht als isolierter vierter SDK-Typ neben bestehenden Registrierungen stehen. Er soll als ergänzende Facette derselben Content-Typ-Registrierung gedacht werden, die im Unified-Content-Entry-Zielbild bereits über `ContentTypeDefinition` beschrieben ist. Das bedeutet:

- die Content-Typ-Registrierung bleibt der kanonische Einstiegspunkt für typspezifische Host/Plugin-Integration
- Detailseiten-Metadaten und Panel-Einhängepunkte werden additiv an diesen Vertrag oder an eng verbundene Unterverträge gehängt
- es entstehen keine voneinander unabhängigen Registrierungsmechanismen für Listen-Einstieg und Detailseiten-Einstieg

### Package-Grenzen

Für die Umsetzung gilt als architektonische Leitplanke:

- framework-agnostische oder plattformweite Logik gehört nicht in React-seitige Fachpanels
- React-spezifische Detailseitenkomposition bleibt in den UI- und Plugin-Paketen
- Runtime- und API-Zugriffe bleiben an den bestehenden Host- und Plugin-Grenzen ausgerichtet
- es werden keine Abkürzungen eingeführt, bei denen Plugins direkt fremde Fachzustände oder interne Host-Implementierungsdetails konsumieren

### Zielarchitektur

Langfristig soll ein wiederverwendbares Detailseitenmuster entstehen, bei dem:

- der Host das redaktionelle Arbeitsgerüst bereitstellt
- Plugins ihre fachlichen Panels in definierte Slots einhängen
- das SDK nur die dafür nötigen stabilen Verträge bereitstellt
- neue Inhaltstypen nicht durch Kopieren bestehender `News`-Seiten, sondern durch saubere Einbindung in dasselbe Muster ergänzt werden

Die erste Iteration für `News` muss diese Zielarchitektur vorbereiten, ohne bereits jeden späteren Erweiterungspunkt vollständig auszubauen.

## Verhältnis zu Unified Content Entry

Das Dokument [Design: Einheitlicher Einstiegspunkt für Inhalte](./2026-05-24-unified-content-entry-design.md) beschreibt die gemeinsame Host-Übersicht `/admin/content` und hält fest, dass Create/Edit zunächst typspezifisch bleiben. Dieses Detailseiten-Design ist die dazugehörige nächste Architekturschicht.

Daraus folgen zwei verbindliche Leitplanken:

- Reihenfolge: Der Unified-Entry-Gedanke ist der äußere Host-Rahmen; das Detailseitenmuster beschreibt die innere Ausgestaltung typspezifischer Edit-Seiten.
- Vertragskonsistenz: Listen-/Picker-Registrierung und Detailseiten-Registrierung dürfen im SDK nicht auseinanderlaufen, sondern müssen als zusammenhängendes Integrationsmodell für Content-Typen gedacht werden.

Wenn spätere Umsetzungsschritte zwischen `/admin/content` und den typspezifischen Detailseiten zusätzliche Metadaten erfordern, sind diese bevorzugt an dieselbe Content-Typ-Definition anzubinden statt als paralleler Sondervertrag eingeführt zu werden.

### Gemeinsamer Detailseiten-Host

Der Host ist verantwortlich für:

- Seitenrahmen
- Headline, Beschreibung und Metadaten-Slots
- Waste-artige Tab-Navigation
- aktiven Tab
- Search-Param- oder routegesteuerte Deeplinks auf Tabs
- Dirty-State-Koordination
- globale Status-, Lade- und Fehlerflächen
- tabbezogene Action-Slots

Der Host kennt keine News-spezifischen Feldstrukturen.

### Typspezifische Panels

`News` liefert konkrete Panels für:

- `Basis`
- `Inhalte`
- `Freigabe`
- `Historie`

Die Panels kapseln:

- Feldstruktur
- Validierung
- Zeichenzählerlogik
- Mapping zwischen Formularzustand und bestehender API
- panel-spezifische Erfolgsmeldungen und Fehlerdarstellung

Die Panel-Komponenten sollen so geschnitten werden, dass einzelne Arbeitsbereiche unabhängig verständlich und testbar bleiben. Große Sammelkomponenten mit gemischter Verantwortung sollen vermieden werden.

Für neue oder grundlegend überarbeitete Formular-Flows innerhalb dieser Panels gilt der Foundations-Standard aus [2026-05-21-studio-data-form-and-test-foundations-design.md](./2026-05-21-studio-data-form-and-test-foundations-design.md) als verbindlicher Default. Das bedeutet insbesondere:

- Form-State und Submit-Orchestrierung laufen über `react-hook-form`
- Validierung wird über `@hookform/resolvers` an dieselbe Formularinstanz angebunden
- gemeinsame Studio-Primitiven und Integrationsbausteine werden für Fehlermapping, Fokusführung und Accessibility-Metadaten genutzt
- neue Panel-Strukturen sollen nicht erneut formularweite `useState`-Eigenorchestrierung aufbauen, wenn der Flow grundlegend überarbeitet wird

### Schmale Adapterverträge

Damit `Events` und `POI` später nicht bei null anfangen, wird ein kleiner, bewusst begrenzter Vertrag vorgesehen. Dazu gehören mindestens:

- `id`
- `label`
- `description`
- `isVisible`
- `hasChanges`
- `actions`
- `panel`

Dieser Vertrag beschreibt nur das UI-Muster der Tabs, nicht das vollständige Domänenmodell eines Inhaltstyps.

## Datenquellen und API-Leitplanken

### Bestehende Inhalts-API

Die bestehende GraphQL- bzw. hostvermittelte Inhalts-API bleibt unverändert. Die `News`-Panels müssen sich an den heutigen Vertragszuschnitt anpassen.

### Historie

Historieninformationen dürfen aus lokaler Host- oder Datenbanklogik gelesen werden, solange die dargestellten Einträge nachvollziehbar und belastbar sind.

Da dafür heute keine erkennbare generische News-Audit-Grundlage vorausgesetzt werden kann, ist `Historie` ausdrücklich als eigenständiger Architektur- und Implementierungsblock zu behandeln. Dazu können je nach bestehender Datenlage Schema-, Repository- und Schreibpfad-Ergänzungen nötig werden. Der Umsetzungsplan muss diesen Aufwand explizit sichtbar machen, statt den Tab nur als UI-Nachtrag zu behandeln.

### Keine vorgezogene API-Abstraktion

Die UI darf keine künstliche generische Workflow- oder History-API erfinden, nur um das Seitenmuster sauberer erscheinen zu lassen.

## Umsetzungsreihenfolge

Die erste Umsetzung wird in vier Pakete geschnitten:

1. gemeinsamer Detailseiten-Host und Tab-Grundmuster extrahieren
2. `News` auf `Basis` und `Inhalte` im neuen Muster migrieren
3. `Freigabe` auf Basis der bestehenden API anbinden
4. `Historie` als read-only Timeline aus lokaler Quelle ergänzen

Damit werden Quick Wins früh sichtbar, ohne die Wiederverwendbarkeit für spätere Inhaltstypen zu verbauen.

## Test- und Qualitätsanforderungen

Der spätere Implementierungsplan muss mindestens folgende Prüfbereiche enthalten:

- Unit-Tests für Tab-State, Dirty-State und Zeichenzählerlogik
- Seitentests für Lade-, Fehler- und Save-Verhalten
- Tests für tabbezogene Validierungsfehler und Wechselwarnungen
- gezielte E2E-Pfade für Tab-Wechsel, erfolgreiche Speicherung und Fehlerfeedback
- Tests für den kleinen Adaptervertrag des Detailseiten-Hosts
- Accessibility-Tests für Tab-Semantik, Tastaturbedienung, Fokusführung und Statuskommunikation
- HTTP-nahe Frontend-Tests für neu geschnittene Formular- und Save-Flows folgen dem Foundations-Standard und nutzen `msw` statt impliziter Request-Stubs

Die Prüfstrategie wird verbindlich pro Ausbaustufe festgelegt:

- nach Einführung des Detailseiten-Hosts: Tests für Tab-Navigation, Deeplinks, Dirty-State-Koordination und globale Fehlerflächen
- nach Migration von `Basis` und `Inhalte`: Feldvalidierung, Zeichenzähler, tabbezogene Saves und Wechselwarnungen
- nach Anbindung von `Freigabe`: Prozessaktionen, Berechtigungs- und Fehlerszenarien
- nach Ergänzung von `Historie`: read-only Rendering, leere Zustände und belastbare Ereignisdarstellung

Vor Abschluss der Implementierung müssen mindestens die betroffenen Unit-, Type-, Lint- und E2E-Prüfungen für den geänderten Bereich grün sein. Für die PR-Vorbereitung bleibt `pnpm test:pr` der bevorzugte Zielzustand.

Die Wiederverwendbarkeit darf nicht nur behauptet, sondern muss mindestens über einen kleinen gemeinsamen Vertrag und passende Tests abgesichert werden.

## Komplexitätsleitplanken

Die neue Detailseite soll die bestehende News-Seite nicht nur visuell umstrukturieren, sondern auch strukturell entflechten.

Dafür gelten folgende Leitplanken:

- der gemeinsame Host enthält keine typspezifische Feldlogik
- jeder Tab bleibt in einer eigenständig verständlichen Panel-Komponente gekapselt
- Mapping zur bestehenden API wird in schmale Adapter oder submissionsnahe Funktionen ausgelagert
- Dirty-State-, Feedback- und Tab-Orchestrierung werden nicht mehrfach in Panels dupliziert
- neue Abstraktionen werden nur eingeführt, wenn sie mindestens `News` sofort vereinfachen und `Events` oder `POI` erkennbar nicht verbauen

Wenn eine Komponente oder ein Modul mehrere Verantwortungen gleichzeitig trägt, ist das im Implementierungsplan explizit als Aufspaltungskandidat zu behandeln statt stillschweigend zu akzeptieren.

## Risiken und bewusste Trade-offs

- Zu frühe Generalisierung würde die erste Iteration unnötig verlangsamen und an der fixen API vorbeientwerfen.
- Zu wenig Generalisierung würde `News` erneut zu einer Sackgasse machen und die spätere Übernahme durch `Events` und `POI` verteuern.
- Die Historie muss lieber kleiner und vertrauenswürdig sein als groß und ungenau.
- `Freigabe` darf in V1 nicht mehr Fachworkflow versprechen, als die bestehende API tatsächlich tragen kann.
- Zusätzliche UX-Qualität ohne explizite Komplexitätsgrenzen würde das Risiko erhöhen, nur die aktuelle Formulargröße in Tabs zu verlagern.

## Ergebnis

Die erste Iteration liefert keine voll generische Content-Detailplattform, aber ein belastbares gemeinsames Detailseiten-Muster mit hohem Nutzwert:

- besseres redaktionelles Arbeiten für `News`
- deutliche Anlehnung an das Waste-Management-UX-Muster
- klare Grundlage für `Events` und `POI`
- saubere Grenzen zur bestehenden API
- spürbare Quick Wins ohne spätere Sackgasse
