# Lokale Instanz-Datenbank initialisieren

## Ziel

Dieses Runbook beschreibt den verbindlichen Bootstrap-Pfad für eine neue lokale Instanz-Datenbank. Ziel ist ein reproduzierbarer Ablauf, der:

- eine leere Ziel-Datenbank anlegt oder wiederverwendet
- das aktuelle IAM-Schema einspielt
- den Laufzeit-User der App korrekt bootstrapped
- den Basiskatalog aus einer Referenzinstanz übernimmt
- die echten Keycloak-Subjects der Ziel-Realm lokal provisioniert

Damit werden die typischen Fehlerbilder `missing_actor_account`, `missing_instance_membership`, `rls_denied` und unvollständige lokale Instanz-Daten vermieden.

## Wann dieses Runbook gilt

Verwenden bei:

- neuer lokaler Instanz wie `demo2`
- zweiter lokaler Datenbank neben dem Standardprofil
- Wechsel auf eine andere Keycloak-Realm bei lokal laufender App
- Neuaufbau einer lokalen Instanz-Datenbank nach Drift oder Inkonsistenz

Nicht verwenden für:

- reguläre lokale Standardentwicklung gegen `de-musterhausen`
- Acceptance- oder Swarm-Serverdeployments
- normale tägliche `pnpm env:up:local-keycloak`-Starts gegen ein bereits fertig konfiguriertes System

Für die reguläre lokale Standardentwicklung gilt stattdessen:

- globaler Realm: `svs-intern-studio-staging`
- fachliche Test-Instanz: `de-musterhausen`
- jede Tenant-Instanz verwendet ihren eigenen `authRealm`
- der globale Realm dient lokal nur dem Root-/Plattform-Host und nicht als Shared-Realm für Tenant-Logins

## Voraussetzungen

- Docker-Container für die Ziel-Datenbank läuft lokal
- Admin-Zugriff auf die Ziel-Realm in Keycloak ist vorhanden
- Runtime-Datei für die Instanz ist vorbereitet
- die App wird lokal außerhalb von Docker betrieben

## Kanonischer Ablauf

### 1. Ziel-Datenbank und Runtime-Datei anlegen

Für jede neue lokale Instanz braucht ihr:

- eigenen Postgres-Container oder eigenen Port
- optional eigenen Adminer-Port
- eigene Runtime-Datei

Empfohlen:

- `config/runtime/local-keycloak.<instanz>.local.vars`
- `config/runtime/local-keycloak.<instanz>.production.local.vars`

Pflichtwerte:

- `SVA_ALLOWED_INSTANCE_IDS=<instanz>`
- `IAM_DATABASE_URL` auf die Ziel-Datenbank
- `SVA_LOCAL_POSTGRES_CONTAINER_NAME=<ziel-container>`
- `SVA_AUTH_ISSUER` nur für lokale Fallback-Pfade
- `SVA_AUTH_CLIENT_ID` nur für lokale Fallback-Pfade
- `SVA_AUTH_CLIENT_SECRET`
- `SVA_AUTH_STATE_SECRET`
- `KEYCLOAK_ADMIN_BASE_URL`
- `KEYCLOAK_ADMIN_REALM` als technischer Service-Account-Realm
- `KEYCLOAK_ADMIN_CLIENT_ID`
- `KEYCLOAK_ADMIN_CLIENT_SECRET`

Zusätzlich muss der Ziel-Instanzdatensatz in `iam.instances` gepflegt sein:

- `authRealm=<ziel-realm>`
- `authClientId=<oidc-client-id>`
- optional `authIssuerUrl=<issuer-url>`

Wichtig:

- `authRealm` in `iam.instances` ist der führende Ziel-Realm für Login, Rollen-CRUD und `POST /api/v1/iam/users/sync-keycloak`.
- Der User-Sync arbeitet fail-closed gegen diesen Ziel-Realm. Läuft er gegen einen instanzspezifischen Realm, dürfen Benutzer auch ohne `instanceId`-Attribut importiert werden; die Zuordnung erfolgt dann über den Realm-Kontext.
- Prüfe nach dem ersten Sync die Diagnosefelder des Sync-Reports oder des Summary-Logs: `authRealm`, `providerSource`, `matchedWithoutInstanceAttributeCount` und `skippedInstanceIds`.

- pro Instanz eigener `SVA_AUTH_SESSION_COOKIE`
- pro Instanz eigener `SVA_AUTH_LOGIN_STATE_COOKIE`
- pro Instanz eigener `SVA_AUTH_REDIS_KEY_PREFIX`

Ohne diese Trennung werden lokale Sessions zwischen Instanzen wiederverwendet und erzeugen falsche Actor-Kontexte.

### 2. Ziel-Datenbank bootstrapen

Der neue Standardpfad ist:

```bash
pnpm env:bootstrap:local-instance-db -- \
  --create-db \
  --import-schema \
  --target-instance-id=demo2 \
  --target-display-name="Demo 2" \
  --target-realm=demo2 \
  --target-db-container=sva-studio-postgres-demo2 \
  --source-db-container=sva-studio-postgres \
  --source-instance-id=de-musterhausen \
  --keycloak-admin-client-id=sva-studio-iam-service \
  --keycloak-admin-client-secret='<secret>'
```

Das Skript führt in Reihenfolge aus:

1. Ziel-Datenbank optional neu erzeugen
2. aktuelles Schema aus der Referenz-Datenbank importieren
3. App-DB-User und `iam_app` auf der Ziel-Datenbank anlegen
4. Basiskatalog aus der Referenzinstanz übernehmen
5. echte Keycloak-Subjects der Ziel-Realm als Accounts und Memberships provisionieren

### 3. Lokalen Zielzustand prüfen

Danach:

```bash
pnpm env:doctor:local-keycloak -- --local-override-file=config/runtime/local-keycloak.demo2.local.vars --json
```

Erwartung:

- `runtime-env` ist `ok`
- `health-live` ist `ok`
- `health-ready` ist `ok`
- `schema-guard` ist `ok`

### 4. Produktions-Bundle oder Dev-Server mit dem Instanzprofil starten

Für den lokalen Produktionslauf:

```bash
set -a
source config/runtime/local-keycloak.demo2.production.local.vars
set +a
cd apps/sva-studio-react
node .output/server/index.mjs
```

Danach im Browser neu anmelden. Alte Sessions einer anderen Instanz dürfen nicht weiterverwendet werden.

## Was das Skript konkret übernimmt

### Schema

Mit `--import-schema` wird das aktuelle Schema aus der Referenz-Datenbank importiert. Das vermeidet unvollständige manuelle Migrationen und lokale Drift bei:

- RLS-Policies
- kritischen Indizes
- zusätzlichen IAM-Tabellen

### App-DB-User

Das Skript bootstrapped:

- `iam_app`
- den konfigurierten App-User, standardmäßig `sva_app`

Damit funktioniert der Zugriff der lokalen App auf die neue Instanz-Datenbank ohne manuellen `psql`-Nachlauf.

### Basiskatalog

Aus der Referenzinstanz werden übernommen:

- `iam.instances`
- `iam.organizations`
- `iam.roles`
- `iam.permissions`
- `iam.role_permissions`

Zusätzlich liegen unter `packages/data/seeds/` tenant-spezifische SQL-Seeds für bekannte Umgebungen. Aktuell sind dort der vollständige Referenz-Seed für `de-musterhausen` sowie ein dedizierter IAM-Katalog-Seed für `bb-guben` hinterlegt.

Wichtig:

- der Basiskatalog darf aus einer Referenzinstanz übernommen werden
- Standard-Seeds behandeln geschützte Umgebungsidentität wie `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id` und `tenant_admin_client_id` für bestehende Instanzen nur noch additiv; bestehende lokale oder staging-nahe Werte dürfen dadurch nicht still überschrieben werden
- fachliche Nutzerkonten dürfen nicht blind von einer anderen Instanz kopiert werden

### Keycloak-Subjects

Das Skript liest aktive User aus der Ziel-Realm über die Keycloak-Admin-API und legt lokal an:

- `iam.accounts(instance_id, keycloak_subject, status)`
- `iam.instance_memberships(instance_id, account_id, membership_type)`

Damit passt die lokale IAM-Datenbank zur echten Realm und der Fehler `missing_actor_account` verschwindet.

Der Login-Pfad der App liest den Ziel-Realm lokal trotzdem aus der Instanz-Registry. Die globalen Variablen `SVA_AUTH_ISSUER` und `SVA_AUTH_CLIENT_ID` bleiben nur für lokale Fallback- oder Migrationspfade bestehen und sollen für neue Instanzen nicht mehr die führende Quelle sein.

Für Tenant-Hosts reicht die Registry-Auflösung allein nicht: Zusätzlich muss das tenant-spezifische `auth_client_secret` für die Zielinstanz vorhanden und lesbar sein. Fehlt dieses Secret, blockiert der Login-Pfad bewusst fail-closed statt auf das globale Plattform-Secret auszuweichen.

Wenn dieselbe lokale Umgebung später regulär über `pnpm env:up:local-keycloak` gegen `studio.localhost` gestartet wird, gilt für die Instanz-Registry jetzt ein read-only Vertrag:

- bestehende abweichende Werte werden nur als Drift gemeldet
- der Standardstart schreibt keine Identitätsfelder und keine Hostname-Primärzuordnung mehr zurück
- Korrekturen laufen nur explizit über `pnpm env:reconcile:local-instance-registry`
- autoritative Korrekturen laufen dabei nur explizit über `SVA_LOCAL_INSTANCE_IDENTITY_RECONCILE_MODE=authoritative`
- für staging-nahe oder CI-nahe lokale Prüfpfade kann `SVA_LOCAL_INSTANCE_IDENTITY_DRIFT_MODE=fail` gesetzt werden

## Empfohlene Optionen

Pflicht:

- `--target-instance-id`
- `--target-realm`
- `--keycloak-admin-client-id`
- `--keycloak-admin-client-secret`

Empfohlen:

- `--create-db`
- `--import-schema`
- `--target-db-container`
- `--source-db-container`
- `--source-instance-id`

Optional:

- `--target-display-name`
- `--target-app-db-user`
- `--target-app-db-password`
- `--page-size`
- `--skip-app-user-bootstrap`
- `--skip-catalog-sync`
- `--skip-keycloak-user-sync`

## Typische Fehlerbilder

- `missing_actor_account`
  - echte Keycloak-Subjects der Ziel-Realm fehlen lokal
  - Lösung: Keycloak-User-Sync erneut ausführen

- `missing_instance_membership`
  - Account existiert, aber Membership zur Zielinstanz fehlt
  - Lösung: Keycloak-User-Sync erneut ausführen oder Membership manuell prüfen

- `rls_denied`
  - meist Folgefehler aus falschem Actor-Kontext oder vermischten Sessions
  - Lösung: eigene Session-Cookies und Redis-Präfixe pro Instanz verwenden, dann neu anmelden

- `schema_drift`
  - Ziel-Datenbank wurde ohne aktuelles Schema oder mit unvollständigen Migrationen aufgebaut
  - Lösung: Ziel-Datenbank neu mit `--create-db --import-schema` bootstrapen

- App-User kann sich nicht anmelden
  - `sva_app` oder `iam_app` fehlen auf der Ziel-Datenbank
  - Lösung: Bootstrap ohne `--skip-app-user-bootstrap` wiederholen

## Instanz lokal hart löschen und neu bootstrapen

Für einen sauberen lokalen Neustart derselben Instanz-ID steht ein reiner Konsolenpfad zur Verfügung:

```bash
pnpm env:delete:local-instance-db -- \
  --target-instance-id=hb-meinquartier \
  --target-db-container=sva-studio-postgres-hb \
  --force
```

Optional:

- `--dry-run` zeigt nur den lokalen Löschumfang
- `--yes` überspringt die interaktive Bestätigung in TTY-Läufen
- `--target-db-name` und `--target-db-user` überschreiben die Standardwerte `sva_studio` und `sva`

Der Hard-Delete entfernt ausschließlich lokale Datenbankdaten der Zielinstanz:

- den Instanzdatensatz in `iam.instances`
- lokale Registry-, Hostname-, Provisioning- und Auditdaten
- lokale IAM-Katalog-, Membership- und Integrationsdaten
- lokale Content- und Media-Metadaten

Die expliziten `DELETE`-Statements greifen direkt auf `iam.activity_logs`, `iam.content_history`, `iam.contents` und `iam.instances`. Weitere instanzgebundene lokale IAM-, Registry- und Content-Daten werden über `ON DELETE CASCADE` an `iam.instances` mitentfernt; der Schema-Guard des Skripts blockiert den Hard-Delete, falls dafür unbekannte Nicht-Cascade-Tabellen im lokalen Schema auftauchen.

Bewusst **nicht** entfernt werden:

- Keycloak-Realm, Keycloak-User oder andere Keycloak-Artefakte
- Mainserver-Daten oder Mainserver-Credentials
- physische Media- oder Blob-Storage-Objekte

Wichtig:

- aktive lokale Instanzen dürfen nur mit explizitem `--force` gelöscht werden
- der Befehl ist nur für lokale Docker-Datenbanken gedacht und kein Remote-Admin-Pfad
- für dieselbe `instanceId` ist danach ein normaler Rebootstrap über `pnpm env:bootstrap:local-instance-db -- ...` vorgesehen

Beispiel für den direkten Rebootstrap nach dem Hard-Delete:

```bash
pnpm env:bootstrap:local-instance-db -- \
  --create-db \
  --import-schema \
  --target-instance-id=hb-meinquartier \
  --target-display-name="HB MeinQuartier" \
  --target-realm=saas-hb-meinquartier \
  --target-db-container=sva-studio-postgres-hb \
  --source-db-container=sva-studio-postgres \
  --source-instance-id=de-musterhausen \
  --keycloak-admin-client-id=sva-studio-iam-service \
  --keycloak-admin-client-secret='<secret>'
```

## Betriebsregeln

- niemals Userdaten einer anderen Instanz als vermeintlichen Seed kopieren
- lokale Instanzwechsel immer mit getrennten Cookie- und Redis-Namen fahren
- vor Browser-Debugging immer zuerst `env:doctor` auf das Zielprofil ausführen
- bei einer neuen Realm immer die echten Keycloak-Subjects synchronisieren

## Nachgelagerte Validierung

Nach erfolgreichem Bootstrap sind mindestens diese Pfade zu prüfen:

- `GET /health/live`
- `GET /health/ready`
- `GET /auth/login`
- `GET /api/v1/iam/me/context`
- `GET /api/v1/iam/users/me/profile`

Wenn diese Aufrufe im lokalen Instanzprofil grün sind, ist die lokale Instanz-Datenbank für die ersten fachlichen Tests ausreichend vorbereitet.
