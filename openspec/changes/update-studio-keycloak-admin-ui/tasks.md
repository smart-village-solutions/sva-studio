## 1. Specification

- [x] 1.1 OpenSpec-Deltas für Keycloak-first Admin-UI finalisieren
- [x] 1.2 Offene Fragen zu Built-in-Rollen, Tenant-Sichtbarkeit und föderierten User-Feldern klären
- [x] 1.3 `openspec validate update-studio-keycloak-admin-ui --strict` ausführen

## 2. Backend

- [x] 2.1 `IdentityProviderPort` um Count-/Cursor-, User-Mutation-, Role-Mutation- und Role-Assignment-Operationen erweitern
- [x] 2.2 Keycloak-Admin-Client für serverseitige User-/Role-Pagination, Suche und Count absichern
- [x] 2.3 Root-/Platform-User und -Rollen vollständig aus Keycloak listen und bearbeitbar machen
- [x] 2.4 Tenant-User und -Rollen vollständig im Tenant-Scope sichtbar machen, inklusive ungemappter Keycloak-Objekte
- [x] 2.5 Keycloak-first Mutationen mit Studio-Read-Model-Sync und Drift-Status implementieren
- [x] 2.6 Diagnosecodes für `partial_failure`, `blocked`, `IDP_FORBIDDEN`, Read-only- und Föderationsfälle stabilisieren
- [x] 2.7 Audit-Events für User-/Rollenänderungen und Rollenzuordnungen ergänzen

## 3. Frontend

- [x] 3.1 Root- und Tenant-Listen für alle Keycloak-User/-Rollen mit Bearbeitbarkeitsstatus erweitern
- [x] 3.2 User-Detail und Rollen-Detail für Keycloak-first Bearbeitung freischalten
- [x] 3.3 Rollenzuordnungen mit sichtbaren Blocked-/Read-only-Zuständen verwaltbar machen
- [x] 3.4 Sync-/Reconcile-Reports objektbezogen mit Zählern, Diagnosecodes und betroffenen Objekten anzeigen
- [x] 3.5 Loading-Zustände so absichern, dass `user === null` keinen falschen Platform-Scope rendert

## 4. Documentation

- [x] 4.1 Keycloak-Runbooks um Studio als Admin-UI und Rechte-Matrix ergänzen
- [x] 4.2 Runtime-Doku um Keycloak-first Mutations- und Sync-Vertrag ergänzen
- [x] 4.3 Betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren

## 5. Verification

- [x] 5.1 Unit-/Integrationstests für Keycloak-Count/Pagination, Mutationen und Drift-Diagnosen
- [x] 5.2 Frontend-Tests für vollständige Keycloak-Listen, Bearbeitbarkeit und Read-only-Zustände
- [ ] 5.3 Tenant-Smokes gegen `bb-guben` und `hb-meinquartier` mit User-Sync und Rollen-Reconcile (nicht lokal ausgeführt)
- [ ] 5.4 Root-Smoke gegen `studio.smart-village.app` mit Platform-User-/Rollenbearbeitung (nicht lokal ausgeführt)
- [x] 5.5 `pnpm test:pr` oder mindestens affected Unit/Types/Lint/E2E ausführen
