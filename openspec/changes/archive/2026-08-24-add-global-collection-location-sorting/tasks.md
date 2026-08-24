## 1. Verträge und Repository

- [x] 1.1 Typisierte, framework-agnostische Filter-, Sortier-, Pagination- und Read-Model-Verträge für die Abholortliste in `@sva/core` ergänzen und über `@sva/plugin-sdk` veröffentlichen.
- [x] 1.2 Deutsch-numerische Vergleichssemantik gegen die unterstützte PostgreSQL-Tenant-Laufzeit verifizieren und die gewählte feste SQL-/Collation-Abbildung im Design dokumentieren.
- [x] 1.3 Repositoryprojektion mit gemeinsamen Filterprädikaten, Gesamtzahl, den Sortiermodi `address` und `addressWithRegion`, fehlenden Werten zuletzt und `ID asc` als Tie-Breaker implementieren.
- [x] 1.4 Serverseitige Auflösung aller IDs des aktuellen Filtervertrags für „Alle gefilterten auswählen“ ergänzen, ohne Sortier- oder Paginationparameter zu übernehmen.
- [x] 1.5 Die Collation `sva_de_numeric` über eine idempotente, versionierte Waste-Tenant-Migration anlegen, `docs/development/studio-db-schema.md` aktualisieren und `docs/development/studio-db-schema-final.sql` gegen die bestehende Trennung der zentralen und tenantbezogenen Schemata prüfen.

## 2. Host-Fassade und Browser-Client

- [x] 2.1 Autorisierten GET-Read unter `/api/v1/waste-management/collection-locations` anbinden und unbekannte oder widersprüchliche Sortierparameter mit `400 invalid_request` abweisen.
- [x] 2.2 Count und Page-Read in einem konsistenten kurzen Read-Snapshot oder einer äquivalent konsistenten Query ausführen; Touraggregation darf Zeilen und Gesamtzahl nicht vervielfachen.
- [x] 2.3 Browser-Client für die paginierte Listenprojektion und die gefilterte ID-Auflösung ergänzen; der bestehende Master-Data-Overview bleibt für seine anderen Verbraucher erhalten.
- [x] 2.4 Server-Runtime-Regeln für geänderte Workspace-Packages einhalten und Runtime-Imports beziehungsweise Dependencies vollständig deklarieren.

## 3. Search-Params und Oberfläche

- [x] 3.1 Search-Params für `address|addressWithRegion` und `asc|desc` mit den Defaults `address` und `asc` ergänzen und ungültige URL-Werte normalisieren.
- [x] 3.2 Abholortliste auf serverseitige Filter-, Sortier-, Count- und Pagination-Ownership umstellen und die bisherige lokale Einzelspalten-Sortierung entfernen.
- [x] 3.3 Zugängliche Bedienung für „Region berücksichtigen“ und die gemeinsame Richtung in Desktop- und schmaler Ansicht mit demselben kontrollierten Zustand implementieren.
- [x] 3.4 Suche, Status-, Regions-, Orts- und Tourfilter sowie Sortier- und Seitengrößenwechsel atomar auf Seite eins zurücksetzen; reine Seitenwechsel erhalten den übrigen Zustand.
- [x] 3.5 ID-basierte Auswahl über Seiten und Sortierwechsel erhalten und „Alle gefilterten auswählen“ an die serverseitige ID-Auflösung binden, ohne außerhalb des Filters liegende Auswahlen falsch zuzuordnen.
- [x] 3.6 Deutsche und englische Übersetzungen für Sortierfolge, Regionsoption, Richtung und Screenreader-Status ergänzen.

## 4. Tests und Dokumentation

- [x] 4.1 Repository-Integrationstests für beide Sortiermodi und Richtungen, natürliche Hausnummern, Umlaute/Großschreibung, fehlende Werte zuletzt, ID-Tie-Breaker, Tourfilter, Gesamtzahl und mindestens zwei Seiten ergänzen.
- [x] 4.2 Handler- und Contract-Tests für Autorisierung, erlaubte Parameter, unbekannte beziehungsweise widersprüchliche Direktparameter und konsistente Pagination ergänzen.
- [x] 4.3 Search-Param- und Navigationstests für Defaults, Normalisierung sowie Seitenreset bei Filter-, Sortier- und Seitengrößenwechsel ergänzen.
- [x] 4.4 Komponenten- und Accessibility-Tests für sichtbare Defaults, Maus-, Tastatur- und Screenreader-Bedienung, gemeinsame Desktop-/Mobilsteuerung, unveränderte Serverreihenfolge und ID-stabile Auswahl ergänzen.
- [x] 4.5 Relevante Waste-Management-Dokumentation unter `docs/guides/` auf Deutsch ergänzen oder aktualisieren.
- [x] 4.6 `docs/architecture/05-building-block-view.md` und `docs/architecture/06-runtime-view.md` um Listenprojektion und Request-Flow ergänzen; Abschnitte 08 und 10 gegen die bestehenden globalen Listenverträge prüfen und nur bei tatsächlicher Abweichung ändern.

## 5. Validierung

- [x] 5.1 Kleinste relevante Unit-, Type- und Repository-Integrationstests blockweise ausführen; bei Server-Package-Änderungen früh `pnpm check:server-runtime` ausführen.
- [x] 5.2 Affected-Scope vor breiten Nx-Runs messen und für den initialen Feature-Push den kleinsten echten Gate-Pfad beziehungsweise bevorzugt `pnpm test:pr` ausführen.
- [x] 5.3 `pnpm check:file-placement`, relevante Dokumentationsprüfungen und `openspec validate add-global-collection-location-sorting --strict` ausführen.
