# ADR-031: Tenant-spezifisches Realm-Auth-Routing

**Status:** Accepted
**Entscheidungsdatum:** 2026-04-02
**Entschieden durch:** IAM/Plattform Team
**GitHub Issue:** TBD
**GitHub PR:** TBD

## Kontext

Die Plattform löst Tenant-Hosts bereits über die Instanz-Registry auf, nutzt für OIDC und Keycloak-Admin jedoch weiterhin globale Konfiguration. Dadurch sind produktive 1:1-Realm-Isolation, tenant-lokale Logins und realm-spezifische Admin-Operationen nicht möglich.

## Entscheidung

- Jede produktive Instanz besitzt genau einen eigenen Keycloak-Realm.
- Tenant-Hosts starten Login, Callback und Logout selbst.
- Die Instanz-Registry ist die führende Quelle für `authRealm`, `authClientId` und optional `authIssuerUrl`.
- Provisioning erzeugt Realm und Standard-Client aktiv in Keycloak.
- Produktive Admin-Pfade lösen den Ziel-Realm aus der angefragten Instanz statt aus `KEYCLOAK_ADMIN_REALM` auf.

## Konsequenzen

### Positive Konsequenzen

- Strikte Realm-Isolation pro Instanz
- Tenant-lokale Redirect- und Logout-Flows ohne globalen Auth-Einstieg
- Einheitliche Realm-Auflösung für Runtime, Provisioning und IAM-Admin

### Negative Konsequenzen

- Höhere Komplexität in Auth-Resolver, Discovery-Cache und Provisioning
- Größerer Keycloak-Betriebsvertrag für Redirect-URLs, Rollen und Wiederaufnahme
- Übergangsaufwand für bestehende Runtime-Profile und aktive Instanzdaten

## Verwandte ADRs

- [ADR-020](ADR-020-kanonischer-auth-host-multi-host-grenze.md)
- [ADR-030](ADR-030-registry-basierte-instance-freigabe-und-provisioning.md)
