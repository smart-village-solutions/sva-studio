## 1. Plugin-Example umstellen

- [x] 1.1 `packages/plugin-example/package.json`: Dependency `@sva/core` → `@sva/sdk` ersetzen
- [x] 1.2 `packages/plugin-example/src/routes.tsx`: Plugin-Typen auf `@sva/sdk` umstellen (`RouteFactory`)
- [x] 1.3 `packages/plugin-example/src/index.ts`: keine Runtime-Abhängigkeit auf `@sva/core`
- [x] 1.4 Build und Tests für `@sva/plugin-example` ausführen und validieren

## 2. SDK um Plugin-relevante Re-Exports erweitern

- [x] 2.1 Prüfen, welche Typen aus `@sva/core` aktuell von Plugins benötigt werden (Route-Factory-Typen, Plugin-Manifest)
- [x] 2.2 Relevante Typen als Re-Exports in `@sva/sdk/src/index.ts` bereitstellen
- [x] 2.3 Sicherstellen, dass der Re-Export keine internen Implementierungsdetails exponiert

## 3. ESLint-Boundary-Regel

- [x] 3.1 ESLint-Regel konfigurieren: Projekte mit Tag `scope:plugin` dürfen nicht aus `@sva/core` importieren
- [x] 3.2 Regel im CI validieren (`pnpm nx run-many -t lint` muss den Verstoß erkennen)
- [x] 3.3 Dokumentation der Boundary-Regel in `docs/monorepo.md` ergänzen

## 4. Architekturdokumentation

- [x] 4.1 `docs/architecture/05-building-block-view.md`: Schichtdiagramm mit erlaubten Abhängigkeitsrichtungen (Core → SDK → Plugin) ergänzen
- [x] 4.2 `docs/architecture/04-solution-strategy.md`: Leitprinzip „Plugin-SDK-Boundary" explizit aufnehmen
- [x] 4.3 Optional: ADR-Erweiterung für ADR-002 (Plugin-SDK-API-Vertrag) prüfen (keine zusätzliche ADR-Änderung erforderlich)

## 5. Validierung

- [x] 5.1 `pnpm nx affected --target=test:unit` – alle betroffenen Tests grün
- [x] 5.2 `pnpm nx affected --target=lint` – keine Boundary-Verletzungen
- [x] 5.3 `pnpm nx run-many -t build` – Build stabil
