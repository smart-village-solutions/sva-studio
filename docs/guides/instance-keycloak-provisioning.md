# Instanzverwaltung als Keycloak-Control-Plane

## Ziel

Dieses Dokument beschreibt den kanonischen Betriebs- und Bedienpfad für tenant-spezifisches Keycloak-Provisioning über die Root-Host-Instanzverwaltung unter `/admin/instances`.

Die Instanzverwaltung ist die führende Control Plane für:

- Registry-Metadaten der Instanz
- Realm-Modus `new` oder `existing`
- tenant-spezifisches Login-Client-Secret
- Tenant-Admin-Bootstrap
- Preflight, Plan, Ausführung und Protokoll des Keycloak-Abgleichs

Die Detaildokumente zu Realm-Vertrag und Service-Account bleiben bestehen, sind aber nur noch Referenzdokumente:

- [Keycloak-Tenant-Realm-Bootstrap für Studio](./keycloak-tenant-realm-bootstrap.md)
- [Keycloak Service-Account Setup für IAM-User- und Rollen-Management](./keycloak-service-account-setup-iam.md)

## Führende Quellen

- Registry ist führend für `authRealm`, `authClientId`, optional `authIssuerUrl`, `realmMode`, Tenant-Secret und Tenant-Admin-Stammdaten.
- Keycloak ist führend für den tatsächlich angewendeten Realm-, Client- und User-Zustand.
- Temporäre Passwörter bleiben write-only und werden nicht persistiert.

Wichtig:

- `Instanzdaten speichern` schreibt nur Registry-Daten.
- `Provisioning ausführen` gleicht Keycloak gegen den gespeicherten Sollzustand ab.
- Ein leeres Secret-Feld bedeutet weiterhin "bestehenden Wert unverändert lassen".

## Vorbedingungen

Vor jeder Keycloak-Mutation führt Studio einen zweistufigen Preflight aus:

1. Plattformzugriff prüfen
   - Root-Host
   - aktueller Benutzer hat `instance_registry_admin`
2. Technische Ausführbarkeit prüfen
   - Ziel-Realm ist erreichbar oder darf erstellt werden
   - Tenant-Secret ist vorhanden, wenn der Ziel-Client es benötigt
   - der technische Keycloak-Admin-Zugang kann den Ziel-Realm verwalten

Ein blockierter Preflight verhindert die Ausführung. Die UI zeigt die Blocker explizit an.

## Realm-Modi

### Neuer Realm

Verwendung für neue Tenants ohne vorhandenen Realm.

Sollverhalten:

- Realm wird erstellt
- Login-Client wird erstellt oder vollständig eingerichtet
- `instanceId`-Mapper wird angelegt
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

## Provisioning-Plan

Vor der Ausführung erstellt Studio einen Plan mit Drift-Zusammenfassung und Schritten.

Typische Planschritte:

- Realm erstellen oder vorhandenen Realm validieren
- OIDC-Client abgleichen
- Redirect-/Logout-/Origin-Werte korrigieren
- `instanceId`-Mapper sicherstellen
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
- Protocol Mapper `instanceId` existiert
- Realm-Rolle `system_admin` existiert
- Realm-Rolle `instance_registry_admin` existiert nur für Plattformpfade, nicht als Default-Rolle des Tenant-Admins
- Tenant-Admin existiert und trägt mindestens `system_admin`

## Rollen- und Rechte-Modell

- `instance_registry_admin` ist eine Plattformrolle und bleibt Root-Host-exklusiv.
- `system_admin` ist die minimale Tenant-Admin-Rolle für tenant-lokale Admin-Funktionen.
- Tenant-Admins erhalten im Bootstrap nicht automatisch `instance_registry_admin`.

## Secret-Policy

- Das Tenant-Client-Secret wird verschlüsselt in der Registry gespeichert.
- Antworten und Protokolle zeigen nur den Konfigurationszustand, nie den Klartext.
- Provisioning schreibt den gespeicherten Secret-Wert nach Keycloak oder gleicht ihn dagegen ab.
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
5. `/auth/me` liefert den korrekten `instanceId`-Kontext

## Referenzen

- [Keycloak-Tenant-Realm-Bootstrap für Studio](./keycloak-tenant-realm-bootstrap.md)
- [Keycloak Service-Account Setup für IAM-User- und Rollen-Management](./keycloak-service-account-setup-iam.md)
- [Deployment-Runbook: IAM Account- und Admin-UI](./iam-deployment-runbook.md)
