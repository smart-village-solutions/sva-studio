# Change: Runtime-Release und IAM-Diagnostik robuster machen

## Why

Der Studio-Releasepfad ist bereits gehärtet, aber Runtime-Artefakt-, Image-Verify- und Live-Precheck-Evidenz sind noch nicht als gemeinsamer Vertrag durchgängig sichtbar. Gleichzeitig existiert der IAM-Diagnosekern bereits, deckt aber noch nicht alle im Analysebericht dokumentierten Auth-, OIDC-, Frontend- und Legacy-/Fallback-Klassen ab.

## What Changes

- Verbindlichen Runtime-Releasevertrag für finalen `.output/server/**`-Output, Image-Verify-Evidenz und lokalen `studio`-Precheck präzisieren.
- IAM-Diagnoseklassifikationen additiv um Auth-, OIDC-, Frontend-State- und Legacy-/Workaround-Fälle erweitern.
- Self-Service-, Admin- und Ops-Sichten auf denselben sicheren Diagnosekern ausrichten.
- Architektur- und Qualitätsdokumentation synchron aktualisieren.

## Impact

- Affected specs: `deployment-topology`, `account-ui`, `iam-core`, `instance-provisioning`
- Affected code: `packages/core/src/iam/**`, `apps/sva-studio-react/src/components/iam-runtime-diagnostic-details.tsx`, `apps/sva-studio-react/src/i18n/resources.ts`, `scripts/ops/runtime-env.ts`, `scripts/ops/studio-release-local.ts`, `package.json`
- Affected arc42 sections: `06-runtime-view`, `07-deployment-view`, `08-cross-cutting-concepts`, `10-quality-requirements`, `11-risks-and-technical-debt`
