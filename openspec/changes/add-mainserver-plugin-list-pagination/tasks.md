## 1. Spezifikation und Architektur
- [x] 1.1 Capability-Deltas für `content-management` und `sva-mainserver-integration` finalisieren und mit dem Design abstimmen
- [x] 1.2 Betroffene arc42-Abschnitte `04`, `05`, `06`, `08`, `10` und `11` mit Fokus auf List-Contract, Laufzeitfluss und Performance-Trade-offs aktualisieren oder begründete Abweichung dokumentieren

## 2. Mainserver- und Host-Vertrag
- [x] 2.1 Gemeinsame Query- und Pagination-Typen für News, Events und POI festlegen
- [x] 2.2 `packages/sva-mainserver` von fest codiertem `limit: 100, skip: 0` auf parametrisierte Listen umstellen
- [x] 2.3 Deterministische Ermittlung von `hasNextPage` auf Basis des sichtbaren Ergebnisses implementieren, ohne Totalseiten vorzutäuschen
- [x] 2.4 Host-Routen für News, Events und POI um Query-Normalisierung und paginierte JSON-Responses erweitern

## 3. Plugin- und UI-Harmonisierung
- [x] 3.1 Plugin-API-Wrapper für News, Events und POI auf paginierte Responses umstellen
- [x] 3.2 `StudioDataTable` auf benötigte generische Erweiterungen für die drei Plugin-Listen anpassen
- [x] 3.3 `NewsListPage`, `EventsListPage` und `PoiListPage` auf typsichere Search-Params, `StudioDataTable` und gemeinsame Prev/Next-Pagination migrieren
- [x] 3.4 Bestehende handgebaute Tabellenmarkups der drei Plugin-Listen entfernen

## 4. Tests und Verifikation
- [x] 4.1 Unit-Tests für Query-Normalisierung, Pagination-Metadaten und Plugin-API-Wrapper ergänzen
- [x] 4.2 Komponenten-Tests für die drei List-Pages um Paging-Interaktion, URL/Search-Param-Synchronisation und States erweitern
- [x] 4.3 Playwright-Mocks und E2E-Tests für paginierte Responses aktualisieren
- [x] 4.4 Relevante Gates ausführen: `pnpm nx run plugin-news:test:unit`, `pnpm nx run plugin-events:test:unit`, `pnpm nx run plugin-poi:test:unit`, `pnpm nx run sva-studio-react:test:unit`, `pnpm nx run sva-mainserver:test:unit`, anschließend `pnpm nx affected --target=test:types --base=origin/main`
- [x] 4.5 `openspec validate add-mainserver-plugin-list-pagination --strict` ausführen
