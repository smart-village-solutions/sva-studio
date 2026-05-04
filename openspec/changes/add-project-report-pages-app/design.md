## Kontext

Die Reporting-Funktion soll öffentlich lesbar, statisch auslieferbar und von der bestehenden Studio-App getrennt sein. Die bereits angelegte öffentliche JSON-Datenbasis bildet den Ausgangspunkt. Die neue App muss bewusst klein bleiben: zwei Ansichten, Filter, URL-Teilbarkeit und Fortschrittsvisualisierung.

## Architekturentscheidung

Es wird eine eigene App `apps/project-report` eingeführt. Diese App konsumiert ausschließlich das öffentliche Reporting-Datenmodell und ist unabhängig von internen Studio-spezifischen Modulen, Auth-Flows und Admin-Funktionen.

Die App wird als statisch deploybare Frontend-Anwendung aufgebaut. Routing im klassischen SPA-Sinn ist nicht erforderlich; der UI-Zustand wird über Search-Params modelliert.

## Bausteine

### 1. Reporting Data Adapter
- Liest das öffentliche JSON-Datenmodell
- Berechnet aggregierte Fortschrittswerte je Meilenstein
- Liefert filterbare Arbeitspaket-Sichten

### 2. Report UI Shell
- Rendert Seitenkopf, Stand der Daten und globale Filterleiste
- Verwaltet Search-Params als einzige URL-basierte Zustandsquelle

### 3. Milestone View
- Zeigt aggregierte Meilenstein-Karten oder Tabellenzeilen
- Enthält Fortschrittsbalken, PT-Summen, Anzahl Arbeitspakete und Warnungsindikatoren

### 4. Work Package View
- Zeigt eine filterbare Detailtabelle
- Enthält Fortschrittsbalken, Status, Warnstatus, Priorität, Aufwand und zugehörigen Meilenstein

## Datenfluss

1. Die App lädt das öffentliche JSON-Dokument beim Build oder als statisches Asset.
2. Der Data Adapter normalisiert Status, Fortschritt und Aggregationen.
3. Search-Params bestimmen aktive Ansicht und Filter.
4. Die UI rendert daraus Meilenstein- oder Arbeitspaket-Sicht.

## Abgrenzungen

- Keine Wiederverwendung von `apps/sva-studio-react` als Host-App für die öffentliche Reporting-Oberfläche
- Keine Veröffentlichung interner Owner- oder Zuständigkeitsdaten
- Kein serverseitiger Runtime-Zwang; die App bleibt statisch auslieferbar
