## 1. Boundary-Scope und Zielverträge

- [ ] 1.1 OpenSpec-Deltas für `monorepo-structure`, `ui-layout-shell` und `sva-mainserver-integration` finalisieren
- [ ] 1.2 die Ziel-Ownership je Kandidat festschreiben: Studio-UI nach `@sva/studio-ui-react`, Legal-Text-Sanitizing nach `@sva/iam-governance`, Mainserver-Host-Parsing nach `@sva/sva-mainserver/server`
- [ ] 1.3 explizit dokumentieren, welche App-Bereiche bewusst im App-Layer bleiben, insbesondere Shell-Komposition, Routing-Bindings und host-spezifische Route-Assemblierung

## 2. Studio-UI-Konsolidierung

- [ ] 2.1 die duplizierten Tabellen-, Listen- und Basis-UI-Bausteine in `apps/sva-studio-react` inventarisieren und einem Ziel-Export in `packages/studio-ui-react` zuordnen
- [ ] 2.2 fehlende Package-Exports oder API-Anpassungen in `@sva/studio-ui-react` ergänzen, damit App und Plugins dieselben Bausteine konsumieren können
- [ ] 2.3 App-Routen und Komponenten schrittweise von lokalen UI-Duplikaten auf Package-Imports umstellen
- [ ] 2.4 betroffene Unit-Tests für App und Package anpassen oder ergänzen, damit die gemeinsame UI-API abgesichert ist

## 3. Domain-Helper-Konsolidierung

- [ ] 3.1 `sanitizeLegalTextHtml` und zugehörige Tests auf den kanonischen Helper aus `@sva/iam-governance` zurückführen
- [ ] 3.2 app-lokale Sanitizer-Duplikate entfernen oder auf reine Kompatibilitäts-Wrapper reduzieren, falls eine Zwischenmigration nötig ist
- [ ] 3.3 prüfen, ob weitere app-lokale Helper mit derselben Ownership-Dynamik existieren, und nur reale Duplikate in denselben Refactoring-Strang aufnehmen
- [ ] 3.4 direkte App-Consumer wie Rich-Text-Editoren und Legal-Text-Dialoge auf die kanonische `@sva/iam-governance`-API umstellen und die Ownership in Tests nachvollziehbar machen

## 4. Mainserver-Host-Adapter aus der App herauslösen

- [ ] 4.1 News-, Events- und POI-spezifische Request-Parser, Validierung und Host-Mutationslogik in paketseitige Server-Verträge überführen
- [ ] 4.2 `apps/sva-studio-react` auf dünne Server-Einstiege reduzieren, die Requests entgegennehmen und an die Package-Handler delegieren
- [ ] 4.3 die Package-Tests so ergänzen, dass die ausgelagerte Parsing- und Fehlerlogik außerhalb der App abgesichert bleibt
- [ ] 4.4 app-seitige Server- und Routen-Tests auf das neue Delegationsmodell anpassen
- [ ] 4.5 sicherstellen, dass reine App-interne Helper-Extraktionen nicht als Abschluss gelten; News-, Events- und POI-Parsing muss tatsächlich über paketseitige Verträge nachweisbar sein

## 5. App-lokale Regelduplikate abbauen

- [ ] 5.1 `interfaces-api` auf gemeinsame Regeln für Instanzkontext und Berechtigungsentscheidungen zurückführen, statt dieselbe Fachentscheidung an mehreren Stellen inline zu pflegen
- [ ] 5.2 Tests für `interfaces-api` so ergänzen, dass die zentralisierte Regelbasis und ihre Fehlerfälle direkt abgesichert sind

## 6. Architektur, Doku und Qualitätssicherung

- [ ] 6.1 betroffene arc42-Abschnitte und Entwicklerdokumentation auf die Ziel-Boundaries aktualisieren
- [ ] 6.2 relevante Nx-Targets für Unit-, Types- und Boundary-Checks grün ausführen, einschließlich `pnpm check:server-runtime` falls serverseitige Packages betroffen sind
- [ ] 6.3 `openspec validate refactor-sva-studio-react-package-boundaries --strict` ausführen
