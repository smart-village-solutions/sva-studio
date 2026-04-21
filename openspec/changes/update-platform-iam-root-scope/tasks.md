## 1. Specification

- [x] 1.1 OpenSpec-Deltas für Platform-IAM und getrennte Smokes ergänzen
- [x] 1.2 OpenSpec strict validieren

## 2. Backend

- [x] 2.1 Platform-Userliste aus Plattform-Keycloak über bestehende IAM-v1-Route bereitstellen
- [x] 2.2 Platform-Rollenliste aus Plattform-Keycloak über bestehende IAM-v1-Route bereitstellen
- [x] 2.3 Platform-Keycloak-User-Sync über bestehende Sync-Route bereitstellen
- [x] 2.4 Tenant-Verhalten unverändert absichern

## 3. Frontend

- [x] 3.1 Root-Userliste als Plattform-Benutzer kennzeichnen und nicht unterstützte Row-Mutationen ausblenden
- [x] 3.2 Root-Rollenliste als Plattform-Rollen kennzeichnen und nicht unterstützte Row-Mutationen ausblenden
- [x] 3.3 Sync-/Reconcile-Diagnostik um Platform-Quelle ergänzen

## 4. Documentation

- [x] 4.1 PR-302-Testliste aktualisieren
- [x] 4.2 Runtime- und Keycloak-Runbooks um Platform-vs-Tenant-Sync ergänzen

## 5. Verification

- [x] 5.1 Backend-Tests für Platform-User/Rollen/Synchronisation
- [x] 5.2 Frontend-Tests für Root-/Tenant-Labeling
- [x] 5.3 Gezielte Nx-Unit-/Type-Checks ausführen
