# Kategorien-Plugin Listenansicht Design

## Kontext

Im Studio existiert bereits ein Menüpunkt `Kategorien` in der Sidebar, die Zielroute `/categories` rendert aktuell aber nur eine Placeholder-Seite. Gleichzeitig liefert die bestehende Mainserver-Integration bereits Kategorien als hierarchisches Modell mit Metadaten wie `id`, `name`, `position`, `tagList`, `updatedAt` und `children`.

Ursprünglich war eine app-lokale Kategorienseite in `apps/sva-studio-react` vorgesehen. Fachlich wäre das aber eine unsaubere Ownership: Die Kategorienseite wäre dann kein eigener Ausbaupunkt, sondern nur eine weitere Spezialansicht der App. Gleichzeitig soll die Kategorien-UI nicht direkt an News gekoppelt bleiben, obwohl der heutige Read-Pfad noch im News-Route-Handler hängt.

Deshalb wird die erste Ausbaustufe als echtes neues Workspace-Plugin umgesetzt. Die technische Mainserver-Abhängigkeit bleibt dabei bewusst in `packages/sva-mainserver`, weil sie systemisch nicht zu vermeiden ist. Das neue Plugin kapselt stattdessen die Kategorien-spezifische Studio-UI, den Kategorien-Read-Client gegen den Host-Endpoint und das flache Listenmodell.

## Ziele

- Die Route `/categories` zeigt eine echte Kategorienseite statt des bisherigen Placeholders.
- Die Kategorienseite wird als neues Workspace-Plugin umgesetzt, nicht als app-lokales Feature.
- Das Plugin kapselt die Kategorien-spezifische Studio-UI und das Kategorien-Read-/Flattening-Modell.
- Die technische Mainserver-Integration bleibt in `packages/sva-mainserver`.
- Der Kategorien-Read-Pfad wird aus der News-spezifischen Route-Boundary herausgelöst und einer categories-spezifischen Host-Boundary zugeordnet.
- Die Tabelle zeigt in der ersten Ausbaustufe die Kerndaten `Name`, `ID`, `Hierarchie`, `Position`, `Tags`, `Aktualisiert` und `Aktionen`.
- Die Aktionen `Bearbeiten`, `Neue Unterkategorie` und `Löschen` sind sichtbar, aber deaktiviert.

## Nicht-Ziele

- Keine echten Mainserver-Schreiboperationen für Kategorien.
- Kein Edit-Dialog, keine Detailseite und kein Create-/Delete-Flow in dieser Ausbaustufe.
- Keine direkte GraphQL-Kommunikation des Plugins.
- Kein vollständiger Shared-Kategorien-Service für News, Events und POIs in diesem Change.
- Keine Baumansicht, kein Expand/Collapse und keine verschachtelte Tabellenstruktur.

## Bestehender Stand

- Die Sidebar enthält bereits einen Menüpunkt `Kategorien`, der auf `/categories` verweist.
- Die Route `/categories` ist derzeit nur als `PlaceholderPage` verdrahtet.
- Das Studio besitzt mit Seiten wie der Schnittstellenansicht bereits ein etabliertes Muster für tabellarische Verwaltungsseiten auf Basis von `StudioDataTable`.
- Der Host bietet bereits einen Read-Pfad `GET /api/v1/mainserver/categories`.
- Dieser Read-Pfad ist aktuell technisch an den News-Route-Handler gekoppelt, obwohl Kategorien fachlich nicht news-spezifisch sind.
- Bestehende Workspace-Plugins wie `plugin-news`, `plugin-events` und `plugin-poi` zeigen das Muster für eigene UI-/Domain-Packages mit separatem Export, Manifest und Tests.

## Bewertete Ansätze

### Ansatz A: App-lokale Kategorienseite in `apps/sva-studio-react`

Die Kategorienseite würde direkt in der App entstehen. Datenzugriff, Flattening und UI blieben app-lokal.

Vorteile:
- geringerer Initialaufwand
- wenig neue Workspace-Struktur

Nachteile:
- fachliche Ownership bleibt in der App statt in einem klaren Kategorienbaustein
- späterer Ausbau zu Create/Edit/Delete müsste aus der App heraus erfolgen
- Kategorien bleiben architektonisch näher an Shell-Code als an einer eigenen Domain-UI

### Ansatz B: Neues `plugin-categories`, Host-Endpoint bleibt zentrale Mainserver-Boundary

Ein neues Workspace-Plugin kapselt die Kategorienlisten-Seite, den plugin-internen Read-Client gegen den Host-Endpoint und das Flattening-Modell. Der hostseitige Kategorien-Endpoint bleibt technisch in der Mainserver-Integration, wird aber aus dem News-Route-Zuschnitt herausgelöst.

Vorteile:
- klare Ownership der Kategorien-UI
- Mainserver-Abhängigkeit bleibt an der richtigen technischen Stelle
- App wird zur Shell und nicht zum Domain-Layer
- guter späterer Ausbaupfad für echte Kategorienverwaltung

Nachteile:
- höherer Initialaufwand als die app-lokale Variante
- zusätzlicher Plugin-Scaffold und zusätzliche Routingverdrahtung

### Ansatz C: Vollständige Entkopplung mit separatem Kategorien-Domain-Package plus Plugin

Zusätzlich zum Plugin würde ein weiteres Shared-Package die Kategorien-Read-Logik und Modelle systemweit kapseln.

Vorteile:
- maximale Trennung und Wiederverwendbarkeit

Nachteile:
- für die erste Ausbaustufe zu viel Vorab-Abstraktion
- noch kein belastbarer zweiter Konsument vorhanden

## Entscheidung

Es wird Ansatz B umgesetzt: ein neues `plugin-categories`, während die technische Mainserver-Integration zentral in `packages/sva-mainserver` bleibt.

Diese Entscheidung trifft den gewünschten Mittelweg. Die Kategorienseite bekommt eine eigene fachliche Heimat als Workspace-Plugin, ohne die technische Mainserver-Abhängigkeit künstlich zu duplizieren oder zu verstecken. Die App bleibt Shell und Routing-Layer; die Mainserver-Integration bleibt technische Boundary; das Plugin besitzt die Kategorien-UI und die plugin-spezifische Listenlogik.

## Zielbild

### 1. Ownership und Boundary

- `packages/sva-mainserver` bleibt Owner der technischen Mainserver-Kommunikation.
- Der Kategorien-Read-Pfad wird dort weiterhin als Host-Endpoint angeboten, aber nicht mehr news-spezifisch zugeschnitten.
- Das neue `packages/plugin-categories` wird Owner der Kategorienlisten-Seite im Studio.
- `apps/sva-studio-react` bindet das Plugin nur noch an `/categories` ein und enthält keine Kategorien-Fachlogik.

### 2. Plugin-Scope

Das neue Plugin enthält in der ersten Ausbaustufe:

- die Studio-Kategorienlisten-Seite
- den plugin-internen Fetch-Client gegen den Host-Endpoint `/api/v1/mainserver/categories`
- das flache Tabellenmodell
- die Flattening-Logik vom hierarchischen Mainserver-Modell auf die Tabellenzeilen
- plugin-eigene Übersetzungen, Tests und Exporte

Das Plugin enthält in dieser Iteration nicht:

- eigene Schreibpfade
- eigene Server- oder GraphQL-Integration
- direkte Abhängigkeit auf `packages/sva-mainserver`

### 3. Host- und Transport-Schnitt

Das Plugin spricht ausschließlich mit dem hostseitigen JSON-Endpoint für Kategorien.

Regeln:

- keine direkte GraphQL-Nutzung im Plugin
- keine direkte Nutzung von `packages/sva-mainserver` im Browser-Plugin
- der Host-Endpoint bleibt die technische Integrationsgrenze
- die Endpoint-Ownership wird fachlich auf Kategorien umgeschnitten, statt in einer News-Route mitzulaufen

Damit gilt:

- Host/Server: Mainserver-Boundary
- Plugin/UI: Kategorien-Boundary
- App: Shell-/Route-Verdrahtung

Vertragsgrenze in dieser Ausbaustufe:

- Der Host-Endpoint liefert einen Kategorien-Snapshot entlang der heute explizit abgefragten GraphQL-Query-Tiefe.
- Innerhalb dieses Snapshots werden fehlende oder ungültige IDs und Namen fail-closed abgelehnt; ein explizites `null` für `categories` wird dagegen als leere Liste interpretiert.
- Tiefere Mainserver-Ebenen, die außerhalb der abgefragten Query-Tiefe liegen, sind in dieser ersten Variante bewusst nicht Teil des garantierten Read-Vertrags.
- Die Listenansicht zeigt deshalb genau die Kategorien, die der Host in diesem Snapshot liefert.

### 4. Seitenaufbau

- Die Route `/categories` rendert die Plugin-Seite statt des bisherigen Placeholders.
- Die Seite folgt dem bestehenden Studio-Muster für Admin-Tabellen.
- Im Kopfbereich stehen:
  - Seitentitel
  - kurze Beschreibung der Seite
  - ein kleiner Hinweis, dass Bearbeiten, Unterkategorien und Löschen vorbereitet, aber noch nicht verfügbar sind
- Hauptinhalt ist eine flache Tabelle mit genau einer Zeile pro angezeigter Kategorie.

### 5. Tabellenspalten

Die Tabelle enthält in der ersten Ausbaustufe folgende Spalten:

- `Name`
- `ID`
- `Hierarchie`
- `Position`
- `Tags`
- `Aktualisiert`
- `Aktionen`

Leitlinien pro Spalte:

- `Name`: Anzeigename der Kategorie.
- `ID`: technische Mainserver-ID.
- `Hierarchie`: lesbarer Pfad- oder Parent-Kontext der Kategorie in flacher Form.
- `Position`: numerischer Positionswert, sofern vorhanden.
- `Tags`: Anzeigedarstellung auf Basis von `tagList`.
- `Aktualisiert`: letzter bekannter Änderungszeitpunkt.
- `Aktionen`: sichtbare, deaktivierte Steuerflächen für spätere CRUD-Fälle.

### 6. Hierarchie-Darstellung

Die Mainserver-Kategorien bleiben fachlich hierarchisch, die Seite zeigt sie aber bewusst flach an.

Regeln:

- Jede Kategorie erscheint als eigene Tabellenzeile.
- Die Tabelle verwendet keine eingerückte Baumansicht.
- Die Spalte `Hierarchie` zeigt den abgeleiteten Parent-/Pfadkontext, damit Unterkategorien trotz flacher Darstellung verständlich bleiben.
- Die Reihenfolge soll stabil und lesbar sein; Eltern und Kinder dürfen zusammenhängend erscheinen, ohne dass dafür ein Tree-Widget gebaut wird.
- Wenn der Mainserver mehr Ebenen besitzt als die aktuelle Host-Query abbildet, ist das kein implizit gelöstes Problem dieser ersten Listenansicht, sondern eine spätere Ausbaufrage des Read-Vertrags.

### 7. Plugin-internes View-Modell

Das Plugin führt für die Tabellenanzeige ein eigenes flaches View-Modell ein.

Das Zeilenmodell enthält mindestens:

- `id`
- `name`
- `hierarchyLabel`
- `position`
- `tagsDisplay`
- `updatedAt`
- `actionTargetId`

Architekturprinzipien:

- Das Mainserver-Modell bleibt hierarchisch und unverändert.
- Die Flattening-Transformation lebt im Plugin, nicht in der App.
- Das Plugin reduziert Kategorien nicht auf reine Namenslisten, wie es ein News-spezifisches Formularmodell tun würde.
- Interne Hilfsfelder wie `depth`, `sortKey` oder `parentId` sind erlaubt, gehören aber nicht zwingend zur UI-Oberfläche.

### 8. Tags-Darstellung

Die Mainserver-Kategorie liefert `tagList` aktuell als String-Wert.

Für die kleine Variante gilt:

- `tagList` wird als Anzeigeinformation behandelt, nicht als bereits voll standardisierte Tag-Domain.
- Das Plugin normalisiert nur oberflächlich für die Darstellung, zum Beispiel durch `trim`.
- Es wird keine fachliche Semantik wie Bearbeitbarkeit, Validierung oder feste Tag-Arrays eingeführt.
- Wenn `tagList` fehlt oder leer ist, wird ein klarer Leerwert angezeigt.

Damit bleibt der erste Schritt konservativ und vermeidet falsche Annahmen über das genaue Upstream-Tagformat.

### 9. Aktionen

Jede Tabellenzeile zeigt drei vorbereitete Aktionen:

- `Bearbeiten`
- `Neue Unterkategorie`
- `Löschen`

Für diese erste Ausbaustufe gilt:

- Alle drei Aktionen sind sichtbar.
- Alle drei Aktionen sind deaktiviert.
- Sie dürfen nicht wie kaputte Links oder aktive Controls wirken.
- Die Oberfläche macht klar, dass diese Funktionen vorgesehen, aber noch nicht verfügbar sind.
- Jede Aktion bleibt bereits an die Kategorie-ID der Zeile gebunden, damit spätere Schreibpfade darauf aufbauen können.

Eine zusätzliche `Details`-Aktion wird nicht vorgesehen, weil sie in dieser Ausbaustufe keinen klaren Mehrwert gegenüber dem späteren Bearbeitungsfluss bietet.

### 10. Lade-, Fehler- und Leerzustände

Die Seite braucht vollständige Zustände analog zu anderen Studio-Listen:

- Ladezustand:
  - bestehender Pending-/Skeleton-Stil der Tabellenroute
- Fehlerzustand:
  - klar lesbare Fehlermeldung innerhalb der Seite
  - optional mit `Erneut laden`, falls das bestehende Muster das unterstützt
- Leerzustand:
  - explizite Meldung, dass aktuell keine Kategorien aus dem Mainserver geliefert wurden

Die Seite darf im Fehlerfall nicht auf den alten Placeholder zurückfallen.

## Architektur und Bausteine

### Neues Plugin-Package

Es wird ein neues Workspace-Package `packages/plugin-categories` angelegt, analog zu den bestehenden Content-Plugins.

Es umfasst mindestens:

- `package.json`
- `project.json`
- `plugin.manifest.json`
- `src/index.ts`
- plugin-spezifische UI-/API-/Typdateien
- plugin-spezifische Tests

### Plugin-Exports

Das Plugin exportiert in der ersten Ausbaustufe:

- die Kategorien-Seitenkomponente
- den plugin-internen Kategorien-Read-Client
- die plugin-internen Kategorien-Typen

Es exportiert in dieser Iteration keine Schreib-APIs.

### App-Route

- Die bestehende Route `/categories` wird in `apps/sva-studio-react` von der Placeholder-Verdrahtung auf die Plugin-Komponente umgestellt.
- Die App enthält keine app-lokale Kategorien-Fachlogik mehr.

### Mainserver-Route-Boundary

- Der Kategorien-Read-Pfad wird in `packages/sva-mainserver` aus dem News-Zuschnitt herausgelöst.
- Ziel ist eine categories-spezifische technische Route-Boundary innerhalb der Mainserver-Hostintegration.
- Der externe Host-Pfad `GET /api/v1/mainserver/categories` bleibt stabil, die interne Ownership ändert sich.

## Teststrategie

Die erste Ausbaustufe benötigt gezielte Tests auf Host-, Plugin- und Routing-Ebene.

Mindestens abzudecken:

- `packages/sva-mainserver` bedient den Kategorien-Read-Pfad unabhängig von der News-Boundary.
- Das neue Plugin lädt Kategorien über den Host-Endpoint, nicht über direkte GraphQL-Logik.
- Hierarchische Mainserver-Daten werden korrekt in flache Tabellenzeilen transformiert.
- Die Plugin-Seite rendert eine echte Kategorien-Tabelle.
- Die Spalte `Hierarchie` bildet Parent-/Pfadkontext nachvollziehbar ab.
- `tagList` wird als `Tags`-Anzeige robust gerendert.
- Fehlende `position`, `tagList` oder `updatedAt` führen zu stabilen Leerwerten statt zu kaputtem Rendering.
- Fehlerzustand wird sichtbar gerendert.
- Leerzustand wird sichtbar gerendert.
- Die Aktionen `Bearbeiten`, `Neue Unterkategorie` und `Löschen` sind sichtbar und deaktiviert.
- Die App-Route `/categories` bindet die Plugin-Seite statt des Placeholders.

## Offene Anschlussfähigkeit

Die kleine Variante soll spätere Ausbaustufen erleichtern, ohne sie vorwegzunehmen.

Dafür werden bewusst vorbereitet:

- eine eigene Plugin-Ownership für Kategorien
- stabile Kategorie-IDs pro Zeile
- eine saubere Trennung zwischen Host-Integration, Plugin-View-Modell und App-Shell
- eine dedizierte Aktionsspalte
- ein Seitenlayout, das später um echte Schreibaktionen erweitert werden kann

Nicht vorbereitet werden in dieser Iteration:

- echte Edit-Routen
- Create-/Delete-Mutationen
- Detailseiten
- Bulk-Aktionen
- systemweite Wiederverwendung der Kategorienlogik durch News, Events oder POIs
