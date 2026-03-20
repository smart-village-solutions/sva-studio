# Change: Acceptance-Deployflow für `acceptance-hb` härten

## Why

Der bestehende Acceptance-Betrieb verteilt Deploy, Migration, Diagnose und Evidenz auf mehrere lose Kommandos und manuelle Handgriffe. Dadurch entstehen vermeidbare Fehler bei Schemaänderungen, unklare Rollout-Zustände und fehlende belastbare Deploy-Logs.

## What Changes

- ergänzt einen kanonischen Acceptance-Releasepfad mit `precheck` und `deploy`
- führt Release-Klassen `app-only` und `schema-and-app` für `acceptance-hb` ein
- erzwingt den orchestrierten Serverdeploypfad statt direkter Acceptance-`up`/`update`-Rollouts
- schreibt pro Acceptance-Deploy standardisierte JSON-/Markdown-Evidenz unter `artifacts/runtime/deployments/`
- ergänzt einen manuellen GitHub-Workflow für Acceptance-Deploys
- synchronisiert Runbooks und arc42-Dokumentation auf den neuen Betriebsvertrag

## Impact

- Affected specs: `monorepo-structure`, `architecture-documentation`
- Affected code: `scripts/ops/runtime-env.ts`, `scripts/ops/runtime-env.shared.ts`, `package.json`, `.github/workflows/acceptance-deploy.yml`
- Affected arc42 sections: `07-deployment-view`, `08-cross-cutting-concepts`
