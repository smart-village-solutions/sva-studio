# Keycloak-Tenant-Realm-Bootstrap für Studio

## Ziel

Dieses Runbook beschreibt den minimalen Sollzustand eines tenant-spezifischen Keycloak-Realms für SVA Studio.
Es ergänzt die technische Service-Account-Doku um den fachlichen Vertrag für:

- Tenant-Realm
- OIDC-Client `sva-studio`
- Tenant-Admins
- Claims und Mapper

Der Fokus liegt auf dem frühen produktionsnahen Betrieb von `studio.smart-village.app` und Tenant-Hosts unter `https://<instanceId>.studio.smart-village.app`.

## Geltungsbereich

Dieses Dokument gilt für jeden Tenant-Realm, der über die Instanz-Registry an eine aktive Studio-Instanz gebunden ist, zum Beispiel:

- `bb-guben`
- `de-musterhausen`

Nicht Gegenstand dieses Dokuments:

- technischer Service-Account `sva-studio-iam-service`
- Rollen-Sync aus `iam.roles`
- vollständige Governance- oder Compliance-Freigaben

Dafür sind die Referenzen:

- [Keycloak Service-Account Setup für IAM-User- und Rollen-Management](./keycloak-service-account-setup-iam.md)
- [Keycloak-Rollen-Sync und Reconcile-Runbook](./keycloak-rollen-sync-runbook.md)

## Minimaler Realm-Vertrag

Jeder Tenant-Realm muss mindestens enthalten:

1. einen Realm mit exakt dem in `iam.instances.authRealm` hinterlegten Namen
2. den OIDC-Client `sva-studio`
3. tenant-spezifische Redirect- und Logout-Ziele
4. einen Protocol Mapper für den Claim `instanceId`
5. mindestens einen aktiven Tenant-Admin mit Rolle `system_admin`

Ohne diesen Zustand kann ein Login technisch zwar teilweise funktionieren, aber Studio erhält nicht zuverlässig den fachlichen Mandantenkontext.

## Führende Quelle

Die führende Quelle für die Realm- und Client-Zuordnung ist die Instanz-Registry:

- `iam.instances.authRealm`
- `iam.instances.authClientId`
- optional `iam.instances.authIssuerUrl`

Für den frühen Betriebsmodus wird dieser Vertrag am Root-Host `https://studio.smart-village.app/admin/instances` gepflegt.
Die Instanzverwaltung ist damit die operative Control Plane für:

- `authRealm`
- `authClientId`
- tenant-spezifisches OIDC-Client-Secret
- initialen Tenant-Admin-Bootstrap

Wichtige Regeln:

- das Client-Secret ist write-only und wird in Studio nur verschlüsselt gespeichert
- ein leeres Secret-Feld bedeutet "unverändert lassen"
- temporäre Admin-Passwörter werden nur für den Bootstrap-/Reset-Vorgang verwendet und nicht gespeichert
- Realm-, Client-, Mapper- und Tenant-Admin-Abgleich laufen idempotent über den expliziten Reconcile-Pfad

Für die App ist `instanceId` der fachliche Mandantenschlüssel. Der Keycloak-Realm muss diesen Schlüssel deshalb als OIDC-Claim an die App weitergeben.

## Studio-Workflow

Für neue oder bestehende Instanzen ist der Sollpfad:

1. Instanz am Root-Host unter `/admin/instances` öffnen oder anlegen
2. Realm-Basisdaten pflegen:
   - `authRealm`
   - `authClientId`
   - optional `authIssuerUrl`
   - Client-Secret
   - Tenant-Admin-Stammdaten
3. Keycloak-Status prüfen
4. Realm anwenden bzw. Reconcile ausführen
5. Tenant-Login und `/auth/me` gegen den Tenant-Host validieren

Direkte Änderungen in Keycloak bleiben für Notfälle möglich, gelten aber nicht als kanonischer Pflegepfad.

## OIDC-Client `sva-studio`

### Pflichtwerte

| Feld | Sollwert |
| --- | --- |
| `clientId` | `sva-studio` |
| Client-Typ | `Confidential` |
| Standard Flow | aktiviert |
| Service Accounts | nicht erforderlich für den Login-Client |

### Tenant-spezifische URLs

Für einen Realm `bb-guben` mit Tenant-Host `https://bb-guben.studio.smart-village.app` gilt:

| Feld | Sollwert |
| --- | --- |
| `rootUrl` | `https://bb-guben.studio.smart-village.app` |
| `redirectUris` | `["https://bb-guben.studio.smart-village.app/auth/callback"]` |
| `webOrigins` | `["https://bb-guben.studio.smart-village.app"]` |
| `post.logout.redirect.uris` | `https://bb-guben.studio.smart-village.app/;+` |

Analog dazu für jeden anderen Tenant-Realm:

- `de-musterhausen` -> `https://de-musterhausen.studio.smart-village.app`

Regel:

- Jeder Tenant-Realm enthält nur seine eigenen Tenant-URLs.
- Root-Host `https://studio.smart-village.app` gehört nicht in tenant-spezifische Client-Konfigurationen.
- Mischkonfigurationen mit Redirects anderer Tenants sind unzulässig.

## Claim-Vertrag für Studio

Studio erwartet im Login-/Session-Pfad mindestens:

- `sub`
- `instanceId`
- Rollen aus `realm_access.roles` und/oder `resource_access`

Der entscheidende Punkt ist:

- `instanceId` muss als OIDC-Claim im Token vorhanden sein
- ein bloßes Keycloak-User-Attribut ohne Mapper reicht nicht aus

## Protocol Mapper

Auf dem Client `sva-studio` muss pro Tenant-Realm ein Mapper für `instanceId` existieren.

### Sollzustand

| Feld | Sollwert |
| --- | --- |
| `name` | `instanceId` |
| `protocol` | `openid-connect` |
| `protocolMapper` | `oidc-usermodel-attribute-mapper` |
| `user.attribute` | `instanceId` |
| `claim.name` | `instanceId` |
| `jsonType.label` | `String` |
| `id.token.claim` | `true` |
| `access.token.claim` | `true` |
| `userinfo.token.claim` | `true` |

### Bedeutung

- Das User-Attribut `instanceId` wird in den OIDC-Claim `instanceId` transformiert.
- Ohne diesen Mapper kann Studio nach dem Login keine stabile Session mit Instanzkontext aufbauen.

## Benutzervertrag für Tenant-Admins

Ein Tenant-Admin benötigt mindestens:

- `username`
- `email`
- `firstName`
- `lastName`
- `enabled=true`
- sinnvollerweise `emailVerified=true`
- User-Attribut `instanceId=<tenant-id>`

Beispiel für `bb-guben`:

```text
username: admin@example.org
email: admin@example.org
attributes.instanceId = bb-guben
```

Beispiel für `de-musterhausen`:

```text
username: admin@example.org
email: admin@example.org
attributes.instanceId = de-musterhausen
```

## Rollenvertrag für Tenant-Admins

### Minimaler Standard

Für einen normalen Tenant-Admin im Studio gilt aktuell:

- `system_admin`

Explizit nicht Teil des Minimalstandards:

- `instance_registry_admin`

Begründung:

- `system_admin` reicht für die tenant-lokalen Admin-Funktionen wie Benutzer-, Rollen- und Gruppenverwaltung
- `instance_registry_admin` ist eine Plattformrolle für globale Instanzmutationen und soll nicht automatisch an Tenant-Admins gehen

### Optionale Zusatzrollen

Nur wenn die jeweilige Funktion tatsächlich benötigt wird:

- `iam_admin`
- `support_admin`
- `security_admin`
- `compliance_officer`
- `app_manager`
- `editor`

Diese Rollen sind bewusst nicht Teil des pauschalen Standard-Bootstraps.

## Alias-Regel

Studio akzeptiert aktuell zusätzlich den Realm-Rollen-Alias:

- `Admin` -> `system_admin`

Das ist ein Kompatibilitätspfad, vor allem für externe oder ältere Realm-Konfigurationen.
Für neue Tenant-Realms soll direkt `system_admin` verwendet werden.

## Prüfliste pro Tenant-Realm

Vor Freigabe eines Tenant-Realm müssen mindestens diese Punkte erfüllt sein:

1. `iam.instances.authRealm` zeigt auf den korrekten Realm
2. `iam.instances.authClientId = sva-studio`
3. Client `sva-studio` existiert im Realm
4. `rootUrl`, `redirectUris`, `webOrigins` und `post.logout.redirect.uris` sind tenant-spezifisch
5. Protocol Mapper `instanceId` existiert
6. mindestens ein aktiver Tenant-Admin existiert
7. Tenant-Admin hat `system_admin`
8. Tenant-Admin hat nicht automatisch `instance_registry_admin`
9. User-Attribut `instanceId` entspricht dem Tenant

## Smoke-Nachweis

Ein Realm gilt erst dann als betriebsbereit, wenn zusätzlich folgende Nachweise grün sind:

1. `GET https://<instanceId>.studio.smart-village.app/auth/login`
   - Redirect auf `/realms/<instanceId>/...`
2. erfolgreicher Login im Tenant-Realm
3. `/auth/me` liefert:
   - `sub`
   - `instanceId = <instanceId>`
   - erwartete Rollen

## Typische Fehlbilder

| Symptom | Wahrscheinliche Ursache |
| --- | --- |
| Login landet im richtigen Realm, aber Studio verhält sich wie Root | `instanceId`-Claim fehlt |
| User kann sich anmelden, aber Session ist tenant-los | Mapper für `instanceId` fehlt oder falsches User-Attribut |
| Tenant-Admin sieht globale Instanzverwaltung | Rolle `instance_registry_admin` versehentlich vergeben |
| Logout springt auf fremden Tenant oder Root | `post.logout.redirect.uris` oder `rootUrl` zu breit konfiguriert |
| Redirect nach Login zeigt falschen Host | `redirectUris` oder Realm-/Client-Zuordnung in `iam.instances` falsch |

## Verweise

- [Runtime-Profile für Lokal, Builder und Remote-Betrieb](../development/runtime-profile-betrieb.md)
- [Swarm-Deployment-Runbook](./swarm-deployment-runbook.md)
- [Keycloak Service-Account Setup für IAM-User- und Rollen-Management](./keycloak-service-account-setup-iam.md)
- [IAM-Acceptance-Runbook für die Paketabnahme](./iam-acceptance-runbook.md)
