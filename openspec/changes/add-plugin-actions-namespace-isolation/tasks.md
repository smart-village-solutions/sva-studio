## 1. Analyse & Spezifikation
- [ ] 1.1 Bestehende Action-Definitionen und Aufrufstellen repo-weit inventarisieren.
- [ ] 1.2 OpenSpec-Deltas für `routing`, `iam-access-control`, `iam-auditing` und `monorepo-structure` ergänzen.
- [ ] 1.3 arc42-Abschnitte 05/08/09/12 mit Namespace-Isolation referenzieren und Update-Bedarf festhalten.

## 2. SDK- und Core-Design
- [x] 2.1 Typsichere Action-Verträge im SDK definieren (`definePluginActions`, Metadaten, i18n-Key-Pflicht).
- [x] 2.2 Namespace-Validator und reservierte Präfixe im SDK implementieren.
- [x] 2.3 Action-Registry mit deterministischem Konfliktverhalten (fail-fast) ausstatten.

## 3. Runtime-Integration
- [ ] 3.1 Routing-/UI-Bindings auf fully-qualified Action-IDs umstellen.
- [ ] 3.2 IAM-Autorisierung auf namespace-sichere Action-ID-Prüfung umstellen.
- [ ] 3.3 Audit-Pipeline um Namespace-Felder erweitern.

## 4. Migration
- [ ] 4.1 Legacy-Action-Aliasing inkl. Deprecation-Warnungen implementieren.
- [x] 4.2 Mindestens ein Referenz-Plugin auf neue Contracts migrieren.
- [ ] 4.3 Migrationsleitfaden in `docs/` ergänzen (inkl. Sunset-Plan).

## 5. Qualitätssicherung
- [x] 5.1 Unit-Tests für Validator und Registry ergänzen.
- [x] 5.2 Type-Tests für SDK-Inferenz und Namespace-Verstöße ergänzen.
- [ ] 5.3 Integrations-/E2E-Tests für erlaubte und verbotene Cross-Namespace-Aufrufe ergänzen.
- [ ] 5.4 PR-Gate ausführen (`pnpm test:pr`) oder dokumentierte Mindest-Gates nachweisen.
