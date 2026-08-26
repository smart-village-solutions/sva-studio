## 1. Binding-Vertrag und Repro

- [x] 1.1 Den bestehenden Konflikt mit zwei Benutzer-Bindungen desselben DataProviders und einem endgültig gelöschten beziehungsweise nicht mehr vorhandenen Account als Repro-Test abbilden.
- [x] 1.2 Negativtests für aktiven, gesperrten, vorläufig gelöschten, organisatorischen und nicht eindeutig klassifizierbaren konkurrierenden Principal ergänzen.
- [x] 1.3 Den atomaren Parallelitätsvertrag für denselben DataProvider und wiederholte Auflösungsversuche testen.

## 2. Anlassbezogene Selbstheilung

- [x] 2.1 Im Binding-Modul eine instanzgebundene, DataProvider-gelockte Klassifikation konkurrierender Principals implementieren.
- [x] 2.2 Ausschließlich endgültig gelöschte oder nach Hard Delete nicht mehr vorhandene Benutzer-Bindungen auf `historical` setzen und `superseded_at` erhalten.
- [x] 2.3 Die aktuell per Identity-Endpunkt bestätigte exakte Bindung in derselben Transaktion auf `verified` setzen.
- [x] 2.4 Den Identity-Guard nach erfolgreicher Auflösung im ursprünglichen Mutationsrequest fortfahren lassen und nicht eindeutig lösbare Konflikte unverändert als `mainserver_data_provider_identity_conflict` ablehnen.
- [x] 2.5 Strukturierte, PII- und secret-minimierte Ergebnis- und Grundsignale für erfolgreiche und abgelehnte Versuche ergänzen.

## 3. Verifikation

- [ ] 3.1 Betroffene Unit- und Datenbankintegrationstests für `auth-runtime` und `sva-mainserver` ausführen.
- [ ] 3.2 Betroffene Type-Tests und `pnpm check:server-runtime` ausführen.
- [x] 3.3 Den affected Scope vor einem gegebenenfalls breiteren PR-Gate messen und den kleinsten relevanten Gate-Pfad ausführen.

## 4. Dokumentation

- [x] 4.1 `docs/development/studio-db-schema.md` um die automatische Historisierung endgültig gelöschter Benutzerprincipals ergänzen; der SQL-Snapshot bleibt mangels Schemaänderung unverändert.
- [x] 4.2 `docs/guides/mainserver-data-provider-authoring.md` um Trigger, Grenzen und Diagnose der Selbstheilung ergänzen.
- [x] 4.3 Die relevanten arc42-Abschnitte `06-runtime-view`, `08-cross-cutting-concepts` und `11-risks-and-technical-debt` aktualisieren.
