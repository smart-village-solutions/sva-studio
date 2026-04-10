## 1. Spezifikation und Architektur

- [x] 1.0 Die vorausgesetzte Rollout-Basis aus `update-studio-swarm-migration-job`, `update-quantum-ops-decoupling`, `update-rollout-observability-gates`, `update-studio-rollout-network-consistency` und `update-studio-operational-drift-controls` bestaetigen
- [x] 1.1 Delta-Specs für `deployment-topology`, `iam-core` und `architecture-documentation` anlegen
- [x] 1.2 ADR für tenant-spezifisches Realm-Routing und tenant-lokale Auth-Flows erstellen

## 2. Datenmodell und Verträge

- [x] 2.1 Registry-Datenmodell um `authRealm`, `authClientId` und optional `authIssuerUrl` erweitern
- [x] 2.2 Create-/Read-Verträge der Instanzverwaltung und zugehörige Typen aktualisieren
- [x] 2.3 Unit- und Type-Tests für die erweiterten Registry-Verträge ergänzen

## 3. Runtime und Admin-Integration

- [x] 3.1 Tenant-spezifischen Auth-Resolver und segmentierten OIDC-Cache einführen
- [x] 3.2 Login, Callback, Logout und Session-Refresh tenant-lokal auflösen
- [x] 3.3 Keycloak-Admin-Client und IAM-Pfade auf dynamischen Ziel-Realm umstellen
- [x] 3.4 Provisioning für Realm-/Client-Erzeugung und Wiederaufnahme implementieren

## 4. Betrieb und Verifikation

- [x] 4.1 Runtime-Profile, Deploy-Checks und Runbooks auf tenant-spezifische Auth-Konfiguration aktualisieren, ohne die bestehende Rollout-Mechanik erneut zu definieren
- [x] 4.2 Betroffene Unit-, Type-, Integrations- und E2E-Tests ausführen
- [x] 4.3 `openspec validate add-tenant-realm-auth-routing --strict` erfolgreich ausführen
