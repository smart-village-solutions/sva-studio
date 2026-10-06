## 1. Plugin-Vertrag

- [x] 1.1 Bestehende Descriptor-/Snapshot-Validierung und alle Verbraucher der Modulzuweisungen am aktuellen `origin/main` nachverfolgen.
- [x] 1.2 Tenant-Modulvoraussetzungen am vorhandenen `PluginDefinition` deklarieren; hostweite Verfügbarkeit von Tenant-Aktivierung trennen.
- [x] 1.3 Direkte Voraussetzung im vorhandenen Plugin-Beitrag validieren; fehlende Tenant-Verfügbarkeit erst bei Assign/Bootstrap fail-closed behandeln.
- [x] 1.4 `news`, `events` und `poi` auf ihre bisherige `categories`-Voraussetzung umstellen; positives und negatives Plugin-Registry-Fixture ergänzen.

## 2. Instance Registry

- [x] 2.1 Statische Companion-Zuordnung durch die validierten Plugin-Voraussetzungen ersetzen.
- [x] 2.2 Assign und Bootstrap mit direkten Voraussetzungen vorvalidieren; gezielte Tests belegen, dass bei fehlenden Beiträgen keine Teilmutation erfolgt.
- [x] 2.3 Revoke gegen direkt benötigte Voraussetzungen schützen und Activation-Policy-/Altzuweisungssemantik erhalten.
- [x] 2.4 Waste-Provisionierungs- und Deaktivierungsaufrufe aus Assign, Bootstrap und Revoke entfernen und den bestehenden Lifecycle-/Reconcile-Pfad nutzen.

## 3. Repositorygrenze und Waste-Kompatibilität

- [x] 3.1 Alle produktiven Consumer der Waste-Provisionierungsoperationen prüfen und verbleibende Waste-Status-/Retry-Aufrufe über die vorhandene plugin-spezifische Serverfassade erhalten.
- [x] 3.2 Ersetzte Waste-Methoden aus dem allgemeinen Instance-Registry-Repositoryvertrag entfernen; keine Fachzustände, Tabellen oder Datensätze löschen.
- [x] 3.3 Repository- und Runtime-Tests aktualisieren; Regressionsfall für Waste-Readiness und manuelle Retry beibehalten.

## 4. Verifikation und Dokumentation

- [x] 4.1 SDK-Registry-, Instance-Registry-Mutations- und Repository-Tests gezielt ausführen.
- [x] 4.2 Lifecycle-Auslösung im betroffenen Registry-Pfad gezielt nachweisen; den bestehenden Lifecycle-Contract unverändert als führende Evidenz verwenden. `pnpm check:server-runtime` ausführen.
- [x] 4.3 Nur tatsächlich betroffene arc42-Aussagen und die Plugin-Plattform-Spezifikation aktualisieren; `openspec validate refactor-plugin-tenant-module-requirements --strict` und `pnpm check:file-placement` ausführen.
