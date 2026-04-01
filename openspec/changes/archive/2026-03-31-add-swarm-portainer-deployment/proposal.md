# Change: Swarm-/Traefik-Deployment für SVA Studio

## Why

Der aktuelle Portainer-Stack ist auf ein einfaches Compose-/Einzelhost-Deployment ausgelegt. Die vorhandene Server-Infrastruktur nutzt aber Docker Swarm, Traefik und externe Runtime-Konfigurationen, sodass der aktuelle Stack dort nur eingeschränkt passt.

Zusätzlich steht die Frage im Raum, ob verschiedene Instanzen unter Hostnamen wie `instanceid.studio.smart-village.app` erreichbar sein sollen. Dafür muss sauber zwischen reinem Ingress-Routing und echter hostabhängiger Applikationslogik unterschieden werden.

## What Changes

- Portainer-Deployment von Compose-/Port-Mapping auf Swarm-/Traefik-Muster umstellen
- Build-via-Portainer durch Registry-/Image-basiertes Deployment ersetzen
- Secrets/Configs für Swarm verbindlich klassifizieren und statt betrieblicher Bind-Mounts über externe Swarm-Ressourcen betreiben
- Betriebsdokumentation für Swarm-Rollout, Rollback, Restore, Secret-Bootstrap und Validierung aktualisieren
- Mehrere App-Hosts unter einer festen Parent-Domain zulassen und das Modell `subdomain == instanceId` normativ schärfen
- Die Env-Allowlist als aktuell autoritative Source of Truth für gültige `instanceId`s festlegen
- Das fail-closed-Verhalten für unbekannte, ungültige oder nicht kanonische Hosts spezifizieren
- Einen kanonischen Auth-Host festlegen und Multi-Host-OIDC-/Logout-Redirects für Instanz-Hosts als benötigte Folgelogik explizit abgrenzen
- Einen minimal belastbaren Betriebsvertrag für Persistenz, Migration, Rollback und Stateful-Placement im Swarm-Profil festhalten
- **Keine** vollständige Implementierung dynamischer Multi-Host-OIDC-Redirects in diesem Change

## Scope-Eingrenzung: Development-Phase

Dieser Change entsteht in der Development-Phase mit frischen Instanzen. Folgende Betriebsthemen sind daher bewusst **nicht** Teil dieses Changes und werden als separate Folgearbeit geplant, sobald ein produktiver Betrieb ansteht:

- Produktive Rollback-Verfahren mit zeitlichem Fenster und Schritt-für-Schritt-Prozedur
- RTO/RPO-Ziele und formalisierte Restore-Prozeduren für Postgres/Redis
- Monitoring-/Alerting-Integration für das Swarm-Profil (externer Healthcheck, OTEL, Loki)
- Overlay-Netzwerk-Verschlüsselung (`--opt encrypted`) für Data-Plane-Traffic
- Healthcheck-Feintuning für Swarm-Scheduling (`start_period`, `update_config`, `rollback_config`)
- Exit-Plan / Plattformmigrations-Mapping (Swarm → K8s/andere)
- Traefik-Access-Log-PII-Behandlung (IP-Anonymisierung, Retention)
- Automatisierte Smoke-Test-Skripte

## Impact

- Affected specs: `architecture-documentation`, `deployment-topology`
- Affected code: `deploy/portainer/*`, `docs/guides/portainer-deployment-ohne-monitoring.md`, `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/07-deployment-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/09-architecture-decisions.md`, `docs/architecture/10-quality-requirements.md`, `docs/architecture/11-risks-and-technical-debt.md`, `docs/architecture/12-glossary.md`, `docs/adr/*`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `07-deployment-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`, `12-glossary`
