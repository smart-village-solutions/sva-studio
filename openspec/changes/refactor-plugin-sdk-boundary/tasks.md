## 1. Plugin-Example umstellen

- [ ] 1.1 `packages/plugin-example/package.json`: Dependency `@sva/core` → `@sva/sdk` ersetzen
- [ ] 1.2 `packages/plugin-example/src/index.ts`: Import auf `import { sdkVersion } from '@sva/sdk'` umstellen
- [ ] 1.3 Sicherstellen, dass `@sva/sdk` `sdkVersion` korrekt exportiert (bereits der Fall)
- [ ] 1.4 Build und Tests für `@sva/plugin-example` ausführen und validieren

## 2. SDK um Plugin-relevante Re-Exports erweitern

- [ ] 2.1 Prüfen, welche Typen aus `@sva/core` aktuell von Plugins benötigt werden (Route-Factory-Typen, Plugin-Manifest)
- [ ] 2.2 Relevante Typen als Re-Exports in `@sva/sdk/src/index.ts` bereitstellen
- [ ] 2.3 Sicherstellen, dass der Re-Export keine internen Implementierungsdetails exponiert

## 3. ESLint-Boundary-Regel

- [ ] 3.1 ESLint-Regel konfigurieren: Projekte mit Tag `scope:plugin` dürfen nicht aus `@sva/core` importieren
- [ ] 3.2 Regel im CI validieren (`pnpm nx run-many -t lint` muss den Verstoß erkennen)
- [ ] 3.3 Dokumentation der Boundary-Regel in `docs/monorepo.md` ergänzen

## 4. Architekturdokumentation

- [ ] 4.1 `docs/architecture/05-building-block-view.md`: Schichtdiagramm mit erlaubten Abhängigkeitsrichtungen (Core → SDK → Plugin) ergänzen
- [ ] 4.2 `docs/architecture/04-solution-strategy.md`: Leitprinzip „Plugin-SDK-Boundary" explizit aufnehmen
- [ ] 4.3 Optional: ADR-Erweiterung für ADR-002 (Plugin-SDK-API-Vertrag) prüfen

## 5. Validierung

- [ ] 5.1 `pnpm nx affected --target=test:unit` – alle betroffenen Tests grün
- [ ] 5.2 `pnpm nx affected --target=lint` – keine Boundary-Verletzungen
- [ ] 5.3 `pnpm nx run-many -t build` – Build stabil
