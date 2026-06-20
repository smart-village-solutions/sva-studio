# Lokale Entwicklung mit Instanz-Registry

## Ziel

Diese Anleitung beschreibt den lokalen Standardpfad und den registry-nahen Multi-Tenant-Pfad für die neue Instanz-Registry.

## Unterstützte Hosts

- Root-Host: `studio.localhost`
- Tenant-Hosts: `<instanceId>.studio.localhost`

`.localhost` ist als lokaler Loopback-Namensraum reserviert und erlaubt reproduzierbare Host-Tests ohne eigene `/etc/hosts`-Einträge.

## Voraussetzungen

- `IAM_DATABASE_URL` zeigt auf die lokale IAM-Postgres-Datenbank
- Migration `0025_iam_instance_registry_provisioning.sql` ist ausgerollt
- lokale Seeds enthalten mindestens zwei aktive Instanzen und einen negativen Fall
- für Browser- oder Playwright-Tests ist `SVA_PARENT_DOMAIN=studio.localhost` gesetzt
- die Dev- oder Playwright-Instanz erlaubt `studio.localhost` und `*.studio.localhost` als lokale Hosts
- im Standardprofil `local-keycloak` ist `svs-intern-studio-staging` der globale Keycloak-Realm und `de-musterhausen` die fachliche Test-Instanz

## Schneller Standardpfad

1. IAM-Migrationen ausführen.
2. lokale Seeds laden
3. App auf dem Root-Host starten
4. `http://studio.localhost:3000` öffnen
5. Tenant-Kontexte über `http://<instanceId>.studio.localhost:3000` prüfen

Empfohlene Seed-Instanzen:

- `de-musterhausen`
- `demo2`
- `demo`
- negativer Fall über unbekannten Host, zum Beispiel `blocked.studio.localhost`

Verifikation:

```bash
curl -i http://studio.localhost:3000/
curl -i http://demo2.studio.localhost:3000/
curl -i http://blocked.studio.localhost:3000/auth/me
```

## Registry-naher Multi-Tenant-Pfad

1. Root-Host unter `studio.localhost` verwenden
2. Instanzen über `/admin/instances` oder die Ops-CLI anlegen
3. nach erfolgreicher Anlage Tenant-Host direkt öffnen
4. unbekannte oder suspendierte Hosts auf identisches fail-closed-Verhalten prüfen

Hinweis zum lokalen Realm-Modell:

- Auch im Profil `local-keycloak` benötigt jeder Tenant einen eigenen Realm.
- Der globale Realm `svs-intern-studio-staging` ist nur für den Root-/Plattform-Host vorgesehen und ersetzt keine tenant-spezifischen Realms.
- Neue lokale Test-Instanzen müssen deshalb mit einem eigenen `authRealm` angelegt und gegen diesen Realm geprüft werden.

Verifikation:

```bash
pnpm exec tsx scripts/ops/instance-registry.ts create \
  --instance-id demo2 \
  --display-name "Demo 2" \
  --parent-domain studio.localhost \
  --auth-realm demo2 \
  --auth-client-id sva-studio \
  --actor-id local-admin
pnpm exec tsx scripts/ops/instance-registry.ts activate \
  --instance-id demo2 \
  --actor-id local-admin
curl -i http://demo2.studio.localhost:3000/
```

Für Playwright ist der offizielle Multi-Tenant-Pfad:

```bash
PLAYWRIGHT_BASE_URL=http://studio.localhost:4173 \
PLAYWRIGHT_TENANT_LOGIN_URL=http://demo2.studio.localhost:4173/auth/login?returnTo=%2Fadmin%2Finstances \
pnpm nx run sva-studio-react:test:e2e -- --grep "tenant-host login"
```

## Ops-CLI

Die nicht-interaktive CLI liegt unter [scripts/ops/instance-registry.ts](../../scripts/ops/instance-registry.ts).

Der Entrypoint bleibt bewusst stabil, die interne Struktur ist aber inzwischen entlang von Command-Modulen, Formatierung und gemeinsamem Kontext geschnitten. Lokale Automatisierung und Tests sollen deshalb weiterhin nur den CLI-Einstieg aufrufen und keine internen Hilfsmodule direkt referenzieren.

Beispiele:

```bash
pnpm exec tsx scripts/ops/instance-registry.ts list --json
pnpm exec tsx scripts/ops/instance-registry.ts create \
  --instance-id demo \
  --display-name "Demo" \
  --parent-domain studio.localhost \
  --auth-realm demo \
  --auth-client-id sva-studio \
  --actor-id local-admin
pnpm exec tsx scripts/ops/instance-registry.ts activate \
  --instance-id demo \
  --actor-id local-admin
```

## Erwartetes Fail-closed-Verhalten

- unbekannte Hosts
- mehrstufige Subdomains
- `suspended` und `archived`

Alle drei Fälle sollen ohne tenant-spezifische Detailoffenlegung abgelehnt werden.
