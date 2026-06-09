# Kategorien-Seite Tabellenansicht Design

## Kontext

Im Studio existiert bereits ein Menüpunkt `Kategorien` in der Sidebar, die Zielroute `/categories` rendert aktuell aber nur eine Placeholder-Seite. Gleichzeitig liefert die bestehende Mainserver-Integration bereits Kategorien als hierarchisches Modell mit Metadaten wie `id`, `name`, `position`, `tagList`, `updatedAt` und `children`.

Diese Kategorien sind kein rein news-spezifisches Konzept, sondern ein fachlich breiteres Mainserver-Modell. Für die erste Ausbaustufe der Kategorien-Seite soll deshalb keine vollständige Kategorienverwaltung gebaut werden, sondern eine belastbare Übersicht, die die vorhandenen Daten sichtbar macht und spätere Schreibpfade vorbereitet.

## Ziele

- Die Route `/categories` zeigt eine echte Kategorienseite statt des bisherigen Placeholders.
- Die Seite verwendet das bestehende Studio-Tabellenmuster und wirkt wie eine reguläre Admin-Listenansicht.
- Die Mainserver-Kategorien werden flach und lesbar in einer Tabelle dargestellt.
- Die Tabelle zeigt die von der Redaktion gewünschten Kerndaten: `Name`, `ID`, `Hierarchie`, `Position`, `Tags` und `Updated At`.
- Zeilenaktionen `Bearbeiten`, `Neue Unterkategorie` und `Löschen` sind bereits sichtbar, aber bewusst deaktiviert.
- Die Lösung bleibt auf eine kleine read-only-Variante begrenzt und dupliziert keine news-spezifische Kategorienlogik.

## Nicht-Ziele

- Keine echten Mainserver-Schreiboperationen für Kategorien.
- Kein Edit-Dialog, keine Detailseite und kein Create-Flow in dieser Ausbaustufe.
- Keine Baumansicht, kein Expand/Collapse und keine verschachtelte Tabellenstruktur.
- Keine neue Kategorienpersistenz im Studio.
- Keine fachliche Umdeutung oder Normalisierung der Mainserver-Tags über eine reine Anzeigeaufbereitung hinaus.

## Bestehender Stand

- Die Sidebar enthält bereits einen Menüpunkt `Kategorien`, der auf `/categories` verweist.
- Die Route `/categories` ist derzeit nur als `PlaceholderPage` verdrahtet.
- Das Studio besitzt mit Seiten wie der Schnittstellenansicht bereits ein etabliertes Muster für tabellarische Verwaltungsseiten auf Basis von `StudioDataTable`.
- Die Mainserver-Fassade bietet bereits einen Read-Pfad `GET /api/v1/mainserver/categories`.
- Dieser Read-Pfad liefert Kategorien hierarchisch; die heutige News-Bearbeitung reduziert diese Struktur später auf eine vereinfachte Namensliste.

## Bewertete Ansätze

### Ansatz A: Kleine Read-only-Tabelle mit deaktivierten Aktionen

Die Placeholder-Seite wird durch eine flache Tabellenansicht ersetzt. Die Aktionen sind sichtbar, aber nicht aktiv.

Vorteile:
- minimaler Scope
- konsistente Studio-UX
- schafft sofort Orientierung über die vorhandenen Kategorien
- bereitet spätere Schreibaktionen ohne Architekturbruch vor

Nachteile:
- keine echte Bearbeitung im ersten Schritt
- Hierarchie bleibt eine Anzeigeableitung statt interaktiver Struktur

### Ansatz B: Tabelle mit bereits vorbereiteten Zielrouten für Edit/Create/Delete

Zusätzlich zur Tabelle würden schon Zielrouten oder Dialoghüllen für künftige Bearbeitungsflows angelegt, auch wenn diese noch Placeholder bleiben.

Vorteile:
- spätere Ausbaupfade hätten bereits stabile Navigationsziele

Nachteile:
- zusätzlicher Routing- und UI-Ballast ohne unmittelbaren Nutzwert
- erhöht den Scope der kleinen Variante unnötig

### Ansatz C: Master-Detail-Ansicht mit Tabelle plus seitlichem Detailpanel

Die Seite würde links eine Liste und rechts eine lesende Detaildarstellung der selektierten Kategorie zeigen.

Vorteile:
- mehr Metadaten ohne zusätzliche Navigation sichtbar

Nachteile:
- deutlich höhere UI-Komplexität
- für die erste Iteration zu groß
- erzeugt schon eine Interaktionslogik, die für den aktuellen Mehrwert nicht nötig ist

## Entscheidung

Es wird Ansatz A umgesetzt: eine kleine read-only-Kategorienseite mit flacher Tabelle und deaktivierten Zeilenaktionen.

Diese Entscheidung passt am besten zum gewünschten Scope. Sie ersetzt den Placeholder durch eine fachlich nützliche Verwaltungsansicht, nutzt vorhandene Tabellenmuster des Studios und lässt sich später ohne Bruch zu echten Schreibpfaden ausbauen.

## Zielbild

### 1. Seitenaufbau

- Die Route `/categories` rendert eine echte Kategorienlisten-Seite.
- Die Seite folgt dem bestehenden Studio-Muster für Admin-Tabellen.
- Im Kopfbereich stehen:
  - Seitentitel
  - kurze Beschreibung der Seite
  - ein kleiner Hinweis, dass Bearbeiten, Unterkategorien und Löschen vorbereitet, aber noch nicht verfügbar sind
- Hauptinhalt ist eine flache Tabelle mit genau einer Zeile pro angezeigter Kategorie.

### 2. Tabellenspalten

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

### 3. Hierarchie-Darstellung

Die Mainserver-Kategorien bleiben fachlich hierarchisch, die Seite zeigt sie aber bewusst flach an.

Regeln:

- Jede Kategorie erscheint als eigene Tabellenzeile.
- Die Tabelle verwendet keine eingerückte Baumansicht.
- Die Spalte `Hierarchie` zeigt den abgeleiteten Parent-/Pfadkontext, damit Unterkategorien trotz flacher Darstellung verständlich bleiben.
- Die Reihenfolge soll stabil und lesbar sein; Eltern und Kinder dürfen zusammenhängend erscheinen, ohne dass dafür ein Tree-Widget gebaut wird.

### 4. Datenfluss und View-Modell

Die Seite verwendet den bestehenden Mainserver-Kategorien-Read-Pfad als Quelle der Wahrheit.

Architekturprinzipien:

- Das Mainserver-Modell bleibt hierarchisch und unverändert.
- Die Kategorien-Seite führt eine gezielte Flattening-Transformation nur für die Anzeige ein.
- Es wird kein news-spezifisches Kategorienmodell wiederverwendet, das Kategorien auf reine Namen reduziert.
- Für die Tabelle wird ein eigenes flaches View-Modell eingeführt.

Das flache Zeilenmodell enthält mindestens:

- `id`
- `name`
- `hierarchyLabel`
- `position`
- `tagsDisplay`
- `updatedAt`
- `actionTargetId`

Optional interne Hilfsfelder wie `depth`, `sortKey` oder `parentId` sind erlaubt, gehören aber nicht zwingend zur UI-Oberfläche.

### 5. Tags-Darstellung

Die Mainserver-Kategorie liefert `tagList` aktuell als String-Wert.

Für die kleine Variante gilt:

- `tagList` wird als Anzeigeinformation behandelt, nicht als bereits voll standardisierte Tag-Domain.
- Die Seite normalisiert nur oberflächlich für die Darstellung, zum Beispiel durch `trim`.
- Es wird keine fachliche Semantik wie Bearbeitbarkeit, Validierung oder feste Tag-Arrays eingeführt.
- Wenn `tagList` fehlt oder leer ist, wird ein klarer Leerwert angezeigt.

Damit bleibt der erste Schritt konservativ und vermeidet falsche Annahmen über das genaue Upstream-Tagformat.

### 6. Aktionen

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

### 7. Lade-, Fehler- und Leerzustände

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

### App-Route

- Die bestehende Route `/categories` wird von der Placeholder-Verdrahtung auf eine echte Kategorienseiten-Komponente umgestellt.

### Datenzugriff

- Die Seite nutzt die bestehende Mainserver-Kategorien-Fassade.
- Falls dafür ein neuer app-seitiger Fetch-Helper sinnvoll ist, wird dieser generisch auf Kategorien ausgerichtet und nicht im News-Plugin verankert.

### Mapping

- Eine kleine, klar abgegrenzte Flattening-Funktion transformiert die hierarchischen Mainserver-Kategorien in Tabellenzeilen.
- Diese Funktion kapselt Parent-/Pfadableitung, Tags-Anzeige und Sortierreihenfolge.

### UI

- Die Renderlogik folgt dem vorhandenen `StudioDataTable`-Muster.
- Tabellenlabels, Caption, Empty-State und Aria-Beschriftung werden explizit lokalisiert.

## Teststrategie

Die erste Ausbaustufe benötigt gezielte Tests auf Routen-, Mapping- und UI-Ebene.

Mindestens abzudecken:

- `/categories` rendert keine Placeholder-Seite mehr.
- Die Route zeigt eine echte Kategorien-Tabelle.
- Hierarchische Mainserver-Daten werden korrekt in flache Tabellenzeilen transformiert.
- Die Spalte `Hierarchie` bildet Parent-/Pfadkontext nachvollziehbar ab.
- `tagList` wird als `Tags`-Anzeige robust gerendert.
- Fehlende `position`, `tagList` oder `updatedAt` führen zu stabilen Leerwerten statt zu kaputtem Rendering.
- Fehlerzustand wird sichtbar gerendert.
- Leerzustand wird sichtbar gerendert.
- Die Aktionen `Bearbeiten`, `Neue Unterkategorie` und `Löschen` sind sichtbar und deaktiviert.

## Offene Anschlussfähigkeit

Die kleine Variante soll spätere Ausbaustufen erleichtern, ohne sie vorwegzunehmen.

Dafür werden bewusst vorbereitet:

- stabile Kategorie-IDs pro Zeile
- eine saubere Trennung zwischen Mainserver-Modell und Tabellen-View-Modell
- eine dedizierte Aktionsspalte
- ein Seitenlayout, das später um echte Schreibaktionen erweitert werden kann

Nicht vorbereitet werden in dieser Iteration:

- echte Edit-Routen
- Create-/Delete-Mutationen
- Detailseiten
- Bulk-Aktionen
