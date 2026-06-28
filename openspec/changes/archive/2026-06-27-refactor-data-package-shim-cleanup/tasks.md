## 1. Architekturvertrag und Dokumentation

- [x] 1.1 OpenSpec-Deltas für `architecture-documentation` und `monorepo-structure` auf den Shim-Vertrag für `@sva/data` und die Führungsrolle von `@sva/data-repositories` festziehen
- [x] 1.2 `docs/architecture/package-zielarchitektur.md` und `docs/architecture/package-gesamtuebersicht.md` so fortschreiben, dass `@sva/data` nur noch als Migrations-, Seed-, DB-Skript/-Operations- und Kompatibilitätspfad beschrieben ist
- [x] 1.3 Die Arc42-Referenzen für Bausteinsicht, Querschnittskonzepte und Risiken auf denselben Ownership-Vertrag angleichen

## 2. Shim-Bereinigung in `@sva/data`

- [x] 2.1 Gedoppelte Repository-Implementierungen in `packages/data/src/**` identifizieren und durch dünne Shims, dokumentierte Delegation oder Entfernung ersetzen
- [x] 2.2 Breite Spiegeltests in `packages/data/src/**` auf gezielte Shim- und Delegationsabsicherung reduzieren
- [x] 2.3 Bestehende Altpfade `@sva/data` und `@sva/data/server` auf dokumentierte Zielpackages delegieren, ohne parallele Repository-Ownership zu behalten

## 3. Guardrails gegen neue Ownership

- [x] 3.1 Guardrails definieren, die neue fachliche Persistenz- oder Repository-Ownership in `@sva/data` blockieren
- [x] 3.2 Boundary-, Shim- oder Tooling-Tests so ergänzen, dass neue Repository-Implementierungen in `@sva/data` auffallen
- [x] 3.3 Die betroffenen Zielpackages und zentralen Testpfade für die Guardrails dokumentieren
