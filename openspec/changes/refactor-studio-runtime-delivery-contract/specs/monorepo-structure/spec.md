## ADDED Requirements

### Requirement: Final-Artifact-Verify als offizieller App-Target

Das System SHALL fuer `apps/sva-studio-react` einen dedizierten Nx-Target bereitstellen, der den finalen Runtime-Vertrag gegen den gebauten `.output/server/**`-Output prueft.

#### Scenario: App-Target prueft finalen Node-Output

- **WHEN** `pnpm nx run sva-studio-react:verify:runtime-artifact` ausgefuehrt wird
- **THEN** baut das Target zuerst die App
- **AND** startet danach den finalen Node-Output aus `.output/server/index.mjs`
- **AND** klassifiziert Fehler mindestens als `artifact-contract-failed`, `dependency-failed`, `runtime-start-failed` oder `http-dispatch-failed`

#### Scenario: Root-Skript delegiert an denselben Verify-Target

- **WHEN** das Root-`package.json` geprueft wird
- **THEN** existiert ein Skript `verify:runtime-artifact`
- **AND** dieses delegiert an `pnpm nx run sva-studio-react:verify:runtime-artifact`

### Requirement: Toolchain-Drift wird vor dem Runtime-Verify fail-fast erkannt

Das System SHALL vor dem produktionsnahen Runtime-Verify pruefen, ob lokale Toolchain und Lockfile denselben Abhaengigkeitsgraphen verwenden.

#### Scenario: Toolchain-Check stoppt bei veraltetem `node_modules`

- **WHEN** `pnpm check:toolchain-consistency` oder `pnpm nx run sva-studio-react:build` ausgefuehrt wird
- **AND** installierte Build-Tooling-Pakete von `pnpm-lock.yaml` abweichen
- **THEN** bricht der Check vor dem eigentlichen App-Build mit einer klaren Aufforderung zu `pnpm install --frozen-lockfile` ab
