## 1. Spezifikation und Architektur
- [ ] 1.1 Capability-Delta für `sva-mainserver-integration` ergänzen, das stabile öffentliche Fassade und interne Modulgrenzen festhält
- [ ] 1.2 arc42-Abschnitte `05`, `06` und `08` mit der neuen internen Baustein- und Laufzeitstruktur aktualisieren

## 2. Interne Infrastrukturmodule
- [ ] 2.1 Gemeinsame interne Typen, Cache-Helfer und Observability-/Fehler-Helfer extrahieren
- [ ] 2.2 Credential-Provider, Token-Provider und GraphQL-Client in getrennte interne Module überführen
- [ ] 2.3 Sichtbarkeits-Paginierung und GraphQL-Executor-Port als wiederverwendbare interne Bausteine abtrennen

## 3. Fachmodule und Fassade
- [ ] 3.1 News-, Event- und POI-Mapper in getrennte interne Module verschieben
- [ ] 3.2 Diagnose-, News-, Event- und POI-Operationen als interne Factories oder Module extrahieren
- [ ] 3.3 `service.ts` auf Orchestrierung, Dependency-Wiring, Default-Service und öffentliche Helper reduzieren

## 4. Tests und Verifikation
- [ ] 4.1 Fokussierte Unit-Tests für Cache, Credentials, Token, GraphQL-Transport und Mapper ergänzen oder aus den bisherigen Service-Tests umschneiden
- [ ] 4.2 Service-Level-Tests für stabile Fassade, Connection-Status-Wiring und Default-Service-Verhalten beibehalten
- [ ] 4.3 `pnpm nx run sva-mainserver:test:unit`, `pnpm nx run sva-mainserver:test:types`, `pnpm nx run sva-mainserver:lint` und `pnpm nx run sva-mainserver:check:runtime` ausführen
- [ ] 4.4 `openspec validate refactor-sva-mainserver-service-internals --strict` ausführen
