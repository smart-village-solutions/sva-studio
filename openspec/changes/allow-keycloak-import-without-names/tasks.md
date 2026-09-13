## 1. Vertrag und Kernlogik

- [x] 1.1 Profil-Vollständigkeitsentscheidung so begrenzen, dass nur eine weiterhin fehlende E-Mail den Import blockiert.
- [x] 1.2 Bestehende Quellwert-, lokaler-Seed- und Username-als-E-Mail-Priorität unverändert erhalten.
- [x] 1.3 Benutzer mit auflösbarer E-Mail und fehlendem Vor- oder Nachnamen ohne Default-Werte in IAM persistieren und ihre Membership sicherstellen.

## 2. Tests

- [x] 2.1 Unit-Tests für fehlende beide beziehungsweise einzelne Namensfelder und Leerzeichenfälle ergänzen.
- [x] 2.2 Negative Tests für eine nach allen Fallbacks fehlende E-Mail und ausbleibende IAM-Persistenz erhalten beziehungsweise ergänzen.
- [x] 2.3 Quellwertvorrang, Subject-/Instanzbindung, idempotente Wiederholung und PII-freies Logging absichern.
- [x] 2.4 Den kleinsten betroffenen Vitest-Pfad und wegen `packages/auth-runtime` zusätzlich `pnpm check:server-runtime` ausführen.

## 3. Dokumentation und Abschluss

- [x] 3.1 `docs/architecture/05-building-block-view.md` und `docs/architecture/08-cross-cutting-concepts.md` auf den neuen Importvertrag aktualisieren.
- [ ] 3.2 Issue #1334 gegen einen datenschutzkonformen Produktions-Readback des exakten ausgerollten HEAD prüfen: ungelöste E-Mail-Fälle, verbleibender `manual_review`-Bestand und erfolgreicher Folgesync.
- [x] 3.3 `openspec validate allow-keycloak-import-without-names --strict` und `pnpm check:file-placement` ausführen.
