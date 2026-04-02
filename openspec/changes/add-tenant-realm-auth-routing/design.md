## Context

Die bestehende Multi-Tenant-Architektur löst Hosts bereits instanzbezogen auf, verwendet für OIDC und Keycloak-Admin jedoch weiterhin globale Env-Variablen. Dadurch bleiben Login, Logout, Reauth und IAM-Mutationen an einen einzelnen Realm gekoppelt.

## Decision

- Jede produktive Instanz besitzt genau einen Keycloak-Realm.
- Interaktive Auth-Flows starten, laufen und enden auf dem jeweiligen Tenant-Host.
- Die Instanz-Registry wird zur führenden Quelle für Realm- und Client-Auflösung.
- Provisioning erzeugt Realm und Standard-Client aktiv über die Keycloak-Admin-API.

## Technical Shape

- Neue Registry-Felder: `authRealm`, `authClientId`, optional `authIssuerUrl`
- Neuer Tenant-Auth-Resolver für Runtime- und Admin-Pfade
- Segmentierter OIDC-Discovery-Cache pro Issuer oder Instanz
- Dynamischer Keycloak-Admin-Client ohne globalen `KEYCLOAK_ADMIN_REALM`
- Mehrstufige Provisioning-Runs mit expliziten Keycloak-Step-Keys

## Risks

- Falsche Realm-Auflösung könnte Tenant-Isolation brechen; Resolver und Negativtests sind sicherheitskritisch.
- Tenant-lokale Redirect- und Logout-URLs erhöhen die Anforderungen an Keycloak-Provisioning und Runbooks.
- Bestehende lokale und Acceptance-Profile benötigen einen klaren Übergangspfad, bis alle aktiven Instanzen Auth-Metadaten besitzen.
