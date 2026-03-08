# Change: App-/Service-E2E-Integrationstest standardisieren

## Why
Aktuell existiert kein dediziertes, reproduzierbares App-E2E-Target für die laufende Anwendung gegen den lokalen Docker-Stack. Dadurch ist die Integrationsvalidierung für Reviews aufwendig und inkonsistent.

## What Changes
- Einführung eines standardisierten Nx-E2E-Targets für die App mit Browser-basiertem Smoke-Flow.
- Verbindliche Vorbedingungen für den laufenden Docker-Service-Stack (Redis, Loki, OTEL, Promtail).
- Dokumentation eines reproduzierbaren lokalen und CI-fähigen Ablaufs für App-Start + E2E.

## Impact
- Affected specs: `app-e2e-integration-testing`
- Affected code: `apps/sva-studio-react`, Nx-Targets/Workspace-Konfiguration, `docs/development/`
