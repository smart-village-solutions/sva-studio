# Change: Rollout- und Tenant-Auth um Observability-Gates erweitern

## Why
Die bisherigen Studio-Rollouts koennen technisch gruen sein, obwohl Tenant-Auth, Logger-Transport oder Keycloak-Secret-Alignment weiterhin kaputt sind. Fehler lassen sich dann erst durch Live-Debugging und manuelle Loki-/Keycloak-Analyse eingrenzen.

## What Changes
- fuehrt fuer das Runtime-Profil `studio` harte Observability- und Tenant-Auth-Gates im Doctor-/Precheck-Pfad ein
- definiert einen expliziten Logger-Betriebsvertrag mit `console_to_loki`, `otel_to_loki` und `degraded`
- ergaenzt strukturierte Tenant-Auth-, Callback- und Keycloak-Status-Logs mit stabilen Diagnosefeldern
- erweitert den Keycloak-Status um Secret-Alignment zwischen Registry, Runtime und Keycloak
- dokumentiert den Diagnosepfad ueber Loki/Grafana und den lokalen Env-Overlay unter `~/.config/quantum/env`

## Impact
- Affected specs: `deployment-topology`, `iam-core`
- Affected code: `packages/sdk/src/logger/*`, `packages/sdk/src/server/bootstrap.server.ts`, `packages/auth/src/config.ts`, `packages/auth/src/routes/handlers.ts`, `packages/auth/src/iam-instance-registry/*`, `scripts/ops/runtime-env.ts`
- Affected arc42 sections: `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-scenarios`
