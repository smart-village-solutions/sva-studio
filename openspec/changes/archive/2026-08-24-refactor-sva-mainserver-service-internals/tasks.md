## 1. Spezifikation und Architektur
- [x] 1.1 Capability-Delta für `sva-mainserver-integration` ergänzen, das stabile öffentliche Fassade und interne Modulgrenzen festhält
- [x] 1.2 arc42-Abschnitte `05`, `06` und `08` mit der neuen internen Baustein- und Laufzeitstruktur aktualisieren

## 2. Interne Infrastrukturmodule
- [x] 2.1 Gemeinsame interne Typen, Cache-Helfer und Observability-/Fehler-Helfer extrahieren
- [x] 2.2 Credential-Provider, Token-Provider und GraphQL-Client in getrennte interne Module überführen
- [x] 2.3 Sichtbarkeits-Paginierung und GraphQL-Executor-Port als wiederverwendbare interne Bausteine abtrennen

## 3. Fachmodule und Fassade
- [x] 3.1 News-, Event- und POI-Mapper in getrennte interne Module verschieben
- [x] 3.2 Diagnose-, News-, Event- und POI-Operationen als interne Factories oder Module extrahieren
- [x] 3.3 `service.ts` auf Orchestrierung, Dependency-Wiring, Default-Service und öffentliche Helper reduzieren

## 4. Tests und Verifikation
- [x] 4.1 Fokussierte Unit-Tests für Cache, Credentials, Token, GraphQL-Transport und Mapper ergänzen oder aus den bisherigen Service-Tests umschneiden
- [x] 4.2 Service-Level-Tests für stabile Fassade, Connection-Status-Wiring und Default-Service-Verhalten beibehalten
- [x] 4.3 `pnpm nx run sva-mainserver:test:unit`, `pnpm nx run sva-mainserver:test:types`, `pnpm nx run sva-mainserver:lint` und `pnpm nx run sva-mainserver:check:runtime` ausführen
- [x] 4.4 `openspec validate refactor-sva-mainserver-service-internals --strict` ausführen
