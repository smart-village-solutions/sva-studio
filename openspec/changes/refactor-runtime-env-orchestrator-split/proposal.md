# Change: Runtime-Orchestrator in dedizierte Module aufteilen

## Why

`scripts/ops/runtime-env.ts` bündelt CLI-Dispatch, Diagnose-Orchestrierung, Deploy-Phasen, Smoke-Retrys und Remote-Verification in einer einzelnen Datei. Das erschwert Tests, erhöht die Komplexität und macht Änderungen am Releasepfad unnötig riskant.

## What Changes

- Teile den Runtime-Orchestrator intern in dedizierte Module für Doctor, Acceptance-Deploy, Smoke/Warmup, Remote-Verification und Command-Dispatch.
- Halte CLI-Syntax, Exit-Codes, JSON-Ausgabe und die bestehenden Export-Fassaden aus `scripts/ops/runtime-env.ts` stabil.
- Ergänze gezielte Modultests für Orchestrierung, Retry-Logik und Remote-Verification-Helfer.

## Impact

- Affected specs: `monorepo-structure`
- Affected code: `scripts/ops/runtime-env.ts`, `scripts/ops/runtime/*.ts`, `scripts/ops/runtime-env*.test.ts`
- Affected arc42 sections: keine verpflichtende Aktualisierung, solange der externe Deploy-/Diagnosepfad unverändert bleibt
