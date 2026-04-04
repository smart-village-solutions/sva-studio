# Change: Studio-Rollout-Vertrag für frühe Testphase härten

## Why

Der bisherige Studio-Rollout ist operativ fragil: Profile fallen still auf unpassende Defaults zurück, wichtige Laufzeitwerte sind nicht klar zwischen Pflicht, Ableitung und Secret getrennt, und Fehlschläge liefern zu wenig belastbare Diagnostik. Für die frühe Entwicklungs- und Testphase wird ein kleiner, pragmatischer, aber verbindlicher Rollout-Vertrag benötigt.

## What Changes

- definiert einen kanonischen Rollout-Pfad für `studio` über `env:precheck`, `env:deploy`, `env:smoke` und `env:migrate`
- härtet den Runtime-Contract für `studio`, inklusive ableitbarer Verbindungswerte statt fragiler Pflicht-URLs
- erweitert Drift-, Hostname-, Image- und Tenant-Diagnostik mit stabilen Fehlercodes und klaren Reports
- dokumentiert einen pragmatischen Migrations- und Rollback-Pfad für die frühe Testphase
- schreibt die Stack-Grenze und den Notfallpfad für `studio` deutlicher fest

## Impact

- Affected specs: `deployment-topology`
- Affected code:
  - `packages/sdk/src/runtime-profile.ts`
  - `scripts/ops/runtime-env.ts`
  - `scripts/ops/runtime-env.shared.ts`
  - `deploy/portainer/docker-compose.studio.yml`
  - `packages/data/src/instance-registry/server.ts`
  - `packages/sdk/tests/runtime-profile.test.ts`
  - Dokumentation unter `docs/development/` und `.github/agents/`
- Affected arc42 sections:
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
