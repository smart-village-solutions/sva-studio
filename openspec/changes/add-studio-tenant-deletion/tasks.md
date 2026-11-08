## Umsetzung

- [x] Atomare Studio-Datenlöschung und PostgreSQL-Test ergänzen.
- [x] Service/API mit Autorisierung, CSRF, Reauth und Bestätigung anbinden.
- [x] Bestehende Instanzübersicht um Löschdialog und Übersetzungen erweitern.
- [x] Gezielte Tests, Typen, Server-Runtime und Dateiplatzierung prüfen.
- [x] Schema-Snapshot und aktuelle Architektur-/API-Dokumentation abschließen.

## Lokale Validierung

- Repository-Mutationen: 37 Unit-Tests.
- Instanz-Service: 145 Unit-Tests; Mutation-HTTP-Vertrag: 13 Unit-Tests.
- Auth-Adapter und Bestätigung: 82 Unit-Tests; Routing: 48 Unit-Tests.
- Scoped-Transaktion ohne Reconciliation/Folgeaktionen: 15 Unit-Tests.
- Instanzübersicht/Dialog: 7 Tests; Hook/API: 91 Tests.
- PostgreSQL mit vollständigem Schema, RLS, Mikrosekunden-CAS, Migration Down/Up und Fehler-Rollback: 8 Tests.
- Typprüfungen der fünf geänderten Projekte, Server-Runtime, Lint, Dateiplatzierung und OpenSpec-Validierung erfolgreich.
- Keine produktive Löschung, kein Push und kein Rollout durchgeführt.

## Begrenzte PR-Korrekturen

- [x] Content-Save-Operation-Referenzen vor Medien entfernen; echte PostgreSQL-Regressionsfixture ergänzt.
- [x] Auch bei der Vorbereitung von `instance.delete`-Challenges die Aktivierungs-Reconciliation deaktivieren; andere Aktionen bleiben unverändert.
- [x] Belegte Complexity-Grenzen im bestehenden Pfad einhalten; kein zusätzliches Package, UI-Bauteil oder öffentlicher HTTP-Wrapper.
- [x] Schema-Snapshot mit `pg_dump` regenerieren statt Definitionsformat manuell nachzubilden.
- [x] Bestehenden Erfolgspfad bei Refetch-Netzwerkfehler durch gezielten Hook-Test nachweisen.

Nach diesen Folgekorrekturen werden die GitHub-Gates des neuen exakten HEAD als Gesamtvalidierung verwendet. Die PostgreSQL-Tests sind lokal belegt; der bestehende PR-Integration-Runner führt `data-repositories` derzeit nicht aus. Dieser PR führt keinen weiteren CI-Pfad ein.

- [x] Draft-RLS nach SQL-Kommando trennen: gewöhnliche globale/kommunale Sessions behalten SELECT/INSERT/UPDATE, erhalten aber kein DELETE; PostgreSQL-Regressionssuite mit Down/Up und vollständiger Tenant-Löschung: 9 Tests erfolgreich.
