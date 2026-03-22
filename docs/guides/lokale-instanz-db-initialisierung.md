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

- neuer lokaler Instanz wie `hb-meinquartier`
- zweiter lokaler Datenbank neben dem Standardprofil
- Wechsel auf eine andere Keycloak-Realm bei lokal laufender App
- Neuaufbau einer lokalen Instanz-Datenbank nach Drift oder Inkonsistenz

Nicht verwenden für:

- reguläre lokale Standardentwicklung gegen `de-musterhausen`
- Acceptance- oder Swarm-Serverdeployments

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
- `SVA_AUTH_ISSUER`
- `SVA_AUTH_CLIENT_ID`
- `SVA_AUTH_CLIENT_SECRET`
- `SVA_AUTH_STATE_SECRET`
- `KEYCLOAK_ADMIN_BASE_URL`
- `KEYCLOAK_ADMIN_REALM`
- `KEYCLOAK_ADMIN_CLIENT_ID`
- `KEYCLOAK_ADMIN_CLIENT_SECRET`

Wichtig:

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
  --target-instance-id=hb-meinquartier \
  --target-display-name="HB MeinQuartier" \
  --target-realm=saas-hb-meinquartier \
  --target-db-container=sva-studio-postgres-hb \
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
pnpm env:doctor:local-keycloak -- --local-override-file=config/runtime/local-keycloak.hb.local.vars --json
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
source config/runtime/local-keycloak.hb.production.local.vars
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

Wichtig:

- der Basiskatalog darf aus einer Referenzinstanz übernommen werden
- fachliche Nutzerkonten dürfen nicht blind von einer anderen Instanz kopiert werden

### Keycloak-Subjects

Das Skript liest aktive User aus der Ziel-Realm über die Keycloak-Admin-API und legt lokal an:

- `iam.accounts(instance_id, keycloak_subject, status)`
- `iam.instance_memberships(instance_id, account_id, membership_type)`

Damit passt die lokale IAM-Datenbank zur echten Realm und der Fehler `missing_actor_account` verschwindet.

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
