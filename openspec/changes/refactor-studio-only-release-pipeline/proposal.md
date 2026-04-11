# Change: Studio-only Release-Pipeline mit Build-Verify-Deploy-Trennung

## Why
Der bisherige produktionsnahe Delivery-Pfad ist zwischen lokalem Operator-Verhalten, ad-hoc Rollout-Debugging und umgebungsspezifischen Workflows verteilt. Das macht Studio-Rollouts schwer reproduzierbar und vermischt Build-, Artefakt- und Deploy-Fehlerbilder.

## What Changes
- `studio` wird der einzige offizielle produktionsnahe Remote-Release-Pfad.
- Die Pipeline wird in getrennte Stufen für Image-Build, Runner-basiertes Artefakt-Verify und CI-gesteuerten Studio-Deploy aufgeteilt.
- Mutierende `studio`-Operationen werden auf den CI-/Runner-Kontext festgezogen; lokale produktionsnahe Mutationen sind kein Standardweg mehr.
- Dokumentation und Runbooks werden auf einen digest-basierten `studio`-Releasevertrag ausgerichtet.

## Impact
- Affected specs: `deployment-topology`
- Affected code: `.github/workflows/*studio*.yml`, `scripts/ci/verify-studio-image.sh`, `scripts/ops/runtime-env.shared.ts`, `scripts/ops/runtime-env.ts`, `package.json`
- Affected arc42 sections: `06-runtime-view`, `07-deployment-view`, `08-cross-cutting-concepts`, `10-quality-requirements`
