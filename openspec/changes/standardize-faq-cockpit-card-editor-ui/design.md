## Context

FAQ und Kacheln sind fachlich begrenzte GenericItems. Beide verwenden bereits die Studio-Seitentemplates und Teile des Design-Systems, bilden Tabs, Panels, Formularfehler, Historie und Listensteuerung jedoch teilweise lokal nach. GenericItems dient als visuelle Referenz, verwendet selbst aber noch lokale Tabs. Der kanonische Zielpfad ist deshalb nicht eine Kopie von `plugin-generic-items`, sondern die gemeinsame Studio-UI mit `StudioDetailTabs`, `StudioFormSummaryErrors`, Detailkarten, Datentabelle und Dialog-Primitives.

Der aktive Change `refactor-shared-editor-primitives` standardisiert allgemeine Section- und Repeater-Bausteine. Dieser Change besitzt einen anderen Zweck: Er migriert FAQ und Kacheln vollständig auf den Studio-Standard und schließt dabei konkrete fachliche Lücken in Listen- und Löschabläufen.

News, Events und POIs sind dabei keine jeweils vollständige Referenzarchitektur. Sie enthalten unterschiedliche, produktiv erprobte Teilmuster, aber auch lokale Nachbildungen derselben Studio-Grundfunktionen. Der Zielstandard wird deshalb aus den besten belegten Teilmustern und den gemeinsamen `studio-ui-react`-Primitives zusammengesetzt.

## Goals / Non-Goals

- Goals:
  - konsistente, responsive und zugängliche Detail-Workspaces für FAQ und Kacheln
  - einheitliche Feld-, Panel-, Status-, Fehler- und History-Darstellung
  - korrekte URL-gesteuerte Listensteuerung ohne Filterung nur innerhalb einer bereits paginierten Seite
  - sichere Löschabläufe für FAQ, Kacheln und GenericItems
  - unveränderte fachliche Daten- und Persistenzverträge
  - nachgewiesene Vereinfachung gegenüber den lokalen Varianten in GenericItems, News, Events und POIs
- Non-Goals:
  - keine neue fachliche Abstraktion der drei GenericItem-Varianten
  - keine Änderung von GraphQL-, GenericItem- oder Content-Projektionsverträgen
  - kein vollständiges UI-Refactoring aller Content-Plugins
  - keine speculative Generalisierung außerhalb nachgewiesener Mehrfachnutzung

## Decisions

### Kuratierte Referenzmatrix statt Kopie eines einzelnen Plugins

| Verantwortung                   | Führende Referenz | Zu übernehmendes Verhalten                                                                                    | Nicht zu übernehmen                                                         |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Formular- und Tabzustand        | News              | besuchte Formularbereiche behalten Werte und Dirty-State; History darf verzögert laden                        | lokales Tabs-/Visited-Tabs-Gerüst                                           |
| Panel- und Abschnittshierarchie | POI               | semantische Section-Cards mit Titel, Beschreibung und klarer Inhaltsfläche                                    | pluginlokale `PoiDetailSectionCard` als dauerhafte Parallelkomponente       |
| URL-Pagination                  | Events            | ungültige Parameter normalisieren und kanonisch in die URL zurückschreiben                                    | erneut pluginlokal implementierte Normalisierungs- und Navigationshelfer    |
| Kompakte Pagination             | POI               | zugängliche Seitenansage, Vor-/Zurück-Sperren und Search-Param-Erhaltung                                      | fachplugingebundene Pagination-Komponente                                   |
| History                         | News              | lokalisierte Aktionen, sortierte Einträge, semantische Tabelle sowie Karten-, Lade-, Fehler- und Leerzustände | news-spezifische Mapper oder Übersetzungsschlüssel im gemeinsamen Primitive |
| Mutationsstatus                 | News              | Pending-Sperre und genau eine Mutation                                                                        | `window.confirm` als Zielinteraktion                                        |

Die Referenzmatrix bestimmt Verhalten und Qualitätsniveau, nicht die Ownership. Allgemeine Oberflächen liegen in `studio-ui-react`; Fachlabels, Datenmapper, Formpfade und API-Aufrufe verbleiben im jeweiligen Plugin.

### Vereinfachung ist ein explizites Abnahmekriterium

Eine Migration gilt nur dann als Vereinfachung, wenn sie lokale Basisimplementierungen entfernt oder auf fachliche Zusammensetzung reduziert. Neue Wrapper, Factories oder Konfigurationsschichten ohne mindestens zwei reale Nutzungen sind unzulässig. Insbesondere werden keine zweite Tab-API, keine zweite Section-Card und kein weiterer pluginlokaler Pagination-Unterbau eingeführt.

Gemeinsame Primitives werden gegen mindestens zwei reale Nutzungsmuster aus FAQ, Kacheln, GenericItems, News, Events oder POIs geprüft. Das verlangt keine gleichzeitige Migration aller Referenzplugins, verhindert aber eine nur auf einen einzelnen Editor zugeschnittene API.

### Gemeinsame Studio-Primitives sind die führende Layout-API

FAQ, Kacheln und GenericItems SHALL keine neuen lokalen Varianten für Tabs, Form-Summaries oder Löschdialoge einführen. `StudioDetailTabs` führt Desktop- und Mobilnavigation, Panel-Header, Beschreibungen, optionale Statusanzeigen und Mounting-Verhalten. Wiederverwendbare Detailkarten stammen aus `studio-ui-react`, sobald der aktive Primitive-Change sie bereitstellt.

Lokale Komponenten bleiben zulässig, wenn sie ausschließlich Fachfelder zusammensetzen und keine parallele Basis-UI definieren.

### Formularzustand bleibt beim Tabwechsel erhalten

FAQ- und Kachel-Formulare enthalten React-Hook-Form-Zustand und bei Kacheln ein `useFieldArray` für Bilder. Die Migration verwendet ein Mounting-Verhalten, bei dem bereits besuchte Formularbereiche nicht unregistriert werden. Tests müssen belegen, dass Werte, Dirty-State und Validierungsfehler nach wiederholten Tabwechseln erhalten bleiben.

History darf weiterhin erst beim ersten Besuch geladen werden, soll anschließend aber nicht bei jedem Tabwechsel unnötig neu initialisiert werden.

### Fachliche Gruppierung ohne Änderung des Datenmodells

Der FAQ-Editor bleibt bewusst kompakt. Seine wenigen Felder dürfen direkt im jeweiligen Tab-Panel stehen; eine zusätzliche Kartenebene ist nur sinnvoll, wenn sie einen echten fachlichen Abschnitt beschreibt.

Der Kachel-Inhalts-Tab besitzt dagegen drei erkennbare Aufgaben und wird in die Karten `Text`, `Bilder` und `Link` gegliedert. Feldnamen, React-Hook-Form-Pfade und Mapper bleiben identisch. Die Medienauswahl bleibt hostgeführt; in der Kachel-Variante bleibt ausschließlich der Alternativtext als Medienmetadatum sichtbar.

### Fehler werden zentral und feldbezogen dargestellt

Speicher- und API-Status verwenden `StudioFormSummary`. Validierungsfehler verwenden `StudioFormSummaryErrors` mit stabilen Feld-IDs. Ein Verweis auf ein Feld in einem inaktiven Tab aktiviert zuerst den zugehörigen Tab und fokussiert anschließend das Feld. Inline-Fehler bleiben dort erhalten, wo sie eine konkrete Korrektur erklären.

Listen- und Detailtemplates erhalten fachlich verständliche Beschreibungen. Die Primäraktion unterscheidet Erstellen und Aktualisieren, bleibt bis zum Start einer Mutation verfügbar und ist während einer laufenden Mutation gesperrt.

### Listenparameter sind URL-gesteuert und fachlich korrekt

FAQ und Kacheln normalisieren `page` und `pageSize` über einen gemeinsamen oder gleichwertigen Listenhelfer und erhalten unbekannte Search-Params bei der Navigation.

Der FAQ-Sprachfilter wird als optionaler URL-Search-Param modelliert. Er MUST auf die vollständige, bereits nach `genericType === "FAQ"` abgegrenzte Menge angewendet werden, bevor Sortierung, `totalCount` und Pagination berechnet werden. Eine browserseitige Filterung nur der geladenen Seite ist unzulässig. Falls der Mainserver keinen geeigneten Filter anbietet, bleibt der hostseitige FAQ-Adapter für Filterung und lokale Pagination verantwortlich.

Die Kachel-Liste verwendet die vom Host gelieferten Werte `page`, `pageSize` und `hasNextPage` und zeigt dieselbe Vor-/Zurück-Navigation wie andere Studio-Fachlisten.

### Destruktive Aktionen benötigen Bestätigung

FAQ, Kacheln und GenericItems verwenden denselben Studio-Bestätigungsdialog. Der Dialog benennt das betroffene Objekt, verlangt eine ausdrückliche Bestätigung, sperrt alle auslösenden Aktionen während der Mutation und zeigt einen fehlgeschlagenen Löschversuch im Dialog an. Abbruch und Fehler dürfen Navigation und Formulardaten nicht verändern; nach Erfolg führt die bestehende Zielnavigation zurück in die Inhaltsübersicht.

## Risks / Trade-offs

- Tab-Migration kann Formularwerte oder `useFieldArray`-Einträge verlieren. → Mounting-Vertrag explizit festlegen und Wechseltests für Create/Edit, Bilder und Fehler ergänzen.
- Fehlerlinks können auf falsche oder noch nicht gerenderte Felder zeigen. → stabile Feld-ID-Matrix und Tab-Aktivierung vor Fokus verwenden.
- FAQ-Filterung nach Pagination erzeugt falsche Leerseiten und Zählwerte. → Filter zwingend im Host vor Sortierung und Pagination anwenden.
- Neue Pagination kann Search-Params verwerfen oder doppelte Requests erzeugen. → funktionale Search-Updater und normalisierte Listenparameter testen.
- Ein Löschdialog kann doppelte Mutationen oder Fokusverlust erzeugen. → Pending-Sperre, genau ein Mutationstest und Fokus-Rückgabe bei Abbruch absichern.
- Parallele Arbeit an `refactor-shared-editor-primitives` kann Merge-Konflikte verursachen. → erst gemeinsame Primitive-Schnittstelle stabilisieren, dann Pluginmigrationen in kleinen Blöcken durchführen.
- Zu viel visuelle Verschachtelung würde die reduzierten Fachformulare unnötig aufblasen. → FAQ kompakt halten; Karten nur für echte Aufgabenbereiche verwenden.
- Eine unkritische Kopie aus einem Referenzplugin würde dessen lokale Doppelimplementierungen konservieren. → pro Verantwortung nur das Verhalten übernehmen und Ownership in `studio-ui-react` zentralisieren.
- Eine zu breite gleichzeitige Migration aller Content-Plugins würde Scope und Konfliktrisiko vervielfachen. → News, Events und POIs nur als Referenzen nutzen und ihre spätere Migration separat entscheiden.

## Migration Plan

1. Referenzmuster aus News, Events und POIs charakterisieren, lokale Altlasten markieren und fehlende gemeinsame Primitives mit `refactor-shared-editor-primitives` abgleichen.
2. FAQ auf `StudioDetailTabs`, Standard-Summaries und Studio-Felder migrieren; Formularverhalten unverändert testen.
3. Kacheln auf dieselben Tabs und Summaries migrieren sowie den Inhaltsbereich in drei Fachkarten gliedern.
4. Gemeinsames History-Muster für FAQ und Kacheln verwenden.
5. FAQ-Filtervertrag hostseitig vor Pagination umsetzen und beide Fachlisten URL-gesteuert navigierbar machen.
6. Gemeinsamen Löschdialog in FAQ, Kacheln und GenericItems einführen.
7. Komponenten-, Integrations- und E2E-Gates ausführen und arc42-Dokumentation aktualisieren.

Die Schritte 2 bis 4 sind visuell und formularnah; Schritte 5 und 6 verändern Nutzerabläufe und werden getrennt reviewbar gehalten. Ein Rollback kann blockweise erfolgen, ohne Datenmigration oder Änderung persistierter Inhalte.

## Deferred Decisions

- Der gemeinsame History-Baustein wird bevorzugt durch `refactor-shared-editor-primitives` bereitgestellt. Fehlt er zum Migrationszeitpunkt, darf dieser Change ihn aufgrund der nachgewiesenen Nutzung durch FAQ und Kacheln in `studio-ui-react` ergänzen.
- Weitere serverseitige FAQ-Filter bleiben außerhalb dieses Changes; normiert wird ausschließlich der vorhandene Sprachfilter.
- Die vollständige Migration von News, Events und POIs auf die stabilisierten Primitives bleibt ein eigener Folgeschritt und wird nicht stillschweigend in diesen Change aufgenommen.
