## Kontext

Die Reporting-Funktion soll öffentlich lesbar, statisch über GitHub Pages auslieferbar und von der bestehenden Studio-App getrennt sein. Die bereits angelegte öffentliche JSON-Datenbasis im Repository bildet den Ausgangspunkt. Die neue App muss bewusst klein bleiben: zwei Ansichten, Filter, URL-Teilbarkeit und Fortschrittsvisualisierung.

## Architekturentscheidung

Es wird eine eigene App `apps/project-report` eingeführt. Diese App konsumiert ausschließlich das zentral im Repository gepflegte öffentliche Reporting-Datenmodell und ist unabhängig von internen Studio-spezifischen Modulen, Auth-Flows und Admin-Funktionen.

Die Reporting-App darf sich visuell an der Studio-App orientieren, führt aber keine direkten technischen Abhängigkeiten auf `apps/sva-studio-react`, `@sva/studio-ui-react` oder andere Studio-app-spezifische Bausteine ein. Umgekehrt führt die Studio-App keine Abhängigkeit auf `apps/project-report` ein.

Die App wird als statisch deploybare Frontend-Anwendung für GitHub Pages aufgebaut. Routing im klassischen SPA-Sinn ist nicht erforderlich; der UI-Zustand wird über Search-Params modelliert.

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

1. Die App lädt das zentrale öffentliche JSON-Dokument beim Build oder als statisches Asset.
2. Das Datenmodell organisiert Arbeitspakete verschachtelt innerhalb ihres Meilensteins; der Data Adapter flacht diese Struktur bei Bedarf nur leseseitig für Filter- und Tabellenansichten ab.
3. Der Data Adapter normalisiert Status und Aggregationen; Fortschrittswerte werden ausschließlich aus `status` über `statusModel` abgeleitet.
4. Search-Params bestimmen aktive Ansicht und Filter.
5. Die UI rendert daraus Meilenstein- oder Arbeitspaket-Sicht.

## Abgrenzungen

- Keine Wiederverwendung von `apps/sva-studio-react` als Host-App für die öffentliche Reporting-Oberfläche
- Keine direkten Code- oder Paketabhängigkeiten zwischen `apps/project-report` und `apps/sva-studio-react`
- Keine Veröffentlichung interner Owner- oder Zuständigkeitsdaten
- Kein serverseitiger Runtime-Zwang; die App bleibt statisch über GitHub Pages auslieferbar
