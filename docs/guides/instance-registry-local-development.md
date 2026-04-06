# Lokale Entwicklung mit Instanz-Registry

## Ziel

Diese Anleitung beschreibt den lokalen Standardpfad und den registry-nahen Multi-Tenant-Pfad für die neue Instanz-Registry.

## Unterstützte Hosts

- Root-Host: `studio.lvh.me`
- Tenant-Hosts: `<instanceId>.studio.lvh.me`

`lvh.me` zeigt lokal auf `127.0.0.1` und erlaubt damit reproduzierbare Host-Tests ohne eigene `/etc/hosts`-Einträge.

## Voraussetzungen

- `IAM_DATABASE_URL` zeigt auf die lokale IAM-Postgres-Datenbank
- Migration `0025_iam_instance_registry_provisioning.sql` ist ausgerollt
- lokale Seeds enthalten mindestens zwei aktive Instanzen und einen negativen Fall
- für Browser- oder Playwright-Tests ist `SVA_PARENT_DOMAIN=studio.lvh.me` gesetzt
- die Dev- oder Playwright-Instanz erlaubt `studio.lvh.me` und `*.studio.lvh.me` als lokale Hosts
- im Standardprofil `local-keycloak` ist `svs-intern-studio-staging` der globale Keycloak-Realm und `de-musterhausen` die fachliche Test-Instanz

## Schneller Standardpfad

1. IAM-Migrationen ausführen.
2. lokale Seeds laden
3. App auf dem Root-Host starten
4. `http://studio.lvh.me:3000` öffnen
5. Tenant-Kontexte über `http://<instanceId>.studio.lvh.me:3000` prüfen

Empfohlene Seed-Instanzen:

- `de-musterhausen`
- `hb`
- `demo`
- negativer Fall über unbekannten Host, zum Beispiel `blocked.studio.lvh.me`

Verifikation:

```bash
curl -i http://studio.lvh.me:3000/
curl -i http://hb.studio.lvh.me:3000/
curl -i http://blocked.studio.lvh.me:3000/auth/me
```

## Registry-naher Multi-Tenant-Pfad

1. Root-Host unter `studio.lvh.me` verwenden
2. Instanzen über `/admin/instances` oder die Ops-CLI anlegen
3. nach erfolgreicher Anlage Tenant-Host direkt öffnen
4. unbekannte oder suspendierte Hosts auf identisches fail-closed-Verhalten prüfen

Hinweis zum lokalen Realm-Modell:

- Für `local-keycloak` wird lokal nicht pro Instanz ein eigener Realm erwartet.
- Neue lokale Test-Instanzen dürfen deshalb auf denselben globalen Test-Realm `svs-intern-studio-staging` zeigen, solange User und Rollen dort sauber mit `instanceId`-Attributen getrennt werden.

Verifikation:

```bash
pnpm exec tsx scripts/ops/instance-registry.ts create \
  --instance-id demo2 \
  --display-name "Demo 2" \
  --parent-domain studio.lvh.me \
  --auth-realm svs-intern-studio-staging \
  --auth-client-id sva-studio \
  --actor-id local-admin
pnpm exec tsx scripts/ops/instance-registry.ts activate \
  --instance-id demo2 \
  --actor-id local-admin
curl -i http://demo2.studio.lvh.me:3000/
```

Für Playwright ist der offizielle Multi-Tenant-Pfad:

```bash
PLAYWRIGHT_BASE_URL=http://studio.lvh.me:4173 \
PLAYWRIGHT_TENANT_LOGIN_URL=http://hb.studio.lvh.me:4173/auth/login?returnTo=%2Fadmin%2Finstances \
pnpm nx run sva-studio-react:test:e2e -- --grep "tenant-host login"
```

## Ops-CLI

Die nicht-interaktive CLI liegt unter [scripts/ops/instance-registry.ts](../../scripts/ops/instance-registry.ts).

Beispiele:

```bash
pnpm exec tsx scripts/ops/instance-registry.ts list --json
pnpm exec tsx scripts/ops/instance-registry.ts create \
  --instance-id demo \
  --display-name "Demo" \
  --parent-domain studio.lvh.me \
  --auth-realm svs-intern-studio-staging \
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
