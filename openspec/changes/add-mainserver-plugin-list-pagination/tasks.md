## 1. Spezifikation und Architektur
- [ ] 1.1 Capability-Deltas fuer `content-management` und `sva-mainserver-integration` finalisieren und mit dem Design abstimmen
- [ ] 1.2 Betroffene arc42-Abschnitte `04`, `05`, `06`, `08`, `10` und `11` mit Fokus auf List-Contract, Laufzeitfluss und Performance-Trade-offs aktualisieren oder begruendete Abweichung dokumentieren

## 2. Mainserver- und Host-Vertrag
- [ ] 2.1 Gemeinsame Query- und Pagination-Typen fuer News, Events und POI festlegen
- [ ] 2.2 `packages/sva-mainserver` von fest codiertem `limit: 100, skip: 0` auf parametrisierte Listen umstellen
- [ ] 2.3 Deterministische Ermittlung von `hasNextPage` auf Basis des sichtbaren Ergebnisses implementieren, ohne Totalseiten vorzutäuschen
- [ ] 2.4 Host-Routen fuer News, Events und POI um Query-Normalisierung und paginierte JSON-Responses erweitern

## 3. Plugin- und UI-Harmonisierung
- [ ] 3.1 Plugin-API-Wrapper fuer News, Events und POI auf paginierte Responses umstellen
- [ ] 3.2 `StudioDataTable` auf benoetigte generische Erweiterungen fuer die drei Plugin-Listen anpassen
- [ ] 3.3 `NewsListPage`, `EventsListPage` und `PoiListPage` auf typsichere Search-Params, `StudioDataTable` und gemeinsame Prev/Next-Pagination migrieren
- [ ] 3.4 Bestehende handgebaute Tabellenmarkups der drei Plugin-Listen entfernen

## 4. Tests und Verifikation
- [ ] 4.1 Unit-Tests fuer Query-Normalisierung, Pagination-Metadaten und Plugin-API-Wrapper ergaenzen
- [ ] 4.2 Komponenten-Tests fuer die drei List-Pages um Paging-Interaktion, URL/Search-Param-Synchronisation und States erweitern
- [ ] 4.3 Playwright-Mocks und E2E-Tests fuer paginierte Responses aktualisieren
- [ ] 4.4 Relevante Gates ausfuehren: `pnpm nx run plugin-news:test:unit`, `pnpm nx run plugin-events:test:unit`, `pnpm nx run plugin-poi:test:unit`, `pnpm nx run sva-studio-react:test:unit`, `pnpm nx run sva-mainserver:test:unit`, anschliessend `pnpm nx affected --target=test:types --base=origin/main`
- [ ] 4.5 `openspec validate add-mainserver-plugin-list-pagination --strict` ausfuehren
