# Instanzverwaltung als Keycloak-Control-Plane

## Ziel

Dieses Dokument beschreibt den kanonischen Betriebs- und Bedienpfad für tenant-spezifisches Keycloak-Provisioning über die Root-Host-Instanzverwaltung unter `/admin/instances`.

Die Instanzverwaltung ist die führende Control Plane für:

- Registry-Metadaten der Instanz
- Realm-Modus `new` oder `existing`
- tenant-spezifisches Login-Client-Secret oder dessen automatische Erzeugung bei `new`
- Tenant-Admin-Bootstrap
- Preflight, Plan, Ausführung und Protokoll des Keycloak-Abgleichs

Die Detaildokumente zu Realm-Vertrag und Service-Account bleiben bestehen, sind aber nur noch Referenzdokumente:

- [Keycloak-Tenant-Realm-Bootstrap für Studio](./keycloak-tenant-realm-bootstrap.md)
- [Keycloak Service-Account Setup für IAM-User- und Rollen-Management](./keycloak-service-account-setup-iam.md)

## Führende Quellen

- Registry ist führend für `authRealm`, `authClientId`, optional `authIssuerUrl`, `realmMode`, Tenant-Secret-Status und Tenant-Admin-Stammdaten.
- Keycloak ist führend für den tatsächlich angewendeten Realm-, Client- und User-Zustand.
- Temporäre Passwörter bleiben write-only und werden nicht persistiert.

Wichtig:

- `Instanzdaten speichern` schreibt nur Registry-Daten.
- `Provisioning ausführen` gleicht Keycloak gegen den gespeicherten Sollzustand ab.
- Bei `existing` bedeutet ein leeres Secret-Feld weiterhin "bestehenden Wert unverändert lassen".
- Bei `new` wird kein Secret als Benutzereingabe erwartet; es entsteht erst beim Provisioning und wird danach in die Registry zurückgeschrieben.

## Verbindliche Soll-/Ist-Checkliste

Die Instanzverwaltung und der Provisioning-Worker verwenden für den fachlichen Mindestzustand dieselbe kompakte Checkliste. Jeder Punkt muss im Detailstatus und nach dem letzten erfolgreichen Run grün sein.

| Pflichtpunkt | Führende Quelle in Studio/Registry | Zielartefakt in Keycloak | Prüfkriterium | Automatische Aktion |
| --- | --- | --- | --- | --- |
| Realm | `realmMode`, `authRealm` | Realm `<authRealm>` | Realm existiert oder darf im Modus `new` erstellt werden | Realm anlegen oder Bestands-Realm validieren |
| OIDC-Client | `authClientId` | Client `<authClientId>` | Client existiert | Client anlegen oder aktualisieren |
| Redirect-URIs | `instanceId`, `parentDomain`, `primaryHostname` | `client.redirectUris` | Redirect-Ziele stimmen exakt | Client-URLs abgleichen |
| Logout-URIs | `instanceId`, `parentDomain`, `primaryHostname` | `client.attributes.post.logout.redirect.uris` | Logout-Ziele stimmen exakt | Client-URLs abgleichen |
| Web-Origins | `instanceId`, `parentDomain`, `primaryHostname` | `client.webOrigins` | Origins stimmen exakt | Client-URLs abgleichen |
| `instanceId`-Mapper | `instanceId` | Protocol Mapper `instanceId` | Optionaler Interop-Hinweis; Mapper existiert oder fehlt sichtbar als Warnung | Mapper anlegen oder korrigieren |
| Tenant-Secret | `authClientSecret` | Client-Secret des Login-Clients | `existing`: Registry-Secret und Keycloak-Secret sind identisch. `new`: Secret wird beim Provisioning erzeugt und danach in die Registry zurückgeschrieben. | Secret setzen, erzeugen, rotieren und Rückschreiben in die Registry |
| Tenant-Admin | `tenantAdminBootstrap.*` | User `<username>` | User existiert | User anlegen oder aktualisieren |
| Rolle `system_admin` | `tenantAdminBootstrap.username` | Realm-Rolle auf Tenant-Admin | Rolle vorhanden | Rollen synchronisieren |
| Ausschluss `instance_registry_admin` | `tenantAdminBootstrap.username` | Realm-Rolle auf Tenant-Admin | Rolle ist nicht zugewiesen | Rollen synchronisieren |
| User-Attribut `instanceId` | `instanceId`, `tenantAdminBootstrap.username` | `attributes.instanceId` am Tenant-Admin | Optionaler Interop-Hinweis; Attribut entspricht der Instanz-ID oder fehlt sichtbar als Warnung | User-Attribute aktualisieren |

Wichtig:

- Diese Checkliste ist bewusst klein. Realm, Client, URLs, Secrets, Tenant-Admin und Rollen sind login-blockierend; Mapper und User-Attribut bleiben sichtbare Interop-/Diagnosepunkte.
- Die UI-Schritte `Realm`, `Client`, `Mapper`, `Tenant-Secret` und `Tenant-Admin` gruppieren jeweils genau diese Pflichtpunkte.
- Ein Provisioning-Lauf gilt für den Login-Pfad als erfolgreich, wenn alle login-blockierenden Punkte erfüllt sind. Optionale Interop-Hinweise dürfen danach weiter sichtbar bleiben.

## Vorbedingungen

Vor jeder Keycloak-Mutation führt Studio einen zweistufigen Preflight aus:

1. Plattformzugriff prüfen
   - Root-Host
   - aktueller Benutzer hat `instance_registry_admin`
2. Technische Ausführbarkeit prüfen
   - Ziel-Realm ist erreichbar oder darf erstellt werden
   - Tenant-Secret ist bei `existing` vorhanden, wenn der Ziel-Client es benötigt
   - bei `new` ist fehlendes Tenant-Secret kein Blocker, sondern erwarteter Vorzustand
   - der technische Keycloak-Admin-Zugang kann den Ziel-Realm verwalten

Ein blockierter Preflight verhindert die Ausführung. Die UI zeigt die Blocker explizit an.

## Realm-Modi

### Neuer Realm

Verwendung für neue Tenants ohne vorhandenen Realm.

Sollverhalten:

- Realm wird erstellt
- Login-Client wird erstellt oder vollständig eingerichtet
- Client-Secret wird von Keycloak erzeugt und anschließend in der Registry gespeichert
- optionaler `instanceId`-Mapper wird angelegt
- Realm-Rollen werden sichergestellt
- Tenant-Admin wird angelegt oder aktualisiert

### Bestehender Realm

Verwendung für Tenants mit bereits vorhandenem Realm.

Sollverhalten:

- Realm wird gelesen und validiert
- bestehende Drift wird im Plan angezeigt
- nur der dokumentierte Sollzustand wird korrigiert
- kein stilles Fallback auf "Realm neu erstellen"

## Geführter Ablauf in der UI

Die Detailseite einer Instanz folgt einem festen Ablauf:

1. Vorbedingungen
2. Realm-Modus
3. Konfiguration
4. Vorschau
5. Ausführen
6. Protokoll

Die UI trennt bewusst zwischen:

- `Instanzdaten speichern`
- `Provisioning ausführen`

Zusatzaktionen wie `Tenant-Admin zurücksetzen` oder `Client-Secret rotieren` laufen als benannte Provisioning-Intents und nicht mehr als unscharfer Sammel-Reconcile.

## Kompakte Betriebs-Checkliste für neue Instanzen

Diese Kurzfassung ist der empfohlene operative Standardpfad für neue oder zu reparierende Instanzen unter `/admin/instances`.

1. Instanz anlegen oder bestehende Instanz öffnen.
2. `Realm mode` korrekt setzen:
   - vorhandener Realm: `Existing realm`
   - neuer Realm: `New realm`
3. Pflichtwerte prüfen:
   - `instanceId`
   - `parentDomain`
   - `authRealm`
   - `authClientId = sva-studio`
4. Tenant-Admin-Stammdaten vollständig pflegen:
   - `username`
   - `email`
   - `firstName`
   - `lastName`
5. Bei `existing` das vorhandene Tenant-Secret pflegen oder für einen späteren Abgleich leer lassen.
6. `Instanz speichern`.
7. `Check preflight` ausführen.
8. `Load provisioning preview` ausführen.
9. `Execute provisioning` ausführen.
10. Wenn `Tenant client secret aligned with Keycloak` noch nicht grün ist:
    - `Rotate client secret`
    - danach Status erneut laden und nur bei weiterem Drift erneut provisionieren
11. Erst wenn alle login-blockierenden Checklistenpunkte grün sind:
    - `Activate`

## Validierte Fallstricke aus dem Live-Betrieb

Die folgenden Punkte wurden auf `studio.smart-village.app` mit den Instanzen `hb-meinquartier`, `bb-guben` und `de-musterhausen` praktisch validiert:

- `Active` in der Übersicht allein reicht nicht als Freigabekriterium.
  Maßgeblich ist die vollständige grüne Checkliste auf der Detailseite.
- Ein bestehender Realm darf nicht versehentlich auf `New realm` stehen.
  Dieser Fehler führt zu einem fachlich falschen Provisioning-Pfad.
- Das Tenant-Admin-Profil muss vollständig gepflegt sein.
  Fehlende Stammdaten blockieren oder verfälschen den Bootstrap.
- Der häufigste Restfehler bei `existing` ist Secret-Drift.
  In diesem Fall zuerst `Rotate client secret` verwenden.
- `Provisioning succeeded` ist das technische Erfolgssignal im Protokoll.
  Die Instanz gilt aber erst dann als sauber, wenn danach auch alle fachlichen Checklistenpunkte grün sind.

## Provisioning-Plan

Vor der Ausführung erstellt Studio einen Plan mit Drift-Zusammenfassung und Schritten.

Typische Planschritte:

- Realm erstellen oder vorhandenen Realm validieren
- OIDC-Client abgleichen
- Redirect-/Logout-/Origin-Werte korrigieren
- optionalen `instanceId`-Mapper sicherstellen
- Tenant-Secret abgleichen
- Realm-Rollen sicherstellen
- Tenant-Admin erstellen oder aktualisieren
- optional temporäres Passwort setzen und `UPDATE_PASSWORD` markieren

Der Plan ist read-only und zeigt, was erstellt, geändert, übersprungen oder blockiert würde.

## Ausführung und Protokoll

Jeder Provisioning-Lauf wird als eigener Run mit Schritten persistiert. Die UI zeigt:

- `mode`
- `intent`
- `overallStatus`
- `driftSummary`
- `requestId`
- chronologische Schrittliste

Jeder Schritt enthält mindestens:

- `stepKey`
- `title`
- `status`
- `startedAt`
- `finishedAt`
- `summary`
- optionale technische `details`
- `requestId`

Erlaubte Schrittzustände:

- `pending`
- `running`
- `done`
- `failed`
- `skipped`
- `unchanged`

## Minimaler Sollzustand pro Tenant

Das Provisioning stellt mindestens folgenden Zustand sicher:

- Realm `authRealm` existiert
- OIDC-Client `authClientId` existiert
- `rootUrl`, `redirectUris`, `webOrigins` und `post.logout.redirect.uris` sind tenant-spezifisch
- Realm-Rolle `system_admin` existiert
- Realm-Rolle `instance_registry_admin` existiert nur für Plattformpfade, nicht als Default-Rolle des Tenant-Admins
- Tenant-Admin existiert, trägt `system_admin` und hat nicht `instance_registry_admin`

Optional und weiter diagnostizierbar:

- Protocol Mapper `instanceId` existiert
- Tenant-Admin besitzt das korrekte User-Attribut `instanceId`

## Rollen- und Rechte-Modell

- `instance_registry_admin` ist eine Plattformrolle und bleibt Root-Host-exklusiv.
- `system_admin` ist die minimale Tenant-Admin-Rolle für tenant-lokale Admin-Funktionen.
- Tenant-Admins erhalten im Bootstrap nicht automatisch `instance_registry_admin`.

## Secret-Policy

- Das Tenant-Client-Secret wird verschlüsselt in der Registry gespeichert.
- Antworten und Protokolle zeigen nur den Konfigurationszustand, nie den Klartext.
- Bei `existing` schreibt Provisioning den gespeicherten Secret-Wert nach Keycloak oder gleicht ihn dagegen ab.
- Bei `new` liest Provisioning das neu erzeugte Secret aus Keycloak zurück und speichert es anschließend verschlüsselt in der Registry.
- Secret-Rotation ist eine bewusste Aktion mit eigenem Intent und kein Nebeneffekt eines normalen Speichervorgangs.

## Fehler- und Retry-Verhalten

- Es gibt kein stilles Fallback zwischen den Realm-Modi.
- Teilfehler markieren den Run als `failed`.
- Wiederholte Ausführung ist idempotent.
- Bereits erfüllte Schritte dürfen bei Wiederholung als `unchanged` oder `skipped` enden.

## Betriebsnachweis

Ein Tenant gilt erst dann als betriebsbereit, wenn zusätzlich folgende Nachweise grün sind:

1. Preflight ist `ready`
2. Plan ist nicht `blocked`
3. letzter Provisioning-Run ist `succeeded`
4. Tenant-Login gegen `https://<instanceId>.studio.smart-village.app/auth/login` funktioniert
5. `/auth/me` liefert den korrekten `instanceId`-Kontext aus Host, Registry und Realm

## Referenzen

- [Keycloak-Tenant-Realm-Bootstrap für Studio](./keycloak-tenant-realm-bootstrap.md)
- [Keycloak Service-Account Setup für IAM-User- und Rollen-Management](./keycloak-service-account-setup-iam.md)
- [Deployment-Runbook: IAM Account- und Admin-UI](./iam-deployment-runbook.md)
