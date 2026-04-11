# Change: Finalen Runtime- und Release-Vertrag fuer `studio` verankern

## Why

Der fragilste Teil des Systems liegt aktuell nicht in der Facharchitektur, sondern im Uebergang zwischen `src/server.ts`, Build-Artefakt, Container-Start und `studio`-Rollout. Bisher konnten Intermediate-SSR-Artefakte, Runtime-Patches im Entrypoint und unzureichend getrennte Verify-Schritte zu falschen Gruen-Signalen oder schwer diagnostizierbaren Fehlern fuehren.

## What Changes

- fuehrt einen expliziten Final-Artifact-Check `sva-studio-react:verify:runtime-artifact` fuer `.output/server/**` ein
- fuehrt einen deterministischen Build-time-Patch des finalen Runtime-Artefakts ein, der den funktionierenden TanStack-Server-Entry in das finale `.output/server/**` ueberfuehrt, statt ihn erst im Container zur Laufzeit umzuschreiben
- fuehrt einen fail-fast-Toolchain-Check ein, der Drift zwischen `.nvmrc`, `packageManager`, `pnpm-lock.yaml` und installiertem `node_modules` vor Build und Runtime-Verify stoppt
- verankert `apps/sva-studio-react/src/server.ts` als offiziellen Server-Entry ueber die TanStack-Start-Server-Entry-Integration
- haertet den `Studio Image Build`-Workflow so, dass der finale Node-Output vor dem Docker-Build validiert wird
- erweitert das runner-basierte `studio`-Image-Verify um Schema-Migrationen, Keycloak-Admin-Mock und phasenklassifizierte Fehlerdiagnostik
- stuft den Entrypoint-Patch zu einem expliziten Legacy-Recovery-Mechanismus mit Flag `SVA_ENABLE_RUNTIME_RECOVERY_PATCH=1` herab
- aktualisiert arc42- und Betriebsdoku auf den neuen Vertrag "finales `.output/server/**` ist die Release-Wahrheit"

## Impact

- Affected specs: `deployment-topology`, `monorepo-structure`, `architecture-documentation`
- Affected code:
  - `apps/sva-studio-react/src/server.ts`
  - `apps/sva-studio-react/vite.config.ts`
  - `apps/sva-studio-react/project.json`
  - `scripts/ci/verify-runtime-artifact.sh`
  - `scripts/ci/verify-studio-image.sh`
  - `.github/workflows/studio-image-build.yml`
  - `.github/workflows/studio-artifact-verify.yml`
  - `deploy/portainer/entrypoint.sh`
- Affected arc42 sections: `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts`, `11-risks-and-technical-debt`
