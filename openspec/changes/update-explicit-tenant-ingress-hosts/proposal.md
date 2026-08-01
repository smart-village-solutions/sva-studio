# Change: Explizite Tenant-Hosts im Studio-Ingress freigeben

## Why

Die Registry kann aktive Tenant-Instanzen führen, während die aktuellen Traefik-Regeln in Dev und Staging nur den jeweiligen Root-Host erreichen. Dadurch ist beispielsweise der aktive Staging-Tenant `de-studio-sandbox` trotz korrekter Registry- und IAM-Konfiguration extern nicht erreichbar. Eine vollständig dynamische Wildcard-TLS-Lösung würde Änderungen am gemeinsam betriebenen Traefik, DNS-01-Zugang zu AutoDNS und zusätzliche Infrastruktur-Ownership erfordern, die aktuell nicht geklärt sind.

## What Changes

- Dev routet neben dem Root-Host genau `de-teststadt-dev.studio-dev.smart-village.app`.
- Staging routet neben dem Root-Host genau `de-studio-sandbox.studio-staging.smart-village.app`.
- Production routet neben dem Root-Host die 63 bestätigten Tenant-Hosts aus dem Design und dem normativen Spec-Delta.
- Traefik verwendet weiterhin den vorhandenen Certificate Resolver und stellt Einzelzertifikate für die expliziten `Host(...)`-Regeln aus.
- Neue oder geänderte Production-Tenant-Hosts werden ausschließlich über eine versionierte Compose-Änderung und den kanonischen Promote-Prozess freigegeben.
- Externe Smokes und der Instanz-Audit prüfen die pro Umgebung explizit freigegebenen Hosts.
- Wildcard-Zertifikate, DNS-01, AutoDNS-Credentials und dynamische Traefik-Mutationen durch die Tenant-Erstellung bleiben außerhalb dieses Changes.

## Impact

- Affected specs: `deployment-topology`
- Affected code: `deploy/compose.dev.yaml`, `deploy/compose.staging.yaml`, `deploy/compose.prod.yaml`, zugehörige Deploy-/Acceptance-Tests und Smoke-Konfiguration
- Affected documentation: `docs/guides/studio-rollout-process.md`, `docs/guides/swarm-deployment-runbook.md`
- Affected arc42 sections: `docs/architecture/06-runtime-view.md`, `docs/architecture/07-deployment-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/11-risks-and-technical-debt.md`
- Operations: Jeder weitere Production-Tenant benötigt bis zu einer späteren Wildcard-TLS-Lösung einen regulären Konfigurations-Rollout.
