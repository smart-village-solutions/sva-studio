# Public-Waste-Web-Release-Runbook

Dieses Runbook beschreibt den isolierten Releasepfad für die öffentliche
Webversion des Abfallkalenders. Es gilt nur für
`apps/public-waste-calendar-web` und darf den normalen Studio-Stack nicht
mitverändern.

## Zielbild

- eigenes Image: `ghcr.io/smart-village-solutions/public-waste-calendar-web`
- eigener Stack: `web-waste-calendar`
- eigene Compose-Datei: `deploy/portainer/docker-compose.public-waste.yml`
- eigener Workflow: `.github/workflows/public-waste-web-release.yml`
- eigener Trigger: Git-Tag `waste-web-vX.Y.Z`

## Führende Laufzeitvariablen in Portainer

Diese Variablen werden im Portainer-Stack gepflegt:

- `PUBLIC_WASTE_IMAGE_TAG`
- `PUBLIC_WASTE_PUBLIC_HOST`
- `PUBLIC_WASTE_BASE_URL`
- `PUBLIC_WASTE_INSTANCE_ID`
- `PUBLIC_WASTE_DATABASE_URL`
- `PUBLIC_WASTE_SCHEMA_NAME`

`PUBLIC_WASTE_CONFIG_JSON` ist kein produktionsführender Vertrag mehr. Der
Wert darf nur für lokale Entwicklung oder Legacy-Kompatibilität bestehen
bleiben.

## Voraussetzungen in GitHub

Für den Releaseworkflow werden mindestens diese GitHub-Konfigurationen
benötigt:

- Secret `QUANTUM_API_KEY`
- Variable `QUANTUM_HOST`
- Variable `QUANTUM_ENDPOINT_ID`
- Variable `PUBLIC_WASTE_STACK_NAME`
- Variable `PUBLIC_WASTE_BASE_URL`

Empfohlener Wert für `PUBLIC_WASTE_STACK_NAME`:

- `web-waste-calendar`

## Normaler Releasepfad

1. Änderungen für `public-waste-calendar-web` auf `main` bringen.
2. SemVer-Tag erzeugen, zum Beispiel `waste-web-v1.2.3`.
3. Tag pushen.
4. GitHub baut und publiziert das Image `ghcr.io/smart-village-solutions/public-waste-calendar-web:v1.2.3`.
5. Der Workflow aktualisiert in Portainer nur `PUBLIC_WASTE_IMAGE_TAG=v1.2.3`.
6. Der Stack `web-waste-calendar` wird neu ausgerollt.
7. Smoke-Checks gegen `/health/live`, `/` und `/api/public-waste/selection` bestätigen den Rollout.

Beispiel:

```bash
git tag waste-web-v1.2.3
git push origin waste-web-v1.2.3
```

## Lokale Vorab-Prüfungen

Vor Änderungen am Releasepfad oder bei Betriebsanpassungen sind mindestens
diese Checks sinnvoll:

```bash
pnpm exec vitest run scripts/ops/public-waste/portainer-release.test.ts
pnpm exec tsc -p tsconfig.scripts.json --noEmit
pnpm nx run public-waste-calendar-web:build
docker compose --env-file config/runtime/public-waste.vars.example -f deploy/portainer/docker-compose.public-waste.yml config
docker build -f deploy/portainer/Dockerfile.public-waste -t public-waste-calendar-web:dev .
```

## Rollback

Rollback folgt bewusst demselben einfachen Tag-Modell:

1. Den vorherigen funktionierenden SemVer-Tag bestimmen.
2. `PUBLIC_WASTE_IMAGE_TAG` im Portainer-Stack auf diesen Tag zurücksetzen.
3. Den Stack erneut deployen.
4. Smoke-Checks erneut ausführen.

Beispiel:

- fehlerhafte Version: `v1.2.3`
- Rollback-Ziel: `v1.2.2`

Dann in Portainer:

- `PUBLIC_WASTE_IMAGE_TAG=v1.2.2`

## Betriebsgrenzen

- Der Waste-Web-Workflow darf weder `SVA_IMAGE_TAG` noch `SVA_IMAGE_REF` oder `SVA_IMAGE_DIGEST` verändern.
- Der Stack `web-waste-calendar` darf nicht aus dem Studio-Stack abgeleitet werden.
- Änderungen an diesem Pfad betreffen nur die öffentliche Abfallkalender-Webversion, nicht das normale Studio.

## Referenzen

- `../../deploy/portainer/docker-compose.public-waste.yml`
- `../../deploy/portainer/Dockerfile.public-waste`
- `../../config/runtime/public-waste.vars.example`
- `../../scripts/ops/public-waste/portainer-release.ts`
- `../../.github/workflows/public-waste-web-release.yml`
