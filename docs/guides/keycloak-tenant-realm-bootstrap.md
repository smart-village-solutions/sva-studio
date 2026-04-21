# Keycloak-Tenant-Realm-Bootstrap für Studio

Hinweis:
Die kanonische Betriebsbeschreibung für den Root-Host-Workflow liegt jetzt unter [Instanzverwaltung als Keycloak-Control-Plane](./instance-keycloak-provisioning.md). Dieses Dokument beschreibt den tenant-spezifischen Zielzustand im Realm selbst.

## Ziel

Dieses Runbook beschreibt den minimalen Sollzustand eines tenant-spezifischen Keycloak-Realms für SVA Studio.
Es ergänzt die technische Service-Account-Doku um den fachlichen Vertrag für:

- Tenant-Realm
- OIDC-Client `sva-studio`
- Tenant-Admins
- optionale Interop-Claims und Mapper

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
4. mindestens einen aktiven Tenant-Admin mit Rolle `system_admin`

Der Mandantenkontext für den Studio-Login stammt aus Host, Registry und Realm. Ein `instanceId`-Claim im Token ist nicht mehr Teil des harten Login-Vertrags.

## Führende Quelle

Die führende Quelle für die Realm- und Client-Zuordnung ist die Instanz-Registry:

- `iam.instances.authRealm`
- `iam.instances.authClientId`
- optional `iam.instances.authIssuerUrl`

Für den operativen Pflegepfad wird dieser Vertrag am Root-Host `https://studio.smart-village.app/admin/instances` geführt.
Die Instanzverwaltung ist damit die operative Control Plane für:

- `authRealm`
- `authClientId`
- tenant-spezifisches OIDC-Client-Secret oder dessen Erzeugung bei `new`
- initialen Tenant-Admin-Bootstrap

Wichtige Regeln:

- das Client-Secret ist write-only und wird in Studio nur verschlüsselt gespeichert
- bei `existing` bedeutet ein leeres Secret-Feld "unverändert lassen"
- bei `new` wird kein Secret als Eingabe erwartet; es wird beim Provisioning erzeugt und danach in Studio gespeichert
- temporäre Admin-Passwörter werden nur für den Bootstrap-/Reset-Vorgang verwendet und nicht gespeichert
- Realm-, Client-, optionale Mapper- und Tenant-Admin-Abgleiche laufen idempotent über den expliziten Provisioning-Pfad

Für die App ist `instanceId` weiterhin der fachliche Mandantenschlüssel. Im Login-Pfad leitet Studio diesen Wert für tenant-spezifische Realms aus dem bereits verifizierten Host-/Registry-/Realm-Scope ab.

## Studio-Workflow

Der vollständige Root-Host-Workflow mit Preflight, Realm-Modus, Plan, Ausführung und Protokoll ist unter [Instanzverwaltung als Keycloak-Control-Plane](./instance-keycloak-provisioning.md) beschrieben.

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
- Rollen aus `realm_access.roles` und/oder `resource_access`

Der entscheidende Punkt ist:

- Der Tenant-Kontext `instanceId` wird bei Tenant-Hosts aus Registry und Realm-Scope in die Session geschrieben.
- Ein fehlender benutzerbezogener OIDC-Claim `instanceId` blockiert den Login nicht.
- Ein vorhandener, aber widersprüchlicher `instanceId`-Claim ist Konfigurationsdrift und wird fail-closed als Scope-Konflikt behandelt.

## Protocol Mapper

Auf dem Client `sva-studio` darf pro Tenant-Realm ein Mapper für `instanceId` existieren. Er ist nützlich für Interoperabilität, Exporte und Diagnose, aber kein hartes Login-Gate.

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
- Ohne diesen Mapper baut Studio weiterhin eine stabile Tenant-Session aus Host, Registry und Realm auf.
- Wenn der Mapper vorhanden ist, muss sein Claim zum Host-/Realm-Scope passen.

## Benutzervertrag für Tenant-Admins

Ein Tenant-Admin benötigt mindestens:

- `username`
- `email`
- `firstName`
- `lastName`
- `enabled=true`
- sinnvollerweise `emailVerified=true`
- optional User-Attribut `instanceId=<tenant-id>` für Interop und Diagnose

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
3. `rootUrl`, `redirectUris`, `webOrigins` und `post.logout.redirect.uris` passen exakt zum Tenant-Host
4. ein Tenant-Admin existiert mit:
   - Rolle `system_admin`
   - ohne Rolle `instance_registry_admin`
5. das Tenant-Client-Secret ist bei `existing` mit der Registry abgeglichen oder wurde bei `new` erfolgreich erzeugt und zurückgeschrieben

Zusätzlich sichtbar, aber nicht login-blockierend:

- Protocol Mapper `instanceId`
- `attributes.instanceId = <instanceId>` am Tenant-Admin

## Operativer Freigabehinweis

Für den täglichen Betrieb gilt:

- Die Realm-Existenz oder ein erfolgreiches Provisioning allein reichen nicht als Freigabe.
- Eine Instanz ist erst dann betriebsbereit, wenn die Detailseite unter `/admin/instances/<instanceId>` alle login-blockierenden Prüfpunkte grün zeigt. Optionale Interop-Hinweise dürfen als Warnung sichtbar bleiben.
- Bei bestehenden Realms ist Secret-Drift der häufigste verbleibende Fehler. Der Standard-Fix ist `Rotate client secret`.

Die vollständige Root-Host-Bedienfolge steht unter [Instanzverwaltung als Keycloak-Control-Plane](./instance-keycloak-provisioning.md).

## Traceability-Matrix für Studio-Felder und Keycloak-Artefakte

Die folgende Matrix ist die schlanke Referenz dafür, welche Eingaben in Studio zu welchen Keycloak-Artefakten führen. Sie dient als gemeinsame Grundlage für UI, Registry, Worker und Statusanzeige.

| Studio-/Registry-Feld | Keycloak-Ziel | Erwarteter Zustand |
| --- | --- | --- |
| `realmMode` + `authRealm` | Realm | `existing`: Realm existiert bereits. `new`: Realm darf angelegt werden. |
| `authClientId` | OIDC-Client | Client existiert im Tenant-Realm. |
| `instanceId` + `parentDomain` | `rootUrl`, `redirectUris`, `webOrigins`, `post.logout.redirect.uris` | Alle URLs zeigen ausschließlich auf den Tenant-Host. |
| `instanceId` | Protocol Mapper `instanceId` | Optionales Interop-Artefakt; Claim wird in ID-, Access- und Userinfo-Token ausgegeben, ist aber kein Login-Gate. |
| `authClientSecret` | Client-Secret | `existing`: Das in der Registry gespeicherte Secret entspricht dem aktiven Keycloak-Secret. `new`: Das Secret wird beim Provisioning erzeugt und danach in der Registry gespeichert. |
| `tenantAdminBootstrap.username` | Tenant-Admin-User | User existiert. |
| `tenantAdminBootstrap.firstName`, `lastName`, `email` | Tenant-Admin-Userprofil | Stammdaten sind auf dem User gepflegt. |
| `tenantAdminBootstrap.username` | Realm-Rolle `system_admin` | Rolle ist zugewiesen. |
| `tenantAdminBootstrap.username` | Realm-Rolle `instance_registry_admin` | Rolle ist nicht zugewiesen. |
| `instanceId` + `tenantAdminBootstrap.username` | User-Attribut `instanceId` | Optionales Interop-/Diagnoseartefakt; Abweichungen blockieren den Login nicht. |

Fehlende Pflichtpunkte verhindern die Login-Bereitschaft. Fehlende optionale Interop-Artefakte bleiben als Diagnosehinweis sichtbar.

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
| Login landet im richtigen Realm, aber Studio verhält sich wie Root | Registry-/Realm-Auflösung oder Session-Scope prüfen |
| Login endet mit Scope-Konflikt | vorhandener `instanceId`-Claim widerspricht Host-/Realm-Scope |
| Tenant-Admin sieht globale Instanzverwaltung | Rolle `instance_registry_admin` versehentlich vergeben |
| Logout springt auf fremden Tenant oder Root | `post.logout.redirect.uris` oder `rootUrl` zu breit konfiguriert |
| Redirect nach Login zeigt falschen Host | `redirectUris` oder Realm-/Client-Zuordnung in `iam.instances` falsch |

## Verweise

- [Runtime-Profile für Lokal, Builder und Remote-Betrieb](../development/runtime-profile-betrieb.md)
- [Swarm-Deployment-Runbook](./swarm-deployment-runbook.md)
- [Keycloak Service-Account Setup für IAM-User- und Rollen-Management](./keycloak-service-account-setup-iam.md)
- [IAM-Acceptance-Runbook für die Paketabnahme](./iam-acceptance-runbook.md)
