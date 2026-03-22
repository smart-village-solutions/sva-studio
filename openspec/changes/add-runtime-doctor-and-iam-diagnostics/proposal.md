# Change: Runtime-Doctor und IAM-Diagnostik standardisieren

## Why

Die bisherigen Betriebs- und Debuggingpfade liefern zu oft nur Symptome wie `500 internal_error`, `403 forbidden` oder `503`, ohne die fachliche Ursache deterministisch offenzulegen. Das führt insbesondere in `acceptance-hb` zu manueller Browser-, `psql`- und Log-Fehlersuche.

## What Changes

- ergänzt ein offizielles `env:doctor:<profil>`-Interface für alle Runtime-Profile
- standardisiert nicht-sensitive Diagnosefelder (`reason_code`, `dependency`, `schema_object`, `expected_migration`, `actor_resolution`, `instance_id`) für IAM-Hotspots und `/health/ready`
- verankert einen kritischen IAM-Schema-Guard in `doctor`, `smoke` und `migrate`
- nutzt OTEL systematisch für korrelierbare Diagnoseattribute und Diagnose-Events
- dokumentiert den Diagnose- und Acceptance-Betriebsweg im Runbook und in der Architekturdoku

## Impact

- Affected specs: `monorepo-structure`, `iam-core`, `monitoring-client`, `architecture-documentation`
- Affected code: `scripts/ops/runtime-env.ts`, `packages/auth`, `packages/sdk`
- Affected docs: `docs/development/runtime-profile-betrieb.md`, `docs/guides/swarm-deployment-runbook.md`, `docs/architecture/08-cross-cutting-concepts.md`
