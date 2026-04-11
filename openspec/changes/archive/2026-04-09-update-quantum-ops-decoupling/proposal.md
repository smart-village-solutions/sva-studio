# Change: Quantum-CLI im Betriebsvertrag entkoppeln und auf Mutationen begrenzen

## Why

Der aktuelle Remote-Betrieb haengt an einer lokalen `quantum-cli`-Kette, die selbst ein wiederkehrender Fehlerkanal ist. Veraltete lokale Auth-Kontexte, Websocket-/`exec`-Flakes und implizite Env-Overlays blockieren oder verfälschen Diagnostik, obwohl App und Stack fachlich gesund sein koennen.

## What Changes

- trennt read-only Remote-Diagnostik von mutierenden Rollout-Pfaden
- verlagert Stack-/Service-/Netzwerk-Inspection auf stabile API- oder MCP-basierte Kanaele statt auf die lokale `quantum-cli`
- stuft `quantum-cli exec` fuer `doctor` und `precheck` auf einen expliziten Fallback herab
- begrenzt `quantum-cli` im Regelbetrieb auf mutierende Aktionen wie `stacks update`; dedizierte `migrate`-/`bootstrap`-Jobs aus `update-studio-swarm-migration-job` bleiben davon unberuehrt
- definiert einen deterministischen Operator-Pfad fuer Mutationen ueber CI oder einen festen Runner-Kontext statt ueber beliebige lokale Shells
- baut auf der Job-Mechanik aus `update-studio-swarm-migration-job` auf und aendert nicht erneut den Migrations- oder Bootstrap-Vertrag

## Impact

- Affected specs: `deployment-topology`
- Affected code:
  - `scripts/ops/runtime-env.ts`
  - `scripts/ops/runtime/process.ts`
  - `scripts/ops/runtime/remote-service-spec.ts`
  - `.github/workflows/acceptance-deploy.yml`
  - Dokumentation unter `docs/development/` und `docs/guides/`
- Affected arc42 sections:
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
