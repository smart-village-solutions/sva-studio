## Umsetzung

- [x] Atomare Studio-Datenlöschung und PostgreSQL-Test ergänzen.
- [x] Service/API mit Autorisierung, CSRF, Reauth und Bestätigung anbinden.
- [x] Bestehende Instanzübersicht um Löschdialog und Übersetzungen erweitern.
- [x] Gezielte Tests, Typen, Server-Runtime und Dateiplatzierung prüfen.
- [x] Schema-Snapshot und aktuelle Architektur-/API-Dokumentation abschließen.

## Lokale Validierung

- Repository-Mutationen: 37 Unit-Tests.
- Instanz-Service: 145 Unit-Tests; Mutation-HTTP-Vertrag: 13 Unit-Tests.
- Auth-Adapter und Bestätigung: 81 Unit-Tests; Routing: 48 Unit-Tests.
- Scoped-Transaktion ohne Reconciliation/Folgeaktionen: 15 Unit-Tests.
- Instanzübersicht/Dialog: 7 Tests; Hook/API: 90 Tests.
- PostgreSQL mit vollständigem Schema, RLS, Mikrosekunden-CAS, Migration Down/Up und Fehler-Rollback: 8 Tests.
- Typprüfungen der fünf geänderten Projekte, Server-Runtime, Lint, Dateiplatzierung und OpenSpec-Validierung erfolgreich.
- Keine produktive Löschung, kein Push und kein Rollout durchgeführt.
