## 1. Spezifikation und Architektur

- [ ] 1.1 Delta-Specs für `deployment-topology`, `iam-core` und `architecture-documentation` anlegen
- [ ] 1.2 ADR für tenant-spezifisches Realm-Routing und tenant-lokale Auth-Flows erstellen

## 2. Datenmodell und Verträge

- [ ] 2.1 Registry-Datenmodell um `authRealm`, `authClientId` und optional `authIssuerUrl` erweitern
- [ ] 2.2 Create-/Read-Verträge der Instanzverwaltung und zugehörige Typen aktualisieren
- [ ] 2.3 Unit- und Type-Tests für die erweiterten Registry-Verträge ergänzen

## 3. Runtime und Admin-Integration

- [ ] 3.1 Tenant-spezifischen Auth-Resolver und segmentierten OIDC-Cache einführen
- [ ] 3.2 Login, Callback, Logout und Session-Refresh tenant-lokal auflösen
- [ ] 3.3 Keycloak-Admin-Client und IAM-Pfade auf dynamischen Ziel-Realm umstellen
- [ ] 3.4 Provisioning für Realm-/Client-Erzeugung und Wiederaufnahme implementieren

## 4. Betrieb und Verifikation

- [ ] 4.1 Runtime-Profile, Deploy-Checks und Runbooks aktualisieren
- [ ] 4.2 Betroffene Unit-, Type-, Integrations- und E2E-Tests ausführen
- [ ] 4.3 `openspec validate add-tenant-realm-auth-routing --strict` erfolgreich ausführen
